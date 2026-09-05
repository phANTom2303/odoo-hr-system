import asyncHandler from '#lib/asyncHandler.js';
import * as typeService from '#services/timeOffType.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

export const getAll = asyncHandler(async (req, res) => {
    const types = await typeService.getAll();
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, count: types.length, data: types });
});

export const getById = asyncHandler(async (req, res) => {
    const type = await typeService.getById(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: type });
});

export const create = asyncHandler(async (req, res) => {
    const type = await typeService.create(req.body);
    res.status(RESPONSE_CODES.CREATED_CODE).json({ success: true, data: type });
});

export const update = asyncHandler(async (req, res) => {
    const type = await typeService.update(req.params.id, req.body);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: type });
});

export const remove = asyncHandler(async (req, res) => {
    await typeService.remove(req.params.id);
    res.status(204).end();
});
