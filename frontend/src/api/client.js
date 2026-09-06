/**
 * Base API client configuration.
 * All requests include credentials (cookies) for JWT-based auth.
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

/**
 * Generic fetcher used by React Query hooks.
 * Automatically includes the HttpOnly JWT cookie on every request.
 *
 * @param {string} endpoint  - Path relative to API_URL, e.g. '/employees'
 * @param {RequestInit} options
 * @returns {Promise<any>}
 */
export async function fetcher(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    credentials: 'include', // send JWT cookie on every API call
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `An error occurred while fetching data from ${endpoint}`);
  }

  return response.json();
}
