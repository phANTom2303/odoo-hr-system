/**
 * @fileoverview Time Off Type Service — Business logic layer.
 *
 * Business rules:
 *  - name must be unique
 *  - Cannot update or delete a type linked to an active contract → 409
 */

import * as typeRepo from '#repositories/timeOffType.repo.js';
import { logger } from '#config/logger.js';
import { NotFoundError, ConflictError } from '#lib/errors.js';

export const getAll = async () => {
    logger.info('Fetching all time off types');
    return typeRepo.findAll();
};

export const getById = async (id) => {
    const row = await typeRepo.findById(id);
    if (!row) throw new NotFoundError(`Time off type with id "${id}" not found`);
    return row;
};

export const create = async (data) => {
    const existing = await typeRepo.findByName(data.name);
    if (existing) throw new ConflictError(`Time off type "${data.name}" already exists`);
    return typeRepo.create(data);
};

export const update = async (id, fields) => {
    const existing = await typeRepo.findById(id);
    if (!existing) throw new NotFoundError(`Time off type with id "${id}" not found`);

    const inUse = await typeRepo.hasActiveContractReference(id);
    if (inUse) {
        throw new ConflictError(
            `Cannot update time off type "${existing.name}" — it is linked to an active contract`
        );
    }

    if (fields.name) {
        const conflict = await typeRepo.findByName(fields.name, id);
        if (conflict) throw new ConflictError(`Time off type "${fields.name}" already exists`);
    }

    const updated = await typeRepo.update(id, fields);
    if (!updated) throw new NotFoundError(`Time off type with id "${id}" not found`);
    return updated;
};

export const remove = async (id) => {
    const existing = await typeRepo.findById(id);
    if (!existing) throw new NotFoundError(`Time off type with id "${id}" not found`);

    const inUse = await typeRepo.hasActiveContractReference(id);
    if (inUse) {
        throw new ConflictError(
            `Cannot delete time off type "${existing.name}" — it is linked to an active contract`
        );
    }

    await typeRepo.remove(id);
};
