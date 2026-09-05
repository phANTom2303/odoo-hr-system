/**
 * @fileoverview Time Off Type Repository
 */

import { query } from '#config/db.js';

export const findAll = async () => {
    const sql = `SELECT * FROM time_off_types ORDER BY name ASC;`;
    const { rows } = await query(sql);
    return rows;
};

export const findById = async (id) => {
    const sql = `SELECT * FROM time_off_types WHERE id = $1;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const findByName = async (name, excludeId = null) => {
    const sql = excludeId
        ? `SELECT id FROM time_off_types WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1;`
        : `SELECT id FROM time_off_types WHERE LOWER(name) = LOWER($1) LIMIT 1;`;
    const params = excludeId ? [name, excludeId] : [name];
    const { rows } = await query(sql, params);
    return rows[0] ?? null;
};

export const create = async (fields) => {
    const sql = `
        INSERT INTO time_off_types
            (name, unit, requires_allocation, approval_required, approver_role,
             leave_validation, attendance_impact, is_paid, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *;
    `;
    const { rows } = await query(sql, [
        fields.name,
        fields.unit ?? 'days',
        fields.requires_allocation ?? true,
        fields.approval_required ?? true,
        fields.approver_role ?? 'hr_manager',
        fields.leave_validation ?? 'manager',
        fields.attendance_impact ?? 'absent',
        fields.is_paid ?? true,
        fields.is_active ?? true,
    ]);
    return rows[0];
};

export const update = async (id, fields) => {
    const allowedKeys = [
        'name','unit','requires_allocation','approval_required','approver_role',
        'leave_validation','attendance_impact','is_paid','is_active',
    ];
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
    const sql = `UPDATE time_off_types SET ${setClauses.join(', ')} WHERE id = $${p} RETURNING *;`;
    const { rows } = await query(sql, values);
    return rows[0] ?? null;
};

export const remove = async (id) => {
    const sql = `DELETE FROM time_off_types WHERE id = $1 RETURNING id;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const hasActiveContractReference = async (id) => {
    const sql = `
        SELECT 1 FROM contract_time_off_types ctt
        JOIN contracts c ON c.id = ctt.contract_id
        WHERE ctt.time_off_type_id = $1 AND c.status = 'active'
        LIMIT 1;
    `;
    const { rows } = await query(sql, [id]);
    return rows.length > 0;
};
