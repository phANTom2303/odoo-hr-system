import { fetcher } from './client';

export const getDepartments = () => fetcher('/departments');
export const getDepartmentById = (id) => fetcher(`/departments/${id}`);
