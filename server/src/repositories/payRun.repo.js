/**
 * @fileoverview Pay Run Repository
 * SQL only — parameterised queries against `pay_runs` / `pay_run_employees`.
 * No business logic, no typed errors: that belongs to `payRun.service.js`.
 *
 * pg gotchas handled here (see PAYROLL_IMPL_SPEC.md §1):
 *  - DATE columns (`start_date`, `end_date`, contract dates) are always cast `::text`
 *    so the engine/service layer never sees a timezone-shifted JS `Date`.
 *  - COUNT/SUM aggregates are cast `::int` / `::float8` so callers don't have to
 *    coerce string aggregates before doing arithmetic.
 */

import { query, transaction } from '#config/db.js';

/** Shared row shape for findAll/findById/updateStatus/updateMeta/create. */
const PAY_RUN_COLUMNS = `
    pr.id,
    pr.name,
    pr.start_date::text AS start_date,
    pr.end_date::text AS end_date,
    pr.status,
    pr.created_by,
    pr.validated_at,
    pr.paid_at,
    pr.created_at,
    pr.updated_at
`;

/**
 * Fetch all pay runs with creator name and derived totals.
 * @param {object} [filters]
 * @param {string} [filters.status]
 * @param {string} [filters.start_date] - ISO date; keeps runs ending on/after this date.
 * @param {string} [filters.end_date]   - ISO date; keeps runs starting on/before this date.
 * @returns {Promise<object[]>}
 */
export const findAll = async ({ status, start_date, end_date } = {}) => {
    const conditions = [];
    const values = [];

    if (status) {
        conditions.push(`pr.status = $${values.length + 1}`);
        values.push(status);
    }
    if (start_date) {
        conditions.push(`pr.end_date >= $${values.length + 1}`);
        values.push(start_date);
    }
    if (end_date) {
        conditions.push(`pr.start_date <= $${values.length + 1}`);
        values.push(end_date);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
        SELECT
            ${PAY_RUN_COLUMNS},
            u.first_name || ' ' || u.last_name AS created_by_name,
            (SELECT COUNT(*) FROM pay_run_employees pre WHERE pre.pay_run_id = pr.id)::int AS employee_count,
            (SELECT COALESCE(SUM(ps.net_salary), 0) FROM payslips ps WHERE ps.pay_run_id = pr.id)::float8 AS total_net
        FROM pay_runs pr
        JOIN users u ON u.id = pr.created_by
        ${where}
        ORDER BY pr.start_date DESC;
    `;
    const { rows } = await query(sql, values);
    return rows;
};

/**
 * Fetch a single pay run with the same enriched projection as findAll.
 * @param {number|string} id
 * @returns {Promise<object|null>}
 */
export const findById = async (id) => {
    const sql = `
        SELECT
            ${PAY_RUN_COLUMNS},
            u.first_name || ' ' || u.last_name AS created_by_name,
            (SELECT COUNT(*) FROM pay_run_employees pre WHERE pre.pay_run_id = pr.id)::int AS employee_count,
            (SELECT COALESCE(SUM(ps.net_salary), 0) FROM payslips ps WHERE ps.pay_run_id = pr.id)::float8 AS total_net
        FROM pay_runs pr
        JOIN users u ON u.id = pr.created_by
        WHERE pr.id = $1;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

/**
 * Fetch the bare pay run row (no joins) — used by the compute/validate/mark-paid
 * orchestration guards where only the raw fields are needed.
 * @param {number|string} id
 * @returns {Promise<object|null>}
 */
export const findByIdRaw = async (id) => {
    const sql = `
        SELECT
            id,
            name,
            start_date::text AS start_date,
            end_date::text AS end_date,
            status,
            validated_at,
            paid_at
        FROM pay_runs
        WHERE id = $1;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

/**
 * Per-employee payslip summary rows for a pay run's detail view.
 * @param {number|string} payRunId
 * @returns {Promise<object[]>}
 */
export const findPayslipSummaries = async (payRunId) => {
    const sql = `
        SELECT
            ps.id,
            ps.employee_id,
            u.first_name || ' ' || u.last_name AS employee_name,
            d.name AS department_name,
            ps.gross_salary,
            ps.net_salary,
            ps.total_deductions,
            ps.worked_days,
            ps.worked_hours,
            ps.status,
            ps.warnings,
            ps.is_reviewed
        FROM payslips ps
        JOIN users u ON u.id = ps.employee_id
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE ps.pay_run_id = $1
        ORDER BY employee_name;
    `;
    const { rows } = await query(sql, [payRunId]);
    return rows;
};

/**
 * Create a pay run and bulk-attach its selected employees in one transaction.
 * @param {object} data
 * @param {string} data.name
 * @param {string} data.start_date
 * @param {string} data.end_date
 * @param {number} data.created_by
 * @param {number[]} data.employee_ids - Already de-duplicated by the service layer.
 * @returns {Promise<object>} The created pay run row plus `employee_count`.
 */
export const create = async ({
    name,
    start_date,
    end_date,
    created_by,
    employee_ids,
}) => {
    return transaction(async (client) => {
        const { rows: [payRun] } = await client.query(
            `INSERT INTO pay_runs (name, start_date, end_date, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING
                id, name,
                start_date::text AS start_date, end_date::text AS end_date,
                status, created_by, validated_at, paid_at, created_at, updated_at;`,
            [name, start_date, end_date, created_by]
        );

        if (employee_ids.length > 0) {
            // Single multi-row VALUES statement: ($1,$2),($1,$3),($1,$4)... — $1 is the
            // pay_run_id, reused across every row; one placeholder per employee follows it.
            const values = [payRun.id, ...employee_ids];
            const placeholders = employee_ids
                .map((_, i) => `($1, $${i + 2})`)
                .join(', ');

            await client.query(
                `INSERT INTO pay_run_employees (pay_run_id, employee_id)
                 VALUES ${placeholders}
                 ON CONFLICT (pay_run_id, employee_id) DO NOTHING;`,
                values
            );
        }

        const { rows: [{ count: employee_count }] } = await client.query(
            `SELECT COUNT(*)::int AS count FROM pay_run_employees WHERE pay_run_id = $1;`,
            [payRun.id]
        );

        return { ...payRun, employee_count };
    });
};

/**
 * Transition a pay run's status, optionally stamping validated_at/paid_at.
 * Only overwrites the timestamp columns when a non-null value is supplied.
 * @param {number|string} id
 * @param {string} status
 * @param {object} [stamps]
 * @param {string|Date|null} [stamps.validated_at]
 * @param {string|Date|null} [stamps.paid_at]
 * @returns {Promise<object>} The updated row.
 */
export const updateStatus = async (id, status, { validated_at = null, paid_at = null } = {}) => {
    const sql = `
        UPDATE pay_runs
        SET status       = $2,
            validated_at = COALESCE($3, validated_at),
            paid_at      = COALESCE($4, paid_at),
            updated_at   = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING
            id, name,
            start_date::text AS start_date, end_date::text AS end_date,
            status, created_by, validated_at, paid_at, created_at, updated_at;
    `;
    const { rows } = await query(sql, [id, status, validated_at, paid_at]);
    return rows[0];
};

/**
 * Update the mutable metadata of a draft pay run (name only).
 * @param {number|string} id
 * @param {object} data
 * @param {string} data.name
 * @returns {Promise<object>} The updated row.
 */
export const updateMeta = async (id, { name }) => {
    const sql = `
        UPDATE pay_runs
        SET name       = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING
            id, name,
            start_date::text AS start_date, end_date::text AS end_date,
            status, created_by, validated_at, paid_at, created_at, updated_at;
    `;
    const { rows } = await query(sql, [id, name]);
    return rows[0];
};

/**
 * Delete a pay run (draft-only enforcement lives in the service).
 * @param {number|string} id
 * @returns {Promise<{id: number}|null>}
 */
export const remove = async (id) => {
    const sql = `DELETE FROM pay_runs WHERE id = $1 RETURNING id;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

/**
 * @param {number|string} payRunId
 * @returns {Promise<number>} Count of employees selected into this pay run.
 */
export const countSelectedEmployees = async (payRunId) => {
    const sql = `SELECT COUNT(*)::int AS count FROM pay_run_employees WHERE pay_run_id = $1;`;
    const { rows } = await query(sql, [payRunId]);
    return rows[0].count;
};

/**
 * Active employees holding >= 1 active contract overlapping [start_date, end_date],
 * one row per (employee, contract) so the run-creation wizard can surface mid-period
 * contract changes. `contract_count > 1` marks an employee whose payslip will be prorated.
 * @param {object} filters
 * @param {string} filters.start_date
 * @param {string} filters.end_date
 * @param {number} [filters.department_id]
 * @param {string} [filters.employee_type]
 * @returns {Promise<object[]>}
 */
export const findEligibleEmployees = async ({ start_date, end_date, department_id, employee_type }) => {
    // $1 = start_date, $2 = end_date — fixed positions, reused by both the contract JOIN
    // and the has_overlapping_payslip sub-select. Optional filters append after them.
    const values = [start_date, end_date];
    const conditions = [];

    if (department_id) {
        conditions.push(`u.department_id = $${values.length + 1}`);
        values.push(Number(department_id));
    }
    if (employee_type) {
        conditions.push(`u.employee_type = $${values.length + 1}`);
        values.push(employee_type);
    }

    const extraWhere = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    const sql = `
        SELECT
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.employee_type,
            d.name AS department_name,
            jp.title AS job_position_title,
            c.id AS contract_id,
            c.wage,
            c.start_date::text AS contract_start,
            c.end_date::text AS contract_end,
            COUNT(c.id) OVER (PARTITION BY u.id)::int AS contract_count,
            EXISTS (
                SELECT 1
                FROM payslips ps
                JOIN pay_runs pr2 ON pr2.id = ps.pay_run_id
                WHERE ps.employee_id = u.id
                  AND ps.status NOT IN ('paid', 'cancelled')
                  AND pr2.start_date <= $2
                  AND pr2.end_date >= $1
            ) AS has_overlapping_payslip
        FROM users u
        JOIN contracts c
            ON c.employee_id = u.id
           AND c.status = 'active'
           AND c.start_date <= $2
           AND (c.end_date IS NULL OR c.end_date >= $1)
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN job_positions jp ON jp.id = u.job_position_id
        WHERE u.is_active = TRUE
          AND u.employment_status = 'active'
          ${extraWhere}
        ORDER BY u.id, c.start_date ASC;
    `;
    const { rows } = await query(sql, values);
    return rows;
};
