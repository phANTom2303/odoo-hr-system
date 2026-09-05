/**
 * @fileoverview Contract Controller
 */

import asyncHandler from '#lib/asyncHandler.js';
import * as contractService from '#services/contract.service.js';
import { RESPONSE_CODES } from '#lib/common.js';
import { NotFoundError } from '#lib/errors.js';

/** GET /api/contracts */
export const getAll = asyncHandler(async (req, res) => {
    const items = await contractService.getAll();

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        count: items.length,
        data: items,
    });
});

/** GET /api/contracts/:id */
export const getById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const item = await contractService.getById(id);

    if (!item) {
        throw new NotFoundError('Contract not found');
    }

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: item,
    });
});

/**
 * POST /api/contracts
 * Creates a new contract.
 * Required body: employee_id, schedule_id, salary_structure_id, wage, start_date.
 * Optional body: overtime_policy_id, department_id, job_position_id, end_date, status.
 */
export const createContract = asyncHandler(async (req, res) => {
    const {
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
    } = req.body;

    const contract = await contractService.createContract({
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

    res.status(RESPONSE_CODES.CREATED_CODE).json({
        success: true,
        data: contract,
    });
});
