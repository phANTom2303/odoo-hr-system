/**
 * @fileoverview Task Repository — Pure database abstraction layer.
 * Executes raw, parameterized SQL via the centralized `db.query` helper.
 * Returns plain row objects (or null). Never touches HTTP or Redis.
 */

import { query } from '#config/db.js';

/**
 * Insert a new task row.
 * @param {string} title
 * @param {string|null} description
 * @param {string} status - One of 'pending' | 'in_progress' | 'completed'
 * @returns {Promise<object>} The created row.
 */
export const create = async (title, description = null, status = 'pending') => {
    const sql = `
        INSERT INTO tasks (title, description, status)
        VALUES ($1, $2, $3)
        RETURNING *;
    `;
    const { rows } = await query(sql, [title, description, status]);
    return rows[0];
};

/**
 * Fetch all tasks, newest first.
 * @returns {Promise<object[]>}
 */
export const findAll = async () => {
    const sql = `SELECT * FROM tasks ORDER BY created_at DESC;`;
    const { rows } = await query(sql);
    return rows;
};

/**
 * Fetch a single task by its UUID.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export const findById = async (id) => {
    const sql = `SELECT * FROM tasks WHERE id = $1;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

/**
 * Dynamically update only the provided fields.
 * @param {string} id - Task UUID
 * @param {object} fields - Partial object with keys: title, description, status
 * @returns {Promise<object|null>} The updated row, or null if not found.
 */
export const update = async (id, fields) => {
    // Build SET clause dynamically from provided fields
    const allowedKeys = ['title', 'description', 'status'];
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

    // Nothing to update — early return
    if (setClauses.length === 0) return findById(id);

    values.push(id); // final param is the WHERE id

    const sql = `
        UPDATE tasks
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *;
    `;

    const { rows } = await query(sql, values);
    return rows[0] ?? null;
};

/**
 * Delete a task by UUID.
 * @param {string} id
 * @returns {Promise<object|null>} The deleted row's id, or null if not found.
 */
export const remove = async (id) => {
    const sql = `DELETE FROM tasks WHERE id = $1 RETURNING id;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};
