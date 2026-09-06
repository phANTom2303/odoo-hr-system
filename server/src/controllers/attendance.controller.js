import asyncHandler from '#lib/asyncHandler.js';
import * as attendanceService from '#services/attendance.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

/** GET /api/attendance */
export const getAll = asyncHandler(async (req, res) => {
    const { employee_id, status, date_from, date_to } = req.query;
    const items = await attendanceService.getAll({ employee_id, status, date_from, date_to });
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, count: items.length, data: items });
});

/** GET /api/attendance/:id */
export const getById = asyncHandler(async (req, res) => {
    const item = await attendanceService.getById(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: item });
});

/** GET /api/attendance/today */
export const getToday = asyncHandler(async (req, res) => {
    const record = await attendanceService.getToday(req.user.sub);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: record ?? null });
});

/** POST /api/attendance/checkin */
export const checkIn = asyncHandler(async (req, res) => {
    const record = await attendanceService.checkIn(req.user.sub);
    res.status(RESPONSE_CODES.CREATED_CODE).json({ success: true, data: record });
});

/** POST /api/attendance/checkout */
export const checkOut = asyncHandler(async (req, res) => {
    const record = await attendanceService.checkOut(req.user.sub);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: record });
});

/** POST /api/attendance/reset-today — DEV ONLY */
export const resetToday = asyncHandler(async (req, res) => {
    const record = await attendanceService.resetToday(req.user.sub);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: record });
});

/**
 * PUT /api/attendance/:id
 * HR manual correction — can update check_in, check_out, worked_hours, status.
 * Sets is_manual_edit = TRUE and records edited_by.
 */
export const manualUpdate = asyncHandler(async (req, res) => {
    const { check_in, check_out, worked_hours, status } = req.body;
    const record = await attendanceService.manualUpdate(
        req.params.id,
        { check_in, check_out, worked_hours, status },
        req.user.sub,
    );
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: record });
});
