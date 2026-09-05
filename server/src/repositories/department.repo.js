/**
 * @fileoverview Department Repository — Pure database abstraction layer.
 * Executes raw, parameterized SQL via the centralized `db.query` helper.
 * Returns plain row objects (or null). Never touches HTTP or Redis.
 */

import { query } from '#config/db.js';

/**
 * Insert a new department row.
 * @param {string} name
 * @returns {Promise<object>} The created row.
 */
export const create = async (name) => {
    const sql = `
        INSERT INTO departments (name)
        VALUES ($1)
        RETURNING *;
    `;
    const { rows } = await query(sql, [name]);
    return rows[0];
};

/**
 * Fetch all departments, alphabetically ordered.
 * @returns {Promise<object[]>}
 */
export const findAll = async () => {
    const sql = `SELECT * FROM departments ORDER BY name ASC;`;
    const { rows } = await query(sql);
    return rows;
};

/**
 * Fetch a single department by its UUID.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export const findById = async (id) => {
    const sql = `SELECT * FROM departments WHERE id = $1;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

/**
 * Find a department by exact name (for uniqueness checks).
 * @param {string} name
 * @param {string|null} excludeId - UUID to exclude (for update checks)
 * @returns {Promise<object|null>}
 */
export const findByName = async (name, excludeId = null) => {
    const sql = excludeId
        ? `SELECT * FROM departments WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1;`
        : `SELECT * FROM departments WHERE LOWER(name) = LOWER($1) LIMIT 1;`;
    const params = excludeId ? [name, excludeId] : [name];
    const { rows } = await query(sql, params);
    return rows[0] ?? null;
};

/**
 * Dynamically update only the provided fields.
 * @param {string} id
 * @param {object} fields - Partial object with updatable keys
 * @returns {Promise<object|null>} The updated row, or null if not found.
 */
export const update = async (id, fields) => {
    const allowedKeys = ['name'];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const key of allowedKeys) {
        if (fields[key] !== undefined) {
            setClauses.push(`${key} = $${paramIndex}`);
            values.push(fields[key]);
            paramIndex++;
        }
    }

    if (setClauses.length === 0) return findById(id);

    values.push(id);

    const sql = `
        UPDATE departments
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *;
    `;

    const { rows } = await query(sql, values);
    return rows[0] ?? null;
};

/**
 * Check whether any active user or contract references this department.
 * Used as a guard before deletion.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export const hasReferences = async (id) => {
    const sql = `
        SELECT 1 FROM users WHERE department_id = $1 AND is_active = TRUE
        UNION ALL
        SELECT 1 FROM contracts WHERE department_id = $1 AND status = 'active'
        LIMIT 1;
    `;
    const { rows } = await query(sql, [id]);
    return rows.length > 0;
};

/**
 * Delete a department by UUID.
 * @param {string} id
 * @returns {Promise<object|null>} The deleted row's id, or null if not found.
 */
export const remove = async (id) => {
    const sql = `DELETE FROM departments WHERE id = $1 RETURNING id;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};
