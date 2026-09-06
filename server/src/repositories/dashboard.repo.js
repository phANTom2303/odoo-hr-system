/**
 * @fileoverview Dashboard Repository
 * SQL only — parameterised aggregate queries backing the HR/payroll dashboard
 * summary. No business logic, no date math: that belongs to `dashboard.service.js`.
 *
 * pg gotchas handled here (see payRun.repo.js / payslip.repo.js for precedent):
 *  - COUNT/SUM aggregates are cast `::int` / `::float8` so callers don't have to
 *    coerce string aggregates before doing arithmetic.
 *  - `start`/`end` are always ISO date strings (`YYYY-MM-DD`) computed by the
 *    service layer — never JS `Date` objects — to avoid timezone drift.
 *  - Pay runs are NOT required to be calendar-month aligned (the pay run wizard
 *    takes arbitrary start/end dates, e.g. a "16th to 15th" cycle). Every query
 *    below that scopes to a period therefore filters on whether the pay run's
 *    date range OVERLAPS [start, end] (`pr.start_date <= end AND pr.end_date >=
 *    start`) rather than whether `pr.start_date` merely falls inside it — same
 *    overlap convention `payRun.repo.js#findAll` already uses. Filtering on
 *    start_date alone silently drops any pay run whose cycle crosses a month
 *    boundary from every period it touches.
 */

import { query } from '#config/db.js';

/**
 * Appends the optional department_id / employee_type filters shared by nearly
 * every dashboard query, following the same `conditions[]`/`values[]` builder
 * idiom used in payRun.repo.js / payslip.repo.js.
 * @param {string[]} conditions
 * @param {any[]} values
 * @param {number|string} [department_id]
 * @param {string} [employee_type]
 * @param {string} [userAlias] - alias of the `users` table in the query (default 'u').
 */
const pushUserFilters = (conditions, values, department_id, employee_type, userAlias = 'u') => {
    if (department_id) {
        conditions.push(`${userAlias}.department_id = $${values.length + 1}`);
        values.push(Number(department_id));
    }
    if (employee_type) {
        conditions.push(`${userAlias}.employee_type = $${values.length + 1}`);
        values.push(employee_type);
    }
};

/**
 * Total net salary paid out for payslips whose pay run starts within [start, end].
 * @param {object} filters
 * @param {string} filters.start
 * @param {string} filters.end
 * @param {number|string} [filters.department_id]
 * @param {string} [filters.employee_type]
 * @returns {Promise<number>}
 */
export const getSalaryTotal = async ({ start, end, department_id, employee_type }) => {
    const values = [start, end];
    const conditions = [
        `ps.status = 'paid'`,
        `pr.start_date <= $2`,
        `pr.end_date >= $1`,
    ];
    pushUserFilters(conditions, values, department_id, employee_type);

    const sql = `
        SELECT COALESCE(SUM(ps.net_salary), 0)::float8 AS total
        FROM payslips ps
        JOIN pay_runs pr ON pr.id = ps.pay_run_id
        JOIN users u ON u.id = ps.employee_id
        WHERE ${conditions.join(' AND ')};
    `;
    const { rows } = await query(sql, values);
    return rows[0].total;
};

/**
 * Payslip generation/paid/pending counts for the period.
 * @param {object} filters
 * @returns {Promise<{generated: number, paid: number, pending: number}>}
 */
export const getPayslipCounts = async ({ start, end, department_id, employee_type }) => {
    const values = [start, end];
    const conditions = [`pr.start_date <= $2`, `pr.end_date >= $1`];
    pushUserFilters(conditions, values, department_id, employee_type);

    const sql = `
        SELECT
            COUNT(*) FILTER (WHERE ps.status != 'cancelled')::int AS generated,
            COUNT(*) FILTER (WHERE ps.status = 'paid')::int AS paid,
            COUNT(*) FILTER (WHERE ps.status IN ('draft', 'computed', 'validated'))::int AS pending
        FROM payslips ps
        JOIN pay_runs pr ON pr.id = ps.pay_run_id
        JOIN users u ON u.id = ps.employee_id
        WHERE ${conditions.join(' AND ')};
    `;
    const { rows } = await query(sql, values);
    return rows[0];
};

/**
 * Payslip counts broken down by status (zero-filled by the caller — SQL only
 * returns statuses that have at least one matching row).
 * @param {object} filters
 * @returns {Promise<{status: string, count: number}[]>}
 */
export const getPayslipStatusCounts = async ({ start, end, department_id, employee_type }) => {
    const values = [start, end];
    const conditions = [`pr.start_date <= $2`, `pr.end_date >= $1`];
    pushUserFilters(conditions, values, department_id, employee_type);

    const sql = `
        SELECT ps.status, COUNT(*)::int AS count
        FROM payslips ps
        JOIN pay_runs pr ON pr.id = ps.pay_run_id
        JOIN users u ON u.id = ps.employee_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY ps.status;
    `;
    const { rows } = await query(sql, values);
    return rows;
};

/**
 * Alert counters: missing bank details, duplicate payslip warnings, and
 * drafts/computed payslips not yet validated.
 * @param {object} filters
 * @returns {Promise<{missingBankAccounts: number, duplicatePayslipWarnings: number, draftsNotValidated: number}>}
 */
export const getAlerts = async ({ start, end, department_id, employee_type }) => {
    const values = [start, end];
    const conditions = [`pr.start_date <= $2`, `pr.end_date >= $1`];
    pushUserFilters(conditions, values, department_id, employee_type);

    const sql = `
        SELECT
            COUNT(*) FILTER (
                WHERE EXISTS (
                    SELECT 1 FROM jsonb_array_elements(ps.warnings) w
                    WHERE w->>'code' = 'MISSING_BANK_DETAILS'
                )
            )::int AS "missingBankAccounts",
            COUNT(*) FILTER (
                WHERE EXISTS (
                    SELECT 1 FROM jsonb_array_elements(ps.warnings) w
                    WHERE w->>'code' = 'DUPLICATE_PAYSLIP'
                )
            )::int AS "duplicatePayslipWarnings",
            COUNT(*) FILTER (WHERE ps.status IN ('draft', 'computed'))::int AS "draftsNotValidated"
        FROM payslips ps
        JOIN pay_runs pr ON pr.id = ps.pay_run_id
        JOIN users u ON u.id = ps.employee_id
        WHERE ${conditions.join(' AND ')};
    `;
    const { rows } = await query(sql, values);
    return rows[0];
};

/**
 * Count of active contracts expiring within [start, end].
 * @param {object} filters
 * @returns {Promise<number>}
 */
export const getContractsExpiringSoon = async ({ start, end, department_id, employee_type }) => {
    const values = [start, end];
    const conditions = [
        `c.status = 'active'`,
        `c.end_date IS NOT NULL`,
        `c.end_date BETWEEN $1 AND $2`,
    ];
    pushUserFilters(conditions, values, department_id, employee_type);

    const sql = `
        SELECT COUNT(*)::int AS count
        FROM contracts c
        JOIN users u ON u.id = c.employee_id
        WHERE ${conditions.join(' AND ')};
    `;
    const { rows } = await query(sql, values);
    return rows[0].count;
};

/**
 * One row per department: headcount of active employees and total net salary
 * paid in the period. LEFT JOINed throughout so departments with zero
 * matching employees/payslips still appear.
 * @param {object} filters
 * @returns {Promise<{departmentId: number, department: string, headcount: number, amount: number}[]>}
 */
export const getDepartmentBreakdown = async ({ start, end, department_id, employee_type }) => {
    // $1 = start, $2 = end — fixed positions used by the payslip LEFT JOIN's ON clause.
    const values = [start, end];

    // employee_type must live in the users LEFT JOIN's ON clause (not WHERE), or it
    // silently turns the LEFT JOIN into an INNER JOIN and drops empty departments.
    const userJoinConditions = [
        `u.department_id = d.id`,
        `u.is_active = TRUE`,
        `u.employment_status = 'active'`,
    ];
    if (employee_type) {
        userJoinConditions.push(`u.employee_type = $${values.length + 1}`);
        values.push(employee_type);
    }

    const whereConditions = [];
    if (department_id) {
        whereConditions.push(`d.id = $${values.length + 1}`);
        values.push(Number(department_id));
    }
    const where = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const sql = `
        SELECT
            d.id AS "departmentId",
            d.name AS department,
            COUNT(DISTINCT u.id)::int AS headcount,
            COALESCE(SUM(ps.net_salary), 0)::float8 AS amount
        FROM departments d
        LEFT JOIN users u ON ${userJoinConditions.join(' AND ')}
        LEFT JOIN payslips ps
            ON ps.employee_id = u.id
           AND ps.status = 'paid'
           AND ps.pay_run_id IN (
                SELECT pr.id FROM pay_runs pr
                WHERE pr.start_date <= $2 AND pr.end_date >= $1
           )
        ${where}
        GROUP BY d.id, d.name
        ORDER BY d.name;
    `;
    const { rows } = await query(sql, values);
    return rows;
};

/**
 * Attendance overview for the period: presence/lateness/absence counters.
 * "Late" is derived per-row via a correlated scalar subquery that resolves the
 * employee's scheduled start time for that weekday (avoids join fan-out from
 * multiple contracts/schedule lines).
 * @param {object} filters
 * @returns {Promise<object>} `{ present, late, absent, onLeave, holiday, missingCheckouts, manualEdits, total }`
 */
export const getAttendanceOverview = async ({ start, end, department_id, employee_type }) => {
    const values = [start, end];
    const conditions = [`a.date >= $1`, `a.date <= $2`];
    pushUserFilters(conditions, values, department_id, employee_type);

    const sql = `
        WITH scoped AS (
            SELECT
                a.status,
                a.check_in,
                a.check_out,
                a.is_manual_edit,
                (
                    SELECT sl.start_time
                    FROM contracts c
                    JOIN schedule_lines sl
                        ON sl.schedule_id = c.schedule_id
                       AND sl.day_of_week = (ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday'])[EXTRACT(ISODOW FROM a.date)::int]::day_of_week
                    WHERE c.employee_id = a.employee_id
                      AND c.status IN ('active', 'expired')
                      AND c.start_date <= a.date
                      AND (c.end_date IS NULL OR c.end_date >= a.date)
                    ORDER BY c.start_date DESC
                    LIMIT 1
                ) AS scheduled_start
            FROM attendance a
            JOIN users u ON u.id = a.employee_id
            WHERE ${conditions.join(' AND ')}
        )
        SELECT
            COUNT(*) FILTER (
                WHERE status = 'present'
                  AND NOT (scheduled_start IS NOT NULL AND check_in::time > scheduled_start + interval '15 minutes')
            )::int AS present,
            COUNT(*) FILTER (
                WHERE status = 'present'
                  AND scheduled_start IS NOT NULL
                  AND check_in::time > scheduled_start + interval '15 minutes'
            )::int AS late,
            COUNT(*) FILTER (WHERE status = 'absent')::int AS absent,
            COUNT(*) FILTER (WHERE status = 'on_leave')::int AS "onLeave",
            COUNT(*) FILTER (WHERE status = 'holiday')::int AS holiday,
            COUNT(*) FILTER (WHERE check_in IS NOT NULL AND check_out IS NULL)::int AS "missingCheckouts",
            COUNT(*) FILTER (WHERE is_manual_edit = TRUE)::int AS "manualEdits",
            COUNT(*)::int AS total
        FROM scoped;
    `;
    const { rows } = await query(sql, values);
    return rows[0];
};

/**
 * One row per active time-off type: approved/pending day counts overlapping
 * the period, plus remaining allocation balance.
 * @param {object} filters
 * @returns {Promise<object[]>} `{ typeId, type, approvedDays, pending, remainingBalance, requiresAllocation }[]`
 */
export const getTimeOffOverview = async ({ start, end, department_id, employee_type }) => {
    // $1 = start, $2 = end — fixed positions reused by the request-overlap filter,
    // the request-side user join, and the allocation subquery.
    const values = [start, end];

    // Request-side: join requests to their type first (time-window filter only —
    // no user filter here, since `u` isn't in scope yet), then LEFT JOIN users so
    // department_id/employee_type can gate the join without dropping zero-request
    // types (same fan-out-safety idiom as getDepartmentBreakdown).
    const requestUserJoinConditions = [`u.id = r.employee_id`];
    if (department_id) {
        requestUserJoinConditions.push(`u.department_id = $${values.length + 1}`);
        values.push(Number(department_id));
    }
    if (employee_type) {
        requestUserJoinConditions.push(`u.employee_type = $${values.length + 1}`);
        values.push(employee_type);
    }

    // Allocation-side filters (own copies of department_id/employee_type params,
    // appended after the request-side ones so placeholder numbering stays correct).
    const allocUserConditions = [];
    if (department_id) {
        allocUserConditions.push(`ua.department_id = $${values.length + 1}`);
        values.push(Number(department_id));
    }
    if (employee_type) {
        allocUserConditions.push(`ua.employee_type = $${values.length + 1}`);
        values.push(employee_type);
    }
    const allocUserWhere = allocUserConditions.length ? `AND ${allocUserConditions.join(' AND ')}` : '';

    const sql = `
        SELECT
            t.id AS "typeId",
            t.name AS type,
            t.requires_allocation AS "requiresAllocation",
            COALESCE(SUM(r.number_of_days) FILTER (WHERE r.status = 'approved' AND u.id IS NOT NULL), 0)::float8 AS "approvedDays",
            COUNT(*) FILTER (WHERE r.status IN ('draft', 'pending') AND u.id IS NOT NULL)::int AS pending,
            (
                SELECT SUM(a.allocated_amount - a.taken)
                FROM time_off_allocations a
                JOIN users ua ON ua.id = a.employee_id
                WHERE a.time_off_type_id = t.id
                  AND a.status = 'approved'
                  AND a.start_date <= $2
                  AND a.end_date >= $1
                  ${allocUserWhere}
            )::float8 AS "remainingBalance"
        FROM time_off_types t
        LEFT JOIN time_off_requests r
            ON r.time_off_type_id = t.id
           AND r.start_date <= $2
           AND r.end_date >= $1
        LEFT JOIN users u ON ${requestUserJoinConditions.join(' AND ')}
        WHERE t.is_active = TRUE
        GROUP BY t.id, t.name, t.requires_allocation
        ORDER BY t.name;
    `;
    const { rows } = await query(sql, values);
    return rows;
};
