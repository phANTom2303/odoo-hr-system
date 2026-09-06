import { fetcher } from './client';

export const getAttendance = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
  ).toString();
  return fetcher(`/attendance${qs ? `?${qs}` : ''}`);
};

export const getAttendanceById = (id) => fetcher(`/attendance/${id}`);

/** GET /api/attendance/today — returns today's record for the logged-in user, or { data: null } */
export const getTodayAttendance = () => fetcher('/attendance/today');

/** POST /api/attendance/checkin */
export const checkInRequest = () =>
  fetcher('/attendance/checkin', { method: 'POST' });

/** POST /api/attendance/checkout */
export const checkOutRequest = () =>
  fetcher('/attendance/checkout', { method: 'POST' });

/** POST /api/attendance/reset-today — DEV ONLY */
export const resetTodayRequest = () =>
  fetcher('/attendance/reset-today', { method: 'POST' });
