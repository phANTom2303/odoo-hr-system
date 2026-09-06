import { query } from '#config/db.js';

export const findAll = async ({ employee_id, status, time_off_type_id } = {}) => {
    const conditions = [];
    const values = [];
    let i = 1;

    if (employee_id)      { conditions.push(`r.employee_id = $${i++}`);      values.push(Number(employee_id)); }
    if (status)           { conditions.push(`r.status = $${i++}`);           values.push(status); }
    if (time_off_type_id) { conditions.push(`r.time_off_type_id = $${i++}`); values.push(Number(time_off_type_id)); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
        SELECT r.*,
               u.first_name || ' ' || u.last_name AS employee_name,
               t.name AS time_off_type_name,
               t.unit AS time_off_unit
        FROM time_off_requests r
        JOIN users u ON u.id = r.employee_id
        JOIN time_off_types t ON t.id = r.time_off_type_id
        ${where}
        ORDER BY r.created_at DESC;
    `;
    const { rows } = await query(sql, values);
    return rows;
};

export const findById = async (id) => {
    const sql = `
        SELECT r.*,
               u.first_name || ' ' || u.last_name AS employee_name,
               t.name AS time_off_type_name,
               t.unit AS time_off_unit,
               a.allocated_amount,
               (a.allocated_amount - a.taken) AS remaining_balance
        FROM time_off_requests r
        JOIN users u ON u.id = r.employee_id
        JOIN time_off_types t ON t.id = r.time_off_type_id
        LEFT JOIN time_off_allocations a ON a.id = r.allocation_id
        WHERE r.id = $1;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const create = async (fields) => {
    const sql = `
        INSERT INTO time_off_requests
            (employee_id, time_off_type_id, allocation_id, start_date, end_date,
             number_of_days, reason, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
    `;
    const { rows } = await query(sql, [
        fields.employee_id,
        fields.time_off_type_id,
        fields.allocation_id ?? null,
        fields.start_date,
        fields.end_date,
        fields.number_of_days ?? null,
        fields.reason ?? null,
        fields.status ?? 'draft',
    ]);
    return rows[0];
};

export const approve = async (id, approver_id) => {
    const sql = `
        UPDATE time_off_requests
        SET status = 'approved', approver_id = $2, approved_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *;
    `;
    const { rows } = await query(sql, [id, approver_id ?? null]);
    return rows[0] ?? null;
};

export const refuse = async (id) => {
    const sql = `
        UPDATE time_off_requests
        SET status = 'refused', updated_at = NOW()
        WHERE id = $1
        RETURNING *;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const withdraw = async (id) => {
    const sql = `
        UPDATE time_off_requests
        SET status = 'withdrawn', updated_at = NOW()
        WHERE id = $1 AND status = 'pending'
        RETURNING *;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};
