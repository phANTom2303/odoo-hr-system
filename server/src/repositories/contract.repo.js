/**
 * @fileoverview Contract Repository
 */

import { query } from '#config/db.js';

/**
 * Fetch all contracts with specific fields.
 * @returns {Promise<object[]>}
 */
export const findAll = async () => {
    const sql = `
        SELECT 
            c.id, 
            u.first_name || ' ' || u.last_name AS employee_name, 
            c.start_date, 
            c.end_date, 
            c.status 
        FROM contracts c
        JOIN users u ON c.employee_id = u.id
        ORDER BY c.created_at DESC;
    `;
    const { rows } = await query(sql);
    return rows;
};

export const getPaginated = async(perPageEntries, pageNumber)  => {
    const toSkip = (pageNumber - 1) * perPageEntries;
     const sql = `
        SELECT 
            c.id, 
            u.first_name || ' ' || u.last_name AS employee_name, 
            c.start_date, 
            c.end_date, 
            c.status 
        FROM contracts c
        JOIN users u ON c.employee_id = u.id
        ORDER BY c.created_at DESC
        LIMIT $1
        OFFSET $2;
    `;
    const { rows } = await query(sql, [perPageEntries, toSkip]);
    return rows;
}

/**
 * Fetch a contract by ID, replacing ID fields with their corresponding names.
 * @param {number|string} id 
 * @returns {Promise<object|null>}
 */
export const findById = async (id) => {
    const sql = `
        SELECT 
            c.id, 
            u.first_name || ' ' || u.last_name AS employee_name, 
            ws.name AS schedule_name,
            ss.name AS salary_structure_name,
            op.name AS overtime_policy_name,
            d.name AS department_name,
            jp.title AS job_position_name,
            c.wage,
            c.start_date, 
            c.end_date, 
            c.status,
            c.created_at,
            c.updated_at
        FROM contracts c
        JOIN users u ON c.employee_id = u.id
        JOIN working_schedules ws ON c.schedule_id = ws.id
        JOIN salary_structures ss ON c.salary_structure_id = ss.id
        LEFT JOIN overtime_policies op ON c.overtime_policy_id = op.id
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN job_positions jp ON c.job_position_id = jp.id
        WHERE c.id = $1;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] || null;
};

/**
 * Insert a new contract row.
 * @param {object} data - Contract fields.
 * @returns {Promise<object>} The created row.
 */
export const create = async ({
    employee_id,
    schedule_id,
    salary_structure_id,
    overtime_policy_id = null,
    department_id = null,
    job_position_id = null,
    wage,
    start_date,
    end_date = null,
    status = 'draft',
}) => {
    const sql = `
        INSERT INTO contracts (
            employee_id, schedule_id, salary_structure_id,
            overtime_policy_id, department_id, job_position_id,
            wage, start_date, end_date, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
    `;
    const { rows } = await query(sql, [
        employee_id,
        schedule_id,
        salary_structure_id,
        overtime_policy_id,
        department_id,
        job_position_id,
        wage,
        start_date,
        end_date,
        status,
    ]);
    return rows[0];
};

/**
 * Find an overlapping active contract for the given employee in the proposed
 * [start_date, end_date] window, excluding a specific contract id (useful
 * when activating an existing contract so it doesn't conflict with itself).
 *
 * Uses '9999-12-31' as a sentinel when end_date is open-ended (NULL).
 *
 * @param {number}      employee_id
 * @param {string}      start_date      - ISO date string (YYYY-MM-DD)
 * @param {string|null} end_date        - ISO date string or null for open-ended
 * @param {number|null} [excludeId]     - Contract id to exclude from the check
 * @returns {Promise<number|null>} The id of the overlapping contract, or null.
 */
export const findOverlappingActiveContracts = async (
    employee_id,
    start_date,
    end_date,
    excludeId = null,
) => {
    const effectiveEndDate = end_date ?? '9999-12-31';
    const sql = `
        SELECT id
        FROM contracts
        WHERE employee_id = $1
          AND status = 'active'
          AND ($4::int IS NULL OR id != $4)
          AND start_date <= $3
          AND (end_date IS NULL OR end_date >= $2)
        LIMIT 1;
    `;
    const { rows } = await query(sql, [employee_id, start_date, effectiveEndDate, excludeId]);
    return rows.length > 0 ? rows[0].id : null;
};

/**
 * Update only the mutable fields of a contract (end_date, status).
 *
 * @param {number}      id
 * @param {string|null} end_date
 * @param {string}      status
 * @returns {Promise<object>} The updated contract row.
 */
export const updateContract = async (id, end_date, status) => {
    const sql = `
        UPDATE contracts
        SET end_date   = $2,
            status     = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
    `;
    const { rows } = await query(sql, [id, end_date ?? null, status]);
    return rows[0];
};

/**
 * Expire a previously-active contract by setting its end_date and status.
 * Used as a side-effect when a new contract is activated for the same employee.
 *
 * @param {number} id       - Contract to expire.
 * @param {string} end_date - The last valid date for the old contract.
 * @returns {Promise<object>} The updated contract row.
 */
export const expireContract = async (id, end_date) => {
    const sql = `
        UPDATE contracts
        SET end_date   = $2,
            status     = 'expired',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
    `;
    const { rows } = await query(sql, [id, end_date]);
    return rows[0];
};
