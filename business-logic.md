# PeoplePay360 — Data Manipulation Logic & Business Rules

> **Quick reference for backend developers.** Each section maps a schema entity to its CRUD permissions, validation rules, side-effects, and computation logic. Use this as the source of truth when writing API endpoints and service functions.

---

## Table of Contents

1. [Users / Employees](#1-users--employees)
2. [Departments & Job Positions](#2-departments--job-positions)
3. [Working Schedules & Schedule Lines](#3-working-schedules--schedule-lines)
4. [Salary Structures & Rules](#4-salary-structures--rules)
5. [Contracts](#5-contracts)
6. [Time Off Types](#6-time-off-types)
7. [Time Off Allocations](#7-time-off-allocations)
8. [Time Off Requests (Leaves)](#8-time-off-requests-leaves)
9. [Attendance](#9-attendance)
10. [Company Holidays](#10-company-holidays)
11. [Overtime Policies](#11-overtime-policies)
12. [Pay Runs](#12-pay-runs)
13. [Payslips & Payslip Lines](#13-payslips--payslip-lines)
14. [Cross-Cutting: Payroll Computation Engine](#14-cross-cutting-payroll-computation-engine)
15. [Cross-Cutting: Warnings System](#15-cross-cutting-warnings-system)

---

## 1. Users / Employees

### Permissions

| Action | Allowed Roles |
|--------|---------------|
| Create | `admin` |
| Read (own) | All roles |
| Read (all) | `hr_manager`, `hr_payroll_user`, `hr_payroll_manager`, `admin` |
| Update | `admin` (full), `hr_manager` (limited fields), self (own profile fields only) |
| Delete (soft) | `admin` |

### Validation Rules

- `email` must be unique and valid format.
- `role` must be one of the defined enum values.
- `manager_id` cannot be self-referential (user cannot be their own manager).
- `date_of_leaving` must be ≥ `date_of_joining` if set.
- When setting `employment_status = 'terminated'`, `is_active` should also be set to `false` and `date_of_leaving` populated.

### Side-Effects on Update

- Changing `employment_status` to `terminated`:
  - Set `is_active = false`.
  - Set `date_of_leaving = CURRENT_DATE` if null.
  - Expire all active contracts for this employee (set `status = 'expired'`, `end_date = CURRENT_DATE`).
- Changing `department_id` or `job_position_id` does NOT retroactively modify contracts. New contracts must be created for new terms.

### Mandatory Fields for Payroll

These fields must be populated before a payslip can be generated (otherwise fire a `MISSING_DATA` warning):
- `first_name`, `last_name`
- `date_of_joining`
- `bank_name`, `bank_account` (warning level — payslip still computed)
- At least one active contract

---

## 2. Departments & Job Positions

### Permissions

| Action | Allowed Roles |
|--------|---------------|
| CRUD | `hr_manager`, `hr_payroll_manager`, `admin` |
| Read | All roles |

### Validation Rules

- `name` / `title` must be unique (enforced by DB).
- Cannot delete a department that has users or contracts referencing it. Return a `409 Conflict` with details.

### Simplification Note

If short on time, skip these tables entirely and use plain `VARCHAR` fields (`department`, `job_position`) on `users` and `contracts`.

---

## 3. Working Schedules & Schedule Lines

### Permissions

| Action | Allowed Roles |
|--------|---------------|
| CRUD | `hr_manager`, `hr_payroll_manager`, `admin` |
| Read | All roles (needed for employee self-view) |

### Validation Rules

- Each schedule line: `end_time > start_time`.
- `break_minutes >= 0`.
- `day_of_week` must be unique within a schedule (enforced by DB unique constraint).
- Max 7 lines per schedule (one per day).

### Computed Field: `total_weekly_hours`

Recompute on every schedule line insert/update/delete:

```
total_weekly_hours = SUM over active lines of:
  (end_time - start_time) in hours - (break_minutes / 60)
```

Store this on `working_schedules.total_weekly_hours`.

### Guardrail: Active Contract Protection

- **Cannot delete** a schedule that is referenced by any contract with `status = 'active'`.
- **Cannot deactivate** (`is_active = false`) a schedule referenced by an active contract.
- Can freely modify schedules not linked to active contracts.

---

## 4. Salary Structures & Rules

### Permissions

| Action | Allowed Roles |
|--------|---------------|
| Create / Update / Delete structures | `hr_payroll_manager`, `admin` |
| Create / Update / Delete rules | `hr_payroll_manager`, `admin` |
| Read | `hr_payroll_user`, `hr_payroll_manager`, `admin` |

### Validation Rules — Structures

- `name` must be non-empty.
- **Cannot update or delete** a structure that is referenced by any contract with `status = 'active'`. Return `409 Conflict`.
- Deactivating a structure (`status = 'inactive'`) is allowed, but new contracts cannot reference inactive structures.

### Validation Rules — Rules

- `code` must be unique within its structure.
- `sequence` must be unique within its structure (no two rules share the same execution order).
- If `rule_type = 'fixed'`: `fixed_amount` must be provided.
- If `rule_type = 'percentage'`: both `percentage` and `base_rule_id` must be provided.
- `base_rule_id` must reference a rule within the **same structure**.

### Dependency Ordering Enforcement

> **Critical Rule:** A percentage-based rule's `base_rule_id` must point to a rule with a **lower** sequence number. This ensures that when rules are processed in sequence order, the base value is always already computed.

```
On create / update of a percentage rule:
  base_rule = SELECT * FROM salary_rules WHERE id = rule.base_rule_id
  IF base_rule.sequence >= rule.sequence:
    → REJECT with error: "Dependent rule must have a higher sequence than its base rule"
```

### Re-arrange Rules (Change Execution Order)

```
On sequence change request for rule R to new_sequence:
  1. Check: If R is a percentage rule, its base_rule must have sequence < new_sequence.
  2. Check: If any OTHER rule depends on R (has base_rule_id = R.id), those rules must
     have sequence > new_sequence.
  3. If both checks pass: update R.sequence = new_sequence, shift other sequences as needed.
  4. If either check fails: REJECT with descriptive error naming the conflicting rule(s).
```

---

## 5. Contracts

### Permissions

| Action | Allowed Roles |
|--------|---------------|
| Create | `hr_manager`, `hr_payroll_manager`, `admin` |
| Read | Own contracts: all roles; All contracts: `hr_manager`, `hr_payroll_manager`, `admin` |
| Update | **Only** `end_date` and `status` fields (for lay-offs / expiry). No other field is mutable. |
| Delete | Not allowed. Create new contracts instead. |

### Validation Rules

- `employee_id` must reference an active user.
- `schedule_id` must reference an active schedule.
- `salary_structure_id` must reference an active salary structure.
- `wage > 0`.
- `start_date` must be provided.
- If `end_date` is provided: `end_date >= start_date`.
- **No overlapping active contracts** for the same employee:

```sql
-- Check before creating/activating a contract:
SELECT COUNT(*) FROM contracts
WHERE employee_id = :employee_id
  AND status = 'active'
  AND id != :new_contract_id
  AND start_date <= :new_end_date   -- (use '9999-12-31' if end_date is NULL)
  AND (end_date IS NULL OR end_date >= :new_start_date);
-- If count > 0 → REJECT: "Overlapping active contract exists"
```

### Status Transitions

```
draft → active       (HR activates the contract)
active → expired     (automatic on end_date, or manual for layoffs)
active → cancelled   (HR cancels before it takes effect)
draft → cancelled    (HR discards a draft)
```

No reverse transitions allowed (expired/cancelled → active).

### Side-Effects

- **Activating a contract:** If the employee has another `active` contract, that old contract must be expired first (set `end_date` = day before new contract's `start_date`, `status = 'expired'`). This supports the promotion / mid-period change flow. Ths Expiration must be done via HR manually. TO ease this process, we can prompt the HR "Would you like to disable/end the prexisting contract" This helpful prompt can be done later.

---

## 6. Time Off Types

### Permissions

| Action | Allowed Roles |
|--------|---------------|
| CRUD | `hr_manager`, `hr_payroll_manager`, `admin` |
| Read | All roles |

### Validation Rules

- `name` must be unique.
- **Cannot update or delete** a type that is linked to any contract via `contract_time_off_types` where the contract is `active`. Return `409 Conflict`.
- `attendance_impact` determines payroll treatment:
  - `'absent'` — standard leave; deducted from allocation if applicable.
  - `'present'` — special leave (business travel, off-site); counts as worked day, no salary deduction.
  - `'none'` — informational only; no attendance or payroll impact.

### Key Flags and Their Effect

| Flag | Effect |
|------|--------|
| `requires_allocation = TRUE` | Leave can only be taken if employee has sufficient allocation balance |
| `requires_allocation = FALSE` | Leave can be freely requested (e.g., sick leave, business travel) |
| `is_paid = TRUE` | No salary deduction for this leave type |
| `is_paid = FALSE` | Salary deducted proportionally for leave days (unpaid leave) |
| `attendance_impact = 'present'` | Counted as a worked day in payslip; no absentee mark |

### Preset Types to Seed

| Name | Unit | Requires Alloc | Paid | Attendance Impact |
|------|------|----------------|------|-------------------|
| Earned Leave | days | ✅ | ✅ | absent |
| Sick Leave | days | ❌ | ✅ | absent |
| Unpaid Leave | days | ❌ | ❌ | absent |
| Business Travel | days | ❌ | ✅ | present |
| Compensatory Off | days | ✅ | ✅ | absent |

---

## 7. Time Off Allocations

### Permissions

| Action | Allowed Roles |
|--------|---------------|
| Create | `hr_manager`, `hr_payroll_manager`, `admin` |
| Read | Own: all roles; All: `hr_manager+` |
| Update (approve/refuse) | `hr_manager`, `hr_payroll_manager`, `admin` |
| Delete | Only if `status = 'draft'` |

### Validation Rules

- `employee_id` must reference an active user.
- `time_off_type_id` must reference a type with `requires_allocation = TRUE`.
- `end_date >= start_date`.
- `allocated_amount > 0`.
- No duplicate active allocations for the same employee + type + overlapping period.

### Balance Computation

```
available_balance = allocation.allocated_amount - allocation.taken

-- 'taken' is pre-computed and updated when leaves are approved:
taken = SUM(time_off_requests.number_of_days)
  WHERE allocation_id = :this_allocation
    AND status = 'approved'
```

### Side-Effects on Approval

- Set `status = 'approved'`, `approved_by`, `approved_at`.
- Allocation becomes available for leave requests.

### Comp-Off Auto-Allocation [P2]

When attendance overtime is flagged as `rest_day_work` or `holiday_work`:

```
→ Auto-create (or increment) an allocation:
  employee_id = the employee
  time_off_type_id = (Compensatory Off type id)
  allocated_amount += 1 day (or proportional hours)
  start_date = today
  end_date = today + 90 days
  status = 'approved'  (auto-approved)
```

---

## 8. Time Off Requests (Leaves)

### Permissions

| Action | Allowed Roles |
|--------|---------------|
| Create | All roles (own requests only) |
| Read (own) | All roles |
| Read (all) | `hr_manager`, `hr_payroll_manager`, `admin` |
| Approve / Refuse | `hr_manager`, `hr_payroll_manager`, `admin` (per type's `approver_role`) |
| Withdraw | Owner only, and only if `status = 'pending'` |

### Validation Rules

- `end_date >= start_date`.
- `employee_id` must match the requesting user (employees can only create their own requests).
- `time_off_type_id` must reference an active type.
- If the type `requires_allocation`:
  - `allocation_id` must be provided.
  - Allocation must be `approved` and within its validity period.
  - **Sufficient balance check:**
    ```
    IF (allocation.allocated_amount - allocation.taken) < request.number_of_days:
      → REJECT: "Insufficient leave balance"
    ```
- `number_of_days` must be computed at request creation:
  ```
  number_of_days = count of business days in [start_date, end_date]
                   per employee's working schedule
                   MINUS company holidays falling on work days
  ```

### Status Transitions

```
draft → pending        (employee submits)
pending → approved     (approver approves)
pending → refused      (approver refuses)
pending → withdrawn    (employee withdraws)
```

### Side-Effects on Approval

```
1. allocation.taken += request.number_of_days
   (only for types with requires_allocation = TRUE)
2. Set request.approver_id, request.approved_at
3. For each date in the leave period:
   - If attendance record exists: update status appropriately
   - Attendance computation will pick this up during payroll
```

### Side-Effects on Withdrawal (from Pending)

- No allocation impact (nothing was deducted yet in pending state).
- Set `status = 'withdrawn'`.

### Side-Effects on Refusal

- No allocation impact.
- Set `status = 'refused'`.

---

## 9. Attendance

### Permissions

| Action | Allowed Roles |
|--------|---------------|
| Check-in / Check-out | All roles (own record only) |
| Read (own) | All roles |
| Read (all) | `hr_manager`, `hr_payroll_user`, `hr_payroll_manager`, `admin` |
| Manual correction | `hr_manager`, `hr_payroll_manager`, `admin` |

### Check-in Logic

```
On check-in by employee E:
  1. Find today's attendance record for E.
  2. If none exists: CREATE with check_in = NOW(), date = TODAY.
  3. If one exists and check_in is null: UPDATE check_in = NOW().
  4. If one exists and check_in is set: REJECT "Already checked in".
```

### Check-out Logic

```
On check-out by employee E:
  1. Find today's attendance record for E.
  2. If none exists or check_in is null: REJECT "Must check in first".
  3. If check_out is already set: REJECT "Already checked out".
  4. UPDATE check_out = NOW().
  5. Compute and store worked_hours:
     worked_hours = EXTRACT(EPOCH FROM (check_out - check_in)) / 3600
                    - (schedule_break_minutes / 60)
```

### Manual Correction

```
On manual edit by manager M for employee E on date D:
  1. Update check_in / check_out as specified.
  2. Recompute worked_hours.
  3. Set is_manual_edit = TRUE, edited_by = M.id.
```

### Status Derivation

The `status` field is derived/computed and stored for fast reads:

```
For employee E on date D:
  IF D is in company_holidays (is_paid = TRUE):
    status = 'holiday'
  ELIF there is an approved time_off_request covering D:
    IF time_off_type.attendance_impact = 'present':
      status = 'special_leave'
    ELSE:
      status = 'on_leave'
  ELIF attendance record exists with check_in:
    status = 'present'
  ELIF D is a scheduled workday for E:
    status = 'absent'
  ELSE:
    → D is a non-workday (weekend etc.); no attendance record needed
```

### Overtime Computation [P2]

```
For attendance record on date D for employee E:
  contract = active contract for E on date D
  policy = contract.overtime_policy (if any)
  schedule_line = schedule line for day_of_week(D) from contract.schedule

  IF D is a company holiday:
    IF worked_hours > 0:
      overtime_hours = worked_hours
      overtime_type = 'holiday_work'

  ELIF schedule_line is NULL or schedule_line.is_active = FALSE:
    (non-workday — weekend etc.)
    IF worked_hours > 0:
      overtime_hours = worked_hours
      overtime_type = 'rest_day_work'

  ELSE:
    (regular workday)
    scheduled_hours = (end_time - start_time) - break_minutes/60
    extra = worked_hours - scheduled_hours
    IF extra > 0 AND (policy IS NULL OR extra > some_threshold):
      overtime_hours = extra
      overtime_type = 'regular_ot'
    ELSE:
      overtime_hours = 0
      overtime_type = NULL

  Store overtime_hours and overtime_type on the attendance record.
```

> **Key insight:** Working 10 AM–7 PM on a 9 AM–6 PM schedule is NOT overtime. `worked_hours (9h) = scheduled_hours (9h)`, so `extra = 0`.

---

## 10. Company Holidays [P0]

### Permissions

| Action | Allowed Roles |
|--------|---------------|
| CRUD | `hr_payroll_manager`, `admin` |
| Read | All roles |

### Validation Rules

- `date` must be unique (one holiday per date).
- `name` is required.
- Cannot create holidays in the past for pay periods that are already `paid`.

### Impact on Other Modules

1. **Attendance:** Holiday dates are excluded from absentee counting.
2. **Leave Requests:** `number_of_days` computation skips holidays.
3. **Payslips:** Holidays count as paid days (if `is_paid = TRUE`); do not consume leave quota.
4. **Overtime:** Working on a holiday triggers `holiday_work` overtime classification.

---

## 11. Overtime Policies [P2]

### Permissions

| Action | Allowed Roles |
|--------|---------------|
| CRUD | `hr_payroll_manager`, `admin` |
| Read | `hr_manager`, `hr_payroll_user`, `hr_payroll_manager`, `admin` |

### Validation Rules

- If `threshold_type = 'daily_hours'`: `daily_threshold_hrs` must be set.
- If `threshold_type = 'weekly_hours'`: `weekly_threshold_hrs` must be set.
- `multiplier > 0`.

### Integration

- Assigned to contracts via `contracts.overtime_policy_id`.
- Used during attendance overtime computation (see Attendance section).
- If `compensatory_off = TRUE`: overtime triggers auto comp-off allocation instead of OT pay.

---

## 12. Pay Runs

### Permissions

| Action | Allowed Roles |
|--------|---------------|
| Create | `hr_payroll_user`, `hr_payroll_manager`, `admin` |
| Read | `hr_payroll_user`, `hr_payroll_manager`, `admin` |
| Compute / Validate / Mark Paid | `hr_payroll_manager`, `admin` |
| Cancel | `hr_payroll_manager`, `admin` (only from `draft` or `computed`) |

### Creation Wizard (Two-Step)

**Step 1 — Define Scope:**
```
Input: salary_structure_id, start_date, end_date
Validation:
  - end_date >= start_date
  - salary_structure must be active
  - No existing pay run with the exact same structure + period (warn, don't block)
```

**Step 2 — Select Employees:**
```
Eligible employees = users WHERE:
  employment_status = 'active'
  AND is_active = TRUE
  AND EXISTS (active contract overlapping [start_date, end_date])

UI allows filter/sort by: department, employee_type, name, etc.
Manager selects specific employees from this list.
```

**On "Create Payrun" click:**
```
1. INSERT into pay_runs (name, salary_structure_id, start_date, end_date, status='draft', created_by)
2. INSERT into pay_run_employees for each selected employee
3. Return the new pay_run record (do NOT compute payslips yet)
```

### Status Transitions

```
draft → computed       (on "Compute" action)
computed → validated   (on "Validate" action — requires all payslips reviewed or warning-free)
validated → paid       (on "Mark Paid" action)
draft → cancelled      (HR cancels)
computed → cancelled   (HR cancels; deletes computed payslips)
```

### Duplicate Payslip Detection

```
On compute, for each selected employee E:
  recent_unpaid = SELECT * FROM payslips
    WHERE employee_id = E.id
      AND status NOT IN ('paid', 'cancelled')
    ORDER BY created_at DESC
    LIMIT 2

  FOR each existing_payslip in recent_unpaid:
    existing_payrun = SELECT * FROM pay_runs WHERE id = existing_payslip.pay_run_id
    IF date_ranges_overlap(
        [existing_payrun.start_date, existing_payrun.end_date],
        [this_payrun.start_date, this_payrun.end_date]
    ):
      → Add warning: DUPLICATE_PAYSLIP on the new payslip
```

---

## 13. Payslips & Payslip Lines

### Permissions

| Action | Allowed Roles |
|--------|---------------|
| Read | `hr_payroll_user`, `hr_payroll_manager`, `admin`; Own: employees |
| Compute (via payrun) | `hr_payroll_manager`, `admin` |
| Review/Acknowledge | `hr_payroll_manager`, `admin` |
| Generate PDF | `hr_payroll_user`, `hr_payroll_manager`, `admin` |
| Send via email | `hr_payroll_manager`, `admin` |

### Computation Flow (Per Employee)

This is the core payroll engine. Triggered when a Pay Run's "Compute" action is called.

```
FOR each employee E in pay_run_employees:

  1. ── Find applicable contracts ──
     contracts = SELECT * FROM contracts
       WHERE employee_id = E.id
         AND status = 'active'
         AND start_date <= payrun.end_date
         AND (end_date IS NULL OR end_date >= payrun.start_date)
       ORDER BY start_date ASC

     IF contracts is empty:
       → Create payslip with warning: NO_ACTIVE_CONTRACT
       → Skip salary computation; set gross = net = 0
       → CONTINUE

  2. ── Determine if pro-ration needed ──  [P0]
     IF len(contracts) == 1:
       → single_contract_mode
     ELIF len(contracts) > 1:
       → pro_ration_mode (mid-period contract change)
       → Add warning: MULTIPLE_CONTRACTS / PRORATED_PAYSLIP

  3. ── Compute segments ──
     segments = []
     FOR each contract C in contracts:
       seg_start = MAX(C.start_date, payrun.start_date)
       seg_end   = MIN(C.end_date ?? payrun.end_date, payrun.end_date)
       segments.append({contract: C, start: seg_start, end: seg_end})

  4. ── For each segment, compute salary lines ──
     all_lines = []
     FOR each segment S:
       total_workdays = count_workdays(payrun.start_date, payrun.end_date, S.contract.schedule)
       segment_workdays = count_workdays(S.start, S.end, S.contract.schedule)
                          - count_holidays(S.start, S.end)
                          - count_unpaid_leaves(E.id, S.start, S.end)
       proration_factor = segment_workdays / total_workdays

       rules = SELECT * FROM salary_rules
         WHERE structure_id = S.contract.salary_structure_id
         ORDER BY sequence ASC

       computed_values = {}
       FOR each rule R in rules:
         IF R.rule_type == 'fixed':
           amount = R.fixed_amount * proration_factor
         ELIF R.rule_type == 'percentage':
           base = computed_values[R.base_rule_id]
           amount = base * R.percentage / 100

         computed_values[R.id] = amount

         all_lines.append(PayslipLine{
           rule_id: R.id,
           rule_code: R.code,
           rule_name: R.name,
           category: R.category,
           sequence: R.sequence,
           amount: amount,
           contract_id: S.contract.id,
           segment_start: S.start,
           segment_end: S.end,
           proration_factor: proration_factor
         })

  5. ── Handle unpaid leave deductions ──
     unpaid_leave_days = count leaves for E in period
       WHERE time_off_type.is_paid = FALSE AND status = 'approved'

     IF unpaid_leave_days > 0:
       per_day_salary = gross_salary / total_workdays
       deduction = per_day_salary * unpaid_leave_days
       → Add a payslip line: category='deduction', code='UNPAID_LV', amount = -deduction
       → Add warning: UNPAID_LEAVE_DEDUCTION

  6. ── Compute aggregates ──
     gross_salary = SUM(amount) WHERE category IN ('basic', 'allowance', 'gross')
     total_deductions = SUM(ABS(amount)) WHERE category = 'deduction'
     net_salary = SUM(all line amounts)  -- deductions are negative

  7. ── Compute worked days/hours ──
     worked_days = COUNT(attendance) WHERE employee_id = E.id
       AND date BETWEEN payrun.start_date AND payrun.end_date
       AND status IN ('present', 'special_leave')
       + count holidays in period

     worked_hours = SUM(attendance.worked_hours) for same filter

  8. ── Generate warnings ──
     (See Warnings System section)

  9. ── Persist ──
     INSERT payslip (pay_run_id, employee_id, contract_id, gross_salary,
       net_salary, total_deductions, worked_days, worked_hours, status='computed', warnings)
     INSERT payslip_lines (all_lines)
```

### Payslip Line Snapshot Rule

> **CRITICAL:** Payslip lines are **snapshots**. Once computed, they must NEVER be re-derived from live salary_rules. The `rule_name`, `rule_code`, `category`, and `amount` are frozen at compute time. If salary rules change later, existing payslips remain accurate.

### PDF Generation

Pull payslip + payslip_lines + employee + contract data and render into a PDF template. Group lines by `category` for display.

### Bulk Email

On "Send Payslips" from a payrun:
```
FOR each payslip in payrun WHERE status IN ('validated', 'paid'):
  Generate PDF for payslip
  Send email to employee.email with PDF attachment
```

---

## 14. Cross-Cutting: Payroll Computation Engine

### Workday Counting Function

```
count_workdays(start_date, end_date, schedule_id):
  schedule_days = active schedule_lines for schedule_id → set of day_of_week values
  count = 0
  FOR each date D in [start_date, end_date]:
    IF day_of_week(D) IN schedule_days:
      count += 1
  RETURN count
```

### Holiday-Aware Workday Counting

```
count_effective_workdays(start_date, end_date, schedule_id, employee_id):
  raw = count_workdays(start_date, end_date, schedule_id)
  holidays_on_workdays = COUNT(company_holidays)
    WHERE date BETWEEN start_date AND end_date
      AND day_of_week(date) IN (active schedule days)
  unpaid_leaves = COUNT(time_off_requests)
    WHERE employee_id = employee_id
      AND status = 'approved'
      AND time_off_type.is_paid = FALSE
      AND dates overlap [start_date, end_date]
  RETURN raw - holidays_on_workdays
```

### Contract Resolution for a Period

```
resolve_contracts(employee_id, period_start, period_end):
  RETURN SELECT * FROM contracts
    WHERE employee_id = employee_id
      AND status = 'active'
      AND start_date <= period_end
      AND (end_date IS NULL OR end_date >= period_start)
    ORDER BY start_date ASC
```

### Salary Rule Execution Engine

```
execute_rules(structure_id, proration_factor):
  rules = SELECT * FROM salary_rules
    WHERE structure_id = structure_id
    ORDER BY sequence ASC

  results = {}
  FOR each rule R:
    IF R.rule_type == 'fixed':
      results[R.id] = R.fixed_amount * proration_factor
    ELIF R.rule_type == 'percentage':
      results[R.id] = results[R.base_rule_id] * R.percentage / 100

  RETURN results
```

---

## 15. Cross-Cutting: Warnings System

### Warning Types & Triggers

| Warning Code | Trigger Condition | Severity |
|---|---|---|
| `NO_ACTIVE_CONTRACT` | No active contract found overlapping pay period | 🔴 Error |
| `MULTIPLE_CONTRACTS` | >1 contract overlaps pay period (pro-ration applied) | 🟡 Info |
| `PRORATED_PAYSLIP` | Payslip was pro-rated across contract segments | 🟡 Info |
| `MISSING_BANK_DETAILS` | Employee has NULL `bank_name` or `bank_account` | 🟠 Warning |
| `MISSING_DATA` | Required employee fields are missing | 🟠 Warning |
| `DUPLICATE_PAYSLIP` | Overlapping unpaid payslip exists for this employee | 🔴 Error |
| `UNREVIEWED_ATTENDANCE` | Attendance records with `is_manual_edit = FALSE` and missing check-outs | 🟠 Warning |
| `MISSING_CHECKIN_DAYS` | Workdays with no attendance and no leave request | 🟠 Warning |
| `UNPAID_LEAVE_DEDUCTION` | Unpaid leave days were deducted from salary | 🟡 Info |
| `COMP_OFF_CREDITED` | Compensatory off days credited from overtime | 🟡 Info |
| `HOLIDAY_WORK_DETECTED` | Employee worked on company holiday(s) | 🟡 Info |

### Warning Storage

Warnings are stored as a JSONB array on the payslip:

```json
[
  {
    "code": "MISSING_BANK_DETAILS",
    "severity": "warning",
    "message": "No bank account on file for John Doe",
    "details": { "employee_id": 42 }
  },
  {
    "code": "PRORATED_PAYSLIP",
    "severity": "info",
    "message": "Payslip pro-rated across 2 contract segments",
    "details": { "segments": 2 }
  }
]
```

### Validation Gate

When the pay run's "Validate" action is triggered:

```
FOR each payslip in pay_run:
  has_errors = any warning with severity = 'error'
  IF has_errors AND payslip.is_reviewed == FALSE:
    → BLOCK validation
    → Return: "Payslip for {employee} has unreviewed errors. Please review and acknowledge."

IF all payslips are either warning-free OR is_reviewed = TRUE:
  → Set pay_run.status = 'validated'
  → Set pay_run.validated_at = NOW()
  → Set all payslips status = 'validated'
ELSE:
  → REJECT with list of unreviewed payslips
```

---

## Implementation Priority Mapping

| Priority | Systems | Schema Ready | App Logic Needed |
|----------|---------|:---:|---|
| 🔴 P0 | Users, Contracts, Schedules, Salary Structures/Rules, Pay Runs, Payslips, Payslip Lines, Holidays, Mid-period pro-ration | ✅ | CRUD APIs, payroll computation engine, contract resolution |
| 🟡 P1 | Time Off (types, allocations, requests), Attendance, Special leaves (`attendance_impact`), Warning system, Review gate | ✅ | Leave balance logic, attendance derivation, warning generation |
| 🟢 P2 | Overtime policies, Overtime computation, Compensatory offs | ✅ | OT calculation, auto comp-off allocation |
| ⚪ P3 | OT spanning two contracts, Weekly OT thresholds, Comp-off expiry | ✅ | Extend pro-ration logic to OT; enforce expiry dates |

> **All priorities are schema-supported from day one.** The tables and columns for P2/P3 features exist but can remain unused until app logic is implemented. This means you can ship P0+P1 features and incrementally add P2/P3 without any database migrations.

---

## API Endpoint Reference (Suggested)

| Module | Endpoints |
|--------|-----------|
| Auth | `POST /auth/login`, `POST /auth/register` |
| Users | `GET/POST /users`, `GET/PUT/DELETE /users/:id` |
| Departments | `GET/POST /departments`, `GET/PUT/DELETE /departments/:id` |
| Schedules | `GET/POST /schedules`, `GET/PUT/DELETE /schedules/:id`, `GET/POST/PUT/DELETE /schedules/:id/lines` |
| Salary Structures | `GET/POST /salary-structures`, `GET/PUT/DELETE /salary-structures/:id` |
| Salary Rules | `GET/POST /salary-structures/:id/rules`, `PUT/DELETE /salary-rules/:id`, `PUT /salary-rules/:id/reorder` |
| Contracts | `GET/POST /contracts`, `GET/PATCH /contracts/:id` (only end_date, status) |
| Time Off Types | `GET/POST /time-off-types`, `GET/PUT/DELETE /time-off-types/:id` |
| Allocations | `GET/POST /allocations`, `GET /allocations/:id`, `PUT /allocations/:id/approve`, `PUT /allocations/:id/refuse` |
| Leave Requests | `GET/POST /leave-requests`, `GET /leave-requests/:id`, `PUT /leave-requests/:id/approve`, `PUT /leave-requests/:id/refuse`, `PUT /leave-requests/:id/withdraw` |
| Attendance | `POST /attendance/check-in`, `POST /attendance/check-out`, `GET /attendance`, `PUT /attendance/:id` (manual correction) |
| Holidays | `GET/POST /holidays`, `GET/PUT/DELETE /holidays/:id` |
| Pay Runs | `GET/POST /pay-runs`, `GET /pay-runs/:id`, `POST /pay-runs/:id/compute`, `POST /pay-runs/:id/validate`, `POST /pay-runs/:id/mark-paid`, `POST /pay-runs/:id/send-payslips` |
| Payslips | `GET /payslips`, `GET /payslips/:id`, `POST /payslips/:id/review`, `GET /payslips/:id/pdf` |
| Dashboard | `GET /dashboard/payroll?period=...&department=...&employee_type=...` |
