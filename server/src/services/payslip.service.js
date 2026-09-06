/**
 * @fileoverview Payslip Service — read + review business logic for payslips.
 *
 * Payslips are never created here: they are produced by the payroll engine and
 * persisted by `payRun.service.js#compute` (algorithm doc Phase 10). This
 * module only reads them back for display and drives the review gate that
 * unblocks `POST /pay-runs/:id/validate` (§15).
 *
 * Throws typed errors from `#lib/errors.js`; never touches `req`/`res`.
 */

import * as payslipRepo from '#repositories/payslip.repo.js';
import * as payRunRepo from '#repositories/payRun.repo.js';
import * as payRunService from '#services/payRun.service.js';
import { ConflictError, NotFoundError, BadRequestError } from '#lib/errors.js';
import { CATEGORY, PAYRUN_STATUS, PAYSLIP_STATUS } from '#lib/payroll.constants.js';
import { num, round2 } from '#utils/payrollDates.js';

/** Payslip statuses that are terminal — a review can no longer change anything. */
const UNREVIEWABLE_STATUSES = new Set([PAYSLIP_STATUS.PAID, PAYSLIP_STATUS.CANCELLED]);

/**
 * Signed subtotal of the payslip lines in each salary rule category, for the
 * frontend's computation panel.
 *
 * Signs match the stored line amounts: `deduction` (PF, PT, UNPAID_LV) is
 * negative, every other category is positive. The engine persists every
 * deduction line negative, so the invariant is:
 *
 *     totals.deduction === -payslip.total_deductions
 *
 * `gross` / `net` are the back-filled placeholder rows, so on a multi-segment
 * payslip they repeat the whole-payslip total once per segment — read the
 * payslip's own `gross_salary` / `net_salary` columns for the authoritative
 * aggregates.
 *
 * @param {object[]} lines - Rows from `payslip.repo.js#findLines`.
 * @returns {{basic: number, allowance: number, gross: number, deduction: number, net: number}}
 */
const rollUpByCategory = (lines) => {
    const totals = {
        [CATEGORY.BASIC]: 0,
        [CATEGORY.ALLOWANCE]: 0,
        [CATEGORY.GROSS]: 0,
        [CATEGORY.DEDUCTION]: 0,
        [CATEGORY.NET]: 0,
    };

    for (const line of lines) {
        if (totals[line.category] === undefined) continue;
        // `amount` is DECIMAL — pg hands it back as a string, so `num()` is
        // mandatory before it takes part in a sum.
        totals[line.category] += num(line.amount);
    }

    for (const key of Object.keys(totals)) {
        totals[key] = round2(totals[key]);
    }

    return totals;
};

/**
 * List payslips, optionally scoped to a pay run / employee / status.
 *
 * @param {object} [filters]
 * @param {number|string} [filters.pay_run_id]
 * @param {number|string} [filters.employee_id]
 * @param {string} [filters.status]
 * @returns {Promise<object[]>}
 */
export const getAll = async (filters = {}) => {
    return payslipRepo.findAll(filters);
};

/**
 * Fetch one payslip with its snapshot lines and a per-category roll-up.
 *
 * @param {number|string} id
 * @returns {Promise<object>} The payslip row plus `lines` and `totals`.
 * @throws {NotFoundError} When the payslip does not exist.
 */
export const getById = async (id) => {
    const payslip = await payslipRepo.findById(id);
    if (!payslip) {
        throw new NotFoundError('Payslip not found');
    }

    const lines = await payslipRepo.findLines(id);

    return { ...payslip, lines, totals: rollUpByCategory(lines) };
};

/**
 * Mark a payslip as reviewed — this is what clears its error-severity
 * warnings from the validation gate (algorithm doc §15).
 *
 * @param {number|string} id
 * @param {number} userId - Reviewer, from `req.user.sub`.
 * @returns {Promise<object>} The updated payslip row.
 * @throws {NotFoundError} When the payslip does not exist.
 * @throws {ConflictError} When the payslip is already paid or cancelled.
 */
export const review = async (id, userId) => {
    const payslip = await payslipRepo.findById(id);
    if (!payslip) {
        throw new NotFoundError('Payslip not found');
    }
    if (UNREVIEWABLE_STATUSES.has(payslip.status)) {
        throw new ConflictError(`Payslips with status '${payslip.status}' cannot be reviewed`);
    }

    return payslipRepo.markReviewed(id, userId);
};

/**
 * Add a manual line to a payslip and recalculate its totals.
 */
export const addManualLine = async (id, data) => {
    const payslip = await payslipRepo.findById(id);
    if (!payslip) {
        throw new NotFoundError('Payslip not found');
    }
    if (UNREVIEWABLE_STATUSES.has(payslip.status)) {
        throw new ConflictError(`Payslips with status '${payslip.status}' cannot be edited`);
    }

    const { rule_name, amount, category } = data;
    if (!rule_name || !amount || !category) {
        throw new BadRequestError('rule_name, amount, category are required');
    }

    let signedAmount = num(amount);
    if (category === CATEGORY.DEDUCTION && signedAmount > 0) {
        signedAmount = -signedAmount;
    }

    await payslipRepo.insertManualLine(id, { rule_name, amount: signedAmount, category });

    const lines = await payslipRepo.findLines(id);
    const totals = rollUpByCategory(lines);

    const newGross = totals[CATEGORY.BASIC] + totals[CATEGORY.ALLOWANCE];
    const newDeductions = Math.abs(totals[CATEGORY.DEDUCTION]);
    const newNet = newGross - newDeductions;

    const updated = await payslipRepo.updatePayslipTotals(id, { 
        gross_salary: newGross, 
        total_deductions: newDeductions, 
        net_salary: newNet 
    });

    return { ...updated, lines, totals: rollUpByCategory(lines) };
};

/**
 * Cancel a payslip: removes employee from pay run, deletes payslips, reverts pay run to draft, and re-computes.
 */
export const cancel = async (id) => {
    const payslip = await payslipRepo.findById(id);
    if (!payslip) {
        throw new NotFoundError('Payslip not found');
    }
    if (UNREVIEWABLE_STATUSES.has(payslip.status)) {
        throw new ConflictError(`Payslips with status '${payslip.status}' cannot be cancelled`);
    }

    const payRunId = payslip.pay_run_id;

    await payRunRepo.removeEmployee(payRunId, payslip.employee_id);
    await payslipRepo.deleteByPayRun(payRunId);
    await payRunRepo.updateMeta(payRunId, { status: PAYRUN_STATUS.DRAFT });

    return payRunService.compute(payRunId);
};
