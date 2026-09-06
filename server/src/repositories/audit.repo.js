/**
 * @fileoverview Audit Log Repository
 */

import { query } from '#config/db.js';

/**
 * Latest N audit log rows across all audited tables, newest first.
 * @param {number} [limit=50]
 * @returns {Promise<object[]>}
 */
export const findRecent = async (limit = 50) => {
    const sql = `
        SELECT id, table_name, record_id, action, old_data, new_data, changed_at
        FROM audit_logs
        ORDER BY changed_at DESC
        LIMIT $1;
    `;
    const { rows } = await query(sql, [limit]);
    return rows;
};
