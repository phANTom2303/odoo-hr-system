/**
 * @fileoverview Employee Service — Business logic layer.
 *
 * Business rules:
 *  - email must be unique
 *  - password hashed with bcrypt before insert
 *  - Termination side-effects (M1): handled in PUT by M1; M2 handles simple field updates
 *  - Soft delete: is_active = false (never hard-delete)
 *  - manager_id cannot be self-referential
 */

import bcrypt from 'bcryptjs';
import * as employeeRepo from '#repositories/employee.repo.js';
import { logger } from '#config/logger.js';
import { NotFoundError, ConflictError, BadRequestError } from '#lib/errors.js';

export const getAll = async (filters = {}) => {
    logger.info({ filters }, 'Fetching employees');
    return employeeRepo.findAll(filters);
};

export const getById = async (id) => {
    const row = await employeeRepo.findById(id);
    if (!row) throw new NotFoundError(`Employee with id "${id}" not found`);
    return row;
};

export const create = async (data) => {
    // Unique email
    const existing = await employeeRepo.findByEmail(data.email);
    if (existing) throw new ConflictError(`Email "${data.email}" is already in use`);

    // Self-referential manager check
    // Can't check against a new record's id, so no issue on create. Enforced on update.

    if (!data.password) throw new BadRequestError('password is required');
    const password_hash = await bcrypt.hash(data.password, 10);

    return employeeRepo.create({ ...data, password_hash });
};

export const update = async (id, fields) => {
    const existing = await employeeRepo.findById(id);
    if (!existing) throw new NotFoundError(`Employee with id "${id}" not found`);

    if (fields.email) {
        const conflict = await employeeRepo.findByEmail(fields.email, id);
        if (conflict) throw new ConflictError(`Email "${fields.email}" is already in use`);
    }

    if (fields.manager_id !== undefined && String(fields.manager_id) === String(id)) {
        throw new BadRequestError('An employee cannot be their own manager');
    }

    // Hash new password if provided
    if (fields.password) {
        fields.password_hash = await bcrypt.hash(fields.password, 10);
        delete fields.password;
    }

    const updated = await employeeRepo.update(id, fields);
    if (!updated) throw new NotFoundError(`Employee with id "${id}" not found`);
    return updated;
};

export const remove = async (id) => {
    const existing = await employeeRepo.findById(id);
    if (!existing) throw new NotFoundError(`Employee with id "${id}" not found`);
    const deleted = await employeeRepo.softDelete(id);
    if (!deleted) throw new NotFoundError(`Employee with id "${id}" not found`);
};

/* Sub-resources */
export const getContracts   = async (id) => {
    await getById(id); // ensure employee exists
    return employeeRepo.findContracts(id);
};
export const getAttendance  = async (id) => {
    await getById(id);
    return employeeRepo.findAttendance(id);
};
export const getTimeOffRequests = async (id) => {
    await getById(id);
    return employeeRepo.findTimeOffRequests(id);
};
export const getAllocations  = async (id) => {
    await getById(id);
    return employeeRepo.findAllocations(id);
};
