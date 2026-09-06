import * as leaveRepo from '#repositories/leaveRequest.repo.js';
import * as allocationRepo from '#repositories/allocation.repo.js';
import { NotFoundError, BadRequestError } from '#lib/errors.js';
import { logger } from '#config/logger.js';
import { query } from '#config/db.js';

export const getAll = async (filters = {}) => {
    logger.info({ filters }, 'Fetching leave requests');
    return leaveRepo.findAll(filters);
};

export const getById = async (id) => {
    const row = await leaveRepo.findById(id);
    if (!row) throw new NotFoundError(`Leave request with id "${id}" not found`);
    return row;
};

export const create = async (data) => {
    // Compute number_of_days from start/end if not provided
    if (!data.number_of_days && data.start_date && data.end_date) {
        const start = new Date(data.start_date);
        const end   = new Date(data.end_date);
        const days  = Math.max(1, Math.round((end - start) / 86400000) + 1);
        data.number_of_days = days;
    }

    // Balance check — if an allocation_id is provided, verify sufficient remaining balance
    if (data.allocation_id) {
        const alloc = await allocationRepo.findById(data.allocation_id);
        if (!alloc) throw new BadRequestError('Allocation not found');
        if (alloc.status !== 'approved') throw new BadRequestError('The selected allocation is not approved');
        const remaining = parseFloat(alloc.remaining ?? alloc.allocated_amount) - parseFloat(alloc.taken ?? 0);
        if (data.number_of_days > remaining) {
            throw new BadRequestError(
                `Insufficient leave balance. Requested: ${data.number_of_days} days, Available: ${remaining.toFixed(1)} days`
            );
        }
    }

    return leaveRepo.create(data);
};

export const approve = async (id, approver_id) => {
    const existing = await leaveRepo.findById(id);
    if (!existing) throw new NotFoundError(`Leave request with id "${id}" not found`);
    if (existing.status === 'approved') throw new BadRequestError('Leave request is already approved');

    const approved = await leaveRepo.approve(id, approver_id);

    // Update allocation.taken so remaining balance stays accurate
    if (existing.allocation_id && existing.number_of_days) {
        await query(
            `UPDATE time_off_allocations
             SET taken = taken + $1, updated_at = NOW()
             WHERE id = $2`,
            [existing.number_of_days, existing.allocation_id]
        );
        logger.info({ allocation_id: existing.allocation_id, days: existing.number_of_days }, 'Allocation taken updated on leave approval');
    }

    return approved;
};

export const refuse = async (id) => {
    const existing = await leaveRepo.findById(id);
    if (!existing) throw new NotFoundError(`Leave request with id "${id}" not found`);
    return leaveRepo.refuse(id);
};

export const withdraw = async (id) => {
    const existing = await leaveRepo.findById(id);
    if (!existing) throw new NotFoundError(`Leave request with id "${id}" not found`);
    if (existing.status !== 'pending') throw new BadRequestError('Only pending requests can be withdrawn');
    const updated = await leaveRepo.withdraw(id);
    if (!updated) throw new BadRequestError('Only pending requests can be withdrawn');
    return updated;
};
