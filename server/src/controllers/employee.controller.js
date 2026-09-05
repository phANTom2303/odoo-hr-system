import asyncHandler from '#lib/asyncHandler.js';
import * as employeeService from '#services/employee.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

export const getAll = asyncHandler(async (req, res) => {
    const { search, department, status, role } = req.query;
    const employees = await employeeService.getAll({ search, department, status, role });
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, count: employees.length, data: employees });
});

export const getById = asyncHandler(async (req, res) => {
    const employee = await employeeService.getById(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: employee });
});

export const create = asyncHandler(async (req, res) => {
    const employee = await employeeService.create(req.body);
    res.status(RESPONSE_CODES.CREATED_CODE).json({ success: true, data: employee });
});

export const update = asyncHandler(async (req, res) => {
    const employee = await employeeService.update(req.params.id, req.body);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: employee });
});

export const remove = asyncHandler(async (req, res) => {
    await employeeService.remove(req.params.id);
    res.status(204).end();
});

/* Sub-resources */
export const getContracts = asyncHandler(async (req, res) => {
    const data = await employeeService.getContracts(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, count: data.length, data });
});

export const getAttendance = asyncHandler(async (req, res) => {
    const data = await employeeService.getAttendance(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, count: data.length, data });
});

export const getTimeOffRequests = asyncHandler(async (req, res) => {
    const data = await employeeService.getTimeOffRequests(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, count: data.length, data });
});

export const getAllocations = asyncHandler(async (req, res) => {
    const data = await employeeService.getAllocations(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, count: data.length, data });
});
