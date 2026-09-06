import { fetcher } from './client';

export const getSchedules = () => fetcher('/schedules');

export const getScheduleById = (id) => fetcher(`/schedules/${id}`);

export const createSchedule = (data) =>
  fetcher('/schedules', { method: 'POST', body: JSON.stringify(data) });

export const updateSchedule = ({ id, ...data }) =>
  fetcher(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteSchedule = (id) =>
  fetcher(`/schedules/${id}`, { method: 'DELETE' });
