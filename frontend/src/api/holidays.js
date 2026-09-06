import { fetcher } from './client';

export const getHolidays = () => fetcher('/holidays');

export const getHolidayById = (id) => fetcher(`/holidays/${id}`);

export const createHoliday = (data) =>
  fetcher('/holidays', { method: 'POST', body: JSON.stringify(data) });

export const updateHoliday = ({ id, ...data }) =>
  fetcher(`/holidays/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteHoliday = (id) =>
  fetcher(`/holidays/${id}`, { method: 'DELETE' });
