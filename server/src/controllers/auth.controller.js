/**
 * @fileoverview Auth Controller — HTTP layer for authentication endpoints.
 *
 * Routes handled:
 *  POST /api/auth/login   → validate credentials, set JWT cookie
 *  GET  /api/auth/me      → return current user (protected)
 *  POST /api/auth/logout  → clear JWT cookie
 */

import asyncHandler from '#lib/asyncHandler.js';
import * as authService from '#services/auth.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

const COOKIE_NAME = 'token';

/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 */
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { user, token, cookieOptions } = await authService.login(email, password);

    res
        .cookie(COOKIE_NAME, token, cookieOptions)
        .status(RESPONSE_CODES.SUCCESS_CODE)
        .json({
            success: true,
            message: 'Login successful.',
            data:    user,
        });
});

/**
 * GET /api/auth/me
 * Requires: requireAuth() middleware to be applied on the route.
 * Returns the current user's profile from the database (fresh, not from JWT cache).
 */
export const getMe = asyncHandler(async (req, res) => {
    // req.user is populated by the requireAuth middleware
    const user = await authService.getMe(req.user.sub);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data:    user,
    });
});

/**
 * POST /api/auth/logout
 * Clears the JWT cookie. The client is responsible for discarding any in-memory state.
 * For full stateless invalidation, the JWT blacklist in the requireAuth middleware
 * should be enabled (uses Redis).
 */
export const logout = asyncHandler(async (req, res) => {
    const clearedOptions = authService.getClearedCookieOptions();

    res
        .cookie(COOKIE_NAME, '', clearedOptions)
        .status(RESPONSE_CODES.SUCCESS_CODE)
        .json({
            success: true,
            message: 'Logged out successfully.',
        });
});
