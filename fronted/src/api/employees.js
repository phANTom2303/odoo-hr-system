import { fetcher } from './client';

export const getEmployees = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
  ).toString();
  return fetcher(`/employees${qs ? `?${qs}` : ''}`);
};

export const getEmployeeById = (id) => fetcher(`/employees/${id}`);

export const createEmployee = (data) =>
  fetcher('/employees', { method: 'POST', body: JSON.stringify(data) });

export const updateEmployee = ({ id, ...data }) =>
  fetcher(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteEmployee = (id) =>
  fetcher(`/employees/${id}`, { method: 'DELETE' });

// Sub-resources
export const getEmployeeContracts    = (id) => fetcher(`/employees/${id}/contracts`);
export const getEmployeeAttendance   = (id) => fetcher(`/employees/${id}/attendance`);
export const getEmployeeTimeOff      = (id) => fetcher(`/employees/${id}/time-off/requests`);
export const getEmployeeAllocations  = (id) => fetcher(`/employees/${id}/time-off/allocations`);
