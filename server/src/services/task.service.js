/**
 * @fileoverview Task Service — Core business logic & Redis cache orchestrator.
 * Implements Cache-Aside pattern: read-through on GETs, invalidate on mutations.
 * All cache interactions and business-rule failures (NotFoundError) live here.
 */

import * as taskRepo from '#repositories/task.repo.js';
import { getRedisClient } from '#config/redis.js';
import { logger } from '#config/logger.js';
import { NotFoundError } from '#lib/errors.js';

// ── Cache Key Conventions ───────────────────────────────────────────
const CACHE_KEYS = {
    single: (id) => `task:${id}`,
    list: 'tasks:all',
};

const CACHE_TTL = 3600; // seconds

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Safely interact with Redis — never let a cache failure crash a request.
 * If Redis is down, the app degrades to DB-only mode.
 */
const safeRedisGet = async (key) => {
    try {
        const redis = getRedisClient();
        return await redis.get(key);
    } catch (err) {
        logger.warn({ err, key }, 'Redis GET failed — falling back to DB');
        return null;
    }
};

const safeRedisSet = async (key, value, ttl = CACHE_TTL) => {
    try {
        const redis = getRedisClient();
        await redis.set(key, JSON.stringify(value), { EX: ttl });
        logger.info({ key, ttl }, 'Cache SET');
    } catch (err) {
        logger.warn({ err, key }, 'Redis SET failed — skipping cache write');
    }
};

const safeRedisDel = async (...keys) => {
    try {
        const redis = getRedisClient();
        await redis.del(keys);
        logger.info({ keys }, 'Cache DEL (invalidated)');
    } catch (err) {
        logger.warn({ err, keys }, 'Redis DEL failed — stale cache possible');
    }
};

// ── Service Methods ─────────────────────────────────────────────────

/**
 * Retrieve all tasks (cache-aside on `tasks:all`).
 */
export const getAllTasks = async () => {
    const cached = await safeRedisGet(CACHE_KEYS.list);

    if (cached) {
        logger.info('Cache HIT — tasks:all');
        return JSON.parse(cached);
    }

    logger.info('Cache MISS — tasks:all → querying DB');
    const tasks = await taskRepo.findAll();

    await safeRedisSet(CACHE_KEYS.list, tasks);
    return tasks;
};

/**
 * Retrieve a single task by ID (cache-aside on `task:{id}`).
 * @throws {NotFoundError}
 */
export const getTaskById = async (id) => {
    const cacheKey = CACHE_KEYS.single(id);
    const cached = await safeRedisGet(cacheKey);

    if (cached) {
        logger.info({ id }, 'Cache HIT — task:%s', id);
        return JSON.parse(cached);
    }

    logger.info({ id }, 'Cache MISS — task:%s → querying DB', id);
    const task = await taskRepo.findById(id);

    if (!task) throw new NotFoundError(`Task with id "${id}" not found`);

    await safeRedisSet(cacheKey, task);
    return task;
};

/**
 * Create a new task, then invalidate the list cache.
 */
export const createTask = async ({ title, description, status }) => {
    const task = await taskRepo.create(title, description, status);

    // Invalidate list cache so next GET /tasks reflects the new item
    await safeRedisDel(CACHE_KEYS.list);

    return task;
};

/**
 * Update an existing task, then invalidate both caches.
 * @throws {NotFoundError}
 */
export const updateTask = async (id, fields) => {
    const updated = await taskRepo.update(id, fields);

    if (!updated) throw new NotFoundError(`Task with id "${id}" not found`);

    // Invalidate specific + list caches
    await safeRedisDel(CACHE_KEYS.single(id), CACHE_KEYS.list);

    return updated;
};

/**
 * Delete a task, then evict both caches.
 * @throws {NotFoundError}
 */
export const deleteTask = async (id) => {
    const deleted = await taskRepo.remove(id);

    if (!deleted) throw new NotFoundError(`Task with id "${id}" not found`);

    await safeRedisDel(CACHE_KEYS.single(id), CACHE_KEYS.list);
};
