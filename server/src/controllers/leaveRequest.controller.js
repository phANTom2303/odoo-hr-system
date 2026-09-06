import asyncHandler from '#lib/asyncHandler.js';
import * as leaveService from '#services/leaveRequest.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

/** GET /api/leave-requests */
export const getAll = asyncHandler(async (req, res) => {
    const { employee_id, status, time_off_type_id } = req.query;
    const items = await leaveService.getAll({ employee_id, status, time_off_type_id });
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, count: items.length, data: items });
});

/** GET /api/leave-requests/:id */
export const getById = asyncHandler(async (req, res) => {
    const item = await leaveService.getById(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: item });
});

/** POST /api/leave-requests */
export const create = asyncHandler(async (req, res) => {
    const item = await leaveService.create(req.body);
    res.status(RESPONSE_CODES.CREATED_CODE).json({ success: true, data: item });
});

/** POST /api/leave-requests/:id/approve */
export const approve = asyncHandler(async (req, res) => {
    const item = await leaveService.approve(req.params.id, req.body.approver_id ?? null);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: item });
});

/** POST /api/leave-requests/:id/refuse */
export const refuse = asyncHandler(async (req, res) => {
    const item = await leaveService.refuse(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: item });
});

/** POST /api/leave-requests/:id/withdraw */
export const withdraw = asyncHandler(async (req, res) => {
    const item = await leaveService.withdraw(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: item });
});
