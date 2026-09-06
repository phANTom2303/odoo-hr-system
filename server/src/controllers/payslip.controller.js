/**
 * @fileoverview Payslip Controller
 */

import asyncHandler from '#lib/asyncHandler.js';
import * as payslipService from '#services/payslip.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

/** GET /api/payslips */
export const getAll = asyncHandler(async (req, res) => {
    const { pay_run_id, employee_id, status } = req.query;
    const items = await payslipService.getAll({ pay_run_id, employee_id, status });

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
