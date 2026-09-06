import { fetcher } from './client';

const qs = (params = {}) =>
  new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  ).toString();

export const getDashboardSummary = (params = {}) =>
  fetcher(`/dashboard/summary${qs(params) ? `?${qs(params)}` : ''}`);
