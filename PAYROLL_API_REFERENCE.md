# Payroll API Reference

**Audience:** frontend engineers building the Payrun wizard, Payrun processing screen, Payslip
computation screen, and payroll dashboard.
**You should not need to read any server code to use this document.**

Covers the 12 payroll endpoints: `/api/pay-runs` (9) and `/api/payslips` (3).
For every other module (employees, contracts, attendance, time off, salary structures) see
`API_ENDPOINTS.md`.

Every request/response example below was captured from a real call against the seeded
development database, not written by hand.

---

## Table of Contents

1. [Basics — base URL, auth, envelopes](#1-basics)
2. [⚠️ Number & date types (read this first)](#2--number--date-types-read-this-first)
3. [Permissions](#3-permissions)
4. [The status lifecycle](#4-the-status-lifecycle)
5. [Endpoints — Pay Runs](#5-endpoints--pay-runs)
6. [Endpoints — Payslips](#6-endpoints--payslips)
7. [Object reference](#7-object-reference)
8. [Warning codes](#8-warning-codes)
9. [Error catalogue](#9-error-catalogue)
10. [Recipes — wiring the screens](#10-recipes--wiring-the-screens)
11. [Known issues & gaps](#11-known-issues--gaps)

---

## 1. Basics

**Base URL:** `http://localhost:5001/api`

### Authentication

Auth is a **HttpOnly cookie** named `token`, set by `POST /api/auth/login`. There is no bearer
token to manage and no way to read the cookie from JavaScript.

Every `fetch` **must** send credentials or you will get a 401:

```js
fetch('http://localhost:5001/api/pay-runs', { credentials: 'include' })
```

```js
// axios: set once, globally
axios.defaults.withCredentials = true;
```

The server sends `Access-Control-Allow-Credentials` and echoes a single origin
(`CLIENT_ORIGIN`, default `http://localhost:5173`). A wildcard origin will not work with
credentialed requests.

### Success envelope

```json
{ "success": true, "data": { } }
```

List endpoints add a `count`:

```json
{ "success": true, "count": 3, "data": [ ] }
```

`data` is the object; everything documented below describes the contents of `data`.

### Error envelopes — there are two, and they differ

Business errors (404 / 409 / 400) come from the app's error handler:

```json
{ "success": false, "error": "Pay run is not in draft state" }
```

Auth failures (401 / 403) come from the auth middleware **before** that handler, and use a
different shape — no `success`, and the key is `message`, not `error`:

```json
{ "message": "Authentication required. No token provided." }
```

Write your error extractor to tolerate both:

```js
const msg = body?.error ?? body?.message ?? 'Request failed';
```

---

## 2. ⚠️ Number & date types (read this first)

**This is the single most likely thing to break your UI.**

PostgreSQL `DECIMAL` columns are serialised by the driver as **JSON strings**, so money read
back from a payslip is `"113600.00"`, not `113600`. But values the engine computes in memory
(the compute summary, the `totals` roll-up, a pay run's `total_net`) are real **numbers**.

The same logical quantity therefore has a different type depending on which endpoint you got
it from:

| Field | `POST /pay-runs/:id/compute` | `GET /payslips/:id` |
|---|---|---|
| `gross_salary` | `113600` *(number)* | `"113600.00"` *(string)* |
| `net_salary` | `103800` *(number)* | `"103800.00"` *(string)* |
| `worked_days` | `1` *(number)* | `"1.00"` *(string)* |

Consequences if you ignore this:

```js
payslip.gross_salary.toFixed(2)        // TypeError — it's a string
payslip.gross_salary + payslip.net_salary  // "113600.00103800.00"  ← concatenation
payslip.gross_salary > 100000          // works by coercion, but by luck
```

**Always coerce at the API boundary.** A one-line normaliser saves you all of it:

```js
const n = (v) => (v === null || v === undefined ? null : Number(v));
```

### Quick type table

| Returned as a **string** | Returned as a **number** |
|---|---|
| `gross_salary`, `net_salary`, `total_deductions`, `worked_days`, `worked_hours` on a **payslip** object | the same fields inside the **compute summary** |
| `amount`, `proration_factor` on a **payslip line** | `totals.*` on `GET /payslips/:id` |
| `wage` on an eligible-employee row | `total_net`, `employee_count`, `contract_count` on a pay run |
| | `payslips_updated`, `payslips_generated`, `line_count`, all `warning_counts` |

### Sign convention: deductions are negative

Every line with `category: "deduction"` is stored **negative** — `PF`, `PT`, and the synthetic
`UNPAID_LV` alike. Every other category is positive. So you can sum lines safely:

```js
const n = (v) => Number(v);
const deductionTotal = slip.lines
  .filter((l) => l.category === 'deduction')
  .reduce((a, l) => a + n(l.amount), 0);      // e.g. -26028.57
```

The payslip's own `total_deductions` column is the same figure as a **positive magnitude**, and
the two are related by a guaranteed invariant:

```
totals.deduction === -payslip.total_deductions
net_salary       === gross_salary - total_deductions
```

Use `total_deductions` when you want to print "Total Deductions: ₹26,028.57", and the signed
line amounts when you want a running ledger that adds up to net. Don't mix them.

### Dates

- **Date-only fields** — `start_date`, `end_date`, `segment_start`, `segment_end`,
  `contract_start`, `contract_end` — are plain `'YYYY-MM-DD'` strings, deliberately **not**
  ISO timestamps. They are calendar dates with no timezone. Render them directly; do **not**
  round-trip them through `new Date(...).toISOString()`, which shifts them a day in any
  timezone behind UTC (IST included).
- **Timestamps** — `created_at`, `updated_at`, `validated_at`, `paid_at`, `reviewed_at` — are
  full ISO-8601 UTC strings (`"2026-09-05T21:46:46.168Z"`). These are real instants; `new Date()`
  is correct for them.

Send dates the same way you receive them: `"2026-10-01"`. A non-`YYYY-MM-DD` string is
rejected with 400.

---

## 3. Permissions

Roles come from the JWT. The three relevant groups:

| Group | Roles |
|---|---|
| **Read** | `admin`, `hr_payroll_manager`, `hr_payroll_user` |
| **Manage runs** | `admin`, `hr_payroll_manager`, `hr_payroll_user` |
| **Process payroll** | `admin`, `hr_payroll_manager` — **not** `hr_payroll_user` |

| Endpoint | Required |
|---|---|
| `GET /pay-runs`, `GET /pay-runs/:id` | Read |
| `GET /pay-runs/eligible-employees` | Manage runs |
| `POST /pay-runs`, `PUT /pay-runs/:id` | Manage runs |
| `DELETE /pay-runs/:id` | **Process payroll** |
| `POST /pay-runs/:id/compute` | **Process payroll** |
| `POST /pay-runs/:id/validate` | **Process payroll** |
| `POST /pay-runs/:id/mark-paid` | **Process payroll** |
| `GET /payslips`, `GET /payslips/:id` | Read |
| `POST /payslips/:id/review` | Manage runs |

**UI implication:** an `hr_payroll_user` can build a pay run but cannot compute, validate,
mark paid, or delete it. Disable those four buttons for that role — the server returns
`403 { "message": "Access denied. Insufficient permissions." }`.

`employee` and `hr_manager` have **no** payroll access at all. There is currently no
"employee views their own payslip" endpoint.

---

## 4. The status lifecycle

```
draft ──compute──> computed ──validate──> validated ──mark-paid──> paid
```

Each transition is **one-way**, and each action requires an exact starting status:

| Action | Requires | Result |
|---|---|---|
| `compute` | `draft` | `computed` |
| `validate` | `computed` | `validated` |
| `mark-paid` | `validated` | `paid` |
| `PUT` (rename) | `draft` | stays `draft` |
| `DELETE` | `draft` | gone |

Anything else returns **409**. In particular:

> **`compute` is not repeatable.** Once it succeeds the run is `computed`, so calling it again
> returns `409 "Pay run is not in draft state"`. There is no "recompute" — if the numbers are
> wrong, delete the draft (or abandon the run) and create a new one. Do not build a UI that
> offers Compute twice.

Payslips carry their own `status` which follows the parent run: `computed` → `validated` →
`paid`. You never set it directly.

---

## 5. Endpoints — Pay Runs

### 5.1 `GET /api/pay-runs` — list

Query params (all optional):

| Param | Meaning |
|---|---|
| `status` | `draft` \| `computed` \| `validated` \| `paid` \| `cancelled` |
| `start_date` | `YYYY-MM-DD` — keeps runs **ending on or after** this date |
| `end_date` | `YYYY-MM-DD` — keeps runs **starting on or before** this date |

Supply both dates to get runs overlapping a window. Sorted by `start_date` descending.

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 14,
      "name": "October 2026 Payroll",
      "salary_structure_id": 1,
      "start_date": "2026-10-01",
      "end_date": "2026-10-31",
      "status": "computed",
      "created_by": 1,
      "validated_at": null,
      "paid_at": null,
      "created_at": "2026-09-05T21:46:46.168Z",
      "updated_at": "2026-09-05T21:46:46.205Z",
      "structure_name": "India Standard CTC",
      "created_by_name": "Anish Goenka",
      "employee_count": 2,
      "total_net": 137200
    }
  ]
}
```

`employee_count` and `total_net` are pre-aggregated — the list view needs no follow-up calls.
`total_net` is `0` until the run is computed.

---

### 5.2 `GET /api/pay-runs/eligible-employees` — wizard step 2

**Required** query params (400 if absent): `start_date`, `end_date` (`YYYY-MM-DD`,
`end_date >= start_date`).
Optional: `department_id`, `employee_type` (`full_time` \| `part_time` \| `contract` \| `intern`).

Returns active employees who hold at least one **active contract overlapping the period** —
**one row per (employee, contract)**, so an employee mid-contract-change appears more than once.

```
GET /api/pay-runs/eligible-employees?start_date=2026-10-01&end_date=2026-10-31
```

```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "id": 3,
      "first_name": "Rahul",
      "last_name": "Verma",
      "email": "rahul@peoplepay.dev",
      "employee_type": "full_time",
      "department_name": "Engineering",
      "job_position_title": "Software Engineer",
      "contract_id": 3,
      "wage": "80000.00",
      "contract_start": "2024-06-10",
      "contract_end": null,
      "contract_count": 1,
      "has_overlapping_payslip": false
    }
  ]
}
```

Two fields exist specifically to drive wizard badges:

- **`contract_count > 1`** — this employee's pay will be **prorated** across contract segments.
  Because rows are per-contract, group by `id` before rendering the picker.
- **`has_overlapping_payslip: true`** — a non-paid payslip already covers this period.
  Selecting them anyway produces a `DUPLICATE_PAYSLIP` **error** warning that blocks validation
  until reviewed. Warn in the UI; don't hard-block.

`contract_end: null` means an open-ended contract.

An employee with **no** active contract in the period simply does not appear. If you select
them anyway (their id is accepted), they get a zeroed payslip with `NO_ACTIVE_CONTRACT`.

---

### 5.3 `POST /api/pay-runs` — create

```json
{
  "name": "October 2026 Payroll",
  "salary_structure_id": 1,
  "start_date": "2026-10-01",
  "end_date": "2026-10-31",
  "employee_ids": [3, 5]
}
```

| Field | Required | Notes |
|---|---|---|
| `salary_structure_id` | ✅ | Must exist and be `active` |
| `start_date`, `end_date` | ✅ | `YYYY-MM-DD`, `end_date >= start_date` |
| `employee_ids` | ✅ | Non-empty array of positive integers; duplicates de-duplicated silently |
| `name` | — | Defaults to `PR/YYYY/MMM` from `start_date` (`2026-10-01` → `"PR/2026/OCT"`) |

**`201 Created`:**

```json
{
  "success": true,
  "data": {
    "id": 14,
    "name": "October 2026 Payroll",
    "salary_structure_id": 1,
    "start_date": "2026-10-01",
    "end_date": "2026-10-31",
    "status": "draft",
    "created_by": 1,
    "validated_at": null,
    "paid_at": null,
    "created_at": "2026-09-05T21:46:46.168Z",
    "updated_at": "2026-09-05T21:46:46.168Z",
    "employee_count": 2
  }
}
```

`created_by` is taken from the session cookie — do not send it. Keep the returned `id`; it
drives every subsequent call.

Creating a run does **not** create payslips. `status` is `draft` and `payslips` is empty until
you compute.

---

### 5.4 `GET /api/pay-runs/:id` — the processing screen

Returns the run plus a summary row per payslip. This is the one call the Payrun processing
screen needs.

```json
{
  "success": true,
  "data": {
    "id": 14,
    "name": "October 2026 Payroll",
    "start_date": "2026-10-01",
    "end_date": "2026-10-31",
    "status": "computed",
    "structure_id": 1,
    "structure_name": "India Standard CTC",
    "created_by_name": "Anish Goenka",
    "employee_count": 2,
    "total_net": 137200,
    "validated_at": null,
    "paid_at": null,
    "payslips": [
      {
        "id": 17,
        "employee_id": 3,
        "employee_name": "Rahul Verma",
        "department_name": "Engineering",
        "gross_salary": "113600.00",
        "net_salary": "103800.00",
        "total_deductions": "9800.00",
        "worked_days": "1.00",
        "worked_hours": "0.00",
        "status": "computed",
        "is_reviewed": false,
        "warnings": [
          {
            "code": "MISSING_CHECKIN_DAYS",
            "severity": "warning",
            "message": "21 workdays have no attendance and no approved leave",
            "details": { "employee_id": 3, "count": 21 }
          }
        ]
      }
    ]
  }
}
```

`payslips` is `[]` before compute. Each row carries its full `warnings` array, so you can render
the warning banner and the per-row error badges without fetching each payslip.

**To decide whether Validate should be enabled:**

```js
const blocked = data.payslips.some(
  (p) => !p.is_reviewed && p.warnings.some((w) => w.severity === 'error')
);
```

---

### 5.5 `POST /api/pay-runs/:id/compute` — run the engine

No request body. Requires `draft`. Generates a payslip and its snapshot lines for every
selected employee, then moves the run to `computed`.

Returns a **summary** (all money here is a **number**):

```json
{
  "success": true,
  "data": {
    "pay_run_id": 14,
    "status": "computed",
    "payslips_generated": 2,
    "total_gross": 150200,
    "total_net": 137200,
    "total_deductions": 13000,
    "warning_counts": { "error": 0, "warning": 3, "info": 0 },
    "payslips": [
      {
        "id": 17,
        "employee_id": 3,
        "contract_id": 3,
        "gross_salary": 113600,
        "net_salary": 103800,
        "total_deductions": 9800,
        "worked_days": 1,
        "worked_hours": 0,
        "status": "computed",
        "line_count": 7,
        "warnings": [ ]
      }
    ]
  }
}
```

`warning_counts` is the headline for the post-compute toast: *"2 payslips generated, 3 warnings,
0 errors."* If `warning_counts.error > 0`, validation will be blocked until those payslips are
reviewed.

**Warnings never abort computation.** A payslip is always produced for every selected employee —
including a zeroed one for an employee with no contract. Compute failing outright means a real
error (bad status, inactive structure, empty selection), not a data problem.

This call is O(employees) with several queries each; for a large run show a spinner and expect
a few seconds.

---

### 5.6 `POST /api/pay-runs/:id/validate` — the review gate

No body. Requires `computed`. Moves the run **and all its payslips** to `validated`.

```json
{
  "success": true,
  "data": {
    "id": 14,
    "status": "validated",
    "validated_at": "2026-09-05T21:46:46.225Z",
    "paid_at": null,
    "payslips_updated": 2
  }
}
```

*(The full pay run row is returned; only the interesting fields are shown.)*

**Blocked with 409 while any payslip has an unreviewed error-severity warning:**

```json
{ "success": false, "error": "Unreviewed error payslips exist: Neha Patel, Arjun Mehta" }
```

The message names the employees. Recover by calling `POST /api/payslips/:id/review` on each,
then validating again. Only `NO_ACTIVE_CONTRACT` and `DUPLICATE_PAYSLIP` are error-severity;
`warning` and `info` never block.

---

### 5.7 `POST /api/pay-runs/:id/mark-paid`

No body. Requires `validated`. Same response shape as validate, with `status: "paid"` and a
`paid_at` timestamp.

Terminal state: a paid run cannot be recomputed, renamed, or deleted. Paid payslips also stop
counting toward `DUPLICATE_PAYSLIP` on future runs for the same period.

---

### 5.8 `PUT /api/pay-runs/:id` — rename

```json
{ "name": "October 2026 Payroll (revised)" }
```

`name` is the **only** mutable field — period, structure and employee selection are fixed at
creation. Draft only (409 otherwise). 400 if `name` is missing or blank.

---

### 5.9 `DELETE /api/pay-runs/:id`

Draft only — 409 for computed / validated / paid, so finalised payroll is preserved as history.
Returns `{ "success": true, "data": { "id": 14 } }`.

---

## 6. Endpoints — Payslips

### 6.1 `GET /api/payslips` — list

Optional query params: `pay_run_id`, `employee_id`, `status`. Sorted newest first.

Rows carry `employee_name`, `pay_run_name`, `structure_name`, and the period as `start_date` /
`end_date` (**the pay run's** period, not the payslip's), plus every payslip column.

`GET /api/payslips?employee_id=3&status=paid` is the payroll-history view for one employee.

---

### 6.2 `GET /api/payslips/:id` — the salary computation screen

Returns the payslip, its `lines`, and a `totals` roll-up.

```json
{
  "success": true,
  "data": {
    "id": 17,
    "pay_run_id": 14,
    "employee_id": 3,
    "contract_id": 3,
    "gross_salary": "113600.00",
    "net_salary": "103800.00",
    "total_deductions": "9800.00",
    "worked_days": "1.00",
    "worked_hours": "0.00",
    "status": "computed",
    "is_reviewed": false,
    "reviewed_by": null,
    "reviewed_at": null,
    "employee_name": "Rahul Verma",
    "department_name": "Engineering",
    "job_position_title": "Software Engineer",
    "pay_run_name": "October 2026 Payroll",
    "structure_name": "India Standard CTC",
    "start_date": "2026-10-01",
    "end_date": "2026-10-31",
    "warnings": [ ],
    "lines": [
      { "id": 100, "rule_id": 1, "rule_code": "BASIC", "rule_name": "Basic Salary",
        "category": "basic",     "sequence": 10,  "amount": "80000.00",
        "contract_id": 3, "segment_start": "2026-10-01", "segment_end": "2026-10-31",
        "proration_factor": "1.0000" },
      { "id": 101, "rule_id": 2, "rule_code": "HRA", "rule_name": "House Rent Allowance",
        "category": "allowance", "sequence": 20,  "amount": "32000.00",
        "contract_id": 3, "segment_start": "2026-10-01", "segment_end": "2026-10-31",
        "proration_factor": "1.0000" },
      { "id": 102, "rule_id": 3, "rule_code": "CONV", "rule_name": "Conveyance Allowance",
        "category": "allowance", "sequence": 30,  "amount": "1600.00",  "…": "…" },
      { "id": 103, "rule_id": 4, "rule_code": "GROSS", "rule_name": "Gross Salary",
        "category": "gross",     "sequence": 100, "amount": "113600.00", "…": "…" },
      { "id": 104, "rule_id": 5, "rule_code": "PF", "rule_name": "Provident Fund",
        "category": "deduction", "sequence": 110, "amount": "-9600.00", "…": "…" },
      { "id": 105, "rule_id": 6, "rule_code": "PT", "rule_name": "Professional Tax",
        "category": "deduction", "sequence": 120, "amount": "-200.00",  "…": "…" },
      { "id": 106, "rule_id": 7, "rule_code": "NET", "rule_name": "Net Salary",
        "category": "net",       "sequence": 200, "amount": "103800.00", "…": "…" }
    ],
    "totals": {
      "basic": 80000, "allowance": 33600, "gross": 113600,
      "deduction": -9800, "net": 103800
    }
  }
}
```

**Render the breakdown by iterating `lines` in the given order** — they arrive sorted by
`sequence`, which is the order the engine executed them, so `GROSS` lands after the earnings
and `NET` last. Use `rule_name` as the label and `category` for styling.

> **Prefer the payslip's own `gross_salary`, `total_deductions` and `net_salary`** — they are
> the authoritative aggregates. `totals` is a faithful signed roll-up of the lines and agrees
> with them, but note `totals.deduction` is **negative** (see
> [sign convention](#sign-convention-deductions-are-negative)), and `totals.gross` / `totals.net`
> repeat per segment on a prorated payslip.

**Lines are an immutable snapshot.** `rule_code`, `rule_name`, `category`, `sequence` and
`amount` were copied from the salary rule at compute time, so editing or deleting a salary rule
later never alters a historical payslip. `rule_id` may be `null` (synthetic lines) or point at a
rule that has since changed — trust the snapshot fields, not `rule_id`.

**Proration metadata.** For a single-contract payslip every line has
`proration_factor: "1.0000"` and the segment dates equal the period. For an employee whose
contract changed mid-period, `payslip.contract_id` is `null` and there is **one line per rule
per contract segment** — e.g. two `BASIC` rows, each with its own `contract_id`,
`segment_start`/`segment_end`, and a fractional `proration_factor` (the factors sum to 1.0000).
Group by `contract_id` to render segments separately.

---

### 6.3 `POST /api/payslips/:id/review`

No body. Sets `is_reviewed: true` and records `reviewed_by` (from your session) and
`reviewed_at`. Returns the updated payslip row (without `lines`).

This is purely an acknowledgement — it recomputes nothing and changes no amount. Its only
effect is to unblock `validate`.

409 for a payslip already `paid` or `cancelled`.

---

## 7. Object reference

### PayRun

| Field | Type | Notes |
|---|---|---|
| `id` | number | |
| `name` | string | |
| `salary_structure_id` / `structure_id` | number | `structure_id` only on detail |
| `structure_name` | string | |
| `start_date`, `end_date` | `YYYY-MM-DD` | |
| `status` | enum | `draft` \| `computed` \| `validated` \| `paid` \| `cancelled` |
| `created_by` / `created_by_name` | number / string | |
| `employee_count` | number | selected employees |
| `total_net` | number | sum of payslip net; `0` before compute |
| `validated_at`, `paid_at` | ISO timestamp \| null | |
| `payslips` | PayslipSummary[] | **detail endpoint only** |

### PayslipSummary (inside `GET /pay-runs/:id`)

`id`, `employee_id`, `employee_name`, `department_name`, `gross_salary`*, `net_salary`*,
`total_deductions`*, `worked_days`*, `worked_hours`*, `status`, `is_reviewed`, `warnings[]`
— *(\* string)*

### Payslip

All of PayslipSummary's money fields (as strings) plus `pay_run_id`, `contract_id`
(**`null` for a prorated multi-contract payslip**), `reviewed_by`, `reviewed_at`,
`created_at`, `updated_at`, `employee_name`, `pay_run_name`, `structure_name`,
`department_name`, `job_position_title`, `start_date`, `end_date`, and on the detail endpoint
`lines[]` and `totals`.

### PayslipLine

| Field | Type | Notes |
|---|---|---|
| `rule_id` | number \| null | `null` for synthetic lines (`OT_PAY`, `UNPAID_LV`) |
| `rule_code` | string | `BASIC`, `HRA`, `CONV`, `GROSS`, `PF`, `PT`, `NET`, `OT_PAY`, `UNPAID_LV` |
| `rule_name` | string | display label |
| `category` | enum | `basic` \| `allowance` \| `gross` \| `deduction` \| `net` |
| `sequence` | number | render order; `OT_PAY` = 9000, `UNPAID_LV` = 9998 |
| `amount` | **string** | **Negative for `category: "deduction"`**, positive otherwise — see [sign convention](#sign-convention-deductions-are-negative) |
| `contract_id` | number \| null | which contract segment produced this line |
| `segment_start`, `segment_end` | `YYYY-MM-DD` \| null | `null` on `UNPAID_LV` |
| `proration_factor` | **string** \| null | `"1.0000"` = full period; `null` on synthetic lines |

`worked_days` counts attendance days marked present/special-leave **plus** paid company
holidays that fall on scheduled workdays — which is why a month with no attendance records can
still show `worked_days: "1.00"` (one paid holiday) with `worked_hours: "0.00"`.

### Warning

```json
{ "code": "MISSING_BANK_DETAILS", "severity": "warning",
  "message": "No bank account on file for Arjun Mehta",
  "details": { "employee_id": 5, "fields_missing": ["bank_name", "bank_account"] } }
```

`message` is human-readable and safe to display verbatim. `details` always carries
`employee_id`; other keys vary by code (see below). `severity` is `error` \| `warning` \| `info`.

---

## 8. Warning codes

| Code | Severity | Blocks validate? | `details` keys | Meaning |
|---|---|:---:|---|---|
| `NO_ACTIVE_CONTRACT` | 🔴 error | ✅ until reviewed | `period_start`, `period_end` | No active contract overlaps the period. Payslip is zeroed, `contract_id: null` |
| `DUPLICATE_PAYSLIP` | 🔴 error | ✅ until reviewed | `pay_run_id`, `pay_run_name` | An overlapping non-paid payslip already exists |
| `MULTIPLE_CONTRACTS` | 🔵 info | ❌ | `contract_count` | >1 contract overlaps; pay is prorated |
| `PRORATED_PAYSLIP` | 🔵 info | ❌ | `contract_count` | Payslip spans multiple contract segments |
| `MISSING_BANK_DETAILS` | 🟠 warning | ❌ | `fields_missing[]` | No bank name/account — cannot pay |
| `MISSING_DATA` | 🟠 warning | ❌ | varies | Name or join date missing, or employee not active |
| `UNREVIEWED_ATTENDANCE` | 🟠 warning | ❌ | `count` | Attendance rows with check-in but no check-out |
| `MISSING_CHECKIN_DAYS` | 🟠 warning | ❌ | `count` | Workdays with no attendance and no approved leave |
| `UNPAID_LEAVE_DEDUCTION` | 🔵 info | ❌ | `days`, `per_day_rate`, `deduction_amount` | Unpaid leave was deducted |
| `HOLIDAY_WORK_DETECTED` | 🔵 info | ❌ | `count` | Employee worked a paid company holiday |
| `OT_NO_POLICY` | 🟠 warning | ❌ | `hours` | Overtime hours exist but the contract has no OT policy — **no OT pay generated** |
| `COMP_OFF_CREDITED` | 🔵 info | ❌ | `hours` | Overtime became compensatory off, not pay |
| `NEGATIVE_NET` | 🟠 warning | ❌ | `computed_net`, `gross_salary`, `total_deductions` | Net went negative; **floored to 0** |

Suggested UI: red badge for `error` (with a Review action), amber for `warning`, grey/blue
info chip for `info`. Only the two error codes ever gate the workflow.

---

## 9. Error catalogue

| Status | `error` message | When |
|---|---|---|
| 400 | `Missing required fields: <list>` | `POST /pay-runs` without required fields |
| 400 | `Missing required fields: name` | `PUT` with no/blank name |
| 400 | `Missing required query parameters: <list>` | `eligible-employees` without dates |
| 400 | `start_date and end_date must be ISO dates in YYYY-MM-DD format` | bad date format |
| 400 | `end_date must be greater than or equal to start_date` | inverted period |
| 400 | `employee_ids must contain positive integers, received: <x>` | bad id in array |
| 400 | `salary_structure_id must be a positive integer` | |
| 400 | `Pay run has no selected employees` | compute on a run with an empty selection |
| 401 | `Authentication required. No token provided.` *(`message` key)* | no cookie sent — check `credentials: 'include'` |
| 401 | `Token expired.` *(`message` key)* | re-login |
| 403 | `Access denied. Insufficient permissions.` *(`message` key)* | role lacks the endpoint |
| 404 | `Pay run not found` / `Payslip not found` | |
| 404 | `Salary structure not found` | unknown `salary_structure_id` |
| 409 | `Salary structure is inactive` | structure deactivated |
| 409 | `Pay run is not in draft state` | compute on a non-draft run |
| 409 | `Pay run is not in computed state` | validate at the wrong stage |
| 409 | `Pay run is not in validated state` | mark-paid at the wrong stage |
| 409 | `Unreviewed error payslips exist: <names>` | validate gate |
| 409 | `Only draft pay runs can be edited` / `... deleted` | |
| 409 | `Payslips with status '<status>' cannot be reviewed` | review a paid/cancelled payslip |

---

## 10. Recipes — wiring the screens

### The wizard (B5)

```js
// Step 1 — user picks structure + period. Nothing is created yet.
// Step 2 — fetch the picker:
const res  = await fetch(
  `/api/pay-runs/eligible-employees?start_date=${start}&end_date=${end}`,
  { credentials: 'include' }
);
const { data: rows } = await res.json();

// Rows are per-contract — group before rendering.
const employees = Object.values(
  rows.reduce((acc, r) => {
    (acc[r.id] ??= { ...r, contracts: [] }).contracts.push(r);
    return acc;
  }, {})
);
// badge: e.contract_count > 1 -> "will be prorated"
//        e.has_overlapping_payslip -> "already has a payslip this period"

// "Create Payrun" -> POST /api/pay-runs -> navigate to /payruns/:id
```

### The processing screen (B6)

```js
const { data: run } = await get(`/api/pay-runs/${id}`);

const canCompute  = run.status === 'draft';
const canValidate = run.status === 'computed' && !run.payslips.some(
  (p) => !p.is_reviewed && p.warnings.some((w) => w.severity === 'error')
);
const canMarkPaid = run.status === 'validated';

// after compute, re-fetch the run to refresh payslips[]
```

### Rendering the computation panel (B7)

```js
const { data: slip } = await get(`/api/payslips/${id}`);
const n = (v) => Number(v);

// lines are already in sequence order
slip.lines.map((l) => ({
  label:  l.rule_name,
  code:   l.rule_code,
  group:  l.category,
  amount: n(l.amount),
  // multi-segment payslips repeat each rule per contract:
  segment: l.segment_start ? `${l.segment_start} → ${l.segment_end}` : null,
  prorated: l.proration_factor !== null && n(l.proration_factor) < 1,
}));

// authoritative figures — never re-derive from lines
const gross = n(slip.gross_salary);
const deds  = n(slip.total_deductions);
const net   = n(slip.net_salary);
```

### Clearing the validate gate

```js
try {
  await post(`/api/pay-runs/${id}/validate`);
} catch (e) {
  if (e.status === 409) {
    const blocked = run.payslips.filter(
      (p) => !p.is_reviewed && p.warnings.some((w) => w.severity === 'error')
    );
    // show them, let the user acknowledge each:
    await Promise.all(blocked.map((p) => post(`/api/payslips/${p.id}/review`)));
    await post(`/api/pay-runs/${id}/validate`);
  }
}
```

---

## 11. Known issues & gaps

### `GROSS` / `NET` lines repeat on prorated payslips

On a multi-contract payslip each segment carries its own `GROSS` and `NET` line, and **both
show the whole-payslip total**, not the segment's share. They are display rows only and never
feed the aggregates. When grouping lines by segment, render `GROSS`/`NET` once at the payslip
level rather than inside each segment group.

### Not implemented

- **Payslip PDF** (`GET /payslips/:id/pdf`) — not built.
- **Bulk email** (`POST /pay-runs/:id/send-payslips`) — not built.
- **Payroll dashboard** (`/dashboard/*`) — not built.
- **Employee self-service payslip view** — no endpoint; payroll roles only.
- There is no pagination on any payroll list endpoint; all matching rows are returned.

### Development-environment caveat

The server re-runs `init.sql` on every boot, and that script **drops and recreates every
table**. Pay runs and payslips do not survive a backend restart during development. Re-seeded
IDs restart from 1.

---

*Generated from the implementation on 2026-09-06. Endpoints verified against the running
service; all examples captured from real responses.*
