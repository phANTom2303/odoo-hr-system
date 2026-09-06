import { query } from '#config/db.js';

export const findAll = async ({ employee_id, status, date_from, date_to } = {}) => {
    const conditions = [];
    const values = [];
    let i = 1;

    if (employee_id) { conditions.push(`a.employee_id = $${i++}`); values.push(Number(employee_id)); }
    if (status)      { conditions.push(`a.status = $${i++}`);      values.push(status); }
    if (date_from)   { conditions.push(`a.date >= $${i++}`);       values.push(date_from); }
    if (date_to)     { conditions.push(`a.date <= $${i++}`);       values.push(date_to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
        SELECT a.*,
               u.first_name || ' ' || u.last_name AS employee_name,
               d.name AS department_name
        FROM attendance a
        JOIN users u ON u.id = a.employee_id
        LEFT JOIN departments d ON d.id = u.department_id
        ${where}
        ORDER BY a.date DESC, a.employee_id;
    `;
    const { rows } = await query(sql, values);
    return rows;
};

export const findById = async (id) => {
    const sql = `
        SELECT a.*,
               u.first_name || ' ' || u.last_name AS employee_name,
               d.name AS department_name
        FROM attendance a
        JOIN users u ON u.id = a.employee_id
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE a.id = $1;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const findTodayByEmployee = async (employee_id) => {
    const sql = `SELECT * FROM attendance WHERE employee_id = $1 AND date = CURRENT_DATE;`;
    const { rows } = await query(sql, [employee_id]);
    return rows[0] ?? null;
};

export const checkIn = async (employee_id) => {
    const sql = `
        INSERT INTO attendance (employee_id, date, check_in, status)
        VALUES ($1, CURRENT_DATE, NOW(), 'present')
        ON CONFLICT (employee_id, date) DO UPDATE
            SET check_in = NOW(), status = 'present'
        RETURNING *;
    `;
    const { rows } = await query(sql, [employee_id]);
    return rows[0];
};

export const checkOut = async (employee_id, worked_hours) => {
    const sql = `
        UPDATE attendance
        SET check_out = NOW(), worked_hours = $2, updated_at = NOW()
        WHERE employee_id = $1 AND date = CURRENT_DATE
        RETURNING *;
    `;
    const { rows } = await query(sql, [employee_id, worked_hours]);
    return rows[0] ?? null;
};

export const resetTodayCheckout = async (employee_id) => {
    const sql = `
        UPDATE attendance
        SET check_out = NULL, worked_hours = NULL, updated_at = NOW()
        WHERE employee_id = $1 AND date = CURRENT_DATE
        RETURNING *;
    `;
    const { rows } = await query(sql, [employee_id]);
    return rows[0] ?? null;
};
export const manualUpdate = async (id, fields, edited_by) => {
    const { check_in, check_out, worked_hours, status } = fields;
    const sql = `
        UPDATE attendance
        SET check_in = COALESCE($2, check_in),
            check_out = COALESCE($3, check_out),
            worked_hours = COALESCE($4, worked_hours),
            status = COALESCE($5, status),
            is_manual_edit = TRUE,
            edited_by = $6,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *;
    `;
    const { rows } = await query(sql, [id, check_in || null, check_out || null, worked_hours ?? null, status || null, edited_by]);
    return rows[0] ?? null;
};
