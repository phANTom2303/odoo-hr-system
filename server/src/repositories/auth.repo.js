import { query } from '#config/db.js';

/**
 * @fileoverview Auth Repository — raw DB access for authentication.
 * All queries return plain row objects; no business logic here.
 */

/**
 * Find a user by email, returning identity + auth fields.
 * @param {string} email
 * @returns {Promise<object|null>}
 */
export const findByEmail = async (email) => {
    const sql = `
        SELECT
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.password_hash,
            u.role,
            u.is_active,
            u.employment_status,
            d.name AS department
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.email = $1
        LIMIT 1
    `;
    const { rows } = await query(sql, [email.toLowerCase().trim()]);
    return rows[0] ?? null;
};

/**
 * Find a user by primary key (for the /me endpoint).
 * @param {number} id
 * @returns {Promise<object|null>}
 */
export const findById = async (id) => {
    const sql = `
        SELECT
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.role,
            u.is_active,
            u.employment_status,
            u.phone,
            u.date_of_joining,
            d.name AS department
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.id = $1
        LIMIT 1
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};
