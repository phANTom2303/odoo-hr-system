import { fetcher } from './client';

export const getContracts = async (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
  ).toString();
  return fetcher(`/contracts${qs ? `?${qs}` : ''}`);
};

export const getContractById = async (id) => {
  return fetcher(`/contracts/${id}`);
};

export const createContract = async (data) => {
  return fetcher('/contracts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateContract = async ({ id, ...data }) => {
  return fetcher(`/contracts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteContract = async (id) => {
  return fetcher(`/contracts/${id}`, {
    method: 'DELETE',
  });
};
