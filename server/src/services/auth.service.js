/**
 * @fileoverview Auth Service — Business logic for JWT-based stateless authentication.
 *
 * Token lifecycle:
 *  - Issue:      Signed JWT placed in an HttpOnly, Secure, SameSite=Strict cookie.
 *  - Verify:     Handled by the requireAuth middleware (see middlewares/auth.js).
 *  - Invalidate: On logout, cookie is cleared. Redis-based token blacklisting is
 *                wired in the middleware but commented out — enable when Redis is
 *                available in the environment.
 *
 * JWT payload shape:
 *  { sub: number, email: string, role: string, name: string }
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as authRepo from '#repositories/auth.repo.js';
import { UnauthorizedError, ForbiddenError } from '#lib/errors.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const JWT_SECRET        = process.env.JWT_SECRET;
const JWT_EXPIRES_IN    = process.env.JWT_EXPIRES_IN ?? '8h';
const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a clean public-safe user object from a DB row.
 * Strips password_hash and any other sensitive columns.
 */
const toPublicUser = (row) => ({
    id:               row.id,
    name:             `${row.first_name} ${row.last_name}`,
    firstName:        row.first_name,
    lastName:         row.last_name,
    email:            row.email,
    role:             row.role,
    department:       row.department ?? null,
    isActive:         row.is_active,
    employmentStatus: row.employment_status,
    phone:            row.phone ?? null,
    dateOfJoining:    row.date_of_joining ?? null,
    // Derived initials for avatar
    initials:         `${row.first_name[0]}${row.last_name[0]}`.toUpperCase(),
});

/**
 * Sign a JWT and return both the token string and the cookie options.
 */
const signToken = (payload) => {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not set.');
    }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const cookieOptions = {
        httpOnly: true,                                    // Not accessible via JS
        secure:   process.env.NODE_ENV === 'production',  // HTTPS only in prod
        sameSite: 'Strict',                               // CSRF mitigation
        maxAge:   COOKIE_MAX_AGE_MS,
        path:     '/',
    };
    return { token, cookieOptions };
};

// ── Exported service functions ────────────────────────────────────────────────

/**
 * Validate credentials and issue a JWT cookie.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: object, token: string, cookieOptions: object }>}
 * @throws {UnauthorizedError} if credentials are invalid or account is inactive.
 * @throws {ForbiddenError}    if account is terminated / deactivated.
 */
export const login = async (email, password) => {
    // 1. Lookup user
    const row = await authRepo.findByEmail(email);

    // 2. Timing-safe credential check (always compare even if user not found)
    const dummyHash = '$2b$10$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // prevent timing attacks
    const hashToCompare = row ? row.password_hash : dummyHash;
    const isMatch = await bcrypt.compare(password, hashToCompare);

    if (!row || !isMatch) {
        throw new UnauthorizedError('Invalid email or password.');
    }

    // 3. Account status checks
    if (!row.is_active) {
        throw new ForbiddenError('This account has been deactivated. Contact your administrator.');
    }
    if (row.employment_status === 'terminated') {
        throw new ForbiddenError('This account is no longer active.');
    }

    // 4. Build JWT payload (keep it lean — only what RBAC needs)
    const payload = {
        sub:   row.id,
        email: row.email,
        role:  row.role,
        name:  `${row.first_name} ${row.last_name}`,
    };

    const { token, cookieOptions } = signToken(payload);
    const user = toPublicUser(row);

    return { user, token, cookieOptions };
};

/**
 * Fetch the authenticated user's full profile (used by /me endpoint).
 *
 * @param {number} userId - decoded from JWT by the requireAuth middleware
 * @returns {Promise<object>}
 * @throws {UnauthorizedError} if user no longer exists or was deactivated.
 */
export const getMe = async (userId) => {
    const row = await authRepo.findById(userId);
    if (!row || !row.is_active) {
        throw new UnauthorizedError('User account not found or inactive.');
    }
    return toPublicUser(row);
};

/**
 * Return cleared cookie options for logout.
 * The actual cookie clearing is done in the controller.
 */
export const getClearedCookieOptions = () => ({
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    expires:  new Date(0), // Epoch = instant expiry
    path:     '/',
});
