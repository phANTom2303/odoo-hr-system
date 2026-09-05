import { fetcher } from './client';

// ── Salary Structures ─────────────────────────────────────────────────
export const getSalaryStructures = () => fetcher('/salary-structures');

export const getSalaryStructureById = (id) => fetcher(`/salary-structures/${id}`);

export const createSalaryStructure = (data) =>
  fetcher('/salary-structures', { method: 'POST', body: JSON.stringify(data) });

export const updateSalaryStructure = ({ id, ...data }) =>
  fetcher(`/salary-structures/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteSalaryStructure = (id) =>
  fetcher(`/salary-structures/${id}`, { method: 'DELETE' });

// ── Salary Rules (nested under structure) ────────────────────────────
export const getSalaryRulesByStructure = (structureId) =>
  fetcher(`/salary-structures/${structureId}/rules`);

export const createSalaryRule = (structureId, data) =>
  fetcher(`/salary-structures/${structureId}/rules`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

// ── Salary Rules (standalone) ─────────────────────────────────────────
export const getSalaryRuleById = (id) => fetcher(`/salary-rules/${id}`);

export const updateSalaryRule = ({ id, ...data }) =>
  fetcher(`/salary-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteSalaryRule = (id) =>
  fetcher(`/salary-rules/${id}`, { method: 'DELETE' });
