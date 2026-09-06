/**
 * @fileoverview Contract Repository
 */

import { query } from '#config/db.js';

export const findAll = async ({ employee_id } = {}) => {
    const conditions = [];
    const values = [];
    if (employee_id) {
        conditions.push(`c.employee_id = $${values.length + 1}`);
        values.push(Number(employee_id));
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
        SELECT c.id, c.employee_id,
               u.first_name || ' ' || u.last_name AS employee_name,
               c.wage, c.start_date, c.end_date, c.status
        FROM contracts c
        JOIN users u ON c.employee_id = u.id
        ${where}
        ORDER BY c.created_at DESC;
    `;
    const { rows } = await query(sql, values);
    return rows;
};

export const findById = async (id) => {
    const sql = `
        SELECT c.id, c.employee_id,
               u.first_name || ' ' || u.last_name AS employee_name,
               ws.name  AS schedule_name,
               ss.name  AS salary_structure_name,
               op.name  AS overtime_policy_name,
               d.name   AS department_name,
               jp.title AS job_position_name,
               c.wage, c.start_date, c.end_date, c.status,
               c.created_at, c.updated_at
        FROM contracts c
        JOIN users u              ON c.employee_id          = u.id
        JOIN working_schedules ws ON c.schedule_id          = ws.id
        JOIN salary_structures ss ON c.salary_structure_id  = ss.id
        LEFT JOIN overtime_policies op ON c.overtime_policy_id = op.id
        LEFT JOIN departments d        ON c.department_id      = d.id
        LEFT JOIN job_positions jp     ON c.job_position_id    = jp.id
        WHERE c.id = $1;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const create = async ({
    employee_id, schedule_id, salary_structure_id,
    overtime_policy_id = null, department_id = null, job_position_id = null,
    wage, start_date, end_date = null, status = 'draft',
}) => {
    const sql = `
        INSERT INTO contracts (
            employee_id, schedule_id, salary_structure_id,
            overtime_policy_id, department_id, job_position_id,
            wage, start_date, end_date, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *;
    `;
    const { rows } = await query(sql, [
        employee_id, schedule_id, salary_structure_id,
        overtime_policy_id, department_id, job_position_id,
        wage, start_date, end_date, status,
    ]);
    return rows[0];
};

export const findOverlappingActiveContracts = async (employee_id, start_date, end_date, excludeId = null) => {
    const effectiveEndDate = end_date ?? '9999-12-31';
    const sql = `
        SELECT id FROM contracts
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

export const updateContract = async (id, end_date, status) => {
    const sql = `
        UPDATE contracts
        SET end_date = $2, status = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
    `;
    const { rows } = await query(sql, [id, end_date ?? null, status]);
    return rows[0];
};

export const expireContract = async (id, end_date) => {
    const sql = `
        UPDATE contracts
        SET end_date = $2, status = 'expired', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
    `;
    const { rows } = await query(sql, [id, end_date]);
    return rows[0];
};

export const deleteContract = async (id) => {
    const sql = `DELETE FROM contracts WHERE id = $1 RETURNING id;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};
