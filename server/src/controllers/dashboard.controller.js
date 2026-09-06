/**
 * @fileoverview Dashboard Controller
 */

import asyncHandler from '#lib/asyncHandler.js';
import * as dashboardService from '#services/dashboard.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

/**
 * GET /api/dashboard/summary
 * Optional query: period ('YYYY-MM', defaults to current month), department_id, employee_type.
 */
export const getSummary = asyncHandler(async (req, res) => {
    const { period, department_id, employee_type } = req.query;
    const data = await dashboardService.getSummary({ period, department_id, employee_type });

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data,
    });
});
