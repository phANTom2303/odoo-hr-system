/**
 * @fileoverview Department Controller — HTTP interface layer.
 * Extracts data from req, delegates to the service, returns standardized responses.
 * Every handler is wrapped in asyncHandler to forward errors to the global error handler.
 */

import asyncHandler from '#lib/asyncHandler.js';
import * as departmentService from '#services/department.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

/**
 * GET /api/departments
 * Returns all departments.
 */
export const getAll = asyncHandler(async (req, res) => {
    const departments = await departmentService.getAll();

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        count: departments.length,
        data: departments,
    });
});

/**
 * GET /api/departments/:id
 * Returns a single department by UUID.
 */
export const getById = asyncHandler(async (req, res) => {
    const department = await departmentService.getById(req.params.id);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: department,
    });
});

/**
 * POST /api/departments
 * Creates a new department.
 */
export const create = asyncHandler(async (req, res) => {
    const department = await departmentService.create(req.body);

    res.status(RESPONSE_CODES.CREATED_CODE).json({
        success: true,
        data: department,
    });
});

/**
 * PUT /api/departments/:id
 * Full replacement update for a department.
 */
export const update = asyncHandler(async (req, res) => {
    const department = await departmentService.update(req.params.id, req.body);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: department,
    });
});

/**
 * PATCH /api/departments/:id
 * Partial update for a department.
 * Reuses the same service method — partial fields handled via dynamic SET clause.
 */
export const patch = asyncHandler(async (req, res) => {
    const department = await departmentService.update(req.params.id, req.body);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: department,
    });
});

/**
 * DELETE /api/departments/:id
 * Deletes a department. Blocked if referenced by active employees or contracts.
 */
export const remove = asyncHandler(async (req, res) => {
    await departmentService.remove(req.params.id);

    res.status(204).end();
});
