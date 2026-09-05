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
