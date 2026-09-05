/**
 * @fileoverview Pay Run Controller
 */

import asyncHandler from '#lib/asyncHandler.js';
import * as payRunService from '#services/payRun.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

/** GET /api/pay-runs */
export const getAll = asyncHandler(async (req, res) => {
    const { status, start_date, end_date } = req.query;
    const items = await payRunService.getAll({ status, start_date, end_date });

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        count: items.length,
        data: items,
    });
});

/**
 * POST /api/pay-runs
 * Creates a new pay run.
 * Required body: salary_structure_id, start_date, end_date, employee_ids.
 * Optional body: name.
 */
export const create = asyncHandler(async (req, res) => {
    const { name, salary_structure_id, start_date, end_date, employee_ids } = req.body;
    const createdBy = req.user.sub;

    const payRun = await payRunService.create(
        { name, salary_structure_id, start_date, end_date, employee_ids },
        createdBy,
    );

    res.status(RESPONSE_CODES.CREATED_CODE).json({
        success: true,
        data: payRun,
    });
});

/** GET /api/pay-runs/eligible-employees */
export const getEligibleEmployees = asyncHandler(async (req, res) => {
    const { start_date, end_date, department_id, employee_type } = req.query;
    const items = await payRunService.getEligibleEmployees({ start_date, end_date, department_id, employee_type });

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        count: items.length,
        data: items,
    });
});

/** GET /api/pay-runs/:id */
export const getById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const item = await payRunService.getById(id);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: item,
    });
});

/**
 * PUT /api/pay-runs/:id
 * Updates a pay run's mutable metadata (draft runs only).
 */
export const updateMeta = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    const updated = await payRunService.updateMeta(id, { name });

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: updated,
    });
});

/** DELETE /api/pay-runs/:id — draft only */
export const remove = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const deleted = await payRunService.remove(id);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: deleted,
    });
});

/** POST /api/pay-runs/:id/compute */
export const compute = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const summary = await payRunService.compute(id);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: summary,
    });
});

/** POST /api/pay-runs/:id/validate */
export const validate = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await payRunService.validate(id);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: result,
    });
});

/** POST /api/pay-runs/:id/mark-paid */
export const markPaid = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await payRunService.markPaid(id);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: result,
    });
});
