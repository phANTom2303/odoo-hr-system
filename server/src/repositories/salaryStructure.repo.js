/**
 * @fileoverview Salary Structure Repository
 */

import { query } from '#config/db.js';

export const findAll = async () => {
    const sql = `
        SELECT
            ss.*,
            COUNT(DISTINCT sr.id)::int  AS rule_count,
            COUNT(DISTINCT c.id)::int   AS employee_count
        FROM salary_structures ss
        LEFT JOIN salary_rules sr ON sr.structure_id = ss.id
        LEFT JOIN contracts    c  ON c.salary_structure_id = ss.id AND c.status = 'active'
        GROUP BY ss.id
        ORDER BY ss.name ASC;
    `;
    const { rows } = await query(sql);
    return rows;
};

export const findById = async (id) => {
    const sql = `
        SELECT
            ss.*,
            COUNT(DISTINCT sr.id)::int  AS rule_count,
            COUNT(DISTINCT c.id)::int   AS employee_count,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', sr.id, 'code', sr.code, 'name', sr.name,
                        'category', sr.category, 'sequence', sr.sequence,
                        'rule_type', sr.rule_type, 'fixed_amount', sr.fixed_amount,
                        'percentage', sr.percentage, 'base_rule_id', sr.base_rule_id
                    ) ORDER BY sr.sequence
                ) FILTER (WHERE sr.id IS NOT NULL),
                '[]'
            ) AS rules
        FROM salary_structures ss
        LEFT JOIN salary_rules sr ON sr.structure_id = ss.id
        LEFT JOIN contracts    c  ON c.salary_structure_id = ss.id AND c.status = 'active'
        WHERE ss.id = $1
        GROUP BY ss.id;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const create = async (fields) => {
    const sql = `
        INSERT INTO salary_structures (name, status)
        VALUES ($1, $2) RETURNING *;
    `;
    const { rows } = await query(sql, [fields.name, fields.status ?? 'active']);
    return rows[0];
};

export const update = async (id, fields) => {
    const allowedKeys = ['name', 'status'];
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
    const sql = `UPDATE salary_structures SET ${setClauses.join(', ')} WHERE id = $${p} RETURNING *;`;
    const { rows } = await query(sql, values);
    return rows[0] ?? null;
};

export const remove = async (id) => {
    const sql = `DELETE FROM salary_structures WHERE id = $1 RETURNING id;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const hasActiveContractReference = async (id) => {
    const sql = `SELECT 1 FROM contracts WHERE salary_structure_id = $1 AND status = 'active' LIMIT 1;`;
    const { rows } = await query(sql, [id]);
    return rows.length > 0;
};
