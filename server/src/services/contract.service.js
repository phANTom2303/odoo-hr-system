/**
 * @fileoverview Contract Service — Core business logic layer.
 */

import * as contractRepo from '#repositories/contract.repo.js';
import { BadRequestError, ConflictError, NotFoundError } from '#lib/errors.js';

const VALID_TRANSITIONS = new Map([
    ['draft',  new Set(['active', 'cancelled'])],
    ['active', new Set(['expired', 'cancelled'])],
]);

export const getAll = async (filters = {}) => {
    return contractRepo.findAll(filters);
};

export const getById = async (id) => {
    return contractRepo.findById(id);
};

export const deleteContract = async (id) => {
    const row = await contractRepo.findById(id);
    if (!row) throw new NotFoundError('Contract not found');
    if (!['draft', 'cancelled'].includes(row.status)) {
        throw new BadRequestError('Only draft or cancelled contracts can be deleted');
    }
    await contractRepo.deleteContract(id);
};

export const createContract = async (data) => {
    const {
        employee_id, schedule_id, salary_structure_id, wage, start_date,
        overtime_policy_id, department_id, job_position_id, end_date, status,
    } = data;

    const missing = [];
    if (employee_id == null)          missing.push('employee_id');
    if (schedule_id == null)          missing.push('schedule_id');
    if (salary_structure_id == null)  missing.push('salary_structure_id');
    if (wage == null)                 missing.push('wage');
    if (!start_date)                  missing.push('start_date');
    if (missing.length > 0) throw new BadRequestError(`Missing required fields: ${missing.join(', ')}`);

    if (status === 'active') {
        const overlappingId = await contractRepo.findOverlappingActiveContracts(
            employee_id, start_date, end_date ?? null,
        );
        if (overlappingId !== null) {
            throw new ConflictError(
                `Please deactivate contract #${overlappingId} before creating a new active contract for this employee`,
            );
        }
    }

    return contractRepo.create({
        employee_id, schedule_id, salary_structure_id,
        overtime_policy_id, department_id, job_position_id,
        wage, start_date, end_date, status,
    });
};

export const updateContract = async (id, data) => {
    const { end_date, status } = data;
    const current = await contractRepo.findById(id);
    if (!current) throw new NotFoundError('Contract not found');

    const newStatus  = status   !== undefined ? status   : current.status;
    const newEndDate = end_date !== undefined ? end_date : current.end_date;

    if (newStatus !== current.status) {
        const allowed = VALID_TRANSITIONS.get(current.status);
        if (!allowed || !allowed.has(newStatus)) {
            throw new BadRequestError(
                `Invalid status transition: '${current.status}' → '${newStatus}'. ` +
                `Allowed: ${allowed ? [...allowed].join(', ') : 'none'}.`,
            );
        }
    }

    if (newEndDate != null) {
        if (new Date(newEndDate) < new Date(current.start_date)) {
            throw new BadRequestError('end_date must be >= start_date');
        }
    }

    if (newStatus === 'active' && current.status !== 'active') {
        const overlappingId = await contractRepo.findOverlappingActiveContracts(
            current.employee_id, current.start_date, newEndDate ?? null, id,
        );
        if (overlappingId !== null) {
            throw new ConflictError(
                `Please deactivate contract #${overlappingId} before activating this one`,
            );
        }

        // Auto-expire any currently active contract for this employee
        const currentlyActive = await contractRepo.findOverlappingActiveContracts(
            current.employee_id, '1970-01-01', '9999-12-31', id,
        );
        if (currentlyActive !== null) {
            const dayBefore = new Date(current.start_date);
            dayBefore.setDate(dayBefore.getDate() - 1);
            await contractRepo.expireContract(currentlyActive, dayBefore.toISOString().slice(0, 10));
        }
    }

    return contractRepo.updateContract(id, newEndDate, newStatus);
};
