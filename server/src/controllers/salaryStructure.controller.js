import asyncHandler from '#lib/asyncHandler.js';
import * as structureService from '#services/salaryStructure.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

export const getAll = asyncHandler(async (req, res) => {
    const structures = await structureService.getAll();
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, count: structures.length, data: structures });
});

export const getById = asyncHandler(async (req, res) => {
    const structure = await structureService.getById(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: structure });
});

export const create = asyncHandler(async (req, res) => {
    const structure = await structureService.create(req.body);
    res.status(RESPONSE_CODES.CREATED_CODE).json({ success: true, data: structure });
});

export const update = asyncHandler(async (req, res) => {
    const structure = await structureService.update(req.params.id, req.body);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: structure });
});

export const remove = asyncHandler(async (req, res) => {
    await structureService.remove(req.params.id);
    res.status(204).end();
});
