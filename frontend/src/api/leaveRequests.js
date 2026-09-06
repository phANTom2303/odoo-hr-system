import { fetcher } from './client';

export const getLeaveRequests = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
  ).toString();
  return fetcher(`/leave-requests${qs ? `?${qs}` : ''}`);
};

export const getLeaveRequestById = (id) => fetcher(`/leave-requests/${id}`);

export const createLeaveRequest = (data) =>
  fetcher('/leave-requests', { method: 'POST', body: JSON.stringify(data) });

export const approveLeaveRequest = (id, approver_id) =>
  fetcher(`/leave-requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ approver_id }) });

export const refuseLeaveRequest = (id) =>
  fetcher(`/leave-requests/${id}/refuse`, { method: 'POST', body: JSON.stringify({}) });

export const withdrawLeaveRequest = (id) =>
  fetcher(`/leave-requests/${id}/withdraw`, { method: 'POST', body: JSON.stringify({}) });
