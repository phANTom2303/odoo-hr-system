/**
 * @fileoverview Payslip Repository
 * SQL only — parameterised queries against `payslips` / `payslip_lines`.
 * No business logic, no typed errors: that belongs to `payslip.service.js` /
 * `payRun.service.js` (Phase 10 orchestration).
 *
 * pg gotchas handled here (see PAYROLL_IMPL_SPEC.md §1):
 *  - DATE columns (`segment_start`, `segment_end`, pay run window) are cast `::text`.
 *  - `warnings` is written as `JSON.stringify(...)` bound to a `$n::jsonb` parameter.
 */

import { query, transaction } from '#config/db.js';

/**
 * Delete a pay run's payslip (and, via FK cascade, its payslip_lines) for one employee.
 * MUST run inside the caller's transaction client — this is what makes
 * `insertPayslipWithLines` safely re-runnable after a partial compute failure.
 * @param {import('pg').PoolClient} client
 * @param {number|string} payRunId
 * @param {number|string} employeeId
 * @returns {Promise<void>}
 */
export const deleteByPayRunAndEmployee = async (client, payRunId, employeeId) => {
    await client.query(
        `DELETE FROM payslips WHERE pay_run_id = $1 AND employee_id = $2;`,
        [payRunId, employeeId]
    );
};

/**
 * Deletes all payslips and their cascaded lines for a specific pay run.
 * @param {number|string} payRunId
 * @returns {Promise<void>}
 */
export const deleteByPayRun = async (payRunId) => {
    await query(
        `DELETE FROM payslips WHERE pay_run_id = $1;`,
        [payRunId]
    );
};

/**
 * Phase 10 persistence: replace any prior payslip for this (pay_run, employee) pair
 * and insert the freshly computed one with its lines, all in a single transaction.
 * @param {object} payload
 * @param {number} payload.pay_run_id
 * @param {number} payload.employee_id
 * @param {number|null} payload.contract_id       - NULL for multi-contract prorated payslips.
 * @param {number} payload.gross_salary
 * @param {number} payload.net_salary
 * @param {number} payload.total_deductions
 * @param {number} payload.worked_days
 * @param {number} payload.worked_hours
 * @param {string} payload.status
 * @param {object[]} payload.warnings
 * @param {object[]} payload.lines                - Empty for a zeroed NO_ACTIVE_CONTRACT payslip.
 * @returns {Promise<object>} The inserted payslip row.
 */
export const insertPayslipWithLines = async ({
    pay_run_id,
    employee_id,
    contract_id,
    gross_salary,
    net_salary,
    total_deductions,
    worked_days,
    worked_hours,
    status,
    warnings,
    lines = [],
}) => {
    return transaction(async (client) => {
        // 1. Make compute re-runnable: wipe any prior payslip for this employee in this run.
        await deleteByPayRunAndEmployee(client, pay_run_id, employee_id);

        // 2. Insert the payslip.
        const { rows: [payslip] } = await client.query(
            `INSERT INTO payslips (
                pay_run_id, employee_id, contract_id, gross_salary, net_salary,
                total_deductions, worked_days, worked_hours, status, warnings
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
             RETURNING
                id, pay_run_id, employee_id, contract_id, gross_salary, net_salary,
                total_deductions, worked_days, worked_hours, status, warnings,
                is_reviewed, reviewed_by, reviewed_at, created_at, updated_at;`,
            [
                pay_run_id,
                employee_id,
                contract_id,
                gross_salary,
                net_salary,
                total_deductions,
                worked_days,
                worked_hours,
                status,
                JSON.stringify(warnings ?? []),
            ]
        );

        // 3. Bulk-insert lines. Skipped entirely for the zeroed NO_ACTIVE_CONTRACT payslip.
        if (lines.length > 0) {
            const COLS_PER_ROW = 11; // payslip_id, rule_id, rule_code, rule_name, category,
            // sequence, amount, contract_id, segment_start, segment_end, proration_factor
            // (computed_at is NOW(), not bound — 12th column in the INSERT list below).
            const values = [];
            const placeholders = lines
                .map((line, i) => {
                    const base = i * COLS_PER_ROW;
                    values.push(
                        payslip.id,
                        line.rule_id,
                        line.rule_code,
                        line.rule_name,
                        line.category,
                        line.sequence,
                        line.amount,
                        line.contract_id,
                        line.segment_start,
                        line.segment_end,
                        line.proration_factor
                    );
                    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, ` +
                        `$${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, NOW())`;
                })
                .join(', ');

            await client.query(
                `INSERT INTO payslip_lines (
                    payslip_id, rule_id, rule_code, rule_name, category, sequence, amount,
                    contract_id, segment_start, segment_end, proration_factor, computed_at
                 ) VALUES ${placeholders};`,
                values
            );
        }

        return payslip;
    });
};

/**
 * @param {object} [filters]
 * @param {number|string} [filters.pay_run_id]
 * @param {number|string} [filters.employee_id]
 * @param {string} [filters.status]
 * @returns {Promise<object[]>}
 */
export const findAll = async ({ pay_run_id, employee_id, status } = {}) => {
    const conditions = [];
    const values = [];

    if (pay_run_id) {
        conditions.push(`ps.pay_run_id = $${values.length + 1}`);
        values.push(Number(pay_run_id));
    }
    if (employee_id) {
        conditions.push(`ps.employee_id = $${values.length + 1}`);
        values.push(Number(employee_id));
    }
    if (status) {
        conditions.push(`ps.status = $${values.length + 1}`);
        values.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
        SELECT
            ps.*,
            u.first_name || ' ' || u.last_name AS employee_name,
            pr.name AS pay_run_name,
            pr.start_date::text AS start_date,
            pr.end_date::text AS end_date,
            ss.name AS structure_name
        FROM payslips ps
        JOIN users u ON u.id = ps.employee_id
        JOIN pay_runs pr ON pr.id = ps.pay_run_id
        LEFT JOIN contracts c ON c.id = ps.contract_id
        LEFT JOIN salary_structures ss ON ss.id = c.salary_structure_id
        ${where}
        ORDER BY ps.created_at DESC;
    `;
    const { rows } = await query(sql, values);
    return rows;
};

/**
 * @param {number|string} id
 * @returns {Promise<object|null>}
 */
export const findById = async (id) => {
    const sql = `
        SELECT
            ps.*,
            u.first_name || ' ' || u.last_name AS employee_name,
            pr.name AS pay_run_name,
            pr.start_date::text AS start_date,
            pr.end_date::text AS end_date,
            ss.name AS structure_name,
            d.name AS department_name,
            jp.title AS job_position_title
        FROM payslips ps
        JOIN users u ON u.id = ps.employee_id
        JOIN pay_runs pr ON pr.id = ps.pay_run_id
        LEFT JOIN contracts c ON c.id = ps.contract_id
        LEFT JOIN salary_structures ss ON ss.id = c.salary_structure_id
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN job_positions jp ON jp.id = u.job_position_id
        WHERE ps.id = $1;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

/**
 * Snapshot lines for one payslip, ordered for display.
 * @param {number|string} payslipId
 * @returns {Promise<object[]>}
 */
export const findLines = async (payslipId) => {
    const sql = `
        SELECT
            id,
            rule_id,
            rule_code,
            rule_name,
            category,
            sequence,
            amount,
            contract_id,
            segment_start::text AS segment_start,
            segment_end::text AS segment_end,
            proration_factor
        FROM payslip_lines
        WHERE payslip_id = $1
        ORDER BY sequence ASC, id ASC;
    `;
    const { rows } = await query(sql, [payslipId]);
    return rows;
};

/**
 * Mark a payslip reviewed (clears the validation-gate block for its errors).
 * @param {number|string} id
 * @param {number|string} userId
 * @returns {Promise<object>} The updated row.
 */
export const markReviewed = async (id, userId) => {
    const sql = `
        UPDATE payslips
        SET is_reviewed = TRUE,
            reviewed_by = $2,
            reviewed_at = NOW(),
            updated_at  = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
    `;
    const { rows } = await query(sql, [id, userId]);
    return rows[0];
};

/**
 * Bulk status transition for every payslip in a pay run (validate / mark-paid).
 * @param {number|string} payRunId
 * @param {string} status
 * @returns {Promise<{id: number}[]>}
 */
export const updateStatusByPayRun = async (payRunId, status) => {
    const sql = `
        UPDATE payslips
        SET status     = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE pay_run_id = $1
        RETURNING id;
    `;
    const { rows } = await query(sql, [payRunId, status]);
    return rows;
};

/**
 * Validation Gate (algorithm doc §15): payslips still unreviewed that carry at
 * least one error-severity warning. A non-empty result blocks `validate(id)`.
 * @param {number|string} payRunId
 * @returns {Promise<object[]>} `{ id, first_name, last_name, warnings }[]`
 */
export const findUnreviewedErrorPayslips = async (payRunId) => {
    const sql = `
        SELECT ps.id, u.first_name, u.last_name, ps.warnings
        FROM payslips ps
        JOIN users u ON u.id = ps.employee_id
        WHERE ps.pay_run_id = $1
          AND ps.is_reviewed = FALSE
          AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(ps.warnings) w
              WHERE w->>'severity' = 'error'
          );
    `;
    const { rows } = await query(sql, [payRunId]);
    return rows;
};

/**
 * @param {number|string} payslipId
 * @param {object} lineData
 * @returns {Promise<void>}
 */
export const insertManualLine = async (payslipId, { rule_name, amount, category }) => {
    const sequence = 8500;
    const rule_code = 'MANUAL';
    await query(
        `INSERT INTO payslip_lines (
            payslip_id, rule_code, rule_name, category, sequence, amount, computed_at
         ) VALUES ($1, $2, $3, $4, $5, $6, NOW());`,
        [payslipId, rule_code, rule_name, category, sequence, amount]
    );
};

export const updatePayslipTotals = async (payslipId, { gross_salary, total_deductions, net_salary }) => {
    const sql = `
        UPDATE payslips
        SET gross_salary = $2, total_deductions = $3, net_salary = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
    `;
    const { rows } = await query(sql, [payslipId, gross_salary, total_deductions, net_salary]);
    return rows[0];
};
