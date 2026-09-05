import asyncHandler from '#lib/asyncHandler.js';
import * as holidayService from '#services/holiday.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

export const getAll = asyncHandler(async (req, res) => {
    const holidays = await holidayService.getAll();
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, count: holidays.length, data: holidays });
});

export const getById = asyncHandler(async (req, res) => {
    const holiday = await holidayService.getById(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: holiday });
});

export const create = asyncHandler(async (req, res) => {
    const holiday = await holidayService.create(req.body);
    res.status(RESPONSE_CODES.CREATED_CODE).json({ success: true, data: holiday });
});

export const update = asyncHandler(async (req, res) => {
    const holiday = await holidayService.update(req.params.id, req.body);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: holiday });
});

export const remove = asyncHandler(async (req, res) => {
    await holidayService.remove(req.params.id);
    res.status(204).end();
});
