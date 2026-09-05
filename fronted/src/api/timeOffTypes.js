import { fetcher } from './client';

export const getTimeOffTypes = () => fetcher('/time-off-types');

export const getTimeOffTypeById = (id) => fetcher(`/time-off-types/${id}`);

export const createTimeOffType = (data) =>
  fetcher('/time-off-types', { method: 'POST', body: JSON.stringify(data) });

export const updateTimeOffType = ({ id, ...data }) =>
  fetcher(`/time-off-types/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteTimeOffType = (id) =>
  fetcher(`/time-off-types/${id}`, { method: 'DELETE' });
