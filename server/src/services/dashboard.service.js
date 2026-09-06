/**
 * @fileoverview Dashboard Service
 * Orchestrates `dashboard.repo.js` calls and does all date/JS math for the
 * HR/payroll dashboard summary. No SQL lives here.
 */

import * as dashboardRepo from '#repositories/dashboard.repo.js';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parses a 'YYYY-MM' period string into a { year, month } pair (month is
 * 1-indexed, matching the string itself).
 * @param {string} period - 'YYYY-MM'
 * @returns {{year: number, month: number}}
 */
const parsePeriod = (period) => {
    const [year, month] = period.split('-').map(Number);
    return { year, month };
};

/**
 * Formats a `{ year, month }` pair (1-indexed month) back into 'YYYY-MM'.
 * @param {number} year
 * @param {number} month - 1-indexed.
 * @returns {string}
 */
const formatPeriod = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

/**
 * First/last calendar day of a 'YYYY-MM' period as 'YYYY-MM-DD' strings.
 * Uses `Date.UTC` throughout to avoid local-timezone off-by-one on the
 * boundary days (see payRun.repo.js's DATE-handling notes).
 * @param {string} period - 'YYYY-MM'
 * @returns {{start: string, end: string}}
 */
const monthBounds = (period) => {
    const { year, month } = parsePeriod(period);
    const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
    // Day 0 of the *next* JS month (0-indexed) = last day of this month.
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    return { start, end };
};

/**
 * The 6 trailing 'YYYY-MM' periods ending at (and including) the given one,
 * in ascending order.
 * @param {string} period - 'YYYY-MM'
 * @returns {string[]}
 */
const trailingPeriods = (period) => {
    const { year, month } = parsePeriod(period);
    const periods = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(Date.UTC(year, month - 1 - i, 1));
        periods.push(formatPeriod(d.getUTCFullYear(), d.getUTCMonth() + 1));
    }
    return periods;
};

/**
 * The current server month as 'YYYY-MM'.
 * @returns {string}
 */
const currentPeriod = () => {
    const now = new Date();
    return formatPeriod(now.getUTCFullYear(), now.getUTCMonth() + 1);
};

/**
 * Resolves the period to report on when the caller didn't pin one.
 *
 * NOT simply "the current calendar month": payroll for the running month is
 * normally not processed until it closes, so on any day before that month's pay
 * run exists, every payslip-scoped section (salary total, payslip counts, per-
 * department cost, status breakdown, payroll alerts) would correctly but
 * uselessly read 0 — while the 6-month trend chart beside them still showed the
 * previous months' data, making the dashboard look broken rather than empty.
 * Default to the most recent month that actually has payroll instead, and fall
 * back to the current month only when there is no payroll at all.
 * @param {string[]} payrollPeriods - ascending 'YYYY-MM' list from the repo.
 * @returns {string}
 */
const defaultPeriod = (payrollPeriods) =>
    payrollPeriods.at(-1) ?? currentPeriod();

/**
 * Builds the dashboard summary payload for a given month/department/employee-type slice.
 * @param {object} [params]
 * @param {string} [params.period] - 'YYYY-MM'; defaults to the current server month.
 * @param {number|string} [params.department_id]
 * @param {string} [params.employee_type]
 * @returns {Promise<object>}
 */
export const getSummary = async ({ period, department_id, employee_type } = {}) => {
    // Fetched first (not inside the Promise.all below) because it decides which
    // period every other query is scoped to when the caller didn't pin one.
    const payrollPeriods = await dashboardRepo.getPayrollPeriods();

    const resolvedPeriod = period || defaultPeriod(payrollPeriods);
    const { start, end } = monthBounds(resolvedPeriod);
    const periods = trailingPeriods(resolvedPeriod); // 6 ascending, periods[5] === resolvedPeriod

    const filters = { department_id, employee_type };

    // The trend's per-month totals reuse the SAME `getSalaryTotal` overlap query
    // as the "Total Net Salary Paid" KPI (deliberately — see dashboard.repo.js's
    // header comment on overlap semantics). A pay run spanning multiple calendar
    // months (e.g. a Jul 1–Aug 31 cycle) must show up, in full, in every month's
    // total it overlaps; bucketing by `pay_run.start_date` alone — the previous
    // approach — attributed the whole amount to a single month, so the trend
    // chart's bar for the *selected* period could silently disagree with the KPI
    // card computed for that same period. Deriving both from one array of calls
    // makes that divergence structurally impossible.
    const [
        monthlyTotals,
        payslipCounts,
        payslipStatusCounts,
        alerts,
        contractsExpiringSoon,
        departmentBreakdown,
        attendanceOverview,
        timeOffOverview,
    ] = await Promise.all([
        Promise.all(periods.map((p) => dashboardRepo.getSalaryTotal({ ...monthBounds(p), ...filters }))),
        dashboardRepo.getPayslipCounts({ start, end, ...filters }),
        dashboardRepo.getPayslipStatusCounts({ start, end, ...filters }),
        dashboardRepo.getAlerts({ start, end, ...filters }),
        dashboardRepo.getContractsExpiringSoon({ start, end, ...filters }),
        dashboardRepo.getDepartmentBreakdown({ start, end, ...filters }),
        dashboardRepo.getAttendanceOverview({ start, end, ...filters }),
        dashboardRepo.getTimeOffOverview({ start, end, ...filters }),
    ]);

    // ── KPIs ─────────────────────────────────────────────────────────
    // periods[5] is the selected period, periods[4] the one immediately before it
    // (trailingPeriods always returns exactly 6 ascending, ending at resolvedPeriod).
    const netSalary = Number(monthlyTotals[5]) || 0;
    const netSalaryPrev = Number(monthlyTotals[4]) || 0;
    const totalNetSalaryChangePct = netSalaryPrev === 0
        ? null
        : Math.round(((netSalary - netSalaryPrev) / netSalaryPrev) * 100 * 10) / 10;

    const payslipsGenerated = Number(payslipCounts.generated) || 0;
    const payslipsPaid = Number(payslipCounts.paid) || 0;
    const payslipsPending = Number(payslipCounts.pending) || 0;

    const avgSalaryPerEmployee = payslipsPaid === 0 ? 0 : netSalary / payslipsPaid;

    const approvedTimeOffDays = timeOffOverview.reduce(
        (sum, row) => sum + (Number(row.approvedDays) || 0),
        0
    );

    const present = Number(attendanceOverview.present) || 0;
    const late = Number(attendanceOverview.late) || 0;
    const absent = Number(attendanceOverview.absent) || 0;
    const coverageDenominator = present + late + absent;
    const coveragePct = coverageDenominator === 0
        ? 0
        : Math.round(((present + late) / coverageDenominator) * 100);

    // ── Payslip status counts (zero-filled) ─────────────────────────
    const statusDefaults = { draft: 0, computed: 0, validated: 0, paid: 0, cancelled: 0 };
    const payslipStatusCountsFilled = payslipStatusCounts.reduce(
        (acc, row) => {
            acc[row.status] = Number(row.count) || 0;
            return acc;
        },
        { ...statusDefaults }
    );

    // ── Department breakdown (shared by two response sections) ─────
    const salaryByDepartment = departmentBreakdown.map((row) => ({
        departmentId: row.departmentId,
        department: row.department,
        amount: Number(row.amount) || 0,
    }));
    const departmentOverview = departmentBreakdown.map((row) => ({
        departmentId: row.departmentId,
        department: row.department,
        headcount: Number(row.headcount) || 0,
        monthlySalary: Number(row.amount) || 0,
    }));

    // ── Monthly salary trend (same getSalaryTotal calls as the KPI above) ──
    const monthlySalaryTrend = periods.map((p, i) => {
        const { month } = parsePeriod(p);
        return {
            period: p,
            monthLabel: MONTH_LABELS[month - 1],
            amount: Number(monthlyTotals[i]) || 0,
        };
    });

    // ── Time off overview (null out remainingBalance when not applicable) ──
    const timeOffOverviewOut = timeOffOverview.map((row) => ({
        typeId: row.typeId,
        type: row.type,
        approvedDays: Number(row.approvedDays) || 0,
        pending: Number(row.pending) || 0,
        remainingBalance: row.requiresAllocation
            ? (row.remainingBalance === null ? null : Number(row.remainingBalance))
            : null,
    }));

    return {
        period: resolvedPeriod,
        // Every month that has a pay run, so the client can flag a selected
        // period whose zeros mean "no payroll yet" rather than "no data found".
        payrollPeriods,
        hasPayroll: payrollPeriods.includes(resolvedPeriod),
        filters: {
            department_id: department_id ? Number(department_id) : null,
            employee_type: employee_type || null,
        },
        kpis: {
            totalNetSalary: netSalary,
            totalNetSalaryPrevPeriod: netSalaryPrev,
            totalNetSalaryChangePct,
            payslipsGenerated,
            payslipsPaid,
            payslipsPending,
            avgSalaryPerEmployee,
            approvedTimeOffDays,
            attendanceHealthPct: coveragePct,
        },
        salaryByDepartment,
        monthlySalaryTrend,
        payslipStatusCounts: payslipStatusCountsFilled,
        alerts: {
            missingBankAccounts: Number(alerts.missingBankAccounts) || 0,
            duplicatePayslipWarnings: Number(alerts.duplicatePayslipWarnings) || 0,
            draftsNotValidated: Number(alerts.draftsNotValidated) || 0,
            contractsExpiringSoon: Number(contractsExpiringSoon) || 0,
        },
        attendanceOverview: {
            present,
            late,
            absent,
            onLeave: Number(attendanceOverview.onLeave) || 0,
            holiday: Number(attendanceOverview.holiday) || 0,
            missingCheckouts: Number(attendanceOverview.missingCheckouts) || 0,
            manualEdits: Number(attendanceOverview.manualEdits) || 0,
            coveragePct,
        },
        timeOffOverview: timeOffOverviewOut,
        departmentOverview,
    };
};
