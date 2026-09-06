import { fetcher } from './client';

export const getAllocations = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
  ).toString();
  return fetcher(`/allocations${qs ? `?${qs}` : ''}`);
};

export const getAllocationById = (id) => fetcher(`/allocations/${id}`);

export const createAllocation = (data) =>
  fetcher('/allocations', { method: 'POST', body: JSON.stringify(data) });

export const deleteAllocation = (id) =>
  fetcher(`/allocations/${id}`, { method: 'DELETE' });

export const approveAllocation = (id, approved_by) =>
  fetcher(`/allocations/${id}/approve`, { method: 'POST', body: JSON.stringify({ approved_by }) });

export const refuseAllocation = (id) =>
  fetcher(`/allocations/${id}/refuse`, { method: 'POST', body: JSON.stringify({}) });
