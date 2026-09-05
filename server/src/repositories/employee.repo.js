/**
 * @fileoverview Employee Repository — Pure database abstraction layer.
 * The `users` table stores employees. Soft-delete via is_active = false.
 */

import { query } from '#config/db.js';

export const findAll = async ({ search, department, status, role } = {}) => {
    const conditions = [];
    const values = [];
    let i = 1;

    if (search) {
        conditions.push(`(u.first_name ILIKE $${i} OR u.last_name ILIKE $${i} OR u.email ILIKE $${i})`);
        values.push(`%${search}%`);
        i++;
    }
    if (department) {
        conditions.push(`d.name ILIKE $${i}`);
        values.push(`%${department}%`);
        i++;
    }
    if (status === 'active')   { conditions.push(`u.is_active = TRUE`); }
    if (status === 'inactive') { conditions.push(`u.is_active = FALSE`); }
    if (role)                  { conditions.push(`u.role = $${i}`); values.push(role); i++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
        SELECT
            u.id, u.first_name, u.last_name, u.email, u.phone,
            u.role, u.employment_status, u.employee_type, u.is_active,
            u.date_of_joining, u.date_of_leaving, u.date_of_birth,
            u.bank_name, u.bank_account, u.address,
            u.manager_id,
            m.first_name || ' ' || m.last_name AS manager_name,
            d.id   AS department_id,   d.name  AS department_name,
            jp.id  AS job_position_id, jp.title AS job_position_title,
            u.created_at, u.updated_at
        FROM users u
        LEFT JOIN users       m  ON m.id  = u.manager_id
        LEFT JOIN departments d  ON d.id  = u.department_id
        LEFT JOIN job_positions jp ON jp.id = u.job_position_id
        ${where}
        ORDER BY u.created_at DESC;
    `;
    const { rows } = await query(sql, values);
    return rows;
};

export const findById = async (id) => {
    const sql = `
        SELECT
            u.id, u.first_name, u.last_name, u.email, u.phone,
            u.role, u.employment_status, u.employee_type, u.is_active,
            u.date_of_joining, u.date_of_leaving, u.date_of_birth,
            u.bank_name, u.bank_account, u.address,
            u.manager_id,
            m.first_name || ' ' || m.last_name AS manager_name,
            d.id   AS department_id,   d.name  AS department_name,
            jp.id  AS job_position_id, jp.title AS job_position_title,
            u.created_at, u.updated_at
        FROM users u
        LEFT JOIN users       m  ON m.id  = u.manager_id
        LEFT JOIN departments d  ON d.id  = u.department_id
        LEFT JOIN job_positions jp ON jp.id = u.job_position_id
        WHERE u.id = $1;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const findByEmail = async (email, excludeId = null) => {
    const sql = excludeId
        ? `SELECT id FROM users WHERE email = $1 AND id != $2 LIMIT 1;`
        : `SELECT id FROM users WHERE email = $1 LIMIT 1;`;
    const params = excludeId ? [email, excludeId] : [email];
    const { rows } = await query(sql, params);
    return rows[0] ?? null;
};

export const create = async (fields) => {
    const sql = `
        INSERT INTO users
            (first_name, last_name, email, phone, password_hash, role,
             employment_status, employee_type, department_id, job_position_id,
             manager_id, date_of_joining, date_of_birth, bank_name, bank_account, address)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING id, first_name, last_name, email, role, employment_status,
                  employee_type, is_active, department_id, job_position_id,
                  manager_id, date_of_joining, created_at;
    `;
    const { rows } = await query(sql, [
        fields.first_name, fields.last_name, fields.email, fields.phone ?? null,
        fields.password_hash, fields.role ?? 'employee',
        fields.employment_status ?? 'active', fields.employee_type ?? 'full_time',
        fields.department_id ?? null, fields.job_position_id ?? null,
        fields.manager_id ?? null, fields.date_of_joining || null,
        fields.date_of_birth || null, fields.bank_name ?? null,
        fields.bank_account ?? null, fields.address ?? null,
    ]);
    return rows[0];
};

export const update = async (id, fields) => {
    const allowedKeys = [
        'first_name','last_name','email','phone','role','employment_status',
        'employee_type','is_active','department_id','job_position_id',
        'manager_id','date_of_joining','date_of_leaving','date_of_birth',
        'bank_name','bank_account','address',
    ];
    const dateKeys = new Set(['date_of_joining', 'date_of_leaving', 'date_of_birth']);
    const setClauses = [];
    const values = [];
    let p = 1;

    for (const key of allowedKeys) {
        if (fields[key] !== undefined) {
            setClauses.push(`${key} = $${p++}`);
            // Normalize empty strings to null for date fields
            const value = dateKeys.has(key) && fields[key] === '' ? null : fields[key];
            values.push(value);
        }
    }
    if (setClauses.length === 0) return findById(id);

    values.push(id);
    const sql = `
        UPDATE users SET ${setClauses.join(', ')}
        WHERE id = $${p} RETURNING *;
    `;
    const { rows } = await query(sql, values);
    return rows[0] ?? null;
};

export const softDelete = async (id) => {
    const sql = `
        UPDATE users SET is_active = FALSE WHERE id = $1 RETURNING id;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

/* Sub-resource helpers */
export const findContracts = async (employeeId) => {
    const sql = `SELECT * FROM contracts WHERE employee_id = $1 ORDER BY created_at DESC;`;
    const { rows } = await query(sql, [employeeId]);
    return rows;
};

export const findAttendance = async (employeeId) => {
    const sql = `SELECT * FROM attendance WHERE employee_id = $1 ORDER BY date DESC;`;
    const { rows } = await query(sql, [employeeId]);
    return rows;
};

export const findTimeOffRequests = async (employeeId) => {
    const sql = `SELECT * FROM time_off_requests WHERE employee_id = $1 ORDER BY created_at DESC;`;
    const { rows } = await query(sql, [employeeId]);
    return rows;
};

export const findAllocations = async (employeeId) => {
    const sql = `SELECT * FROM time_off_allocations WHERE employee_id = $1 ORDER BY created_at DESC;`;
    const { rows } = await query(sql, [employeeId]);
    return rows;
};
