/**
 * @fileoverview Payslip Controller
 */

import asyncHandler from '#lib/asyncHandler.js';
import * as payslipService from '#services/payslip.service.js';
import { RESPONSE_CODES } from '#lib/common.js';
import { ForbiddenError } from '#lib/errors.js';
import { PAYROLL_READ } from '#lib/roles.js';
import { PAYSLIP_STATUS } from '#lib/payroll.constants.js';

/**
 * Payslip statuses an employee is allowed to see for themselves. Draft /
 * computed payslips are still being edited by payroll (manual lines, review,
 * recompute) and cancelled ones are meaningless, so only finalised payslips
 * are exposed on the self-service side.
 */
const EMPLOYEE_VISIBLE_STATUSES = [PAYSLIP_STATUS.VALIDATED, PAYSLIP_STATUS.PAID];

/** True when the caller holds a payroll role and may read every payslip. */
const canReadAllPayslips = (user) => PAYROLL_READ.includes(user.role);

/** GET /api/payslips */
export const getAll = asyncHandler(async (req, res) => {
    const { pay_run_id, employee_id, status } = req.query;
    const isPayroll = canReadAllPayslips(req.user);

    // Employees may only ever list their own finalised payslips — the
    // employee_id / status query params are ignored for them.
    const filters = isPayroll
        ? { pay_run_id, employee_id, status }
        : {
            pay_run_id,
            employee_id: req.user.sub,
            status: status && EMPLOYEE_VISIBLE_STATUSES.includes(status)
                ? status
                : EMPLOYEE_VISIBLE_STATUSES,
        };

    const items = await payslipService.getAll(filters);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        count: items.length,
        data: items,
    });
});

/** GET /api/payslips/:id */
export const getById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const item = await payslipService.getById(id);

    if (!canReadAllPayslips(req.user)) {
        const isOwner = Number(item.employee_id) === Number(req.user.sub);
        if (!isOwner || !EMPLOYEE_VISIBLE_STATUSES.includes(item.status)) {
            throw new ForbiddenError('You can only view your own payslips.');
        }
    }

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: item,
    });
});

/** POST /api/payslips/:id/review */
export const review = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.sub;

    const reviewed = await payslipService.review(id, userId);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: reviewed,
    });
});

/** POST /api/payslips/:id/manual-lines */
export const addManualLine = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rule_name, amount, category } = req.body;

    const updated = await payslipService.addManualLine(id, { rule_name, amount, category });

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: updated,
    });
});

/** POST /api/payslips/:id/cancel */
export const cancel = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const result = await payslipService.cancel(id);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: result,
    });
});
