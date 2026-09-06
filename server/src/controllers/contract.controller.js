/**
 * @fileoverview Contract Controller
 */

import asyncHandler from '#lib/asyncHandler.js';
import * as contractService from '#services/contract.service.js';
import { RESPONSE_CODES } from '#lib/common.js';
import { NotFoundError } from '#lib/errors.js';

/** GET /api/contracts */
export const getAll = asyncHandler(async (req, res) => {
    const isHR = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'].includes(req.user.role);
    const employee_id = isHR ? req.query.employee_id : req.user.sub;
    const items = await contractService.getAll({ employee_id });
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, count: items.length, data: items });
});

/** GET /api/contracts/:id */
export const getById = asyncHandler(async (req, res) => {
    const item = await contractService.getById(req.params.id);
    if (!item) throw new NotFoundError('Contract not found');
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: item });
});

/** POST /api/contracts */
export const createContract = asyncHandler(async (req, res) => {
    const {
        employee_id, schedule_id, salary_structure_id,
        overtime_policy_id, department_id, job_position_id,
        wage, start_date, end_date, status,
    } = req.body;

    const contract = await contractService.createContract({
        employee_id, schedule_id, salary_structure_id,
        overtime_policy_id, department_id, job_position_id,
        wage, start_date, end_date, status,
    });
    res.status(RESPONSE_CODES.CREATED_CODE).json({ success: true, data: contract });
});

/** PUT /api/contracts/:id — only end_date and status are mutable */
export const updateContract = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { end_date, status } = req.body;

    if (!end_date && !status) {
        return res.status(RESPONSE_CODES.BAD_REQUEST_CODE).json({
            success: false,
            error: 'Provide at least one of: end_date, status',
        });
    }

    const updated = await contractService.updateContract(id, { end_date, status });
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: updated });
});

/** DELETE /api/contracts/:id — only draft or cancelled contracts */
export const deleteContract = asyncHandler(async (req, res) => {
    await contractService.deleteContract(req.params.id);
    res.status(204).end();
});
