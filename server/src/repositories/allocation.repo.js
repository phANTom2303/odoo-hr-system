import { query } from '#config/db.js';

export const findAll = async ({ employee_id, status, time_off_type_id } = {}) => {
    const conditions = [];
    const values = [];
    let i = 1;

    if (employee_id)       { conditions.push(`a.employee_id = $${i++}`);       values.push(Number(employee_id)); }
    if (status)            { conditions.push(`a.status = $${i++}`);            values.push(status); }
    if (time_off_type_id)  { conditions.push(`a.time_off_type_id = $${i++}`);  values.push(Number(time_off_type_id)); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
        SELECT a.*,
               u.first_name || ' ' || u.last_name AS employee_name,
               t.name  AS time_off_type_name,
               t.unit  AS time_off_unit,
               (a.allocated_amount - a.taken) AS remaining
        FROM time_off_allocations a
        JOIN users u ON u.id = a.employee_id
        JOIN time_off_types t ON t.id = a.time_off_type_id
        ${where}
        ORDER BY a.created_at DESC;
    `;
    const { rows } = await query(sql, values);
    return rows;
};

export const findById = async (id) => {
    const sql = `
        SELECT a.*,
               u.first_name || ' ' || u.last_name AS employee_name,
               t.name  AS time_off_type_name,
               t.unit  AS time_off_unit,
               (a.allocated_amount - a.taken) AS remaining
        FROM time_off_allocations a
        JOIN users u ON u.id = a.employee_id
        JOIN time_off_types t ON t.id = a.time_off_type_id
        WHERE a.id = $1;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const create = async (fields = {}) => {
    const sql = `
        INSERT INTO time_off_allocations
            (employee_id, time_off_type_id, start_date, end_date, allocated_amount, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
    `;
    const { rows } = await query(sql, [
        fields.employee_id,
        fields.time_off_type_id,
        fields.start_date,
        fields.end_date,
        fields.allocated_amount,
        fields.status ?? 'draft',
    ]);
    return rows[0];
};

export const remove = async (id) => {
    const sql = `DELETE FROM time_off_allocations WHERE id = $1 AND status = 'draft' RETURNING id;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const approve = async (id, approved_by) => {
    const sql = `
        UPDATE time_off_allocations
        SET status = 'approved', approved_by = $2, approved_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *;
    `;
    const { rows } = await query(sql, [id, approved_by]);
    return rows[0] ?? null;
};

export const refuse = async (id) => {
    const sql = `
        UPDATE time_off_allocations
        SET status = 'refused', updated_at = NOW()
        WHERE id = $1
        RETURNING *;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const update = async (id, fields) => {
    const { start_date, end_date, allocated_amount } = fields;
    const sql = `
        UPDATE time_off_allocations
        SET start_date       = COALESCE($2, start_date),
            end_date         = COALESCE($3, end_date),
            allocated_amount = COALESCE($4, allocated_amount),
            updated_at       = NOW()
        WHERE id = $1 AND status = 'draft'
        RETURNING *;
    `;
    const { rows } = await query(sql, [id, start_date ?? null, end_date ?? null, allocated_amount ?? null]);
    return rows[0] ?? null;
};
