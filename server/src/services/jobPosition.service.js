/**
 * @fileoverview Job Position Service — Core business logic layer.
 *
 * Business rules enforced here (from business-logic.md §2):
 *  - title must be unique (case-insensitive)
 *  - department_id, if provided, must reference an existing department
 *  - Cannot delete a job position referenced by active users or contracts → 409 Conflict
 */

import * as jobPositionRepo from '#repositories/jobPosition.repo.js';
import * as departmentRepo from '#repositories/department.repo.js';
import { logger } from '#config/logger.js';
import { NotFoundError, ConflictError, BadRequestError } from '#lib/errors.js';

// ── Internal Helpers ────────────────────────────────────────────────

/**
 * Validate that a department_id actually exists, if provided.
 * @param {string|null} departmentId
 * @throws {BadRequestError}
 */
const validateDepartment = async (departmentId) => {
    if (!departmentId) return;
    const dept = await departmentRepo.findById(departmentId);
    if (!dept) {
        throw new BadRequestError(`Department with id "${departmentId}" does not exist`);
    }
};

// ── Service Methods ─────────────────────────────────────────────────

/**
 * Retrieve all job positions.
 * Each row includes department_name from the JOIN.
 * @returns {Promise<object[]>}
 */
export const getAll = async () => {
    logger.info('Fetching all job positions from DB');
    return jobPositionRepo.findAll();
};

/**
 * Retrieve a single job position by ID (includes department_name).
 * @param {string} id
 * @throws {NotFoundError}
 * @returns {Promise<object>}
 */
export const getById = async (id) => {
    const row = await jobPositionRepo.findById(id);
    if (!row) throw new NotFoundError(`Job position with id "${id}" not found`);
    return row;
};

/**
 * Create a new job position.
 * Enforces unique title (case-insensitive).
 * Validates department_id existence if provided.
 * @param {{ title: string, department_id?: string }} data
 * @throws {ConflictError} if title already exists
 * @throws {BadRequestError} if department_id is invalid
 * @returns {Promise<object>}
 */
export const create = async ({ title, department_id = null }) => {
    const existing = await jobPositionRepo.findByTitle(title);
    if (existing) {
        throw new ConflictError(`Job position with title "${title}" already exists`);
    }

    await validateDepartment(department_id);

    return jobPositionRepo.create(title, department_id);
};

/**
 * Update a job position's title and/or department.
 * Enforces unique title (case-insensitive), excluding current record.
 * Validates department_id existence if being changed.
 * @param {string} id
 * @param {{ title?: string, department_id?: string }} fields
 * @throws {NotFoundError}
 * @throws {ConflictError} if updated title conflicts with another job position
 * @throws {BadRequestError} if department_id is invalid
 * @returns {Promise<object>}
 */
export const update = async (id, fields) => {
    const existing = await jobPositionRepo.findById(id);
    if (!existing) throw new NotFoundError(`Job position with id "${id}" not found`);

    if (fields.title) {
        const conflict = await jobPositionRepo.findByTitle(fields.title, id);
        if (conflict) {
            throw new ConflictError(`Job position with title "${fields.title}" already exists`);
        }
    }

    if (fields.department_id !== undefined) {
        await validateDepartment(fields.department_id);
    }

    const dbFields = {};
    if (fields.title !== undefined)         dbFields.title = fields.title;
    if (fields.department_id !== undefined) dbFields.department_id = fields.department_id;

    return jobPositionRepo.update(id, dbFields);
};

/**
 * Delete a job position by ID.
 * Blocks deletion if any active user or contract references this position.
 * @param {string} id
 * @throws {NotFoundError}
 * @throws {ConflictError} if referenced by active employees or contracts
 */
export const remove = async (id) => {
    const existing = await jobPositionRepo.findById(id);
    if (!existing) throw new NotFoundError(`Job position with id "${id}" not found`);

    const inUse = await jobPositionRepo.hasReferences(id);
    if (inUse) {
        throw new ConflictError(
            `Cannot delete job position "${existing.title}" — it is referenced by active employees or contracts`
        );
    }

    await jobPositionRepo.remove(id);
};
