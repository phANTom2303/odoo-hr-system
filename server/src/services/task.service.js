/**
 * @fileoverview Task Service — Core business logic layer.
 */

import * as taskRepo from '#repositories/task.repo.js';
import { logger } from '#config/logger.js';
import { NotFoundError } from '#lib/errors.js';

// ── Service Methods ─────────────────────────────────────────────────

/**
 * Retrieve all tasks.
 */
export const getAllTasks = async () => {
    logger.info('Fetching all tasks from DB');
    return taskRepo.findAll();
};

/**
 * Retrieve a single task by ID.
 * @throws {NotFoundError}
 */
export const getTaskById = async (id) => {
    const task = await taskRepo.findById(id);
    if (!task) throw new NotFoundError(`Task with id "${id}" not found`);
    return task;
};

/**
 * Create a new task.
 */
export const createTask = async ({ title, description, status }) => {
    return taskRepo.create(title, description, status);
};

/**
 * Update an existing task.
 * @throws {NotFoundError}
 */
export const updateTask = async (id, fields) => {
    const updated = await taskRepo.update(id, fields);
    if (!updated) throw new NotFoundError(`Task with id "${id}" not found`);
    return updated;
};

/**
 * Delete a task.
 * @throws {NotFoundError}
 */
export const deleteTask = async (id) => {
    const deleted = await taskRepo.remove(id);
    if (!deleted) throw new NotFoundError(`Task with id "${id}" not found`);
};
