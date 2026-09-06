import { fetcher } from './client';

/**
 * Payroll API — wrappers for /api/pay-runs and /api/payslips.
 * See PAYROLL_API_REFERENCE.md at the repo root for full request/response shapes.
 *
 * Number & date gotcha (see PAYROLL_API_REFERENCE.md §2): money/day fields come back as
 * JSON strings on payslip rows (e.g. "113600.00") but as real numbers inside compute /
 * validate / mark-paid summaries. Use `n()` below to coerce at the call site.
 */

const qs = (params = {}) =>
  new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  ).toString();

/** Coerce a value that may be a numeric string, a number, or null/undefined. */
export const n = (v) => (v === null || v === undefined ? null : Number(v));

// ── Pay Runs ────────────────────────────────────────────────────────────
export const getPayRuns = (params = {}) => fetcher(`/pay-runs${qs(params) ? `?${qs(params)}` : ''}`);

export const getEligibleEmployees = (params) => fetcher(`/pay-runs/eligible-employees?${qs(params)}`);

export const getPayRunById = (id) => fetcher(`/pay-runs/${id}`);

export const createPayRun = (data) =>
  fetcher('/pay-runs', { method: 'POST', body: JSON.stringify(data) });

export const renamePayRun = ({ id, name }) =>
  fetcher(`/pay-runs/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });

export const deletePayRun = (id) => fetcher(`/pay-runs/${id}`, { method: 'DELETE' });

export const computePayRun = (id) => fetcher(`/pay-runs/${id}/compute`, { method: 'POST' });

export const validatePayRun = (id) => fetcher(`/pay-runs/${id}/validate`, { method: 'POST' });

export const markPayRunPaid = (id) => fetcher(`/pay-runs/${id}/mark-paid`, { method: 'POST' });

// ── Payslips ────────────────────────────────────────────────────────────
export const getPayslips = (params = {}) => fetcher(`/payslips${qs(params) ? `?${qs(params)}` : ''}`);

export const getPayslipById = (id) => fetcher(`/payslips/${id}`);

export const reviewPayslip = (id) => fetcher(`/payslips/${id}/review`, { method: 'POST' });

export const addManualLine = (payslipId, data) =>
  fetcher(`/payslips/${payslipId}/manual-lines`, { method: 'POST', body: JSON.stringify(data) });

export const cancelPayslip = (payslipId) =>
  fetcher(`/payslips/${payslipId}/cancel`, { method: 'POST' });

export const updatePayRunMeta = (id, data) =>
  fetcher(`/pay-runs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
