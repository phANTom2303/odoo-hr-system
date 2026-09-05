/**
 * Auth API — wrappers for the /api/auth/* endpoints.
 * All requests use credentials: 'include' to send/receive the HttpOnly JWT cookie.
 */

import { API_URL } from './client';

/**
 * POST /api/auth/login
 * On success, the server sets an HttpOnly cookie automatically.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ success: boolean, data: object }>}
 */
export async function loginRequest(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method:      'POST',
    credentials: 'include', // required to receive the Set-Cookie header
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ email, password }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Prefer server-provided error message
    throw new Error(json.error || json.message || 'Login failed.');
  }

  return json; // { success: true, data: <user> }
}

/**
 * GET /api/auth/me
 * Verifies the HttpOnly cookie and returns the current user's profile.
 * Used on app startup to restore session.
 * @returns {Promise<{ success: boolean, data: object } | null>}
 */
export async function getMeRequest() {
  const res = await fetch(`${API_URL}/auth/me`, {
    method:      'GET',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    // 401/403 = no valid session — return null instead of throwing
    return null;
  }

  return res.json(); // { success: true, data: <user> }
}

/**
 * POST /api/auth/logout
 * Instructs the server to clear the HttpOnly cookie.
 */
export async function logoutRequest() {
  await fetch(`${API_URL}/auth/logout`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
  });
}
