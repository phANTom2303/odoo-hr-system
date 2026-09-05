/**
 * @fileoverview Payroll Engine Read-Model Repository
 *
 * Read-only queries feeding the payroll compute engine
 * (`payrollEngine.service.js`). Pure SQL, parameterised — no business logic,
 * no typed errors thrown. Absent data resolves to `null` / `0` / `[]` and is
 * left for the service layer to interpret.
 *
 * Two `pg` footguns apply throughout (see `PAYROLL_IMPL_SPEC.md` §1 and
 * `#utils/payrollDates.js`):
 *   - every DATE column is cast `::text` so it arrives as a 'YYYY-MM-DD'
 *     string instead of a timezone-shifted JS `Date`;
 *   - every COUNT/SUM is cast `::int` / `::float8` so it arrives as a JS
 *     number instead of a string.
 */

import { query } from '#config/db.js';

/**
 * Loads a pay run's core fields for the compute pre-condition guards.
 * Algorithm doc §1a.
 *
 * @param {number} payRunId
 * @returns {Promise<{id: number, name: string, salary_structure_id: number,
 *   start_date: string, end_date: string, status: string}|null>}
 */
export const findPayRunForCompute = async (payRunId) => {
  const sql = `
    SELECT id, name, salary_structure_id,
           start_date::text AS start_date,
           end_date::text   AS end_date,
           status
    FROM pay_runs
    WHERE id = $1;
  `;
  const { rows } = await query(sql, [payRunId]);
  return rows[0] ?? null;
};

/**
 * Loads the salary structure attached to a pay run, for the "structure must
 * be active" pre-condition guard. Algorithm doc §1b.
 *
 * @param {number} payRunId
 * @returns {Promise<{id: number, name: string, status: string}|null>}
 */
export const findStructureForPayRun = async (payRunId) => {
  const sql = `
    SELECT ss.id, ss.name, ss.status
    FROM salary_structures ss
    JOIN pay_runs pr ON pr.salary_structure_id = ss.id
    WHERE pr.id = $1;
  `;
  const { rows } = await query(sql, [payRunId]);
  return rows[0] ?? null;
};

/**
 * Loads all salary rules for a structure, ordered for sequential execution.
 * Algorithm doc §2a (Phase 0).
 *
 * @param {number} structureId
 * @returns {Promise<object[]>} Rows: id, code, name, category, sequence,
 *   rule_type, fixed_amount, percentage, base_rule_id.
 */
export const findRulesByStructure = async (structureId) => {
  const sql = `
    SELECT
      sr.id,
      sr.code,
      sr.name,
      sr.category,
      sr.sequence,
      sr.rule_type,
      sr.fixed_amount,
      sr.percentage,
      sr.base_rule_id
    FROM salary_rules sr
    WHERE sr.structure_id = $1
    ORDER BY sr.sequence ASC;
  `;
  const { rows } = await query(sql, [structureId]);
  return rows;
};

/**
 * Loads paid company holidays inside the pay period, for the paid-holidays-
 * on-workdays calculation in Phase 8. Algorithm doc §2b (Phase 0).
 *
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate - 'YYYY-MM-DD'
 * @returns {Promise<{date: string, dow: number}[]>}
 */
export const findPaidHolidays = async (startDate, endDate) => {
  const sql = `
    SELECT date::text AS date,
           EXTRACT(ISODOW FROM date)::int AS dow
    FROM company_holidays
    WHERE date BETWEEN $1 AND $2
      AND is_paid = TRUE;
  `;
  const { rows } = await query(sql, [startDate, endDate]);
  return rows;
};

/**
 * Loads the employees selected for a pay run. Algorithm doc §2c (Phase 0).
 *
 * @param {number} payRunId
 * @returns {Promise<{employee_id: number}[]>}
 */
export const findSelectedEmployees = async (payRunId) => {
  const sql = `
    SELECT u.id AS employee_id
    FROM pay_run_employees pre
    JOIN users u ON u.id = pre.employee_id
    WHERE pre.pay_run_id = $1
    ORDER BY u.id;
  `;
  const { rows } = await query(sql, [payRunId]);
  return rows;
};

/**
 * Loads candidate payslips (from other pay runs) that might overlap the
 * current pay run's period, for the duplicate-payslip check.
 * Algorithm doc §4a (Phase 2).
 *
 * @param {number} employeeId
 * @param {number} currentPayRunId
 * @returns {Promise<{id: number, pay_run_id: number, pay_run_name: string,
 *   existing_start: string, existing_end: string}[]>}
 */
export const findOverlappingPayslipCandidates = async (employeeId, currentPayRunId) => {
  const sql = `
    SELECT
      ps.id,
      ps.pay_run_id,
      pr.name AS pay_run_name,
      pr.start_date::text AS existing_start,
      pr.end_date::text   AS existing_end
    FROM payslips ps
    JOIN pay_runs pr ON pr.id = ps.pay_run_id
    WHERE ps.employee_id = $1
      AND ps.status NOT IN ('paid', 'cancelled')
      AND ps.pay_run_id != $2
    ORDER BY ps.created_at DESC
    LIMIT 5;
  `;
  const { rows } = await query(sql, [employeeId, currentPayRunId]);
  return rows;
};

/**
 * Loads the employee snapshot fields used by the Phase 2 missing-data
 * checks. Algorithm doc §4b (Phase 2).
 *
 * @param {number} employeeId
 * @returns {Promise<object|null>} first_name, last_name, email,
 *   date_of_joining, bank_name, bank_account, employment_status, is_active.
 */
export const findEmployeeSnapshot = async (employeeId) => {
  const sql = `
    SELECT
      first_name,
      last_name,
      email,
      date_of_joining::text AS date_of_joining,
      bank_name,
      bank_account,
      employment_status,
      is_active
    FROM users
    WHERE id = $1;
  `;
  const { rows } = await query(sql, [employeeId]);
  return rows[0] ?? null;
};

/**
 * Loads active contracts for an employee overlapping the pay period, ordered
 * for Phase 3 contract resolution / Phase 4 segmenting.
 * Algorithm doc §5 (Phase 3).
 *
 * @param {number} employeeId
 * @param {string} startDate - Pay run start date, 'YYYY-MM-DD'.
 * @param {string} endDate - Pay run end date, 'YYYY-MM-DD'.
 * @returns {Promise<object[]>} Rows: id, wage, schedule_id,
 *   salary_structure_id, start_date, end_date, department_id,
 *   job_position_id, overtime_policy_id.
 */
export const findActiveContractsInPeriod = async (employeeId, startDate, endDate) => {
  const sql = `
    SELECT
      c.id,
      c.wage,
      c.schedule_id,
      c.salary_structure_id,
      c.start_date::text AS start_date,
      c.end_date::text   AS end_date,
      c.department_id,
      c.job_position_id,
      c.overtime_policy_id
    FROM contracts c
    WHERE c.employee_id = $1
      AND c.status = 'active'
      AND c.start_date <= $3
      AND (c.end_date IS NULL OR c.end_date >= $2)
    ORDER BY c.start_date ASC;
  `;
  const { rows } = await query(sql, [employeeId, startDate, endDate]);
  return rows;
};

/**
 * Loads the active schedule line day names for a working schedule. The
 * caller maps `dow_name` through `DOW_MAP` to get ISO integers.
 * Algorithm doc §6a (Phase 4).
 *
 * @param {number} scheduleId
 * @returns {Promise<{dow_name: string}[]>}
 */
export const findScheduleDayNames = async (scheduleId) => {
  const sql = `
    SELECT day_of_week::text AS dow_name
    FROM schedule_lines
    WHERE schedule_id = $1
      AND is_active = TRUE;
  `;
  const { rows } = await query(sql, [scheduleId]);
  return rows;
};

/**
 * Average net scheduled hours per active schedule line (start_time to
 * end_time minus break), used to derive the OT hourly rate.
 * Algorithm doc §6e (Phase 4).
 *
 * @param {number} scheduleId
 * @returns {Promise<number>} 0 if the schedule has no active lines.
 */
export const findScheduleDailyHours = async (scheduleId) => {
  const sql = `
    SELECT
      AVG(
        EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) / 3600.0
          - (sl.break_minutes / 60.0)
      )::float8 AS daily_hours
    FROM schedule_lines sl
    WHERE sl.schedule_id = $1
      AND sl.is_active = TRUE;
  `;
  const { rows } = await query(sql, [scheduleId]);
  return rows[0]?.daily_hours ?? 0;
};

/**
 * Loads an overtime policy by id. Algorithm doc §8a (Phase 5B).
 *
 * @param {number|null} policyId - Contract's overtime_policy_id.
 * @returns {Promise<{id: number, name: string, multiplier: string,
 *   compensatory_off: boolean, threshold_type: string}|null>} null when
 *   `policyId` is null (contract has no OT policy) or not found.
 */
export const findOvertimePolicy = async (policyId) => {
  if (policyId === null || policyId === undefined) return null;
  const sql = `
    SELECT id, name, multiplier, compensatory_off, threshold_type
    FROM overtime_policies
    WHERE id = $1;
  `;
  const { rows } = await query(sql, [policyId]);
  return rows[0] ?? null;
};

/**
 * Sums recorded overtime hours for an employee within a segment — used both
 * for the "untracked OT" warning (no policy) and the comp-off hours warning.
 * Algorithm doc §8a/§8b (Phase 5B).
 *
 * @param {number} employeeId
 * @param {string} segStart - 'YYYY-MM-DD'
 * @param {string} segEnd - 'YYYY-MM-DD'
 * @returns {Promise<number>} 0 if no matching attendance rows.
 */
export const sumOvertimeHours = async (employeeId, segStart, segEnd) => {
  const sql = `
    SELECT COALESCE(SUM(overtime_hours), 0)::float8 AS total_ot_hours
    FROM attendance
    WHERE employee_id = $1
      AND date BETWEEN $2 AND $3
      AND overtime_hours > 0;
  `;
  const { rows } = await query(sql, [employeeId, segStart, segEnd]);
  return rows[0]?.total_ot_hours ?? 0;
};

/**
 * Sums overtime hours grouped by overtime_type for a segment, used to
 * compute total OT pay. Algorithm doc §8c (Phase 5B).
 *
 * @param {number} employeeId
 * @param {string} segStart - 'YYYY-MM-DD'
 * @param {string} segEnd - 'YYYY-MM-DD'
 * @returns {Promise<{overtime_type: string, ot_hours: number}[]>}
 */
export const sumOvertimeByType = async (employeeId, segStart, segEnd) => {
  const sql = `
    SELECT a.overtime_type,
           SUM(a.overtime_hours)::float8 AS ot_hours
    FROM attendance a
    WHERE a.employee_id = $1
      AND a.date BETWEEN $2 AND $3
      AND a.overtime_hours > 0
    GROUP BY a.overtime_type;
  `;
  const { rows } = await query(sql, [employeeId, segStart, segEnd]);
  return rows;
};

/**
 * Counts approved unpaid-leave days (clipped to the pay period) that fall on
 * a scheduled workday, via the `generate_series` CROSS JOIN LATERAL query.
 * Algorithm doc §9 (Phase 6).
 *
 * @param {number} employeeId
 * @param {string} startDate - Pay run start date, 'YYYY-MM-DD'.
 * @param {string} endDate - Pay run end date, 'YYYY-MM-DD'.
 * @param {number[]} dayNumbers - ISO day-of-week integers (1..7).
 * @returns {Promise<number>} 0 immediately if `dayNumbers` is empty.
 */
export const countUnpaidLeaveDays = async (employeeId, startDate, endDate, dayNumbers) => {
  if (!dayNumbers || dayNumbers.length === 0) return 0;
  const sql = `
    SELECT COUNT(*)::int AS total_unpaid_leave_days
    FROM time_off_requests tor
    JOIN time_off_types tot ON tot.id = tor.time_off_type_id
    CROSS JOIN LATERAL generate_series(
      GREATEST(tor.start_date, $2::date),
      LEAST(tor.end_date, $3::date),
      '1 day'
    ) AS d(dt)
    WHERE tor.employee_id = $1
      AND tor.status = 'approved'
      AND tot.is_paid = FALSE
      AND tor.start_date <= $3
      AND tor.end_date   >= $2
      AND EXTRACT(ISODOW FROM d.dt)::int = ANY($4::int[]);
  `;
  const { rows } = await query(sql, [employeeId, startDate, endDate, dayNumbers]);
  return rows[0]?.total_unpaid_leave_days ?? 0;
};

/**
 * Aggregates attendance for the full pay period into present-day count and
 * total worked hours. Algorithm doc §11 (Phase 8).
 *
 * @param {number} employeeId
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate - 'YYYY-MM-DD'
 * @returns {Promise<{attendance_present_days: number, total_worked_hours: number}>}
 */
export const findAttendanceAggregate = async (employeeId, startDate, endDate) => {
  const sql = `
    SELECT
      COUNT(CASE WHEN a.status IN ('present', 'special_leave') THEN 1 END)::int
        AS attendance_present_days,
      COALESCE(
        SUM(CASE WHEN a.status IN ('present', 'special_leave')
                 THEN a.worked_hours ELSE 0 END),
        0
      )::float8 AS total_worked_hours
    FROM attendance a
    WHERE a.employee_id = $1
      AND a.date BETWEEN $2 AND $3;
  `;
  const { rows } = await query(sql, [employeeId, startDate, endDate]);
  return rows[0] ?? { attendance_present_days: 0, total_worked_hours: 0 };
};

/**
 * Counts attendance records with a check-in but no check-out over the pay
 * period (unreviewed attendance). Algorithm doc §12 W1 (Phase 9).
 *
 * @param {number} employeeId
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate - 'YYYY-MM-DD'
 * @returns {Promise<number>}
 */
export const countMissingCheckouts = async (employeeId, startDate, endDate) => {
  const sql = `
    SELECT COUNT(*)::int AS missing_checkouts
    FROM attendance a
    WHERE a.employee_id = $1
      AND a.date BETWEEN $2 AND $3
      AND a.check_in IS NOT NULL
      AND a.check_out IS NULL;
  `;
  const { rows } = await query(sql, [employeeId, startDate, endDate]);
  return rows[0]?.missing_checkouts ?? 0;
};

/**
 * Counts scheduled workdays in the pay period (excluding company holidays)
 * with no attendance check-in and no approved leave covering the date.
 * Algorithm doc §12 W2 (Phase 9).
 *
 * @param {number} employeeId
 * @param {string} startDate - Pay run start date, 'YYYY-MM-DD'.
 * @param {string} endDate - Pay run end date, 'YYYY-MM-DD'.
 * @param {number[]} dayNumbers - ISO day-of-week integers (1..7).
 * @returns {Promise<number>} 0 immediately if `dayNumbers` is empty.
 */
export const countMissingCheckinDays = async (employeeId, startDate, endDate, dayNumbers) => {
  if (!dayNumbers || dayNumbers.length === 0) return 0;
  const sql = `
    WITH scheduled_days AS (
      SELECT d::date AS work_date
      FROM generate_series($2::date, $3::date, '1 day') d
      WHERE EXTRACT(ISODOW FROM d)::int = ANY($4::int[])
        AND d::date NOT IN (
          SELECT date FROM company_holidays
          WHERE date BETWEEN $2 AND $3
        )
    )
    SELECT COUNT(*)::int AS missing_checkin_days
    FROM scheduled_days sd
    WHERE NOT EXISTS (
      SELECT 1 FROM attendance a
      WHERE a.employee_id = $1
        AND a.date = sd.work_date
        AND a.check_in IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM time_off_requests tor
      WHERE tor.employee_id = $1
        AND tor.status = 'approved'
        AND tor.start_date <= sd.work_date
        AND tor.end_date   >= sd.work_date
    );
  `;
  const { rows } = await query(sql, [employeeId, startDate, endDate, dayNumbers]);
  return rows[0]?.missing_checkin_days ?? 0;
};

/**
 * Counts days in the pay period where the employee worked (worked_hours > 0)
 * on a paid company holiday. Algorithm doc §12 W3 (Phase 9).
 *
 * @param {number} employeeId
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate - 'YYYY-MM-DD'
 * @returns {Promise<number>}
 */
export const countHolidayWorkDays = async (employeeId, startDate, endDate) => {
  const sql = `
    SELECT COUNT(*)::int AS holiday_work_days
    FROM attendance a
    JOIN company_holidays ch ON ch.date = a.date
    WHERE a.employee_id = $1
      AND a.date BETWEEN $2 AND $3
      AND ch.is_paid = TRUE
      AND a.worked_hours > 0;
  `;
  const { rows } = await query(sql, [employeeId, startDate, endDate]);
  return rows[0]?.holiday_work_days ?? 0;
};
