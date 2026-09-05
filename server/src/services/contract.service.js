/**
 * @fileoverview Contract Service — Core business logic layer.
 * Validates inputs and orchestrates repository calls.
 * Throws typed errors from #lib/errors.js; never touches HTTP directly.
 */

import * as contractRepo from '#repositories/contract.repo.js';
import { BadRequestError, ConflictError, NotFoundError } from '#lib/errors.js';

// ── Allowed status transitions ───────────────────────────────────────
const VALID_TRANSITIONS = new Map([
    ['draft',  new Set(['active', 'cancelled'])],
    ['active', new Set(['expired', 'cancelled'])],
]);

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
        const overlappingId = await contractRepo.findOverlappingActiveContracts(
            employee_id,
            start_date,
            end_date ?? null,
        );

        if (overlappingId !== null) {
            throw new ConflictError(
                `Please deactivate / specify accurate end date for contract number ${overlappingId} to create a new contract for this employee`,
            );
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

/**
 * Update a contract's mutable fields (end_date, status only).
 *
 * Business rules enforced:
 *  - Only `end_date` and `status` are writable; any other field in the body is ignored.
 *  - `status` must follow the allowed transition graph.
 *  - `end_date` (when provided) must be >= the contract's start_date.
 *  - No reverse transitions from terminal states (expired / cancelled).
 *  - Activating a draft: overlap-checked against other active contracts for the same employee.
 *  - Side-effect on activation: any other active contract for the employee is expired
 *    (end_date set to one day before the new contract's start_date).
 *
 * @param {number} id   - Contract to update.
 * @param {object} data - May contain `end_date` and/or `status`.
 * @returns {Promise<object>} The updated contract row.
 * @throws {NotFoundError}   When the contract does not exist.
 * @throws {BadRequestError} When the transition or date is invalid.
 * @throws {ConflictError}   When activating would create an overlap.
 */
export const updateContract = async (id, data) => {
    const { end_date, status } = data;

    // ── Fetch current state ──────────────────────────────────────────
    const current = await contractRepo.findById(id);
    if (!current) {
        throw new NotFoundError('Contract not found');
    }

    const newStatus  = status  !== undefined ? status  : current.status;
    const newEndDate = end_date !== undefined ? end_date : current.end_date;

    // ── Validate status transition ───────────────────────────────────
    if (newStatus !== current.status) {
        const allowed = VALID_TRANSITIONS.get(current.status);
        if (!allowed || !allowed.has(newStatus)) {
            throw new BadRequestError(
                `Invalid status transition: '${current.status}' → '${newStatus}'. ` +
                `Allowed transitions from '${current.status}': ${allowed ? [...allowed].join(', ') : 'none'}.`,
            );
        }
    }

    // ── Validate end_date ────────────────────────────────────────────
    if (newEndDate !== null && newEndDate !== undefined) {
        const startMs  = new Date(current.start_date).getTime();
        const endMs    = new Date(newEndDate).getTime();
        if (endMs < startMs) {
            throw new BadRequestError('end_date must be greater than or equal to start_date');
        }
    }

    // ── Overlap check when activating ────────────────────────────────
    if (newStatus === 'active' && current.status !== 'active') {
        const overlappingId = await contractRepo.findOverlappingActiveContracts(
            current.employee_id,
            current.start_date,
            newEndDate ?? null,
            id,   // exclude self
        );

        if (overlappingId !== null) {
            throw new ConflictError(
                `Please deactivate / specify accurate end date for contract number ${overlappingId} to activate a new contract for this employee`,
            );
        }
    }

    // ── Persist ──────────────────────────────────────────────────────
    const updated = await contractRepo.updateContract(id, newEndDate, newStatus);
    return updated;
};


