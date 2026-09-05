/**
 * @fileoverview Job Position Repository — Pure database abstraction layer.
 * Executes raw, parameterized SQL via the centralized `db.query` helper.
 * Returns plain row objects (or null). Never touches HTTP or Redis.
 */

import { query } from '#config/db.js';

/**
 * Insert a new job_position row.
 * @param {string} title
 * @param {string|null} departmentId - Optional FK to departments
 * @returns {Promise<object>} The created row.
 */
export const create = async (title, departmentId = null) => {
    const sql = `
        INSERT INTO job_positions (title, department_id)
        VALUES ($1, $2)
        RETURNING *;
    `;
    const { rows } = await query(sql, [title, departmentId]);
    return rows[0];
};

/**
 * Fetch all job positions, joined with department name, alphabetically ordered.
 * @returns {Promise<object[]>}
 */
export const findAll = async () => {
    const sql = `
        SELECT
            jp.*,
            d.name AS department_name
        FROM job_positions jp
        LEFT JOIN departments d ON d.id = jp.department_id
        ORDER BY jp.title ASC;
    `;
    const { rows } = await query(sql);
    return rows;
};

/**
 * Fetch a single job position by UUID, joined with department name.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export const findById = async (id) => {
    const sql = `
        SELECT
            jp.*,
            d.name AS department_name
        FROM job_positions jp
        LEFT JOIN departments d ON d.id = jp.department_id
        WHERE jp.id = $1;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

/**
 * Find a job position by exact title (case-insensitive), for uniqueness checks.
 * @param {string} title
 * @param {string|null} excludeId - UUID to exclude (used during updates)
 * @returns {Promise<object|null>}
 */
export const findByTitle = async (title, excludeId = null) => {
    const sql = excludeId
        ? `SELECT * FROM job_positions WHERE LOWER(title) = LOWER($1) AND id != $2 LIMIT 1;`
        : `SELECT * FROM job_positions WHERE LOWER(title) = LOWER($1) LIMIT 1;`;
    const params = excludeId ? [title, excludeId] : [title];
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
    const allowedKeys = ['title', 'department_id'];
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
        UPDATE job_positions
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *;
    `;

    const { rows } = await query(sql, values);
    return rows[0] ?? null;
};

/**
 * Check whether any active user or contract references this job position.
 * Used as a guard before deletion.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export const hasReferences = async (id) => {
    const sql = `
        SELECT 1 FROM users WHERE job_position_id = $1 AND is_active = TRUE
        UNION ALL
        SELECT 1 FROM contracts WHERE job_position_id = $1 AND status = 'active'
        LIMIT 1;
    `;
    const { rows } = await query(sql, [id]);
    return rows.length > 0;
};

/**
 * Delete a job position by UUID.
 * @param {string} id
 * @returns {Promise<object|null>} The deleted row's id, or null if not found.
 */
export const remove = async (id) => {
    const sql = `DELETE FROM job_positions WHERE id = $1 RETURNING id;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};
