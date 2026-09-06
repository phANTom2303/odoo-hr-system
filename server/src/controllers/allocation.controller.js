import asyncHandler from '#lib/asyncHandler.js';
import * as allocationService from '#services/allocation.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

/** GET /api/allocations */
export const getAll = asyncHandler(async (req, res) => {
    const { employee_id, status, time_off_type_id } = req.query;
    const items = await allocationService.getAll({ employee_id, status, time_off_type_id });
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, count: items.length, data: items });
});

/** GET /api/allocations/:id */
export const getById = asyncHandler(async (req, res) => {
    const item = await allocationService.getById(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: item });
});

/** POST /api/allocations */
export const create = asyncHandler(async (req, res) => {
    const item = await allocationService.create(req.body);
    res.status(RESPONSE_CODES.CREATED_CODE).json({ success: true, data: item });
});

/** DELETE /api/allocations/:id */
export const remove = asyncHandler(async (req, res) => {
    await allocationService.remove(req.params.id);
    res.status(204).end();
});

/** POST /api/allocations/:id/approve */
export const approve = asyncHandler(async (req, res) => {
    const item = await allocationService.approve(req.params.id, req.body.approved_by ?? null);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: item });
});

/** POST /api/allocations/:id/refuse */
export const refuse = asyncHandler(async (req, res) => {
    const item = await allocationService.refuse(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: item });
});

/** PUT /api/allocations/:id — edit draft allocation */
export const update = asyncHandler(async (req, res) => {
    const { start_date, end_date, allocated_amount } = req.body;
    const item = await allocationService.update(req.params.id, { start_date, end_date, allocated_amount });
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: item });
});
