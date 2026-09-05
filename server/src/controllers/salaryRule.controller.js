import asyncHandler from '#lib/asyncHandler.js';
import * as ruleService from '#services/salaryRule.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

export const getByStructure = asyncHandler(async (req, res) => {
    const rules = await ruleService.getByStructure(req.params.structureId);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, count: rules.length, data: rules });
});

export const getById = asyncHandler(async (req, res) => {
    const rule = await ruleService.getById(req.params.id);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: rule });
});

export const create = asyncHandler(async (req, res) => {
    const rule = await ruleService.create(req.params.structureId, req.body);
    res.status(RESPONSE_CODES.CREATED_CODE).json({ success: true, data: rule });
});

export const update = asyncHandler(async (req, res) => {
    const rule = await ruleService.update(req.params.id, req.body);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data: rule });
});

export const remove = asyncHandler(async (req, res) => {
    await ruleService.remove(req.params.id);
    res.status(204).end();
});
