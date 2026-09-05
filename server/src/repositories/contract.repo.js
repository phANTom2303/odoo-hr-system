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
