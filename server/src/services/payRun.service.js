/**
 * @fileoverview Pay Run Service — business logic and orchestration for pay runs.
 *
 * Owns the compute lifecycle: `draft → computed → validated → paid`. The
 * arithmetic itself lives in `payrollEngine.service.js` (which writes nothing);
 * this module supplies the pre-condition guards (algorithm doc §1a) and
 * Phase 10 persistence (§13).
 *
 * Throws typed errors from `#lib/errors.js`; never touches `req`/`res`.
 */

import * as payRunRepo from '#repositories/payRun.repo.js';
import * as payslipRepo from '#repositories/payslip.repo.js';
import * as payrollEngine from '#services/payrollEngine.service.js';
import { BadRequestError, ConflictError, NotFoundError } from '#lib/errors.js';
import { PAYRUN_STATUS, PAYSLIP_STATUS, SEVERITY } from '#lib/payroll.constants.js';
import { round2 } from '#utils/payrollDates.js';

/** Month abbreviations for the auto-generated `PR/YYYY/MMM` pay run name. */
const MONTH_ABBREVIATIONS = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

/** Matches a strict 'YYYY-MM-DD' date string. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Builds the default pay run name from its start date, e.g.
 * `'2026-09-01' → 'PR/2026/SEP'`. `pay_runs.name` carries no unique
 * constraint, so duplicates across runs are acceptable and unhandled.
 *
 * @param {string} startDate - 'YYYY-MM-DD'
 * @returns {string}
 */
const buildDefaultName = (startDate) => {
    const [year, month] = startDate.split('-');
    const abbreviation = MONTH_ABBREVIATIONS[Number(month) - 1] ?? month;
    return `PR/${year}/${abbreviation}`;
};

// ── Reads ────────────────────────────────────────────────────────────

/**
 * List pay runs with their derived employee counts and net totals.
 *
 * @param {object} [filters]
 * @param {string} [filters.status]
 * @param {string} [filters.start_date]
 * @param {string} [filters.end_date]
 * @returns {Promise<object[]>}
 */
export const getAll = async (filters = {}) => {
    return payRunRepo.findAll(filters);
};

/**
 * Fetch a single pay run with its per-employee payslip summaries attached.
 *
 * @param {number|string} id
 * @returns {Promise<object>}
 * @throws {NotFoundError} When the pay run does not exist.
 */
export const getById = async (id) => {
    const payRun = await payRunRepo.findById(id);
    if (!payRun) {
        throw new NotFoundError('Pay run not found');
    }

    const payslips = await payRunRepo.findPayslipSummaries(id);
    return { ...payRun, payslips };
};

/**
 * Active employees holding at least one active contract overlapping the given
 * window — the candidate list for the pay run creation wizard.
 *
 * @param {object} filters
 * @param {string} filters.start_date - 'YYYY-MM-DD'
 * @param {string} filters.end_date - 'YYYY-MM-DD'
 * @param {number|string} [filters.department_id]
 * @param {string} [filters.employee_type]
 * @returns {Promise<object[]>}
 * @throws {BadRequestError} When the date window is missing or inverted.
 */
export const getEligibleEmployees = async (filters = {}) => {
    const { start_date, end_date, department_id, employee_type } = filters;

    const missing = [];
    if (!start_date) missing.push('start_date');
    if (!end_date) missing.push('end_date');
    if (missing.length > 0) {
        throw new BadRequestError(`Missing required query parameters: ${missing.join(', ')}`);
    }

    if (end_date < start_date) {
        throw new BadRequestError('end_date must be greater than or equal to start_date');
    }

    return payRunRepo.findEligibleEmployees({ start_date, end_date, department_id, employee_type });
};

// ── Writes ───────────────────────────────────────────────────────────

/**
 * Create a draft pay run and attach its selected employees.
 *
 * @param {object} data
 * @param {string} [data.name] - Defaults to `PR/YYYY/MMM` from `start_date`.
 * @param {string} data.start_date - 'YYYY-MM-DD'
 * @param {string} data.end_date - 'YYYY-MM-DD'
 * @param {Array<number|string>} data.employee_ids - De-duplicated internally.
 * @param {number} createdBy - `req.user.sub`.
 * @returns {Promise<object>} The created pay run plus `employee_count`.
 * @throws {BadRequestError} Missing/invalid fields.
 */
export const create = async (data, createdBy) => {
    const { name, start_date, end_date, employee_ids } = data;

    // ── Required-field presence check ────────────────────────────────
    const missing = [];
    if (!start_date) missing.push('start_date');
    if (!end_date) missing.push('end_date');
    if (!Array.isArray(employee_ids) || employee_ids.length === 0) missing.push('employee_ids');

    if (missing.length > 0) {
        throw new BadRequestError(`Missing required fields: ${missing.join(', ')}`);
    }

    // ── Date shape & ordering (ISO strings compare lexicographically) ─
    if (!ISO_DATE_PATTERN.test(start_date) || !ISO_DATE_PATTERN.test(end_date)) {
        throw new BadRequestError('start_date and end_date must be ISO dates in YYYY-MM-DD format');
    }
    if (end_date < start_date) {
        throw new BadRequestError('end_date must be greater than or equal to start_date');
    }

    // ── Employee ids: de-duplicate and coerce to positive integers ───
    const normalisedIds = [];
    const seen = new Set();
    for (const rawId of employee_ids) {
        const id = Number(rawId);
        if (!Number.isInteger(id) || id <= 0) {
            throw new BadRequestError(`employee_ids must contain positive integers, received: ${rawId}`);
        }
        if (!seen.has(id)) {
            seen.add(id);
            normalisedIds.push(id);
        }
    }

    // ── Persist (status defaults to 'draft' in the schema) ───────────
    return payRunRepo.create({
        name: name?.trim() || buildDefaultName(start_date),
        start_date,
        end_date,
        created_by: createdBy,
        employee_ids: normalisedIds,
    });
};

/**
 * Update a draft or computed pay run's mutable metadata.
 *
 * @param {number|string} id
 * @param {object} data
 * @param {string} [data.name]
 * @param {string} [data.start_date]
 * @param {string} [data.end_date]
 * @param {number[]} [data.employee_ids]
 * @returns {Promise<object>} The updated pay run row.
 * @throws {NotFoundError}   When the pay run does not exist.
 * @throws {ConflictError}   When the pay run has left computed state.
 */
export const updateMeta = async (id, data) => {
    const { name, start_date, end_date, employee_ids } = data ?? {};

    const payRun = await payRunRepo.findByIdRaw(id);
    if (!payRun) {
        throw new NotFoundError('Pay run not found');
    }
    if (payRun.status !== PAYRUN_STATUS.DRAFT && payRun.status !== PAYRUN_STATUS.COMPUTED) {
        throw new ConflictError('Only draft and computed pay runs can be edited');
    }

    const updatePayload = {};
    if (name) updatePayload.name = name.trim();
    if (start_date) updatePayload.start_date = start_date;
    if (end_date) updatePayload.end_date = end_date;
    if (employee_ids && Array.isArray(employee_ids)) {
        const seen = new Set();
        const normalisedIds = [];
        for (const rawId of employee_ids) {
            const id = Number(rawId);
            if (!Number.isInteger(id) || id <= 0) {
                throw new BadRequestError(`employee_ids must contain positive integers, received: ${rawId}`);
            }
            if (!seen.has(id)) {
                seen.add(id);
                normalisedIds.push(id);
            }
        }
        updatePayload.employee_ids = normalisedIds;
    }

    if (Object.keys(updatePayload).length === 0) {
        throw new BadRequestError('Missing fields to update');
    }

    if (payRun.status === PAYRUN_STATUS.COMPUTED && (start_date || end_date || employee_ids)) {
        await payslipRepo.deleteByPayRun(id);
        updatePayload.status = PAYRUN_STATUS.DRAFT;
    }

    return payRunRepo.updateMeta(id, updatePayload);
};

/**
 * Delete a pay run (its `pay_run_employees` and payslips cascade).
 *
 * @param {number|string} id
 * @returns {Promise<{id: number}>}
 * @throws {NotFoundError} When the pay run does not exist.
 * @throws {ConflictError} When the pay run has left validated state.
 */
export const remove = async (id) => {
    const payRun = await payRunRepo.findByIdRaw(id);
    if (!payRun) {
        throw new NotFoundError('Pay run not found');
    }
    if (payRun.status === PAYRUN_STATUS.PAID || payRun.status === PAYRUN_STATUS.CANCELLED) {
        throw new ConflictError('Only draft, computed, and validated pay runs can be deleted');
    }

    return payRunRepo.remove(id);
};

// ── Compute lifecycle ────────────────────────────────────────────────

/**
 * Run the payroll engine over every selected employee and persist the results
 * (algorithm doc Phase 10, §13).
 *
 * Employees are processed **sequentially**: each `insertPayslipWithLines` call
 * opens its own transaction, and a `Promise.all` over a few hundred employees
 * would exhaust the 20-connection pool and deadlock. If one employee throws,
 * the error propagates and the run stays `draft` — `insertPayslipWithLines`
 * deletes any prior payslip for the (run, employee) pair first, so re-running
 * compute after a partial failure is safe and idempotent.
 *
 * @param {number|string} id - Pay run id.
 * @returns {Promise<{pay_run_id: number, status: string, payslips_generated: number,
 *   total_gross: number, total_net: number, total_deductions: number,
 *   warning_counts: {error: number, warning: number, info: number},
 *   payslips: object[]}>}
 * @throws {NotFoundError}   Unknown pay run.
 * @throws {ConflictError}   Pay run is not draft.
 * @throws {BadRequestError} No employees selected into the run.
 */
export const compute = async (id) => {
    // ── §1a: pay run exists and is computable ────────────────────────
    const payRun = await payRunRepo.findByIdRaw(id);
    if (!payRun) {
        throw new NotFoundError('Pay run not found');
    }
    if (payRun.status !== PAYRUN_STATUS.DRAFT) {
        throw new ConflictError('Pay run is not in draft state');
    }

    // ── Phase 0: load everything shared across employees, once ───────
    const ctx = await payrollEngine.loadPayRunContext(id);
    if (ctx.employeeIds.length === 0) {
        throw new BadRequestError('Pay run has no selected employees');
    }

    const payslips = [];
    const warningCounts = { [SEVERITY.ERROR]: 0, [SEVERITY.WARNING]: 0, [SEVERITY.INFO]: 0 };
    let totalGross = 0;
    let totalNet = 0;
    let totalDeductions = 0;

    for (const employeeId of ctx.employeeIds) {
        // Phases 1–9: pure computation, no writes.
        const computed = await payrollEngine.computeEmployeePayslip(ctx, employeeId);

        // Phase 10: one transaction per employee.
        const payslip = await payslipRepo.insertPayslipWithLines({
            ...computed,
            pay_run_id: payRun.id,
            status: PAYSLIP_STATUS.COMPUTED,
        });

        // Totals accumulate from the engine's own numbers, never from the
        // returned row — pg hands DECIMAL columns back as strings, and `+`
        // on those concatenates instead of adding.
        totalGross += computed.gross_salary;
        totalNet += computed.net_salary;
        totalDeductions += computed.total_deductions;

        for (const warning of computed.warnings) {
            if (warningCounts[warning.severity] !== undefined) {
                warningCounts[warning.severity] += 1;
            }
        }

        payslips.push({
            id: payslip.id,
            employee_id: computed.employee_id,
            contract_id: computed.contract_id,
            gross_salary: computed.gross_salary,
            net_salary: computed.net_salary,
            total_deductions: computed.total_deductions,
            worked_days: computed.worked_days,
            worked_hours: computed.worked_hours,
            status: payslip.status,
            line_count: computed.lines.length,
            warnings: computed.warnings,
        });
    }

    const updated = await payRunRepo.updateStatus(id, PAYRUN_STATUS.COMPUTED);

    return {
        pay_run_id: payRun.id,
        status: updated.status,
        payslips_generated: payslips.length,
        total_gross: round2(totalGross),
        total_net: round2(totalNet),
        total_deductions: round2(totalDeductions),
        warning_counts: {
            error: warningCounts[SEVERITY.ERROR],
            warning: warningCounts[SEVERITY.WARNING],
            info: warningCounts[SEVERITY.INFO],
        },
        payslips,
    };
};

/**
 * Validation gate (algorithm doc §15): a computed pay run may only be
 * validated once every payslip carrying an error-severity warning has been
 * explicitly reviewed.
 *
 * @param {number|string} id
 * @returns {Promise<object>} The validated pay run plus `payslips_updated`.
 * @throws {NotFoundError} When the pay run does not exist.
 * @throws {ConflictError} Wrong status, or unreviewed error payslips remain.
 */
export const validate = async (id) => {
    const payRun = await payRunRepo.findByIdRaw(id);
    if (!payRun) {
        throw new NotFoundError('Pay run not found');
    }
    if (payRun.status !== PAYRUN_STATUS.COMPUTED) {
        throw new ConflictError('Pay run is not in computed state');
    }

    const blocking = await payslipRepo.findUnreviewedErrorPayslips(id);
    if (blocking.length > 0) {
        const names = blocking.map((row) => `${row.first_name} ${row.last_name}`);
        throw new ConflictError(`Unreviewed error payslips exist: ${names.join(', ')}`);
    }

    const updated = await payRunRepo.updateStatus(id, PAYRUN_STATUS.VALIDATED, {
        validated_at: new Date(),
    });
    const updatedPayslips = await payslipRepo.updateStatusByPayRun(id, PAYSLIP_STATUS.VALIDATED);

    return { ...updated, payslips_updated: updatedPayslips.length };
};

/**
 * Mark a validated pay run (and all of its payslips) as paid.
 *
 * @param {number|string} id
 * @returns {Promise<object>} The paid pay run plus `payslips_updated`.
 * @throws {NotFoundError} When the pay run does not exist.
 * @throws {ConflictError} When the pay run is not validated.
 */
export const markPaid = async (id) => {
    const payRun = await payRunRepo.findByIdRaw(id);
    if (!payRun) {
        throw new NotFoundError('Pay run not found');
    }
    if (payRun.status !== PAYRUN_STATUS.VALIDATED) {
        throw new ConflictError('Pay run is not in validated state');
    }

    const updated = await payRunRepo.updateStatus(id, PAYRUN_STATUS.PAID, { paid_at: new Date() });
    const updatedPayslips = await payslipRepo.updateStatusByPayRun(id, PAYSLIP_STATUS.PAID);

    return { ...updated, payslips_updated: updatedPayslips.length };
};
