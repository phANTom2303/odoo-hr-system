/**
 * @fileoverview Company Holiday Repository
 */

import { query } from '#config/db.js';

export const findAll = async () => {
    const sql = `SELECT * FROM company_holidays ORDER BY date ASC;`;
    const { rows } = await query(sql);
    return rows;
};

export const findById = async (id) => {
    const sql = `SELECT * FROM company_holidays WHERE id = $1;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const findByDate = async (date, excludeId = null) => {
    const sql = excludeId
        ? `SELECT id FROM company_holidays WHERE date = $1 AND id != $2 LIMIT 1;`
        : `SELECT id FROM company_holidays WHERE date = $1 LIMIT 1;`;
    const params = excludeId ? [date, excludeId] : [date];
    const { rows } = await query(sql, params);
    return rows[0] ?? null;
};

export const create = async (fields) => {
    const sql = `
        INSERT INTO company_holidays (name, date, holiday_type, is_paid)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
    `;
    const { rows } = await query(sql, [
        fields.name,
        fields.date,
        fields.holiday_type ?? 'national',
        fields.is_paid ?? true,
    ]);
    return rows[0];
};

export const update = async (id, fields) => {
    const allowedKeys = ['name', 'date', 'holiday_type', 'is_paid'];
    const setClauses = [];
    const values = [];
    let p = 1;
    for (const key of allowedKeys) {
        if (fields[key] !== undefined) {
            setClauses.push(`${key} = $${p++}`);
            values.push(fields[key]);
        }
    }
    if (setClauses.length === 0) return findById(id);
    values.push(id);
    const sql = `UPDATE company_holidays SET ${setClauses.join(', ')} WHERE id = $${p} RETURNING *;`;
    const { rows } = await query(sql, values);
    return rows[0] ?? null;
};

export const remove = async (id) => {
    const sql = `DELETE FROM company_holidays WHERE id = $1 RETURNING id;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};
