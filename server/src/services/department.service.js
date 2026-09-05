/**
 * @fileoverview Department Service — Core business logic layer.
 *
 * Business rules enforced here (from business-logic.md §2):
 *  - name must be unique (case-insensitive)
 *  - Cannot delete a department referenced by active users or contracts → 409 Conflict
 */

import * as departmentRepo from '#repositories/department.repo.js';
import { logger } from '#config/logger.js';
import { NotFoundError, ConflictError } from '#lib/errors.js';

// ── Service Methods ─────────────────────────────────────────────────

/**
 * Retrieve all departments.
 * @returns {Promise<object[]>}
 */
export const getAll = async () => {
    logger.info('Fetching all departments from DB');
    return departmentRepo.findAll();
};

/**
 * Retrieve a single department by ID.
 * @param {string} id
 * @throws {NotFoundError}
 * @returns {Promise<object>}
 */
export const getById = async (id) => {
    const row = await departmentRepo.findById(id);
    if (!row) throw new NotFoundError(`Department with id "${id}" not found`);
    return row;
};

/**
 * Create a new department.
 * Enforces unique name (case-insensitive).
 * @param {{ name: string }} data
 * @throws {ConflictError} if name already exists
 * @returns {Promise<object>}
 */
export const create = async ({ name }) => {
    const existing = await departmentRepo.findByName(name);
    if (existing) {
        throw new ConflictError(`Department with name "${name}" already exists`);
    }

    return departmentRepo.create(name);
};

/**
 * Update a department's name.
 * Enforces unique name (case-insensitive), excluding the current record.
 * @param {string} id
 * @param {{ name?: string }} fields
 * @throws {NotFoundError}
 * @throws {ConflictError} if updated name conflicts with another department
 * @returns {Promise<object>}
 */
export const update = async (id, fields) => {
    const existing = await departmentRepo.findById(id);
    if (!existing) throw new NotFoundError(`Department with id "${id}" not found`);

    if (fields.name) {
        const conflict = await departmentRepo.findByName(fields.name, id);
        if (conflict) {
            throw new ConflictError(`Department with name "${fields.name}" already exists`);
        }
    }

    return departmentRepo.update(id, fields);
};

/**
 * Delete a department by ID.
 * Blocks deletion if any active user or contract references this department.
 * @param {string} id
 * @throws {NotFoundError}
 * @throws {ConflictError} if referenced by active employees or contracts
 */
export const remove = async (id) => {
    const existing = await departmentRepo.findById(id);
    if (!existing) throw new NotFoundError(`Department with id "${id}" not found`);

    const inUse = await departmentRepo.hasReferences(id);
    if (inUse) {
        throw new ConflictError(
            `Cannot delete department "${existing.name}" — it is referenced by active employees or contracts`
        );
    }

    await departmentRepo.remove(id);
};
