/**
 * @fileoverview Contract Service — Core business logic layer.
 * Validates inputs and orchestrates repository calls.
 * Throws typed errors from #lib/errors.js; never touches HTTP directly.
 */

import * as contractRepo from '#repositories/contract.repo.js';
import { BadRequestError, ConflictError } from '#lib/errors.js';

// ── Service Methods ─────────────────────────────────────────────────

export const getAll = async () => {
    const rows = await contractRepo.findAll();
    return rows;
};

export const getById = async (id) => {
    const row = await contractRepo.findById(id);
    return row;
};

/**
 * Create a new contract after validating required fields and,
 * when status is 'active', checking for overlapping active contracts.
 *
 * @param {object} data - Raw body fields from the controller.
 * @returns {Promise<object>} The newly created contract row.
 * @throws {BadRequestError} When required fields are missing.
 * @throws {ConflictError}   When an overlapping active contract exists.
 */
export const createContract = async (data) => {
    const {
        employee_id,
        schedule_id,
        salary_structure_id,
        wage,
        start_date,
        // optional
        overtime_policy_id,
        department_id,
        job_position_id,
        end_date,
        status,
    } = data;

    // ── Required-field presence check ────────────────────────────────
    const missing = [];
    if (employee_id === undefined || employee_id === null) missing.push('employee_id');
    if (schedule_id === undefined || schedule_id === null) missing.push('schedule_id');
    if (salary_structure_id === undefined || salary_structure_id === null) missing.push('salary_structure_id');
    if (wage === undefined || wage === null) missing.push('wage');
    if (!start_date) missing.push('start_date');

    if (missing.length > 0) {
        throw new BadRequestError(`Missing required fields: ${missing.join(', ')}`);
    }

    // ── Overlap check (only when activating a contract) ──────────────
    if (status === 'active') {
        const hasOverlap = await contractRepo.findOverlappingActiveContracts(
            employee_id,
            start_date,
            end_date ?? null,
        );

        if (hasOverlap) {
            throw new ConflictError('Overlapping active contract exists');
        }
    }

    // ── Persist ──────────────────────────────────────────────────────
    const contract = await contractRepo.create({
        employee_id,
        schedule_id,
        salary_structure_id,
        overtime_policy_id,
        department_id,
        job_position_id,
        wage,
        start_date,
        end_date,
        status,
    });

    return contract;
};
