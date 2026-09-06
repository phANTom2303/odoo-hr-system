/**
 * @fileoverview Audit Log Controller
 */

import asyncHandler from '#lib/asyncHandler.js';
import * as auditRepo from '#repositories/audit.repo.js';
import { RESPONSE_CODES } from '#lib/common.js';

/**
 * GET /api/audit-logs
 * Latest 50 audit log entries, newest first. No pagination (demo scope).
 */
export const getRecent = asyncHandler(async (req, res) => {
    const data = await auditRepo.findRecent(50);
    res.status(RESPONSE_CODES.SUCCESS_CODE).json({ success: true, data });
});
