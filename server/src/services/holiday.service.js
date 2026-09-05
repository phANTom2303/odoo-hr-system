/**
 * @fileoverview Company Holiday Service — Business logic layer.
 *
 * Business rules:
 *  - One holiday per date (unique date constraint)
 */

import * as holidayRepo from '#repositories/holiday.repo.js';
import { logger } from '#config/logger.js';
import { NotFoundError, ConflictError } from '#lib/errors.js';

export const getAll = async () => {
    logger.info('Fetching all company holidays');
    return holidayRepo.findAll();
};

export const getById = async (id) => {
    const row = await holidayRepo.findById(id);
    if (!row) throw new NotFoundError(`Holiday with id "${id}" not found`);
    return row;
};

export const create = async (data) => {
    const existing = await holidayRepo.findByDate(data.date);
    if (existing) throw new ConflictError(`A holiday already exists on ${data.date}`);
    return holidayRepo.create(data);
};

export const update = async (id, fields) => {
    const existing = await holidayRepo.findById(id);
    if (!existing) throw new NotFoundError(`Holiday with id "${id}" not found`);

    if (fields.date) {
        const conflict = await holidayRepo.findByDate(fields.date, id);
        if (conflict) throw new ConflictError(`A holiday already exists on ${fields.date}`);
    }

    const updated = await holidayRepo.update(id, fields);
    if (!updated) throw new NotFoundError(`Holiday with id "${id}" not found`);
    return updated;
};

export const remove = async (id) => {
    const existing = await holidayRepo.findById(id);
    if (!existing) throw new NotFoundError(`Holiday with id "${id}" not found`);
    await holidayRepo.remove(id);
};
