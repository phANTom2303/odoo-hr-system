/**
 * @fileoverview Contract Service
 */

import * as contractRepo from '#repositories/contract.repo.js';

// ── Service Methods ─────────────────────────────────────────────────

export const getAll = async () => {
    const rows = await contractRepo.findAll();
    return rows;
};
