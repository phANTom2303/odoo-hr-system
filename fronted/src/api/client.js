export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function fetcher(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `An error occurred while fetching data from ${endpoint}`);
  }

  return response.json();
}
