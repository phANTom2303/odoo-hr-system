/**
 * @fileoverview Contract Controller
 */

import asyncHandler from '#lib/asyncHandler.js';
import * as contractService from '#services/contract.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

/** GET /api/contracts */
export const getAll = asyncHandler(async (req, res) => {
    const items = await contractService.getAll();

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        count: items.length,
        data: items,
    });
});
