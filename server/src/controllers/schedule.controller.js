import asyncHandler from '#lib/asyncHandler.js';
import * as scheduleService from '#services/schedule.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

export const getAll = asyncHandler(async (req, res) => {
    const schedules = await scheduleService.getAll();
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, count: schedules.length, data: schedules });
});

export const getById = asyncHandler(async (req, res) => {
    const schedule = await scheduleService.getById(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: schedule });
});

export const create = asyncHandler(async (req, res) => {
    const schedule = await scheduleService.create(req.body);
    res.status(RESPONSE_CODES.CREATED_CODE).json({ success: true, data: schedule });
});

export const update = asyncHandler(async (req, res) => {
    const schedule = await scheduleService.update(req.params.id, req.body);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: schedule });
});

export const remove = asyncHandler(async (req, res) => {
    await scheduleService.remove(req.params.id);
    res.status(204).end();
});
