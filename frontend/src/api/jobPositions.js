import { fetcher } from './client';

export const getJobPositions = () => fetcher('/job-positions');
export const getJobPositionById = (id) => fetcher(`/job-positions/${id}`);
