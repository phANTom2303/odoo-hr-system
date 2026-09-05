/**
 * @fileoverview Salary Rule Repository
 */

import { query } from '#config/db.js';

export const findByStructure = async (structureId) => {
    const sql = `
        SELECT sr.*, br.code AS base_rule_code
        FROM salary_rules sr
        LEFT JOIN salary_rules br ON br.id = sr.base_rule_id
        WHERE sr.structure_id = $1
        ORDER BY sr.sequence ASC;
    `;
    const { rows } = await query(sql, [structureId]);
    return rows;
};

export const findById = async (id) => {
    const sql = `
        SELECT sr.*, br.code AS base_rule_code
        FROM salary_rules sr
        LEFT JOIN salary_rules br ON br.id = sr.base_rule_id
        WHERE sr.id = $1;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const findByCode = async (structureId, code, excludeId = null) => {
    const sql = excludeId
        ? `SELECT id FROM salary_rules WHERE structure_id = $1 AND UPPER(code) = UPPER($2) AND id != $3 LIMIT 1;`
        : `SELECT id FROM salary_rules WHERE structure_id = $1 AND UPPER(code) = UPPER($2) LIMIT 1;`;
    const params = excludeId ? [structureId, code, excludeId] : [structureId, code];
    const { rows } = await query(sql, params);
    return rows[0] ?? null;
};

export const findBySequence = async (structureId, sequence, excludeId = null) => {
    const sql = excludeId
        ? `SELECT id FROM salary_rules WHERE structure_id = $1 AND sequence = $2 AND id != $3 LIMIT 1;`
        : `SELECT id FROM salary_rules WHERE structure_id = $1 AND sequence = $2 LIMIT 1;`;
    const params = excludeId ? [structureId, sequence, excludeId] : [structureId, sequence];
    const { rows } = await query(sql, params);
    return rows[0] ?? null;
};

export const create = async (structureId, fields) => {
    const sql = `
        INSERT INTO salary_rules
            (structure_id, code, name, category, sequence, rule_type,
             fixed_amount, percentage, base_rule_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *;
    `;
    const { rows } = await query(sql, [
        structureId,
        fields.code.toUpperCase(),
        fields.name,
        fields.category,
        fields.sequence,
        fields.rule_type,
        fields.fixed_amount ?? null,
        fields.percentage ?? null,
        fields.base_rule_id ?? null,
    ]);
    return rows[0];
};

export const update = async (id, fields) => {
    const allowedKeys = [
        'code','name','category','sequence','rule_type',
        'fixed_amount','percentage','base_rule_id',
    ];
    const setClauses = [];
    const values = [];
    let p = 1;
    for (const key of allowedKeys) {
        if (fields[key] !== undefined) {
            setClauses.push(`${key} = $${p++}`);
            values.push(key === 'code' ? fields[key].toUpperCase() : fields[key]);
        }
    }
    if (setClauses.length === 0) return findById(id);
    values.push(id);
    const sql = `UPDATE salary_rules SET ${setClauses.join(', ')} WHERE id = $${p} RETURNING *;`;
    const { rows } = await query(sql, values);
    return rows[0] ?? null;
};

export const remove = async (id) => {
    const sql = `DELETE FROM salary_rules WHERE id = $1 RETURNING id;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const hasDependentRules = async (id) => {
    const sql = `SELECT 1 FROM salary_rules WHERE base_rule_id = $1 LIMIT 1;`;
    const { rows } = await query(sql, [id]);
    return rows.length > 0;
};
