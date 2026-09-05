/**
 * @fileoverview Contract Service
 */

import * as contractRepo from '#repositories/contract.repo.js';

// ── Service Methods ─────────────────────────────────────────────────

export const getAll = async () => {
    const rows = await contractRepo.findAll();
    return rows;
};

export const getById = async (id) => {
    const row = await contractRepo.findById(id);
    return row;
};
