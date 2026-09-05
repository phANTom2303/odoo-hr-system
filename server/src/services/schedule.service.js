/**
 * @fileoverview Working Schedule Service — Business logic layer.
 *
 * Business rules:
 *  - Cannot delete a schedule referenced by an active contract → 409
 *  - Cannot deactivate a schedule referenced by an active contract → 409
 *  - total_weekly_hours is always auto-computed from lines, never manually set
 */

import * as scheduleRepo from '#repositories/schedule.repo.js';
import { logger } from '#config/logger.js';
import { NotFoundError, ConflictError } from '#lib/errors.js';

export const getAll = async () => {
    logger.info('Fetching all working schedules');
    return scheduleRepo.findAll();
};

export const getById = async (id) => {
    const row = await scheduleRepo.findById(id);
    if (!row) throw new NotFoundError(`Working schedule with id "${id}" not found`);
    return row;
};

export const create = async ({ name, lines = [] }) => {
    return scheduleRepo.create(name, lines);
};

export const update = async (id, { name, is_active, lines }) => {
    const existing = await scheduleRepo.findById(id);
    if (!existing) throw new NotFoundError(`Working schedule with id "${id}" not found`);

    // Block deactivation if referenced by active contract
    if (is_active === false) {
        const inUse = await scheduleRepo.hasActiveContractReference(id);
        if (inUse) {
            throw new ConflictError(
                `Cannot deactivate schedule "${existing.name}" — it is referenced by an active contract`
            );
        }
    }

    const updated = await scheduleRepo.update(id, { name, is_active }, lines);
    if (!updated) throw new NotFoundError(`Working schedule with id "${id}" not found`);
    return scheduleRepo.findById(id); // return with lines included
};

export const remove = async (id) => {
    const existing = await scheduleRepo.findById(id);
    if (!existing) throw new NotFoundError(`Working schedule with id "${id}" not found`);

    const inUse = await scheduleRepo.hasActiveContractReference(id);
    if (inUse) {
        throw new ConflictError(
            `Cannot delete schedule "${existing.name}" — it is referenced by an active contract`
        );
    }

    await scheduleRepo.remove(id);
};
