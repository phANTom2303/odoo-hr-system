# PeoplePay360 — Payroll Computation Algorithm
### *Exact flow when a Payroll person clicks "Compute" on a Pay Run*

> **Audience:** Backend developers implementing `POST /pay-runs/:id/compute`.
> This document is the single source of truth for the payroll engine.
> Every SQL query and server-side calculation is spelled out in order.

---

## Table of Contents

1. [Trigger & Pre-conditions](#1-trigger--pre-conditions)
2. [Phase 0 — Load Pay Run Context](#2-phase-0--load-pay-run-context)
3. [Phase 1 — Employee Loop Setup](#3-phase-1--employee-loop-setup)
4. [Phase 2 — Pre-compute Checks & Early Warnings](#4-phase-2--pre-compute-checks--early-warnings)
5. [Phase 3 — Contract Resolution](#5-phase-3--contract-resolution)
6. [Phase 4 — Segment & Proration Calculation](#6-phase-4--segment--proration-calculation)
7. [Phase 5 — Salary Rule Execution (Per Segment)](#7-phase-5--salary-rule-execution-per-segment)
8. [Phase 6 — Unpaid Leave Deduction](#8-phase-6--unpaid-leave-deduction)
9. [Phase 7 — Aggregate Computation](#9-phase-7--aggregate-computation)
10. [Phase 8 — Worked Days & Hours](#10-phase-8--worked-days--hours)
11. [Phase 9 — Warning Generation](#11-phase-9--warning-generation)
12. [Phase 10 — Persistence](#12-phase-10--persistence)
13. [Helper Functions](#13-helper-functions)
14. [Warning Reference Table](#14-warning-reference-table)
15. [Full Algorithm Flowchart](#15-full-algorithm-flowchart)

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

## 2. Phase 0 — Load Pay Run Context

Load all data shared across all employees in this batch. Do this **once** before the employee loop.

```sql
-- 2a. Load all salary rules for the pay run's structure, in execution order
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

```sql
-- 2b. Load all company holidays that fall within the pay period
SELECT date
FROM company_holidays
WHERE date BETWEEN :start_date AND :end_date
  AND is_paid = TRUE;
-- Store as: paid_holiday_dates[]  (Set for O(1) lookup)
```

```sql
-- 2c. Load all employees selected for this pay run
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
-- Find any overlapping non-paid, non-cancelled payslips for this employee
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
-- Find all contracts overlapping the pay period for this employee
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
  → Single contract mode (no proration across contracts)
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

**Server-side (for each contract C in contracts[]):**

```
seg_start = MAX(C.start_date, payrun.start_date)
seg_end   = MIN(C.end_date ?? payrun.end_date, payrun.end_date)
```

### 6a. Resolve Schedule Days

```sql
-- Get which days-of-week this contract's schedule covers
SELECT sl.day_of_week
FROM schedule_lines sl
WHERE sl.schedule_id = :S.contract.schedule_id
  AND sl.is_active = TRUE;
-- Store as: schedule_days[]  e.g. ['monday','tuesday','wednesday','thursday','friday']
```

### 6b. Count Total Workdays in Full Pay Period (denominator)

```sql
-- Count scheduled work days in the full payrun period
SELECT COUNT(*) AS total_period_workdays
FROM generate_series(:payrun_start_date::date, :payrun_end_date::date, '1 day') AS d
WHERE TRIM(TO_CHAR(d, 'day')) = ANY(:schedule_days);
-- Store as: total_period_workdays
```

### 6c. Count Workdays in Segment (numerator base)

```sql
SELECT COUNT(*) AS segment_raw_workdays
FROM generate_series(:seg_start::date, :seg_end::date, '1 day') AS d
WHERE TRIM(TO_CHAR(d, 'day')) = ANY(:schedule_days);
```

### 6d. Count Paid Holidays Falling on Workdays in Segment

```sql
SELECT COUNT(*) AS holidays_in_segment
FROM company_holidays
WHERE date BETWEEN :seg_start AND :seg_end
  AND is_paid = TRUE
  AND TRIM(TO_CHAR(date, 'day')) = ANY(:schedule_days);
```

> **Alternative server-side:** Filter `paid_holiday_dates[]` (loaded in Phase 0).

### 6e. Count Unpaid Leave Days in Segment

```sql
SELECT COALESCE(SUM(
  -- Number of approved unpaid leave days overlapping this segment
  LEAST(tor.end_date, :seg_end) - GREATEST(tor.start_date, :seg_start) + 1
), 0) AS unpaid_days_in_segment
FROM time_off_requests tor
JOIN time_off_types tot ON tot.id = tor.time_off_type_id
WHERE tor.employee_id = :employee_id
  AND tor.status = 'approved'
  AND tot.is_paid = FALSE
  AND tor.start_date <= :seg_end
  AND tor.end_date   >= :seg_start;
```

> **Note:** `number_of_days` on the request is the pre-computed business-day count.
> When a leave spans segment boundaries, use the day-intersection approach above
> or recompute overlap using the employee's schedule.

### 6f. Compute Proration Factor

```
segment_effective_workdays = segment_raw_workdays
                             - holidays_in_segment
                             - unpaid_days_in_segment

proration_factor = segment_effective_workdays / total_period_workdays

-- Clamp to [0.0, 1.0]
proration_factor = MAX(0.0, MIN(1.0, proration_factor))
```

> **Single contract:** If only 1 contract covers the full period,
> `seg_start = payrun.start_date`, `seg_end = payrun.end_date`.
> Proration still correctly reduces pay for unpaid leaves and full-period absences.

---

## 7. Phase 5 — Salary Rule Execution (Per Segment)

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
    rule_name:        R.name,       -- SNAPSHOT: copy from rule now
    category:         R.category,  -- SNAPSHOT
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

## 8. Phase 6 — Unpaid Leave Deduction

After all salary lines are computed, calculate the total unpaid leave deduction across the full pay period:

```sql
-- All approved unpaid leaves in the full pay period
SELECT COALESCE(SUM(tor.number_of_days), 0) AS total_unpaid_days
FROM time_off_requests tor
JOIN time_off_types tot ON tot.id = tor.time_off_type_id
WHERE tor.employee_id = :employee_id
  AND tor.status = 'approved'
  AND tot.is_paid = FALSE
  AND tor.start_date <= :payrun_end_date
  AND tor.end_date   >= :payrun_start_date;
-- Store as: total_unpaid_leave_days
```

**Server-side:**
```
IF total_unpaid_leave_days > 0:
  -- Interim gross from all lines computed so far
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
    sequence:         9999,
    amount:           -unpaid_leave_deduction,    -- NEGATIVE
    contract_id:      primary_contract_id,
    segment_start:    NULL,
    segment_end:      NULL,
    proration_factor: NULL
  })

  ADD warning: UNPAID_LEAVE_DEDUCTION (severity: info,
    details: { days: total_unpaid_leave_days, deduction_amount: unpaid_leave_deduction })
```

---

## 9. Phase 7 — Aggregate Computation

Compute final aggregate numbers from `all_lines`:

```
gross_salary = SUM(line.amount)
  WHERE line.category IN ('basic', 'allowance')
  AND line.rule_code NOT IN ('GROSS', 'NET')   -- exclude placeholder lines

total_deductions = SUM(ABS(line.amount))
  WHERE line.category = 'deduction'
  -- deduction amounts are stored as NEGATIVE values

net_salary = gross_salary - total_deductions

-- Guard: floor net salary at 0 (edge case: extreme deductions)
IF net_salary < 0:
  ADD warning: MISSING_DATA (severity: warning,
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

## 10. Phase 8 — Worked Days & Hours

```sql
-- Count present/special_leave days and sum worked hours from attendance
SELECT
  COUNT(CASE WHEN a.status IN ('present', 'special_leave') THEN 1 END) AS attendance_present_days,
  COALESCE(
    SUM(CASE WHEN a.status IN ('present', 'special_leave') THEN a.worked_hours ELSE 0 END),
    0
  ) AS total_worked_hours
FROM attendance a
WHERE a.employee_id = :employee_id
  AND a.date BETWEEN :payrun_start_date AND :payrun_end_date;
```

**Server-side:**
```
-- Paid holidays count as worked days (no attendance record needed)
paid_holidays_on_workdays = COUNT of paid_holiday_dates[]
  WHERE day_of_week(date) IN schedule_days  -- use primary contract's schedule

worked_days  = attendance_present_days + paid_holidays_on_workdays
worked_hours = total_worked_hours    -- holidays contribute 0 hours
```

---

## 11. Phase 9 — Warning Generation

Run all remaining warning checks after computation so warnings have full context.

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
  -- All dates in period that fall on this employee's scheduled working days
  -- excluding paid holidays (those are fine to miss)
  SELECT d::date AS work_date
  FROM generate_series(:payrun_start_date::date, :payrun_end_date::date, '1 day') d
  WHERE TRIM(TO_CHAR(d, 'day')) = ANY(:schedule_days)
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

## 12. Phase 10 — Persistence

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

## 13. Helper Functions

### `count_workdays(start_date, end_date, schedule_days[])`

```sql
SELECT COUNT(*) AS workdays
FROM generate_series(:start_date::date, :end_date::date, '1 day') AS d
WHERE TRIM(TO_CHAR(d, 'day')) = ANY(:schedule_days);
```

---

### `resolve_schedule_days(schedule_id)`

```sql
SELECT ARRAY_AGG(day_of_week::text) AS schedule_days
FROM schedule_lines
WHERE schedule_id = :schedule_id
  AND is_active = TRUE;
-- Returns e.g. ARRAY['monday','tuesday','wednesday','thursday','friday']
```

---

### `count_paid_holidays_on_workdays(start_date, end_date, schedule_days[])`

```sql
SELECT COUNT(*) AS holiday_count
FROM company_holidays
WHERE date BETWEEN :start_date AND :end_date
  AND is_paid = TRUE
  AND TRIM(TO_CHAR(date, 'day')) = ANY(:schedule_days);
```

---

### `date_ranges_overlap(start1, end1, start2, end2)`

```
RETURN (start1 <= end2) AND (end1 >= start2)
```

---

## 14. Warning Reference Table

| Warning Code | Trigger Condition | Severity | Blocks Validation? | Payslip Generated? |
|---|---|:---:|:---:|:---:|
| `NO_ACTIVE_CONTRACT` | No active contract overlaps pay period | 🔴 Error | ✅ Yes (until reviewed) | ✅ Yes (zeroed out) |
| `DUPLICATE_PAYSLIP` | Overlapping non-paid payslip exists for this employee | 🔴 Error | ✅ Yes (until reviewed) | ✅ Yes |
| `MULTIPLE_CONTRACTS` | >1 contract overlaps pay period | 🟡 Info | ❌ No | ✅ Yes (prorated) |
| `PRORATED_PAYSLIP` | Payslip spans multiple contract segments | 🟡 Info | ❌ No | ✅ Yes |
| `MISSING_BANK_DETAILS` | `bank_name` or `bank_account` is NULL | 🟠 Warning | ❌ No | ✅ Yes |
| `MISSING_DATA` | Name / join date missing, or employee inactive | 🟠 Warning | ❌ No | ✅ Yes |
| `UNREVIEWED_ATTENDANCE` | Attendance records with check-in but no check-out | 🟠 Warning | ❌ No | ✅ Yes |
| `MISSING_CHECKIN_DAYS` | Workday with no attendance record and no approved leave | 🟠 Warning | ❌ No | ✅ Yes |
| `UNPAID_LEAVE_DEDUCTION` | Unpaid leave days deducted from salary | 🟡 Info | ❌ No | ✅ Yes |
| `HOLIDAY_WORK_DETECTED` | Employee worked on a company paid holiday | 🟡 Info | ❌ No | ✅ Yes |

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
    "code": "PRORATED_PAYSLIP",
    "severity": "info",
    "message": "Payslip pro-rated across 2 contract segments",
    "details": { "segments": 2 }
  }
]
```

### Validation Gate (triggered by `POST /pay-runs/:id/validate`)

```sql
-- Check for any payslips with error-severity warnings that are not yet reviewed
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

## 15. Full Algorithm Flowchart

```
POST /pay-runs/:id/compute
│
├─ [Guard] Pay run status == 'draft'?        No  → 409
├─ [Guard] Salary structure active?          No  → 409
│
├─ Phase 0: Load rules[], paid_holiday_dates[], selected_employees[]
│
└─ FOR each employee E:
   │
   ├─ Phase 2: Pre-compute checks
   │   ├─ Duplicate payslip check       → warn: DUPLICATE_PAYSLIP (error)
   │   ├─ Missing name/join date        → warn: MISSING_DATA (warning)
   │   └─ Missing bank details          → warn: MISSING_BANK_DETAILS (warning)
   │
   ├─ Phase 3: Contract resolution
   │   ├─ 0 contracts → warn: NO_ACTIVE_CONTRACT (error), create zeroed payslip, SKIP
   │   ├─ 1 contract  → single-contract mode
   │   └─ N contracts → warn: MULTIPLE_CONTRACTS + PRORATED_PAYSLIP, proration mode
   │
   ├─ Phase 4 (per segment):
   │   ├─ resolve_schedule_days(schedule_id)
   │   ├─ total_period_workdays  = count_workdays(payrun.start, payrun.end, days)
   │   ├─ segment_raw_workdays   = count_workdays(seg.start, seg.end, days)
   │   ├─ holidays_in_segment    = count_paid_holidays_on_workdays(seg.start, seg.end, days)
   │   ├─ unpaid_days_in_segment = SUM approved unpaid leaves overlapping segment
   │   └─ proration_factor       = (raw - holidays - unpaid) / total_period_workdays
   │
   ├─ Phase 5 (per segment, per rule in sequence order):
   │   ├─ BASIC (fixed)      → wage × proration_factor
   │   ├─ HRA   (% of BASIC) → BASIC_amount × 40%
   │   ├─ CONV  (fixed)      → 1600 × proration_factor
   │   ├─ PF    (% of BASIC) → BASIC_amount × 12%    [deduction, negative]
   │   ├─ PT    (fixed)      → 200 × proration_factor [deduction, negative]
   │   ├─ GROSS (placeholder)→ 0.00 (updated in Phase 7)
   │   └─ NET   (placeholder)→ 0.00 (updated in Phase 7)
   │
   ├─ Phase 6: Unpaid leave deduction
   │   └─ IF unpaid_days > 0:
   │       deduction = (interim_gross / total_period_workdays) × unpaid_days
   │       → append UNPAID_LV line (negative amount)
   │       → warn: UNPAID_LEAVE_DEDUCTION (info)
   │
   ├─ Phase 7: Aggregates
   │   ├─ gross = SUM(basic + allowance lines)
   │   ├─ total_deductions = SUM(ABS(deduction lines))
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

## Appendix: Concrete Worked Example

**Setup:** Pay period = September 1–30, 2026 | Structure = "India Standard CTC"

**Employee: Rahul Verma** | Wage: ₹80,000 | Schedule: Mon–Fri (Standard 40h)

| Input | Value |
|---|---|
| Total period workdays (Mon–Fri in Sep) | 22 |
| Paid holidays in Sep 2026 | 0 (Independence Day is Aug 15) |
| Approved paid leaves in Sep | 3 days Casual Leave (Sep 1–3, `is_paid=TRUE`) |
| Approved unpaid leaves in Sep | 0 |
| Proration factor | `(22 − 0 − 0) / 22 = 1.0000` |

> Paid leaves do **not** reduce the proration factor. Rahul gets full salary.

**Salary Rule Execution:**

| Seq | Code | Rule | Type | Calculation | Amount |
|---|---|---|---|---|---|
| 10 | BASIC | Basic Salary | fixed | `80,000 × 1.0000` | ₹80,000.00 |
| 20 | HRA | House Rent Allowance | % of BASIC | `80,000 × 40%` | ₹32,000.00 |
| 30 | CONV | Conveyance Allowance | fixed | `1,600 × 1.0000` | ₹1,600.00 |
| 100 | GROSS | Gross Salary | placeholder | `80,000 + 32,000 + 1,600` | ₹1,13,600.00 |
| 110 | PF | Provident Fund | % of BASIC | `80,000 × 12%` = −₹9,600 | −₹9,600.00 |
| 120 | PT | Professional Tax | fixed | `200 × 1.0000` = −₹200 | −₹200.00 |
| 200 | NET | Net Salary | placeholder | `113,600 − 9,600 − 200` | ₹1,03,800.00 |

**Aggregates:**
- `gross_salary` = 80,000 + 32,000 + 1,600 = **₹1,13,600.00**
- `total_deductions` = 9,600 + 200 = **₹9,800.00**
- `net_salary` = **₹1,03,800.00**

**Worked Days:**
- Attendance: Sep 4, Sep 5 = 2 present days (Sep 1–3 = on_leave)
- Paid holidays: 0 in September
- `worked_days` = **2**

**Warnings generated:**
- `MISSING_CHECKIN_DAYS`? No — Sep 1–3 have approved leave covering them. Sep 4–5 have attendance. ✅
- `MISSING_BANK_DETAILS`? No — Rahul has SBI account. ✅
- Final warnings: **none** → clean payslip. ✅

---

**Employee: Arjun Mehta** | Wage: ₹25,000 | Schedule: Mon–Fri (Standard 40h)

| Input | Value |
|---|---|
| Proration factor | `22 / 22 = 1.0000` (full month) |
| Approved unpaid leaves | 0 |
| Attendance Sep 5 | **absent** (no check-in, no leave) |

**Warnings generated:**
- `MISSING_BANK_DETAILS` → Arjun has NULL bank_name and bank_account in seed data → ⚠️ Warning
- `MISSING_CHECKIN_DAYS` → Sep 5 is a scheduled workday, no attendance, no leave → ⚠️ Warning

Payslip is **still computed** (warnings don't block computation). Payroll person can review and acknowledge before validating.

---

*Document version: 1.0 | Generated: 2026-09-05*
*Sources: problem-statement.md · server/src/config/init.sql · business-logic.md*
