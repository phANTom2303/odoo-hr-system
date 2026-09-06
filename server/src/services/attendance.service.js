import * as attendanceRepo from '#repositories/attendance.repo.js';
import { NotFoundError, BadRequestError } from '#lib/errors.js';
import { logger } from '#config/logger.js';

export const getAll = async (filters = {}) => {
    logger.info({ filters }, 'Fetching attendance records');
    return attendanceRepo.findAll(filters);
};

export const getById = async (id) => {
    const row = await attendanceRepo.findById(id);
    if (!row) throw new NotFoundError(`Attendance record with id "${id}" not found`);
    return row;
};

/** Returns today's attendance record for the given employee, or null. */
export const getToday = async (employee_id) => {
    return attendanceRepo.findTodayByEmployee(employee_id);
};

/**
 * Check in for today.
 * Blocks if already checked in (no checkout yet) OR already completed today.
 */
export const checkIn = async (employee_id) => {
    const existing = await attendanceRepo.findTodayByEmployee(employee_id);

    if (existing?.check_in && !existing?.check_out) {
        throw new BadRequestError('You are already checked in for today.');
    }
    if (existing?.check_in && existing?.check_out) {
        throw new BadRequestError('You have already completed your attendance for today.');
    }

    const row = await attendanceRepo.checkIn(employee_id);
    logger.info({ employee_id, record_id: row.id }, 'Employee checked in');
    return row;
};

/**
 * Check out for today.
 * Calculates worked_hours from check_in → NOW().
 */
export const checkOut = async (employee_id) => {
    const existing = await attendanceRepo.findTodayByEmployee(employee_id);

    if (!existing) {
        throw new BadRequestError('No check-in record found for today. Please check in first.');
    }
    if (!existing.check_in) {
        throw new BadRequestError('You have not checked in today.');
    }
    if (existing.check_out) {
        throw new BadRequestError('You have already checked out for today.');
    }

    const checkInMs    = new Date(existing.check_in).getTime();
    const worked_hours = parseFloat(((Date.now() - checkInMs) / 3_600_000).toFixed(2));

    const row = await attendanceRepo.checkOut(employee_id, worked_hours);
    logger.info({ employee_id, worked_hours, record_id: row.id }, 'Employee checked out');
    return row;
};

/** DEV ONLY — resets today's checkout so check-in can be tested again */
export const resetToday = async (employee_id) => {
    return attendanceRepo.resetTodayCheckout(employee_id);
};

/**
 * HR manual correction of any attendance record.
 * Sets is_manual_edit = TRUE and records edited_by from the JWT.
 */
export const manualUpdate = async (id, fields, edited_by) => {
    const existing = await attendanceRepo.findById(id);
    if (!existing) throw new NotFoundError(`Attendance record with id "${id}" not found`);

    // Recompute worked_hours if both timestamps provided
    let { check_in, check_out, worked_hours, status } = fields;
    if (check_in && check_out && worked_hours == null) {
        worked_hours = parseFloat(
            ((new Date(check_out).getTime() - new Date(check_in).getTime()) / 3_600_000).toFixed(2)
        );
    }

    const row = await attendanceRepo.manualUpdate(id, { check_in, check_out, worked_hours, status }, edited_by);
    logger.info({ id, edited_by }, 'Attendance manually corrected');
    return row;
};
