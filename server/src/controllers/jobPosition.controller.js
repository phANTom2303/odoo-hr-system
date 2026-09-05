/**
 * @fileoverview Job Position Controller — HTTP interface layer.
 * Extracts data from req, delegates to the service, returns standardized responses.
 * Every handler is wrapped in asyncHandler to forward errors to the global error handler.
 */

import asyncHandler from '#lib/asyncHandler.js';
import * as jobPositionService from '#services/jobPosition.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

/**
 * GET /api/job-positions
 * Returns all job positions (each includes department_name).
 */
export const getAll = asyncHandler(async (req, res) => {
    const jobPositions = await jobPositionService.getAll();

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        count: jobPositions.length,
        data: jobPositions,
    });
});

/**
 * GET /api/job-positions/:id
 * Returns a single job position by UUID.
 */
export const getById = asyncHandler(async (req, res) => {
    const jobPosition = await jobPositionService.getById(req.params.id);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: jobPosition,
    });
});

/**
 * POST /api/job-positions
 * Creates a new job position.
 */
export const create = asyncHandler(async (req, res) => {
    const jobPosition = await jobPositionService.create(req.body);

    res.status(RESPONSE_CODES.CREATED_CODE).json({
        success: true,
        data: jobPosition,
    });
});

/**
 * PUT /api/job-positions/:id
 * Full replacement update for a job position.
 */
export const update = asyncHandler(async (req, res) => {
    const jobPosition = await jobPositionService.update(req.params.id, req.body);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: jobPosition,
    });
});

/**
 * PATCH /api/job-positions/:id
 * Partial update for a job position.
 */
export const patch = asyncHandler(async (req, res) => {
    const jobPosition = await jobPositionService.update(req.params.id, req.body);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: jobPosition,
    });
});

/**
 * DELETE /api/job-positions/:id
 * Deletes a job position. Blocked if referenced by active employees or contracts.
 */
export const remove = asyncHandler(async (req, res) => {
    await jobPositionService.remove(req.params.id);

    res.status(204).end();
});
