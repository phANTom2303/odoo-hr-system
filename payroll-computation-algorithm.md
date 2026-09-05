# PeoplePay360 — Payroll Computation Algorithm (v2.0)
### *Exact flow when a Payroll person clicks "Compute" on a Pay Run*

> **Audience:** Backend developers implementing `POST /pay-runs/:id/compute`.
> This document is the single source of truth for the payroll engine.
> Every SQL query and server-side calculation is spelled out in order.

---

### Changelog (v1.0 → v2.0)

| Change | Rationale |
|---|---|
| All day-of-week comparisons now use `EXTRACT(ISODOW)` integers instead of `TRIM(TO_CHAR(d,'day'))` strings | Eliminates locale-dependent string ops; O(1) integer comparison |
| Proration factor no longer deducts unpaid leaves or holidays | **Bug fix:** v1.0 double-counted unpaid leave (once in proration, once in deduction line). Proration is now a pure calendar fraction. |
| Added Phase 5B: Overtime Pay Calculation [P2] | v1.0 had no overtime-to-pay flow despite schema support |
| Unpaid leave deduction (Phase 6) is now the **sole** mechanism for unpaid leave salary reduction | Proration only handles multi-contract segment splitting |

---

## Table of Contents

1. [Trigger & Pre-conditions](#1-trigger--pre-conditions)
2. [Phase 0 — Load Pay Run Context & Constants](#2-phase-0--load-pay-run-context--constants)
3. [Phase 1 — Employee Loop Setup](#3-phase-1--employee-loop-setup)
4. [Phase 2 — Pre-compute Checks & Early Warnings](#4-phase-2--pre-compute-checks--early-warnings)
5. [Phase 3 — Contract Resolution](#5-phase-3--contract-resolution)
6. [Phase 4 — Segment & Proration Calculation](#6-phase-4--segment--proration-calculation)
7. [Phase 5A — Salary Rule Execution (Per Segment)](#7-phase-5a--salary-rule-execution-per-segment)
8. [Phase 5B — Overtime Pay Calculation \[P2\]](#8-phase-5b--overtime-pay-calculation-p2)
9. [Phase 6 — Unpaid Leave Deduction](#9-phase-6--unpaid-leave-deduction)
10. [Phase 7 — Aggregate Computation](#10-phase-7--aggregate-computation)
11. [Phase 8 — Worked Days & Hours](#11-phase-8--worked-days--hours)
12. [Phase 9 — Warning Generation](#12-phase-9--warning-generation)
13. [Phase 10 — Persistence](#13-phase-10--persistence)
14. [Helper Functions](#14-helper-functions)
15. [Warning Reference Table](#15-warning-reference-table)
16. [Affected Endpoints (DOW Optimization)](#16-affected-endpoints-dow-optimization)
17. [Full Algorithm Flowchart](#17-full-algorithm-flowchart)
18. [Appendix: Worked Examples](#18-appendix-worked-examples)

---

## 1. Trigger & Pre-conditions

**Endpoint:** `POST /pay-runs/:id/compute`
**Required role:** `hr_payroll_manager` or `admin`

### Pre-condition checks (before any computation starts)

```sql
-- 1a. Confirm pay run exists and is in a computable state
SELECT id, name, salary_structure_id, start_date, end_date, status
FROM pay_runs
WHERE id = :pay_run_id;
-- If NOT FOUND → 404
-- If status NOT IN ('draft') → 409 "Pay run is not in draft state"
```

```sql
-- 1b. Confirm the salary structure is still active
SELECT ss.id, ss.name, ss.status
FROM salary_structures ss
JOIN pay_runs pr ON pr.salary_structure_id = ss.id
WHERE pr.id = :pay_run_id;
-- If status = 'inactive' → 409 "Salary structure is inactive"
```

> If pre-conditions fail, **abort entirely** — no payslips are created.

---

## 2. Phase 0 — Load Pay Run Context & Constants

Load all data shared across all employees. Do this **once** before the employee loop.

### Day-of-Week Integer Map (Application Constant)

```
DOW_MAP = {
  'monday':    1,
  'tuesday':   2,
  'wednesday': 3,
  'thursday':  4,
  'friday':    5,
  'saturday':  6,
  'sunday':    7
}
```

> Maps the `day_of_week` PostgreSQL enum to ISO day-of-week integers.
> `EXTRACT(ISODOW FROM date)` returns these exact values (1=Monday … 7=Sunday).
> All workday counting, holiday-on-workday, and missing-checkin queries use this.

### 2a. Load Salary Rules

```sql
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
WHERE sr.structure_id = :salary_structure_id
ORDER BY sr.sequence ASC;
-- Store as: rules[]
```

### 2b. Load Company Holidays in Period

```sql
SELECT date, EXTRACT(ISODOW FROM date)::int AS dow
FROM company_holidays
WHERE date BETWEEN :start_date AND :end_date
  AND is_paid = TRUE;
-- Store as: paid_holidays[]  (array of {date, dow} for O(1) lookup)
```

### 2c. Load Selected Employees

```sql
SELECT u.id AS employee_id
FROM pay_run_employees pre
JOIN users u ON u.id = pre.employee_id
WHERE pre.pay_run_id = :pay_run_id;
-- Store as: selected_employees[]
```

---

## 3. Phase 1 — Employee Loop Setup

For **each** `employee_id` in `selected_employees[]`, initialize a fresh accumulator:

```
warnings          = []        -- JSONB array of warning objects
all_lines         = []        -- PayslipLine objects to insert
gross_salary      = 0.00
net_salary        = 0.00
total_deductions  = 0.00
worked_days       = 0.00
worked_hours      = 0.00
skip_computation  = FALSE     -- set to TRUE on NO_ACTIVE_CONTRACT
```

---

## 4. Phase 2 — Pre-compute Checks & Early Warnings

Run these checks before touching contracts or salary rules.

### 4a. Duplicate Payslip Detection

```sql
SELECT
  ps.id,
  ps.pay_run_id,
  pr.start_date AS existing_start,
  pr.end_date   AS existing_end
FROM payslips ps
JOIN pay_runs pr ON pr.id = ps.pay_run_id
WHERE ps.employee_id = :employee_id
  AND ps.status NOT IN ('paid', 'cancelled')
  AND ps.pay_run_id != :current_pay_run_id
ORDER BY ps.created_at DESC
LIMIT 5;
```

**Server-side:** For each returned row, check date overlap:
```
IF existing_start <= :payrun_end_date AND existing_end >= :payrun_start_date:
  → ADD warning: DUPLICATE_PAYSLIP (severity: error)
```

### 4b. Missing Employee Data

```sql
SELECT
  first_name,
  last_name,
  date_of_joining,
  bank_name,
  bank_account,
  employment_status,
  is_active
FROM users
WHERE id = :employee_id;
```

**Server-side checks:**
```
IF first_name IS NULL OR last_name IS NULL:
  → ADD warning: MISSING_DATA (severity: warning, details: "Name incomplete")

IF date_of_joining IS NULL:
  → ADD warning: MISSING_DATA (severity: warning, details: "Missing date of joining")

IF bank_name IS NULL OR bank_account IS NULL:
  → ADD warning: MISSING_BANK_DETAILS (severity: warning)

IF employment_status != 'active' OR is_active = FALSE:
  → ADD warning: MISSING_DATA (severity: warning, details: "Employee not active at compute time")
```

> **Note:** These warnings do NOT stop computation. Payslip is still generated.

---

## 5. Phase 3 — Contract Resolution

```sql
SELECT
  c.id,
  c.wage,
  c.schedule_id,
  c.salary_structure_id,
  c.start_date,
  c.end_date,
  c.department_id,
  c.job_position_id,
  c.overtime_policy_id
FROM contracts c
WHERE c.employee_id = :employee_id
  AND c.status = 'active'
  AND c.start_date <= :payrun_end_date
  AND (c.end_date IS NULL OR c.end_date >= :payrun_start_date)
ORDER BY c.start_date ASC;
-- Store as: contracts[]
```

**Server-side decision:**

```
IF contracts is EMPTY:
  → ADD warning: NO_ACTIVE_CONTRACT (severity: error)
  → SET skip_computation = TRUE
  → INSERT payslip with gross=0, net=0, deductions=0, worked_days=0
  → CONTINUE to next employee

ELIF LENGTH(contracts) == 1:
  → Single contract mode (proration_factor will be 1.0)
  → primary_contract_id = contracts[0].id

ELIF LENGTH(contracts) > 1:
  → Proration mode (mid-period contract change)
  → ADD warning: MULTIPLE_CONTRACTS (severity: info,
      details: { contract_count: N })
  → ADD warning: PRORATED_PAYSLIP (severity: info)
  → primary_contract_id = NULL
```

---

## 6. Phase 4 — Segment & Proration Calculation

Build **segments** — one per contract, clipped to the pay period.

> **Key design decision (v2.0):** The proration factor is a **pure calendar fraction**.
> It answers only: *"What fraction of the period's working days does this contract segment cover?"*
> It does **NOT** account for holidays, paid leaves, or unpaid leaves.
> - Paid holidays: no salary impact (employee is paid for them)
> - Paid leaves: no salary impact
> - Unpaid leaves: handled exclusively by the `UNPAID_LV` deduction line in Phase 6
>
> This ensures that for a single contract covering the full period, `proration_factor = 1.0`.
> For multi-contract: all segment proration factors sum to `1.0`.

**Server-side (for each contract C in contracts[]):**

```
seg_start = MAX(C.start_date, payrun.start_date)
seg_end   = MIN(C.end_date ?? payrun.end_date, payrun.end_date)
```

### 6a. Resolve Schedule Days as Integers

```sql
SELECT day_of_week::text AS dow_name
FROM schedule_lines
WHERE schedule_id = :schedule_id
  AND is_active = TRUE;
```

**Server-side mapping:**
```
schedule_day_numbers = []
FOR each row:
  schedule_day_numbers.append(DOW_MAP[row.dow_name])
-- e.g. [1, 2, 3, 4, 5] for Mon–Fri
```

### 6b. Count Total Workdays in Full Pay Period (denominator)

```sql
SELECT COUNT(*) AS total_period_workdays
FROM generate_series(:payrun_start_date::date, :payrun_end_date::date, '1 day') AS d
WHERE EXTRACT(ISODOW FROM d)::int = ANY(:schedule_day_numbers);
```

### 6c. Count Workdays in Segment (numerator)

```sql
SELECT COUNT(*) AS segment_workdays
FROM generate_series(:seg_start::date, :seg_end::date, '1 day') AS d
WHERE EXTRACT(ISODOW FROM d)::int = ANY(:schedule_day_numbers);
```

### 6d. Compute Proration Factor

```
proration_factor = segment_workdays / total_period_workdays

-- Clamp to [0.0, 1.0]
proration_factor = MAX(0.0, MIN(1.0, proration_factor))
```

> **Single contract:** `segment_workdays == total_period_workdays` → `1.0`
> **Multi-contract example:** Period has 22 workdays. Contract A covers first 10, Contract B covers 12.
> A: `10/22 = 0.4545`, B: `12/22 = 0.5455`. Sum = `1.0`. ✅

### 6e. Also Load: Daily Scheduled Hours (needed for OT in Phase 5B)

```sql
SELECT
  EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) / 3600.0
    - (sl.break_minutes / 60.0) AS net_hours
FROM schedule_lines sl
WHERE sl.schedule_id = :schedule_id
  AND sl.is_active = TRUE;
-- Compute average:
-- daily_scheduled_hours = AVG(net_hours)
-- OR use total_weekly_hours / active_line_count
```

```sql
-- Alternatively, from the pre-computed total:
SELECT ws.total_weekly_hours, COUNT(sl.id) AS active_days
FROM working_schedules ws
JOIN schedule_lines sl ON sl.schedule_id = ws.id AND sl.is_active = TRUE
WHERE ws.id = :schedule_id
GROUP BY ws.total_weekly_hours;
-- daily_scheduled_hours = total_weekly_hours / active_days
```

Store as `daily_scheduled_hours` for this segment.

---

## 7. Phase 5A — Salary Rule Execution (Per Segment)

For each segment S, execute salary rules in sequence order:

```
computed_values = {}   -- key: rule.id, value: computed amount (float)
segment_lines   = []

FOR each rule R in rules (ordered by sequence ASC):

  IF R.rule_type == 'fixed':
    -- Special case: BASIC rule uses contract wage, not fixed_amount
    IF R.code == 'BASIC':
      base_amount = S.contract.wage
    ELSE:
      base_amount = R.fixed_amount

    amount = ROUND(base_amount * S.proration_factor, 2)

  ELIF R.rule_type == 'percentage':
    -- base_rule is guaranteed to have a lower sequence (already computed)
    base_value = computed_values[R.base_rule_id]
    -- base is already prorated; do NOT apply proration_factor again
    amount = ROUND(base_value * R.percentage / 100, 2)

  -- Placeholder rules (GROSS, NET): set to 0 now; updated in Phase 7
  IF R.code IN ('GROSS', 'NET'):
    amount = 0.00

  computed_values[R.id] = amount

  segment_lines.append({
    rule_id:          R.id,
    rule_code:        R.code,
    rule_name:        R.name,       -- SNAPSHOT: copied from rule at compute time
    category:         R.category,   -- SNAPSHOT
    sequence:         R.sequence,
    amount:           amount,
    contract_id:      S.contract.id,
    segment_start:    S.start,
    segment_end:      S.end,
    proration_factor: ROUND(S.proration_factor, 4)
  })

all_lines.extend(segment_lines)
```

> **Multi-contract payslips** will have multiple lines per rule code (one per segment).
> This is by design — each segment is a separate snapshot row in `payslip_lines`.

---

## 8. Phase 5B — Overtime Pay Calculation [P2]

> **Priority:** P2. If not implementing overtime, skip this phase entirely.
> Overtime hours are pre-computed on `attendance` records at check-out time
> (see business-logic.md §9). This phase **consumes** those hours to generate pay.

For each segment S:

### 8a. Check if Contract Has an Overtime Policy

```sql
SELECT
  op.id,
  op.name,
  op.multiplier,
  op.compensatory_off,
  op.threshold_type
FROM overtime_policies op
WHERE op.id = :S.contract.overtime_policy_id;
```

**If `overtime_policy_id` IS NULL:**
```
-- Check if overtime hours exist anyway (unexplained OT)
SELECT COALESCE(SUM(a.overtime_hours), 0) AS untracked_ot
FROM attendance a
WHERE a.employee_id = :employee_id
  AND a.date BETWEEN :seg_start AND :seg_end
  AND a.overtime_hours > 0;

IF untracked_ot > 0:
  ADD warning: OT_NO_POLICY (severity: warning,
    details: { hours: untracked_ot,
               message: "Overtime hours detected but no overtime policy on contract" })

→ SKIP to next segment (no OT pay generated)
```

### 8b. Check Compensatory Off Mode

```
IF policy.compensatory_off == TRUE:
  -- OT was already converted to comp-off allocation at attendance time
  -- No OT pay line generated. Inform the payroll person.

  SELECT COALESCE(SUM(a.overtime_hours), 0) AS comp_off_hours
  FROM attendance a
  WHERE a.employee_id = :employee_id
    AND a.date BETWEEN :seg_start AND :seg_end
    AND a.overtime_hours > 0;

  IF comp_off_hours > 0:
    ADD warning: COMP_OFF_CREDITED (severity: info,
      details: { hours: comp_off_hours,
                 message: "Overtime converted to compensatory off; no OT pay" })

  → SKIP to next segment
```

### 8c. Sum Overtime Hours

```sql
SELECT
  a.overtime_type,
  SUM(a.overtime_hours) AS ot_hours
FROM attendance a
WHERE a.employee_id = :employee_id
  AND a.date BETWEEN :seg_start AND :seg_end
  AND a.overtime_hours > 0
GROUP BY a.overtime_type;
-- Store as: ot_by_type[]  e.g. [{type: 'regular_ot', hours: 4.5}, ...]
```

### 8d. Compute Hourly Rate & OT Pay

```
-- Hourly rate derived from this contract's wage and schedule
monthly_scheduled_hours = total_period_workdays * daily_scheduled_hours
hourly_rate = S.contract.wage / monthly_scheduled_hours

total_ot_hours = SUM(ot_by_type[].hours)
ot_pay = ROUND(total_ot_hours * hourly_rate * policy.multiplier, 2)
```

### 8e. Create Payslip Line(s)

```
IF ot_pay > 0:
  all_lines.append({
    rule_id:          NULL,           -- no salary_rule; OT is computed dynamically
    rule_code:        'OT_PAY',
    rule_name:        'Overtime Pay',
    category:         'allowance',    -- OT pay is an earning
    sequence:         9000,           -- after regular rules, before deductions
    amount:           ot_pay,
    contract_id:      S.contract.id,
    segment_start:    S.start,
    segment_end:      S.end,
    proration_factor: NULL            -- N/A; OT is actual hours worked
  })

  -- Optional: break down by OT type for transparency
  -- (only if you want separate lines per overtime_type)
  -- For now, a single consolidated OT_PAY line is sufficient.
```

> **Note:** The current schema has a single `multiplier` per overtime policy.
> If future requirements need different multipliers per `overtime_type`
> (e.g., 1.5× for regular_ot, 2× for holiday_work), the `overtime_policies`
> table would need additional columns. The algorithm structure here supports
> that extension — just loop over `ot_by_type[]` with different multipliers.

---

## 9. Phase 6 — Unpaid Leave Deduction

> **This is the sole mechanism for unpaid leave salary reduction.**
> The proration factor in Phase 4 does NOT account for unpaid leaves.
> This deduction line provides transparency: the payroll person sees the full salary
> entitlement in the salary rule lines, and the explicit deduction for unpaid days here.

```sql
-- All approved unpaid leaves overlapping the full pay period
SELECT COALESCE(SUM(
  -- Compute the number of unpaid leave days that fall WITHIN the pay period
  -- A leave request may span beyond the period boundaries, so clip it
  GREATEST(0,
    LEAST(tor.end_date, :payrun_end_date)
    - GREATEST(tor.start_date, :payrun_start_date)
    + 1
  )
), 0) AS total_unpaid_calendar_days
FROM time_off_requests tor
JOIN time_off_types tot ON tot.id = tor.time_off_type_id
WHERE tor.employee_id = :employee_id
  AND tor.status = 'approved'
  AND tot.is_paid = FALSE
  AND tor.start_date <= :payrun_end_date
  AND tor.end_date   >= :payrun_start_date;
```

**Server-side: Refine to only count unpaid leave days that fall on workdays**

```
-- total_unpaid_calendar_days is a rough count.
-- Refine by counting only days that fall on scheduled workdays:

unpaid_workdays = 0
FOR each approved unpaid leave request in period:
  clip_start = MAX(request.start_date, payrun.start_date)
  clip_end   = MIN(request.end_date, payrun.end_date)
  FOR each date D in [clip_start .. clip_end]:
    IF ISODOW(D) IN schedule_day_numbers:
      unpaid_workdays += 1
-- Store as: total_unpaid_leave_days
```

> **Or use a single SQL query:**
```sql
SELECT COUNT(*) AS total_unpaid_leave_days
FROM time_off_requests tor
JOIN time_off_types tot ON tot.id = tor.time_off_type_id
CROSS JOIN LATERAL generate_series(
  GREATEST(tor.start_date, :payrun_start_date),
  LEAST(tor.end_date, :payrun_end_date),
  '1 day'
) AS d(dt)
WHERE tor.employee_id = :employee_id
  AND tor.status = 'approved'
  AND tot.is_paid = FALSE
  AND tor.start_date <= :payrun_end_date
  AND tor.end_date   >= :payrun_start_date
  AND EXTRACT(ISODOW FROM d.dt)::int = ANY(:schedule_day_numbers);
```

**Compute deduction:**
```
IF total_unpaid_leave_days > 0:
  -- interim_gross is the sum of all basic + allowance lines (including OT_PAY)
  -- computed so far (before deductions)
  interim_gross = SUM(line.amount FOR line IN all_lines
                     WHERE line.category IN ('basic', 'allowance')
                       AND line.rule_code NOT IN ('GROSS', 'NET'))

  per_day_rate = interim_gross / total_period_workdays

  unpaid_leave_deduction = ROUND(per_day_rate * total_unpaid_leave_days, 2)

  all_lines.append({
    rule_id:          NULL,
    rule_code:        'UNPAID_LV',
    rule_name:        'Unpaid Leave Deduction',
    category:         'deduction',
    sequence:         9998,           -- after OT_PAY (9000), before NET (200)
    amount:           -unpaid_leave_deduction,    -- NEGATIVE
    contract_id:      primary_contract_id,
    segment_start:    NULL,
    segment_end:      NULL,
    proration_factor: NULL
  })

  ADD warning: UNPAID_LEAVE_DEDUCTION (severity: info,
    details: { days: total_unpaid_leave_days,
               per_day_rate: per_day_rate,
               deduction_amount: unpaid_leave_deduction })
```

---

## 10. Phase 7 — Aggregate Computation

Compute final aggregate numbers from `all_lines`:

```
gross_salary = SUM(line.amount)
  WHERE line.category IN ('basic', 'allowance')
  AND line.rule_code NOT IN ('GROSS', 'NET')
  -- Includes OT_PAY (category = 'allowance')

total_deductions = SUM(ABS(line.amount))
  WHERE line.category = 'deduction'
  -- Includes PF, PT, UNPAID_LV. Amounts are stored NEGATIVE; ABS for display.

net_salary = gross_salary - total_deductions

-- Guard: floor net salary at 0
IF net_salary < 0:
  ADD warning: NEGATIVE_NET (severity: warning,
    details: "Net salary computed as negative — review deduction rules")
  net_salary = 0.00
```

**Update placeholder lines:**
```
FOR line IN all_lines WHERE line.rule_code == 'GROSS':
  line.amount = gross_salary

FOR line IN all_lines WHERE line.rule_code == 'NET':
  line.amount = net_salary
```

---

## 11. Phase 8 — Worked Days & Hours

```sql
SELECT
  COUNT(CASE WHEN a.status IN ('present', 'special_leave') THEN 1 END)
    AS attendance_present_days,
  COALESCE(
    SUM(CASE WHEN a.status IN ('present', 'special_leave')
             THEN a.worked_hours ELSE 0 END),
    0
  ) AS total_worked_hours
FROM attendance a
WHERE a.employee_id = :employee_id
  AND a.date BETWEEN :payrun_start_date AND :payrun_end_date;
```

**Server-side:**
```
-- Paid holidays that fall on scheduled workdays count as worked days
paid_holidays_on_workdays = COUNT of paid_holidays[]
  WHERE dow IN schedule_day_numbers

worked_days  = attendance_present_days + paid_holidays_on_workdays
worked_hours = total_worked_hours    -- holidays contribute 0 hours (no attendance record)
```

---

## 12. Phase 9 — Warning Generation

Run remaining warning checks **after** computation for full context.

### W1. Unreviewed Attendance — Missing Check-outs

```sql
SELECT COUNT(*) AS missing_checkouts
FROM attendance a
WHERE a.employee_id = :employee_id
  AND a.date BETWEEN :payrun_start_date AND :payrun_end_date
  AND a.check_in IS NOT NULL
  AND a.check_out IS NULL;
```
```
IF missing_checkouts > 0:
  ADD warning: UNREVIEWED_ATTENDANCE (severity: warning,
    details: { count: missing_checkouts,
               message: "N attendance records have check-in but no check-out" })
```

### W2. Missing Check-in Days (Unexplained Absences)

```sql
WITH scheduled_days AS (
  SELECT d::date AS work_date
  FROM generate_series(:payrun_start_date::date, :payrun_end_date::date, '1 day') d
  WHERE EXTRACT(ISODOW FROM d)::int = ANY(:schedule_day_numbers)
    AND d::date NOT IN (
      SELECT date FROM company_holidays
      WHERE date BETWEEN :payrun_start_date AND :payrun_end_date
    )
)
SELECT COUNT(*) AS missing_checkin_days
FROM scheduled_days sd
WHERE NOT EXISTS (
  SELECT 1 FROM attendance a
  WHERE a.employee_id = :employee_id
    AND a.date = sd.work_date
    AND a.check_in IS NOT NULL
)
AND NOT EXISTS (
  SELECT 1 FROM time_off_requests tor
  WHERE tor.employee_id = :employee_id
    AND tor.status = 'approved'
    AND tor.start_date <= sd.work_date
    AND tor.end_date   >= sd.work_date
);
```
```
IF missing_checkin_days > 0:
  ADD warning: MISSING_CHECKIN_DAYS (severity: warning,
    details: { count: missing_checkin_days,
               message: "N workdays have no attendance and no approved leave" })
```

### W3. Holiday Work Detected

```sql
SELECT COUNT(*) AS holiday_work_days
FROM attendance a
JOIN company_holidays ch ON ch.date = a.date
WHERE a.employee_id = :employee_id
  AND a.date BETWEEN :payrun_start_date AND :payrun_end_date
  AND ch.is_paid = TRUE
  AND a.worked_hours > 0;
```
```
IF holiday_work_days > 0:
  ADD warning: HOLIDAY_WORK_DETECTED (severity: info,
    details: { count: holiday_work_days })
```

> All warnings accumulated throughout Phases 2–9 are now finalized in `warnings[]`.

---

## 13. Phase 10 — Persistence

All database writes for a single employee happen in a **single transaction** (`BEGIN` / `COMMIT`).

### Step 1: Insert Payslip Record

```sql
INSERT INTO payslips (
  pay_run_id,
  employee_id,
  contract_id,
  gross_salary,
  net_salary,
  total_deductions,
  worked_days,
  worked_hours,
  status,
  warnings
) VALUES (
  :pay_run_id,
  :employee_id,
  :primary_contract_id,     -- NULL for multi-contract prorated payslips
  :gross_salary,
  :net_salary,
  :total_deductions,
  :worked_days,
  :worked_hours,
  'computed',
  :warnings_jsonb           -- JSON array of warning objects
)
RETURNING id AS payslip_id;
```

### Step 2: Insert Payslip Lines (Snapshot)

```sql
INSERT INTO payslip_lines (
  payslip_id,
  rule_id,
  rule_code,
  rule_name,
  category,
  sequence,
  amount,
  contract_id,
  segment_start,
  segment_end,
  proration_factor,
  computed_at
)
VALUES
  (:payslip_id, :rule_id, :rule_code, :rule_name, :category,
   :sequence, :amount, :contract_id, :segment_start, :segment_end,
   :proration_factor, NOW())
-- ... one row per entry in all_lines[]
```

> **Snapshot guarantee:** Once inserted, `payslip_lines` are **never recomputed** from live
> `salary_rules`. If rules change later, historical payslips remain accurate.

### Step 3: Update Pay Run Status (after ALL employees processed)

```sql
UPDATE pay_runs
SET status = 'computed',
    updated_at = NOW()
WHERE id = :pay_run_id;
```

---

## 14. Helper Functions

### `count_workdays(start_date, end_date, schedule_day_numbers[])`

```sql
SELECT COUNT(*) AS workdays
FROM generate_series(:start_date::date, :end_date::date, '1 day') AS d
WHERE EXTRACT(ISODOW FROM d)::int = ANY(:schedule_day_numbers);
```

---

### `resolve_schedule_day_numbers(schedule_id)`

```sql
SELECT day_of_week::text AS dow_name
FROM schedule_lines
WHERE schedule_id = :schedule_id
  AND is_active = TRUE;
```

**Then map in application code:**
```
RETURN [DOW_MAP[row.dow_name] FOR each row]
-- e.g. [1, 2, 3, 4, 5] for Mon–Fri
```

---

### `count_paid_holidays_on_workdays(start_date, end_date, schedule_day_numbers[])`

```sql
SELECT COUNT(*) AS holiday_count
FROM company_holidays
WHERE date BETWEEN :start_date AND :end_date
  AND is_paid = TRUE
  AND EXTRACT(ISODOW FROM date)::int = ANY(:schedule_day_numbers);
```

---

### `date_ranges_overlap(start1, end1, start2, end2)`

```
RETURN (start1 <= end2) AND (end1 >= start2)
```

---

## 15. Warning Reference Table

| Warning Code | Trigger Condition | Severity | Blocks Validation? | Payslip Generated? |
|---|---|:---:|:---:|:---:|
| `NO_ACTIVE_CONTRACT` | No active contract overlaps pay period | 🔴 Error | ✅ Yes (until reviewed) | ✅ Yes (zeroed out) |
| `DUPLICATE_PAYSLIP` | Overlapping non-paid payslip exists | 🔴 Error | ✅ Yes (until reviewed) | ✅ Yes |
| `MULTIPLE_CONTRACTS` | >1 contract overlaps pay period | 🟡 Info | ❌ No | ✅ Yes (prorated) |
| `PRORATED_PAYSLIP` | Payslip spans multiple contract segments | 🟡 Info | ❌ No | ✅ Yes |
| `MISSING_BANK_DETAILS` | `bank_name` or `bank_account` is NULL | 🟠 Warning | ❌ No | ✅ Yes |
| `MISSING_DATA` | Name / join date missing, or employee inactive | 🟠 Warning | ❌ No | ✅ Yes |
| `UNREVIEWED_ATTENDANCE` | Attendance with check-in but no check-out | 🟠 Warning | ❌ No | ✅ Yes |
| `MISSING_CHECKIN_DAYS` | Workday with no attendance and no approved leave | 🟠 Warning | ❌ No | ✅ Yes |
| `UNPAID_LEAVE_DEDUCTION` | Unpaid leave days deducted from salary | 🟡 Info | ❌ No | ✅ Yes |
| `HOLIDAY_WORK_DETECTED` | Employee worked on a paid company holiday | 🟡 Info | ❌ No | ✅ Yes |
| `OT_NO_POLICY` | Overtime hours exist but contract has no OT policy | 🟠 Warning | ❌ No | ✅ Yes [P2] |
| `COMP_OFF_CREDITED` | OT converted to comp-off (no OT pay generated) | 🟡 Info | ❌ No | ✅ Yes [P2] |
| `NEGATIVE_NET` | Net salary computed as negative after deductions | 🟠 Warning | ❌ No | ✅ Yes (floored to 0) |

### Warning JSON Shape (stored in `payslips.warnings` JSONB column)

```json
[
  {
    "code": "MISSING_BANK_DETAILS",
    "severity": "warning",
    "message": "No bank account on file for Arjun Mehta",
    "details": {
      "employee_id": 5,
      "fields_missing": ["bank_name", "bank_account"]
    }
  },
  {
    "code": "UNPAID_LEAVE_DEDUCTION",
    "severity": "info",
    "message": "3 unpaid leave days deducted",
    "details": {
      "days": 3,
      "per_day_rate": 5163.64,
      "deduction_amount": 15490.91
    }
  }
]
```

### Validation Gate (triggered by `POST /pay-runs/:id/validate`)

```sql
-- Check for payslips with error-severity warnings that are not yet reviewed
SELECT ps.id, u.first_name, u.last_name, ps.warnings
FROM payslips ps
JOIN users u ON u.id = ps.employee_id
WHERE ps.pay_run_id = :pay_run_id
  AND ps.is_reviewed = FALSE
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(ps.warnings) w
    WHERE w->>'severity' = 'error'
  );
```

**Server-side:**
```
IF any rows returned:
  → BLOCK: 409 "Unreviewed error payslips exist: [list employee names]"
ELSE:
  UPDATE pay_runs SET status = 'validated', validated_at = NOW() WHERE id = :pay_run_id
  UPDATE payslips SET status = 'validated'  WHERE pay_run_id = :pay_run_id
```

---

## 16. Affected Endpoints (DOW Optimization)

The switch from `TRIM(TO_CHAR(d, 'day'))` string comparison to `EXTRACT(ISODOW FROM d)::int`
integer comparison is an **internal optimization**. No API request/response contracts change.

The following endpoints/services use day-of-week comparison internally and their **server-side
implementation** must adopt the `DOW_MAP` + `EXTRACT(ISODOW)` pattern:

| Endpoint | Where DOW is used internally |
|---|---|
| `POST /pay-runs/:id/compute` | All workday counting, holiday-on-workday, missing check-in detection (this algorithm) |
| `POST /leave-requests` | `number_of_days` computation — counts business days per employee's schedule, excluding holidays |
| `POST /attendance/check-in` | Status derivation: checking if today is a scheduled workday |
| `POST /attendance/check-out` | Same as check-in |
| `PUT /attendance/:id` | Manual correction: re-derive status for the corrected date |
| `GET /dashboard/payroll` | Attendance coverage metrics, workday count computations |
| `GET /schedules/:id` | `total_weekly_hours` recomputation when schedule lines change |

> **No schema changes required.** The `day_of_week` enum stays as-is.
> The mapping happens once in the service layer when schedule lines are loaded.

---

## 17. Full Algorithm Flowchart

```
POST /pay-runs/:id/compute
│
├─ [Guard] Pay run status == 'draft'?        No  → 409
├─ [Guard] Salary structure active?          No  → 409
│
├─ Phase 0: Load rules[], paid_holidays[], selected_employees[]
│           Define DOW_MAP constant
│
└─ FOR each employee E:
   │
   ├─ Phase 2: Pre-compute checks
   │   ├─ Duplicate payslip check       → warn: DUPLICATE_PAYSLIP (error)
   │   ├─ Missing name/join date        → warn: MISSING_DATA (warning)
   │   └─ Missing bank details          → warn: MISSING_BANK_DETAILS (warning)
   │
   ├─ Phase 3: Contract resolution
   │   ├─ 0 contracts → warn: NO_ACTIVE_CONTRACT (error), zeroed payslip, SKIP
   │   ├─ 1 contract  → single-contract mode (proration = 1.0)
   │   └─ N contracts → warn: MULTIPLE_CONTRACTS + PRORATED_PAYSLIP
   │
   ├─ Phase 4 (per segment):
   │   ├─ resolve_schedule_day_numbers(schedule_id)  → e.g. [1,2,3,4,5]
   │   ├─ total_period_workdays  = count_workdays(payrun.start, payrun.end, day_numbers)
   │   ├─ segment_workdays       = count_workdays(seg.start, seg.end, day_numbers)
   │   ├─ proration_factor       = segment_workdays / total_period_workdays
   │   └─ daily_scheduled_hours  = total_weekly_hours / active_schedule_days
   │
   ├─ Phase 5A (per segment, per rule in sequence order):
   │   ├─ BASIC (fixed)      → wage × proration_factor
   │   ├─ HRA   (% of BASIC) → BASIC_amount × 40%
   │   ├─ CONV  (fixed)      → 1600 × proration_factor
   │   ├─ PF    (% of BASIC) → BASIC_amount × 12%    [deduction]
   │   ├─ PT    (fixed)      → 200 × proration_factor [deduction]
   │   ├─ GROSS (placeholder)→ 0 (updated in Phase 7)
   │   └─ NET   (placeholder)→ 0 (updated in Phase 7)
   │
   ├─ Phase 5B [P2] (per segment):
   │   ├─ Contract has OT policy?    No  → check for untracked OT → warn OT_NO_POLICY
   │   ├─ policy.compensatory_off?   Yes → warn COMP_OFF_CREDITED, skip
   │   ├─ Sum overtime_hours from attendance in segment
   │   ├─ hourly_rate = wage / (total_period_workdays × daily_scheduled_hours)
   │   ├─ ot_pay = total_ot_hours × hourly_rate × multiplier
   │   └─ Append OT_PAY line (category='allowance', seq=9000)
   │
   ├─ Phase 6: Unpaid leave deduction (SOLE mechanism for unpaid leave impact)
   │   └─ IF unpaid_leave_days > 0:
   │       per_day_rate = interim_gross / total_period_workdays
   │       deduction = per_day_rate × unpaid_days
   │       → Append UNPAID_LV line (negative, category='deduction', seq=9998)
   │       → warn: UNPAID_LEAVE_DEDUCTION (info)
   │
   ├─ Phase 7: Aggregates
   │   ├─ gross = SUM(basic + allowance lines, incl. OT_PAY)
   │   ├─ total_deductions = SUM(ABS(deduction lines), incl. UNPAID_LV)
   │   ├─ net = gross - total_deductions  (floor at 0)
   │   └─ Update GROSS/NET placeholder line amounts
   │
   ├─ Phase 8: Worked days & hours
   │   └─ worked_days = attendance(present/special_leave) + paid_holidays_on_workdays
   │
   ├─ Phase 9: Remaining warnings
   │   ├─ Missing check-out records     → warn: UNREVIEWED_ATTENDANCE (warning)
   │   ├─ Workdays with no attendance/leave → warn: MISSING_CHECKIN_DAYS (warning)
   │   └─ Attendance on holidays        → warn: HOLIDAY_WORK_DETECTED (info)
   │
   └─ Phase 10: Persist (single transaction)
       ├─ INSERT payslips (status='computed', warnings=jsonb)
       └─ INSERT payslip_lines[] (snapshot — frozen forever)
│
└─ UPDATE pay_runs SET status = 'computed'
```

---

## 18. Appendix: Worked Examples

### Example A: Clean Payslip (Single Contract, No Issues)

**Employee: Rahul Verma** | Wage: ₹80,000 | Schedule: Mon–Fri (40h) | Period: Sep 1–30, 2026

| Input | Value |
|---|---|
| Schedule day numbers | `[1, 2, 3, 4, 5]` |
| Total period workdays | 22 |
| Contracts overlapping period | 1 (full coverage) |
| Segment workdays | 22 |
| **Proration factor** | **22/22 = 1.0000** |
| Approved paid leaves in Sep | 3 days Casual Leave (Sep 1–3, is_paid=TRUE) |
| Approved unpaid leaves in Sep | 0 |
| Overtime hours | 0 |

> Paid leaves do **not** reduce the proration factor and have no deduction line.
> Rahul gets full salary.

**Payslip Lines:**

| Seq | Code | Rule | Type | Calculation | Amount |
|---|---|---|---|---|---|
| 10 | BASIC | Basic Salary | fixed | `80,000 × 1.0` | ₹80,000.00 |
| 20 | HRA | House Rent Allowance | % of BASIC | `80,000 × 40%` | ₹32,000.00 |
| 30 | CONV | Conveyance Allowance | fixed | `1,600 × 1.0` | ₹1,600.00 |
| 100 | GROSS | Gross Salary | placeholder | `80,000 + 32,000 + 1,600` | ₹1,13,600.00 |
| 110 | PF | Provident Fund | % of BASIC | `80,000 × 12%` | −₹9,600.00 |
| 120 | PT | Professional Tax | fixed | `200 × 1.0` | −₹200.00 |
| 200 | NET | Net Salary | placeholder | `113,600 − 9,800` | ₹1,03,800.00 |

**Warnings:** None ✅

---

### Example B: Payslip with Unpaid Leave Deduction

**Employee: Rahul Verma** | Same as above, but with **3 unpaid leave days** in Sep

| Input | Value |
|---|---|
| Proration factor | **1.0000** (unchanged — unpaid leave does NOT reduce proration) |
| Unpaid leave days on workdays | 3 |

**Payslip Lines (salary rules same as Example A, then):**

| Seq | Code | Rule | Amount |
|---|---|---|---|
| 10 | BASIC | Basic Salary | ₹80,000.00 |
| 20 | HRA | House Rent Allowance | ₹32,000.00 |
| 30 | CONV | Conveyance Allowance | ₹1,600.00 |
| 100 | GROSS | Gross Salary | ₹99,163.64 |
| 110 | PF | Provident Fund | −₹9,600.00 |
| 120 | PT | Professional Tax | −₹200.00 |
| 9998 | UNPAID_LV | Unpaid Leave Deduction | **−₹15,490.91** |
| 200 | NET | Net Salary | **₹88,309.09** |

**Calculation:**
```
interim_gross = 80,000 + 32,000 + 1,600 = 113,600
per_day_rate  = 113,600 / 22 = 5,163.64
UNPAID_LV     = −(5,163.64 × 3) = −15,490.91
gross (final) = 113,600 − 15,490.91 = ... but wait:
```

> **Clarification:** `gross_salary` in the payslip aggregate is the sum of basic + allowance lines
> (₹1,13,600). The `UNPAID_LV` line has `category = 'deduction'`, so it appears in
> `total_deductions` alongside PF and PT. The aggregate fields on the payslip record are:
> - `gross_salary` = ₹1,13,600.00
> - `total_deductions` = 9,600 + 200 + 15,490.91 = ₹25,290.91
> - `net_salary` = ₹88,309.09

**Warnings:** `UNPAID_LEAVE_DEDUCTION` (info) ✅

---

### Example C: Overtime Pay [P2]

**Employee: Anish Goenka** | Wage: ₹1,50,000 | Schedule: Mon–Fri (40h)
**OT Policy:** Standard OT (multiplier: 1.5×, compensatory_off: FALSE)
**Period:** Sep 2026 | 2 hours of `regular_ot` recorded

```
total_period_workdays = 22
daily_scheduled_hours = 40 / 5 = 8
monthly_scheduled_hours = 22 × 8 = 176
hourly_rate = 150,000 / 176 = 852.27
ot_pay = 2 × 852.27 × 1.5 = 2,556.82
```

**Additional payslip line:**

| Seq | Code | Rule | Amount |
|---|---|---|---|
| 9000 | OT_PAY | Overtime Pay | ₹2,556.82 |

This gets included in `gross_salary` (it's an allowance).

---

### Example D: Warning-Heavy Payslip (Arjun Mehta, Intern)

**Wage:** ₹25,000 | Sep 5 = absent (no check-in, no leave) | No bank details

**Warnings generated:**
1. `MISSING_BANK_DETAILS` (warning) — `bank_name` and `bank_account` are NULL
2. `MISSING_CHECKIN_DAYS` (warning) — Sep 5 is a scheduled workday with no attendance and no leave
3. `OT_NO_POLICY` [P2] (warning) — if any overtime hours exist but `overtime_policy_id` is NULL

Payslip is **still computed with full salary**. Payroll person reviews and acknowledges before validation.

---

*Document version: 2.0 | Generated: 2026-09-06*
*Sources: problem-statement.md · server/src/config/init.sql · business-logic.md*
