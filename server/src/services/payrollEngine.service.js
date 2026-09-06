/**
 * @fileoverview Payroll Computation Engine — Phases 0–9 of
 * `payroll-computation-algorithm.md`.
 *
 * **This module computes only. It performs no database writes.**
 * Phase 10 (persistence) lives in `payRun.service.js#compute`, which feeds the
 * payload returned by {@link computeEmployeePayslip} straight into
 * `payslip.repo.js#insertPayslipWithLines`. Keeping the split clean is what
 * makes the arithmetic here testable without a transaction.
 *
 * Two `pg` footguns govern every line of this file (see
 * `PAYROLL_IMPL_SPEC.md` §1):
 *
 *  1. DECIMAL/NUMERIC columns arrive as JS **strings** (`wage` is `"80000.00"`).
 *     `"80000.00" + 1600` is the string `"80000.001600"`, which would look
 *     plausible on a payslip and be catastrophically wrong. Every value read
 *     from the database — `wage`, `fixed_amount`, `percentage`, `multiplier`,
 *     `worked_hours`, `overtime_hours`, counts — is routed through `num()`
 *     before it takes part in arithmetic.
 *  2. DATE columns are cast `::text` by the read-model, so dates are ALWAYS
 *     `'YYYY-MM-DD'` strings in here. They are compared / min'd / max'd as
 *     strings (ISO dates sort lexicographically). No `Date` is ever built from
 *     a period boundary.
 *
 * Division guards are deliberate, not defensive noise: a schedule with no
 * active lines yields `total_period_workdays === 0`, and an unguarded divide
 * would put `NaN` into a payslip.
 */

import * as payrollDataRepo from '#repositories/payrollData.repo.js';
import { NotFoundError } from '#lib/errors.js';
import {
    CATEGORY,
    DOW_MAP,
    EARNING_CATEGORIES,
    PLACEHOLDER_CODES,
    RULE_CODE,
    SEVERITY,
    SYNTHETIC_SEQUENCE,
    WARNING,
    makeWarning,
} from '#lib/payroll.constants.js';
import {
    countWorkdays,
    dateRangesOverlap,
    maxDate,
    minDate,
    num,
    round2,
    round4,
} from '#utils/payrollDates.js';

// ── Internal helpers ─────────────────────────────────────────────────

/**
 * Clamp a proration factor into [0, 1] (algorithm doc §6d).
 *
 * @param {number} value
 * @returns {number}
 */
const clamp01 = (value) => Math.max(0, Math.min(1, value));

/**
 * Human-readable employee label for warning messages. Falls back to the id
 * when the name snapshot is incomplete (which is itself a MISSING_DATA case).
 *
 * @param {object|null} employee - Row from `findEmployeeSnapshot`.
 * @param {number} employeeId
 * @returns {string}
 */
const employeeLabel = (employee, employeeId) => {
    const name = `${employee?.first_name ?? ''} ${employee?.last_name ?? ''}`.trim();
    return name.length > 0 ? name : `employee #${employeeId}`;
};

/**
 * Sum of the earning lines that roll up into `gross_salary` — categories
 * `basic` + `allowance`, excluding the GROSS/NET placeholder rows (which are
 * back-filled with the totals in Phase 7 and must never feed them).
 * Includes the synthetic OT_PAY line, which is an allowance.
 *
 * @param {object[]} lines
 * @returns {number} Unrounded sum; callers round once at the end.
 */
const sumEarnings = (lines) =>
    lines
        .filter((line) => EARNING_CATEGORIES.has(line.category) && !PLACEHOLDER_CODES.has(line.rule_code))
        .reduce((total, line) => total + num(line.amount), 0);

// ── Phase 0 ──────────────────────────────────────────────────────────

/**
 * Phase 0 — load everything shared by every employee in the run, exactly once.
 * Algorithm doc §2.
 *
 * The compute pre-condition *guards* (draft status, structure active) live in
 * `payRun.service.js#compute`; this function only performs their data loads
 * plus the per-run constants the employee loop needs.
 *
 * @param {number|string} payRunId
 * @returns {Promise<{payRun: object, structure: object, rules: object[],
 *   paidHolidays: {date: string, dow: number}[], employeeIds: number[]}>}
 * @throws {NotFoundError} When the pay run or its salary structure is absent.
 */
export const loadPayRunContext = async (payRunId) => {
    const payRun = await payrollDataRepo.findPayRunForCompute(payRunId);
    if (!payRun) {
        throw new NotFoundError('Pay run not found');
    }

    const structure = await payrollDataRepo.findStructureForPayRun(payRunId);
    if (!structure) {
        throw new NotFoundError('Salary structure for this pay run not found');
    }

    const [rules, paidHolidays, selectedEmployees] = await Promise.all([
        payrollDataRepo.findRulesByStructure(payRun.salary_structure_id),
        payrollDataRepo.findPaidHolidays(payRun.start_date, payRun.end_date),
        payrollDataRepo.findSelectedEmployees(payRunId),
    ]);

    return {
        payRun,
        structure,
        rules,
        paidHolidays,
        employeeIds: selectedEmployees.map((row) => row.employee_id),
    };
};

// ── Phases 1–9 ───────────────────────────────────────────────────────

/**
 * Phases 1–9 — compute one employee's payslip against a loaded pay run
 * context. Performs **no writes**; the returned object is exactly the payload
 * `payslip.repo.js#insertPayslipWithLines` expects (minus `pay_run_id` /
 * `status`, which the orchestrator in `payRun.service.js` supplies).
 *
 * @param {object} ctx - Result of {@link loadPayRunContext}.
 * @param {number} employeeId
 * @returns {Promise<{employee_id: number, contract_id: number|null,
 *   gross_salary: number, net_salary: number, total_deductions: number,
 *   worked_days: number, worked_hours: number, warnings: object[],
 *   lines: object[]}>}
 */
export const computeEmployeePayslip = async (ctx, employeeId) => {
    const { payRun, rules, paidHolidays } = ctx;
    const periodStart = payRun.start_date;
    const periodEnd = payRun.end_date;

    // ── Phase 1: fresh per-employee accumulators (algorithm doc §3) ───
    /** @type {object[]} */
    const warnings = [];
    /** @type {object[]} */
    const lines = [];

    // ── Phase 2: pre-compute checks & early warnings (§4) ────────────
    // None of these stop computation — the payslip is still produced and the
    // payroll operator reviews the warnings before validation.
    const [duplicateCandidates, employee] = await Promise.all([
        payrollDataRepo.findOverlappingPayslipCandidates(employeeId, payRun.id),
        payrollDataRepo.findEmployeeSnapshot(employeeId),
    ]);

    const label = employeeLabel(employee, employeeId);

    // 2a. Duplicate payslip: an unpaid/uncancelled payslip from another pay
    // run whose period overlaps this one. Compared as ISO strings.
    for (const candidate of duplicateCandidates) {
        if (dateRangesOverlap(candidate.existing_start, candidate.existing_end, periodStart, periodEnd)) {
            warnings.push(
                makeWarning(
                    WARNING.DUPLICATE_PAYSLIP,
                    SEVERITY.ERROR,
                    `An overlapping payslip already exists for ${label} in pay run "${candidate.pay_run_name}"`,
                    {
                        employee_id: employeeId,
                        payslip_id: candidate.id,
                        pay_run_id: candidate.pay_run_id,
                        pay_run_name: candidate.pay_run_name,
                        existing_start: candidate.existing_start,
                        existing_end: candidate.existing_end,
                    },
                ),
            );
        }
    }

    // 2b. Missing employee data.
    if (!employee) {
        warnings.push(
            makeWarning(WARNING.MISSING_DATA, SEVERITY.WARNING, `Employee record not found for employee #${employeeId}`, {
                employee_id: employeeId,
                reason: 'Employee record not found',
            }),
        );
    } else {
        if (!employee.first_name || !employee.last_name) {
            warnings.push(
                makeWarning(WARNING.MISSING_DATA, SEVERITY.WARNING, `Name incomplete for ${label}`, {
                    employee_id: employeeId,
                    reason: 'Name incomplete',
                }),
            );
        }

        if (!employee.date_of_joining) {
            warnings.push(
                makeWarning(WARNING.MISSING_DATA, SEVERITY.WARNING, `Missing date of joining for ${label}`, {
                    employee_id: employeeId,
                    reason: 'Missing date of joining',
                }),
            );
        }

        const fieldsMissing = [];
        if (!employee.bank_name) fieldsMissing.push('bank_name');
        if (!employee.bank_account) fieldsMissing.push('bank_account');
        if (fieldsMissing.length > 0) {
            warnings.push(
                makeWarning(
                    WARNING.MISSING_BANK_DETAILS,
                    SEVERITY.WARNING,
                    `No bank account on file for ${label}`,
                    { employee_id: employeeId, fields_missing: fieldsMissing },
                ),
            );
        }

        if (employee.employment_status !== 'active' || employee.is_active === false) {
            warnings.push(
                makeWarning(
                    WARNING.MISSING_DATA,
                    SEVERITY.WARNING,
                    `${label} is not active at compute time`,
                    {
                        employee_id: employeeId,
                        reason: 'Employee not active at compute time',
                        employment_status: employee.employment_status,
                        is_active: employee.is_active,
                    },
                ),
            );
        }
    }

    // ── Phase 3: contract resolution (§5) ────────────────────────────
    const contracts = await payrollDataRepo.findActiveContractsInPeriod(employeeId, periodStart, periodEnd);

    if (contracts.length === 0) {
        // Zeroed payslip, no lines, and we return immediately — there is no
        // wage to compute against. The error-severity warning blocks
        // validation until a payroll operator reviews the payslip.
        warnings.push(
            makeWarning(
                WARNING.NO_ACTIVE_CONTRACT,
                SEVERITY.ERROR,
                `No active contract overlaps the pay period for ${label}`,
                { employee_id: employeeId, period_start: periodStart, period_end: periodEnd },
            ),
        );

        return {
            employee_id: employeeId,
            contract_id: null,
            gross_salary: 0,
            net_salary: 0,
            total_deductions: 0,
            worked_days: 0,
            worked_hours: 0,
            warnings,
            lines: [],
        };
    }

    let primaryContractId = contracts[0].id;

    if (contracts.length > 1) {
        // Mid-period contract change: the payslip is split into one segment
        // per contract, so no single contract owns it.
        primaryContractId = null;
        warnings.push(
            makeWarning(
                WARNING.MULTIPLE_CONTRACTS,
                SEVERITY.INFO,
                `${contracts.length} active contracts overlap the pay period for ${label}`,
                { employee_id: employeeId, contract_count: contracts.length },
            ),
        );
        warnings.push(
            makeWarning(
                WARNING.PRORATED_PAYSLIP,
                SEVERITY.INFO,
                `Payslip is prorated across ${contracts.length} contract segments`,
                { employee_id: employeeId, contract_count: contracts.length },
            ),
        );
    }

    // ── Phase 4: segments & proration (§6) ───────────────────────────
    // Schedule lookups are cached per schedule_id for the duration of this
    // employee's computation — consecutive contracts usually share a schedule.
    /** @type {Map<number, {dayNumbers: number[], dailyHours: number}>} */
    const scheduleCache = new Map();

    /**
     * @param {number} scheduleId
     * @returns {Promise<{dayNumbers: number[], dailyHours: number}>}
     */
    const loadSchedule = async (scheduleId) => {
        const cached = scheduleCache.get(scheduleId);
        if (cached) return cached;

        const [dayRows, dailyHours] = await Promise.all([
            payrollDataRepo.findScheduleDayNames(scheduleId),
            payrollDataRepo.findScheduleDailyHours(scheduleId),
        ]);

        const resolved = {
            // DOW_MAP turns the `day_of_week` enum text into the ISO integers
            // that EXTRACT(ISODOW) and isoDow() both produce.
            dayNumbers: dayRows.map((row) => DOW_MAP[row.dow_name]).filter((dow) => dow !== undefined),
            dailyHours: num(dailyHours),
        };
        scheduleCache.set(scheduleId, resolved);
        return resolved;
    };

    const segments = [];
    for (const contract of contracts) {
        const segStart = maxDate(contract.start_date, periodStart);
        const segEnd = minDate(contract.end_date ?? periodEnd, periodEnd);

        const { dayNumbers, dailyHours } = await loadSchedule(contract.schedule_id);

        const totalPeriodWorkdays = countWorkdays(periodStart, periodEnd, dayNumbers);
        const segmentWorkdays = countWorkdays(segStart, segEnd, dayNumbers);

        // Division guard: a schedule with no active lines (or a period wholly
        // outside it) has zero workdays. 0/0 is NaN, which would silently
        // poison every amount on the payslip — force the factor to 0 instead.
        const prorationFactor =
            totalPeriodWorkdays > 0 ? clamp01(segmentWorkdays / totalPeriodWorkdays) : 0;

        segments.push({
            contract,
            start: segStart,
            end: segEnd,
            dayNumbers,
            dailyScheduledHours: dailyHours,
            totalPeriodWorkdays,
            segmentWorkdays,
            prorationFactor,
        });
    }

    // Reference schedule for the phases the algorithm doc describes in
    // single-contract terms (Phase 6 unpaid leave, Phase 8 paid holidays on
    // workdays, Phase 9 missing check-in days). The doc does not say which
    // segment supplies them in multi-contract mode; per PAYROLL_IMPL_SPEC §9
    // we use segments[0] — the earliest contract, since `contracts` is ordered
    // by start_date ASC.
    const refSegment = segments[0];
    const refDayNumbers = refSegment.dayNumbers;
    const refTotalPeriodWorkdays = refSegment.totalPeriodWorkdays;

    // ── Phase 5A: salary rule execution, per segment (§7) ────────────
    for (const segment of segments) {
        // `computed_values` is keyed by rule.id and is PER SEGMENT — a fresh
        // map each time round. A percentage rule reads its base from here, and
        // that base is already prorated, so the proration factor must NOT be
        // applied a second time.
        /** @type {Map<number, number>} */
        const computedValues = new Map();

        for (const rule of rules) {
            let amount = 0;

            if (rule.rule_type === 'fixed') {
                // BASIC is the one rule whose base is the contract wage rather
                // than the structure's fixed_amount.
                const base =
                    rule.code === RULE_CODE.BASIC ? num(segment.contract.wage) : num(rule.fixed_amount);
                amount = round2(base * segment.prorationFactor);
            } else if (rule.rule_type === 'percentage') {
                // A misconfigured structure (base_rule_id pointing at a rule
                // with a higher sequence, or at a rule from another structure)
                // must not kill the whole run — treat the missing base as 0.
                const baseValue = computedValues.has(rule.base_rule_id)
                    ? computedValues.get(rule.base_rule_id)
                    : 0;
                amount = round2(num(baseValue) * num(rule.percentage) / 100);
            }

            // GROSS / NET are placeholders — zeroed now, back-filled in Phase 7.
            if (PLACEHOLDER_CODES.has(rule.code)) {
                amount = 0;
            }

            // `computedValues` holds the UNSIGNED magnitude on purpose: a
            // percentage rule based on a deduction (e.g. "5% of PF") must
            // compute off its face value, not off a negative.
            computedValues.set(rule.id, amount);

            // Deduction lines are persisted NEGATIVE so that every reduction on
            // a payslip carries one consistent sign — the synthetic UNPAID_LV
            // line (Phase 6) is negative too. Phase 7 sums deductions with
            // Math.abs(), so the aggregates are unaffected by this sign.
            const signedAmount =
                rule.category === CATEGORY.DEDUCTION ? -Math.abs(amount) : amount;

            lines.push({
                rule_id: rule.id,
                // Snapshot fields: frozen copies of the rule as it was at
                // compute time, so later rule edits never rewrite history.
                rule_code: rule.code,
                rule_name: rule.name,
                category: rule.category,
                sequence: rule.sequence,
                amount: signedAmount,
                contract_id: segment.contract.id,
                segment_start: segment.start,
                segment_end: segment.end,
                proration_factor: round4(segment.prorationFactor),
            });
        }
    }

    // ── Phase 5B: overtime pay, per segment (§8) ─────────────────────
    for (const segment of segments) {
        const policy = await payrollDataRepo.findOvertimePolicy(segment.contract.overtime_policy_id);

        // 8a. No OT policy on the contract — flag unexplained OT hours, no pay.
        if (!policy) {
            const untrackedOt = num(
                await payrollDataRepo.sumOvertimeHours(employeeId, segment.start, segment.end),
            );
            if (untrackedOt > 0) {
                warnings.push(
                    makeWarning(
                        WARNING.OT_NO_POLICY,
                        SEVERITY.WARNING,
                        `${untrackedOt} overtime hours detected but no overtime policy on contract`,
                        {
                            employee_id: employeeId,
                            contract_id: segment.contract.id,
                            hours: untrackedOt,
                            message: 'Overtime hours detected but no overtime policy on contract',
                        },
                    ),
                );
            }
            continue;
        }

        // 8b. Comp-off mode — OT was already converted to a leave allocation
        // at attendance time, so no pay line is generated.
        if (policy.compensatory_off === true) {
            const compOffHours = num(
                await payrollDataRepo.sumOvertimeHours(employeeId, segment.start, segment.end),
            );
            if (compOffHours > 0) {
                warnings.push(
                    makeWarning(
                        WARNING.COMP_OFF_CREDITED,
                        SEVERITY.INFO,
                        `${compOffHours} overtime hours converted to compensatory off; no OT pay`,
                        {
                            employee_id: employeeId,
                            contract_id: segment.contract.id,
                            hours: compOffHours,
                            message: 'Overtime converted to compensatory off; no OT pay',
                        },
                    ),
                );
            }
            continue;
        }

        // 8c/8d. Sum OT hours and price them off the contract's hourly rate.
        const otByType = await payrollDataRepo.sumOvertimeByType(employeeId, segment.start, segment.end);
        const totalOtHours = otByType.reduce((total, row) => total + num(row.ot_hours), 0);

        const monthlyScheduledHours = segment.totalPeriodWorkdays * segment.dailyScheduledHours;
        // Division guard: no scheduled workdays or no schedule lines ⇒ no
        // meaningful hourly rate, so OT pays 0 rather than Infinity/NaN.
        const hourlyRate =
            monthlyScheduledHours > 0 ? num(segment.contract.wage) / monthlyScheduledHours : 0;

        const otPay = round2(totalOtHours * hourlyRate * num(policy.multiplier));

        // 8e. One consolidated OT_PAY line per segment.
        if (otPay > 0) {
            lines.push({
                rule_id: null,
                rule_code: RULE_CODE.OT_PAY,
                rule_name: 'Overtime Pay',
                category: CATEGORY.ALLOWANCE,
                sequence: SYNTHETIC_SEQUENCE.OT_PAY,
                amount: otPay,
                contract_id: segment.contract.id,
                segment_start: segment.start,
                segment_end: segment.end,
                // N/A: OT is actual hours worked, not a prorated entitlement.
                proration_factor: null,
            });
        }
    }

    // ── Phase 6: unpaid leave deduction (§9) ─────────────────────────
    // The SOLE mechanism for unpaid-leave salary reduction — the Phase 4
    // proration factor is a pure calendar fraction and ignores leave entirely.
    const unpaidLeaveDays = num(
        await payrollDataRepo.countUnpaidLeaveDays(employeeId, periodStart, periodEnd, refDayNumbers),
    );

    if (unpaidLeaveDays > 0 && refTotalPeriodWorkdays > 0) {
        // interim_gross is every earning line computed so far — including the
        // OT_PAY lines, which are allowances.
        const interimGross = sumEarnings(lines);
        const perDayRate = interimGross / refTotalPeriodWorkdays;
        const deduction = round2(perDayRate * unpaidLeaveDays);

        lines.push({
            rule_id: null,
            rule_code: RULE_CODE.UNPAID_LV,
            rule_name: 'Unpaid Leave Deduction',
            category: CATEGORY.DEDUCTION,
            sequence: SYNTHETIC_SEQUENCE.UNPAID_LV,
            // Stored NEGATIVE; Phase 7 takes ABS for total_deductions.
            amount: -deduction,
            contract_id: primaryContractId,
            segment_start: null,
            segment_end: null,
            proration_factor: null,
        });

        warnings.push(
            makeWarning(
                WARNING.UNPAID_LEAVE_DEDUCTION,
                SEVERITY.INFO,
                `${unpaidLeaveDays} unpaid leave days deducted`,
                {
                    employee_id: employeeId,
                    days: unpaidLeaveDays,
                    per_day_rate: round2(perDayRate),
                    deduction_amount: deduction,
                },
            ),
        );
    }

    // ── Phase 7: aggregates (§10) ────────────────────────────────────
    const grossSalary = round2(sumEarnings(lines));

    const totalDeductions = round2(
        lines
            .filter((line) => line.category === CATEGORY.DEDUCTION)
            .reduce((total, line) => total + Math.abs(num(line.amount)), 0),
    );

    let netSalary = round2(grossSalary - totalDeductions);

    if (netSalary < 0) {
        warnings.push(
            makeWarning(
                WARNING.NEGATIVE_NET,
                SEVERITY.WARNING,
                `Net salary computed as negative (${netSalary}) — review deduction rules`,
                { employee_id: employeeId, computed_net: netSalary, gross_salary: grossSalary, total_deductions: totalDeductions },
            ),
        );
        netSalary = 0;
    }

    // Back-fill the placeholders. Note: per the algorithm doc this sets EVERY
    // GROSS / NET line to the whole-payslip figure, so a multi-segment payslip
    // repeats the same total on each segment's GROSS/NET row. That is the
    // specified behaviour — those two categories never feed the aggregates, so
    // the repetition cannot double-count.
    for (const line of lines) {
        if (line.rule_code === RULE_CODE.GROSS) line.amount = grossSalary;
        if (line.rule_code === RULE_CODE.NET) line.amount = netSalary;
    }

    // ── Phase 8: worked days & hours (§11) ───────────────────────────
    const attendance = await payrollDataRepo.findAttendanceAggregate(employeeId, periodStart, periodEnd);

    const refDaySet = new Set(refDayNumbers);
    // Paid holidays landing on a scheduled workday count as worked days but
    // contribute zero hours (there is no attendance record for them).
    const paidHolidaysOnWorkdays = paidHolidays.filter((holiday) => refDaySet.has(num(holiday.dow))).length;

    const workedDays = round2(num(attendance.attendance_present_days) + paidHolidaysOnWorkdays);
    const workedHours = round2(num(attendance.total_worked_hours));

    // ── Phase 9: remaining warnings (§12) ────────────────────────────
    const missingCheckouts = num(
        await payrollDataRepo.countMissingCheckouts(employeeId, periodStart, periodEnd),
    );
    if (missingCheckouts > 0) {
        warnings.push(
            makeWarning(
                WARNING.UNREVIEWED_ATTENDANCE,
                SEVERITY.WARNING,
                `${missingCheckouts} attendance records have check-in but no check-out`,
                { employee_id: employeeId, count: missingCheckouts },
            ),
        );
    }

    const missingCheckinDays = num(
        await payrollDataRepo.countMissingCheckinDays(employeeId, periodStart, periodEnd, refDayNumbers),
    );
    if (missingCheckinDays > 0) {
        warnings.push(
            makeWarning(
                WARNING.MISSING_CHECKIN_DAYS,
                SEVERITY.WARNING,
                `${missingCheckinDays} workdays have no attendance and no approved leave`,
                { employee_id: employeeId, count: missingCheckinDays },
            ),
        );
    }

    const holidayWorkDays = num(
        await payrollDataRepo.countHolidayWorkDays(employeeId, periodStart, periodEnd),
    );
    if (holidayWorkDays > 0) {
        warnings.push(
            makeWarning(
                WARNING.HOLIDAY_WORK_DETECTED,
                SEVERITY.INFO,
                `${holidayWorkDays} paid company holidays were worked`,
                { employee_id: employeeId, count: holidayWorkDays },
            ),
        );
    }

    return {
        employee_id: employeeId,
        contract_id: primaryContractId,
        gross_salary: grossSalary,
        net_salary: netSalary,
        total_deductions: totalDeductions,
        worked_days: workedDays,
        worked_hours: workedHours,
        warnings,
        lines,
    };
};
