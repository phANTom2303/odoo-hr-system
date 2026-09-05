/**
 * @fileoverview Salary Structure Service — Business logic layer.
 *
 * Business rules:
 *  - Cannot update or delete a structure referenced by an active contract → 409
 *  - New contracts cannot reference inactive structures (enforced in contract service)
 */

import * as structureRepo from '#repositories/salaryStructure.repo.js';
import { logger } from '#config/logger.js';
import { NotFoundError, ConflictError } from '#lib/errors.js';

export const getAll = async () => {
    logger.info('Fetching all salary structures');
    return structureRepo.findAll();
};

export const getById = async (id) => {
    const row = await structureRepo.findById(id);
    if (!row) throw new NotFoundError(`Salary structure with id "${id}" not found`);
    return row;
};

export const create = async (data) => {
    return structureRepo.create(data);
};

export const update = async (id, fields) => {
    const existing = await structureRepo.findById(id);
    if (!existing) throw new NotFoundError(`Salary structure with id "${id}" not found`);

    const inUse = await structureRepo.hasActiveContractReference(id);
    if (inUse) {
        throw new ConflictError(
            `Cannot update salary structure "${existing.name}" — it is referenced by an active contract`
        );
    }

    const updated = await structureRepo.update(id, fields);
    if (!updated) throw new NotFoundError(`Salary structure with id "${id}" not found`);
    return updated;
};

export const remove = async (id) => {
    const existing = await structureRepo.findById(id);
    if (!existing) throw new NotFoundError(`Salary structure with id "${id}" not found`);

    const inUse = await structureRepo.hasActiveContractReference(id);
    if (inUse) {
        throw new ConflictError(
            `Cannot delete salary structure "${existing.name}" — it is referenced by an active contract`
        );
    }

    await structureRepo.remove(id);
};
