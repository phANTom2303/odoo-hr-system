import { fetcher } from './client';

export const getContracts = async () => {
  return fetcher('/contracts');
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
