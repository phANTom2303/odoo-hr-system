import * as allocationRepo from '#repositories/allocation.repo.js';
import { NotFoundError, BadRequestError } from '#lib/errors.js';
import { logger } from '#config/logger.js';

export const getAll = async (filters = {}) => {
    logger.info({ filters }, 'Fetching allocations');
    return allocationRepo.findAll(filters);
};

export const getById = async (id) => {
    const row = await allocationRepo.findById(id);
    if (!row) throw new NotFoundError(`Allocation with id "${id}" not found`);
    return row;
};

export const create = async (data) => {
    if (!data || typeof data !== 'object') {
        throw new BadRequestError('Request body is missing or invalid');
    }
    const { employee_id, time_off_type_id, start_date, end_date, allocated_amount } = data;
    if (!employee_id)       throw new BadRequestError('employee_id is required');
    if (!time_off_type_id)  throw new BadRequestError('time_off_type_id is required');
    if (!start_date)        throw new BadRequestError('start_date is required');
    if (!end_date)          throw new BadRequestError('end_date is required');
    if (allocated_amount == null) throw new BadRequestError('allocated_amount is required');
    return allocationRepo.create(data);
};

export const remove = async (id) => {
    const existing = await allocationRepo.findById(id);
    if (!existing) throw new NotFoundError(`Allocation with id "${id}" not found`);
    if (existing.status !== 'draft') throw new BadRequestError('Only draft allocations can be deleted');
    const deleted = await allocationRepo.remove(id);
    if (!deleted) throw new BadRequestError('Only draft allocations can be deleted');
    return deleted;
};

export const approve = async (id, approved_by) => {
    const existing = await allocationRepo.findById(id);
    if (!existing) throw new NotFoundError(`Allocation with id "${id}" not found`);
    return allocationRepo.approve(id, approved_by);
};

export const refuse = async (id) => {
    const existing = await allocationRepo.findById(id);
    if (!existing) throw new NotFoundError(`Allocation with id "${id}" not found`);
    return allocationRepo.refuse(id);
};

export const update = async (id, fields) => {
    const existing = await allocationRepo.findById(id);
    if (!existing) throw new NotFoundError(`Allocation with id "${id}" not found`);
    if (existing.status !== 'draft') throw new BadRequestError('Only draft allocations can be edited');
    const updated = await allocationRepo.update(id, fields);
    if (!updated) throw new BadRequestError('Only draft allocations can be edited');
    return updated;
};
