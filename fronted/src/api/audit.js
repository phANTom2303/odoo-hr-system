import { fetcher } from './client';

export const getAuditLogs = () => fetcher('/audit-logs');
