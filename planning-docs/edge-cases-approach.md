# PeoplePay360 — Edge Case Handling Strategy

> **Hackathon Context (< 20 hrs left):** Every system below is designed with a "minimum viable but correct" philosophy. The goal is to handle 80% of real cases automatically, flag the remaining 20% for manual HR review, and never silently produce a wrong payslip.

---

## The Four Problem Areas

1. **Holiday Calendar** — company/national holidays that shouldn't eat leave quota
2. **Overtime Policy** — distinguishing real overtime from shifted schedules
3. **Mid-Period Contract Changes** — pro-rated salary across two contracts
4. **Special Attendance Types** — off-site work, unpaid leave, compensatory offs

---

## System 1: Company Holiday Calendar

### What it solves
HRs can mark days as holidays. These days are **excluded** from:
- Paid leave quota consumption
- Absentee counting in payroll

### Data Model (add one table)

```sql
COMPANY_HOLIDAYS (
  id            PK,
  name          VARCHAR,          -- "Diwali", "Republic Day"
  date          DATE UNIQUE,
  holiday_type  ENUM('national','festival','company'),
  is_paid       BOOL DEFAULT TRUE  -- almost always true; set false for rare cases
)
```

### Logic

```
When computing payslip worked_days for period [start, end]:
  workdays = schedule_lines for employee's contract schedule
              (Mon–Fri or whatever their pattern is)

  For each calendar day in [start, end]:
    if day in COMPANY_HOLIDAYS AND holiday.is_paid = true:
      → count as PAID (does NOT consume leave quota, does NOT mark absent)
    elif day has an approved TIME_OFF_REQUEST:
      → count as LEAVE (consumes allocation if leave type requires it)
    elif day has an ATTENDANCE record with check_in:
      → count as PRESENT
    else:
      → flag as ABSENT / needs review
```

### HR Workflow
- HR Payroll Manager: CRUD on `company_holidays`
- HR creates holiday calendar at the start of the year
- Holidays are **global** (all employees share the same calendar — simplest correct model for a hackathon)

> **Note:** If you need department-specific holidays later, add a nullable `department_id FK` to `company_holidays`. For now, `NULL` = applies to everyone.

---

## System 2: Overtime Policy Engine

### Core Insight
> "If my schedule is 9 AM–6 PM and I work 10 AM–7 PM, I haven't worked overtime."

Overtime is about **total hours worked beyond the scheduled hours**, not just whether you left late. The system must compare `worked_hours` vs `scheduled_hours` for the day.

### Two-Part Design

#### Part A — Overtime Policy (configuration table)

```sql
OVERTIME_POLICIES (
  id                    PK,
  name                  VARCHAR,              -- "Standard OT Policy"
  threshold_type        ENUM(
                          'daily_hours',      -- work > X hrs/day
                          'weekly_hours',     -- work > X hrs/week
                          'outside_schedule'  -- work on a non-scheduled day
                        ),
  daily_threshold_hrs   DECIMAL,              -- e.g. 9.0 (hours per day)
  weekly_threshold_hrs  DECIMAL,              -- e.g. 45.0
  multiplier            DECIMAL DEFAULT 1.5,  -- OT pay = hourly_rate * multiplier
  compensatory_off      BOOL DEFAULT FALSE,   -- if true, gives comp-off instead of pay
  applies_to_schedule_id FK → working_schedules  -- NULL = applies to all
)
```

**Assign policy to contract:**
```sql
ALTER TABLE contracts ADD COLUMN overtime_policy_id FK → overtime_policies;
```

#### Part B — Overtime Determination Logic

```
For each attendance record on date D for employee E:
  scheduled_hours = schedule_lines hours for day_of_week(D)
                    (0 if D is not in employee's schedule)

  actual_hours = attendance.worked_hours

  if D is in COMPANY_HOLIDAYS OR D is an approved leave day:
    → overtime_type = 'holiday_work' (always full OT, tracked separately)

  elif scheduled_hours == 0:  (D is a non-working day — weekend etc.)
    if actual_hours > 0:
      → overtime_type = 'rest_day_work' → auto-generate compensatory off credit

  else:  (regular working day)
    extra = actual_hours - scheduled_hours
    if extra > policy.daily_threshold_hrs:
      → overtime_hours = extra
    else:
      → no overtime (shifted schedule, early arrival, etc.)
      → NOTE: This handles the "10am–7pm ≠ overtime" case correctly
```

> **Tip:** Store the result: add `overtime_hours DECIMAL, overtime_type VARCHAR` to the `attendance` table. Compute this when HR "reviews" attendance, not at check-in time. This gives HR a chance to correct before payroll runs.

---

## System 3: Mid-Period Contract Changes (Pro-ration)

### The Problem
Employee promoted Sept 15. Pay period: Sept 1–30. Old contract applies Sept 1–14 (14 days), new contract applies Sept 15–30 (16 days).

### Approach: Split Payslip Lines by Contract Segment

#### Step 1 — Detect mid-period contract change

```
During payslip computation for employee E, period [P_start, P_end]:

  contracts = all contracts for E where:
    contract.start_date <= P_end
    AND (contract.end_date IS NULL OR contract.end_date >= P_start)

  if len(contracts) == 1:
    → normal single-contract computation

  if len(contracts) > 1:
    → pro-ration mode: split period into segments
```

#### Step 2 — Compute each segment

```
For each contract C in contracts (ordered by start_date):
  seg_start = MAX(C.start_date, P_start)
  seg_end   = MIN(C.end_date ?? P_end, P_end)

  scheduled_days = workdays in [seg_start, seg_end] per C's schedule
                   (excluding holidays, approved leaves)

  total_scheduled_days = workdays in [P_start, P_end] per C's schedule

  proration_factor = scheduled_days / total_scheduled_days

  for each salary_rule in C.salary_structure.rules:
    line_amount = rule.compute() * proration_factor
    → persist as payslip_line with contract_segment metadata
```

#### Step 3 — Payslip display

```
Payslip shows TWO sections:
  ┌─────────────────────────────────────────────────────┐
  │ Segment 1: Sept 1–14  (Contract: Junior Dev, 14d)   │
  │   Basic Salary:    ₹14,000  (14/30 × ₹30,000)      │
  │   HRA:             ₹5,600                           │
  ├─────────────────────────────────────────────────────┤
  │ Segment 2: Sept 15–30  (Contract: Senior Dev, 16d)  │
  │   Basic Salary:    ₹21,333  (16/30 × ₹40,000)      │
  │   HRA:             ₹8,533                           │
  ├─────────────────────────────────────────────────────┤
  │ Net Salary:        ₹49,466                          │
  └─────────────────────────────────────────────────────┘
```

#### Schema addition to payslip_lines

```sql
ALTER TABLE payslip_lines ADD COLUMN contract_id      INT REFERENCES contracts(id);
ALTER TABLE payslip_lines ADD COLUMN segment_start    DATE;
ALTER TABLE payslip_lines ADD COLUMN segment_end      DATE;
ALTER TABLE payslip_lines ADD COLUMN proration_factor DECIMAL(5,4);
```

> **Warning — Unpaid leave spanning two contract segments:** If an employee takes 5 unpaid leave days spanning Sept 12–16, deduct proportionally from each segment's salary. Apply the same `scheduled_days` logic — just exclude those leave days from the segment's workday count before computing `proration_factor`.

> **Warning — Overtime spanning two contract segments:** Compute overtime pay using the hourly rate of whichever contract was active on that specific day. Store the contract_id on the attendance/overtime record.

---

## System 4: Special Attendance Types

### The "Absent but Present" Problem

Some employees are off-site but on company business — field visits, client presentations, conferences. They should count as **present** for attendance and payroll purposes.

### Approach: Extend Time Off Types with an `attendance_impact` field

```sql
ALTER TABLE time_off_types ADD COLUMN attendance_impact 
  ENUM('absent','present','none') DEFAULT 'absent';
```

| Leave Type                | `attendance_impact` | Effect                              |
|---------------------------|---------------------|-------------------------------------|
| Sick Leave                | `absent`            | Counts as absent (from allocation)  |
| Earned Leave / Annual     | `absent`            | Counts as absent (from allocation)  |
| Unpaid Leave              | `absent`            | Counts as absent, salary deducted   |
| **Business Travel**       | **`present`**       | **Counts as present, no deduction** |
| **Conference / Off-site** | **`present`**       | **Counts as present, no deduction** |

**In payslip computation:**
```
For each leave day in period:
  if leave.time_off_type.attendance_impact == 'present':
    → add to worked_days count
    → do NOT deduct from salary
    → mark attendance status as 'special_leave' for visibility
```

> **Note:** HR just needs to create a "Business Travel" Time Off Type with `attendance_impact = 'present'` and `requires_allocation = false`. Employees submit a request; HR approves. The payslip computation handles the rest.

---

## System 5: Compensatory Offs

### The Rule
Employee works on a scheduled-off day (weekend, holiday) → earns compensatory off credits → can use those credits as paid leave on a workday.

### Approach: Comp-off as a special Time Off Type + auto-allocation

```
TIME_OFF_TYPES: one row where name='Compensatory Off', requires_allocation=TRUE
```

**When overtime is of type `rest_day_work` or `holiday_work`:**
```
→ auto-create a TIME_OFF_ALLOCATION for this employee:
    time_off_type = 'Compensatory Off'
    allocated_days += 1  (or proportional hours / scheduled_hours)
    valid_until = today + 90 days  (configurable)
    status = 'approved'  (auto-approved, no HR needed)
```

**When employee submits a comp-off leave request:**
```
→ normal Time Off Request flow
→ deducts from their Compensatory Off allocation
→ counts as paid, doesn't deduct from salary
```

> **Tip:** For the hackathon, trigger comp-off allocation from within the overtime computation step. When payroll or HR "approves" attendance, the system auto-generates comp-off credits. This can be shown in the demo as a notable feature.

---

## System 6: Manual Review Gate (The Safety Net)

### Philosophy
> Don't silently compute wrong payslips. Flag edge cases. Let a human confirm before finalizing.

### Payslip Warning System

Extend the existing `warnings` field on payslips with structured checks:

```javascript
// Warnings generated at compute time
const WARNINGS = {
  NO_ACTIVE_CONTRACT:        "No active contract found for this period",
  MULTIPLE_CONTRACTS:        "Multiple overlapping contracts — pro-ration applied",
  MISSING_BANK_DETAILS:      "No bank account on file",
  UNREVIEWED_ATTENDANCE:     "X attendance records not reviewed/approved",
  MISSING_CHECKIN_DAYS:      "X workdays with no check-in and no leave request",
  UNPAID_LEAVE_DEDUCTION:    "Unpaid leave deducted: X days (₹Y deducted)",
  COMP_OFF_CREDITED:         "Compensatory off credited: X days",
  PRORATED_PAYSLIP:          "Payslip pro-rated across 2 contracts",
  HOLIDAY_WORK_DETECTED:     "Employee worked on X holiday(s) — OT/comp-off applied",
};
```

### Review Workflow

```
Payrun Status Flow:
  DRAFT → [Compute] → COMPUTED (warnings visible)
                    → HR reviews flagged payslips individually
                    → [Mark Reviewed] per payslip
  COMPUTED → [Validate] → requires all payslips to be either:
               a) warning-free, OR
               b) manually reviewed + acknowledged
  VALIDATED → [Mark Paid]
```

**UI change needed:** Add a "Reviewed" checkbox/button on individual payslip form. HR clicks after manually inspecting. Payrun's Validate action checks all payslips are either clean or reviewed.

---

## Implementation Priority (Time Budget)

Given ~20 hours remaining, recommended build order:

| Priority | System | Est. Time | Rationale |
|----------|--------|-----------|-----------|
| 🔴 P0 | Company Holiday Calendar (CRUD + payslip integration) | 2–3 hrs | High visual impact; directly asked |
| 🔴 P0 | Mid-period contract pro-ration | 3–4 hrs | Core judging criterion |
| 🟡 P1 | Special Attendance Types (`attendance_impact` flag) | 1–2 hrs | Trivial to add; covers off-site work |
| 🟡 P1 | Manual Review Gate + structured warnings | 2–3 hrs | Safety net; directly in problem req |
| 🟢 P2 | Overtime Policy Engine (daily threshold only) | 3–4 hrs | Complex; build basic version first |
| 🟢 P2 | Compensatory Offs | 1–2 hrs | Auto-allocation; impressive demo moment |
| ⚪ P3 | OT spanning two contracts | 1 hr | Only if P0/P1 done; reuse pro-ration logic |

---

## What to Cut If Time Is Short

| Feature | Safe to cut? | Demo Alternative |
|---------|-------------|-----------------|
| Weekly OT threshold | ✅ Yes | Daily threshold covers 90% of cases |
| Holiday-specific OT multiplier | ✅ Yes | Same multiplier as regular OT |
| Comp-off expiry enforcement | ✅ Yes | Store `valid_until` but don't enforce in demo |
| Pro-ration for unpaid leave spanning contracts | ⚠️ Partial | Handle within single contract; flag cross-contract as "manual review" |
| Departmental holiday calendars | ✅ Yes | Company-wide only |

---

## Schema Delta Summary

These are additions on top of your existing schema from `schema-review.md`:

```sql
-- NEW TABLE
CREATE TABLE company_holidays (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  date         DATE NOT NULL UNIQUE,
  holiday_type VARCHAR(50),   -- 'national', 'festival', 'company'
  is_paid      BOOLEAN DEFAULT TRUE
);

-- NEW TABLE
CREATE TABLE overtime_policies (
  id                   SERIAL PRIMARY KEY,
  name                 VARCHAR(100),
  threshold_type       VARCHAR(50),  -- 'daily_hours', 'weekly_hours', 'outside_schedule'
  daily_threshold_hrs  DECIMAL(5,2),
  weekly_threshold_hrs DECIMAL(5,2),
  multiplier           DECIMAL(4,2) DEFAULT 1.5,
  compensatory_off     BOOLEAN DEFAULT FALSE
);

-- MODIFIED: contracts
ALTER TABLE contracts ADD COLUMN overtime_policy_id INT REFERENCES overtime_policies(id);

-- MODIFIED: time_off_types
ALTER TABLE time_off_types ADD COLUMN attendance_impact VARCHAR(20) DEFAULT 'absent';
-- Values: 'absent' | 'present' | 'none'

-- MODIFIED: attendance
ALTER TABLE attendance ADD COLUMN overtime_hours  DECIMAL(5,2) DEFAULT 0;
ALTER TABLE attendance ADD COLUMN overtime_type   VARCHAR(50);
-- Values: 'regular_ot' | 'rest_day_work' | 'holiday_work'

-- MODIFIED: payslip_lines (add contract segment info for pro-ration)
ALTER TABLE payslip_lines ADD COLUMN contract_id       INT REFERENCES contracts(id);
ALTER TABLE payslip_lines ADD COLUMN segment_start     DATE;
ALTER TABLE payslip_lines ADD COLUMN segment_end       DATE;
ALTER TABLE payslip_lines ADD COLUMN proration_factor  DECIMAL(6,4);

-- MODIFIED: payslips (add review tracking)
ALTER TABLE payslips ADD COLUMN is_reviewed      BOOLEAN DEFAULT FALSE;
ALTER TABLE payslips ADD COLUMN reviewed_by      INT REFERENCES users(id);
ALTER TABLE payslips ADD COLUMN reviewed_at      TIMESTAMP;
```

---

## Quick Demo Script (5-minute walkthrough)

1. **Holiday Calendar:** Show Diwali marked as a company holiday. Employee has no attendance that day. Payslip shows full pay, zero leave deduction.
2. **Off-site work:** Employee submits "Business Travel" leave for 2 days. Payslip shows them as present, no deduction.
3. **Promotion mid-month:** Employee gets new contract on the 15th. Run payroll. Show payslip split into two segments with correct pro-rated amounts.
4. **Comp-off:** Employee worked last Sunday. Overtime flagged as `rest_day_work`. Comp-off credit auto-added. They submit a comp-off leave — full pay, no deduction.
5. **Warning review:** Payrun compute shows 1 warning (missing bank account). HR acknowledges it. Validate unlocks.
