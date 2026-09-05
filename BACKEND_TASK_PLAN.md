# PeoplePay360 — Backend Task Plan

> **Deadline:** Sep 6, 2026 at 10:00 AM IST
> **Time remaining at plan creation:** ~19 hrs (~8-10 productive coding hours per person)

---

## Team Roles

| | Member 1 (M1) — **Backend Lead** | Member 2 (M2) — **CRUD & Integrator** |
|---|---|---|
| **Strengths** | DB schema mastery, complex business logic | Frontend context, CRUD patterns, simple calculations |
| **Owns** | Auth middleware, contracts, leave logic, payroll engine, dashboard | Auth endpoints, all simple CRUD modules, list filters, payslip reads |

---

## Key Design Decisions (vs. Frontend API Doc)

> The `API_ENDPOINTS.md` was written from a frontend perspective. Below are changes to align with the DB schema and business logic.

| Decision | Rationale |
|---|---|
| **Merge Users + Employees** into `/employees` | DB has a single `users` table. No separate user entity needed. Admin-only user management is just employee CRUD with a role filter. |
| **No `DELETE` on Contracts** | Business logic forbids deletion. Use `PATCH` to change `status` and `end_date` only. |
| **Attendance: check-in / check-out actions** instead of generic `POST /attendance` | Business logic defines specific check-in/check-out flows with validation. Keep a `PUT /:id` for manual corrections by HR. |
| **Drop `DELETE` on Time Off Requests** | Requests use status transitions (`withdraw`), not deletion. |
| **Drop fields not in DB** | `gender`, `panNumber`, `workLocation`, `company`, `color`, `personalEmail`, `timezone` — not in schema. Don't fake them. |
| **`period` as `start_date` + `end_date`** (not a string) | DB stores dates, not period strings. Frontend can derive display strings. |
| **Drop `Formula` rule type** | Schema only supports `fixed` and `percentage`. The `Formula` type in the API doc has no DB backing. |
| **Skip Overtime Policies CRUD** | Marked P2 in business logic. Table exists with seed data. Build only if time permits. |

---

## Consolidated Endpoint List (85 endpoints)

### Foundation & Auth (5)

| # | Method | Endpoint | Owner | Complexity |
|---|--------|----------|-------|------------|
| 1 | `POST` | `/auth/login` | M2 | Simple |
| 2 | `GET` | `/auth/me` | M2 | Simple |
| 3 | — | Auth middleware (JWT verify) | M1 | Medium |
| 4 | — | RBAC middleware (`authorize(...roles)`) | M1 | Medium |
| 5 | — | Shared utilities (DB pool, error helpers, pagination) | M1 | Medium |

### Departments (5) & Job Positions (5)

| # | Method | Endpoint | Owner | Complexity |
|---|--------|----------|-------|------------|
| 6-10 | CRUD | `/departments` , `/departments/:id` | M2 | Simple |
| 11-15 | CRUD | `/job-positions` , `/job-positions/:id` | M2 | Simple |

### Employees (9)

| # | Method | Endpoint | Owner | Complexity |
|---|--------|----------|-------|------------|
| 16 | `GET` | `/employees` | M2 | Simple (filters: search, department, status, role) |
| 17 | `POST` | `/employees` | M2 | Simple (hash password, validate email unique) |
| 18 | `GET` | `/employees/:id` | M2 | Simple |
| 19 | `PUT` | `/employees/:id` | M1 | Medium (termination side-effects) |
| 20 | `DELETE` | `/employees/:id` | M2 | Simple (soft-delete: `is_active = false`) |
| 21 | `GET` | `/employees/:id/contracts` | M2 | Simple |
| 22 | `GET` | `/employees/:id/attendance` | M2 | Simple |
| 23 | `GET` | `/employees/:id/time-off/requests` | M2 | Simple |
| 24 | `GET` | `/employees/:id/time-off/allocations` | M2 | Simple |

### Working Schedules (5)

| # | Method | Endpoint | Owner | Complexity |
|---|--------|----------|-------|------------|
| 25 | `GET` | `/schedules` | M2 | Simple |
| 26 | `POST` | `/schedules` | M2 | Medium (accept `lines[]` in body, auto-compute `total_weekly_hours`) |
| 27 | `GET` | `/schedules/:id` | M2 | Simple (include lines in response) |
| 28 | `PUT` | `/schedules/:id` | M2 | Medium (recompute `total_weekly_hours` on line changes) |
| 29 | `DELETE` | `/schedules/:id` | M2 | Simple (block if referenced by active contract) |

### Company Holidays (5)

| # | Method | Endpoint | Owner | Complexity |
|---|--------|----------|-------|------------|
| 30-34 | CRUD | `/holidays` , `/holidays/:id` | M2 | Simple |

### Salary Structures (5)

| # | Method | Endpoint | Owner | Complexity |
|---|--------|----------|-------|------------|
| 35 | `GET` | `/salary-structures` | M2 | Simple (include rule count, employee count) |
| 36 | `POST` | `/salary-structures` | M2 | Simple |
| 37 | `GET` | `/salary-structures/:id` | M2 | Simple (include associated rules) |
| 38 | `PUT` | `/salary-structures/:id` | M2 | Simple (block if active contract references it) |
| 39 | `DELETE` | `/salary-structures/:id` | M2 | Simple (block if active contract references it) |

### Salary Rules (5)

| # | Method | Endpoint | Owner | Complexity |
|---|--------|----------|-------|------------|
| 40 | `GET` | `/salary-structures/:structureId/rules` | M2 | Simple |
| 41 | `POST` | `/salary-structures/:structureId/rules` | M1 | Medium (sequence/dependency validation) |
| 42 | `GET` | `/salary-rules/:id` | M2 | Simple |
| 43 | `PUT` | `/salary-rules/:id` | M1 | Medium (reorder validation, base_rule dependency check) |
| 44 | `DELETE` | `/salary-rules/:id` | M2 | Simple (block if other rules depend on it) |

### Contracts (4)

| # | Method | Endpoint | Owner | Complexity |
|---|--------|----------|-------|------------|
| 45 | `GET` | `/contracts` | M2 | Simple (filters: employee, status) |
| 46 | `POST` | `/contracts` | M1 | **Hard** (overlap check, active contract expiry side-effect) |
| 47 | `GET` | `/contracts/:id` | M2 | Simple |
| 48 | `PATCH` | `/contracts/:id` | M1 | **Hard** (status transitions only, validation) |

### Time Off Types (5)

| # | Method | Endpoint | Owner | Complexity |
|---|--------|----------|-------|------------|
| 49-53 | CRUD | `/time-off-types` , `/time-off-types/:id` | M2 | Simple |

### Time Off Allocations (6)

| # | Method | Endpoint | Owner | Complexity |
|---|--------|----------|-------|------------|
| 54 | `GET` | `/allocations` | M2 | Simple (filters: employee, status, type) |
| 55 | `POST` | `/allocations` | M1 | Medium (validate type requires allocation, no duplicate overlap) |
| 56 | `GET` | `/allocations/:id` | M2 | Simple (include computed `remaining`) |
| 57 | `DELETE` | `/allocations/:id` | M2 | Simple (only if `status = 'draft'`) |
| 58 | `POST` | `/allocations/:id/approve` | M1 | Medium (set approved_by, approved_at, status) |
| 59 | `POST` | `/allocations/:id/refuse` | M1 | Simple |

### Time Off Requests (6)

| # | Method | Endpoint | Owner | Complexity |
|---|--------|----------|-------|------------|
| 60 | `GET` | `/leave-requests` | M2 | Simple (filters: employee, status, type) |
| 61 | `POST` | `/leave-requests` | M1 | **Hard** (compute `number_of_days` from schedule, check balance, link allocation) |
| 62 | `GET` | `/leave-requests/:id` | M2 | Simple |
| 63 | `POST` | `/leave-requests/:id/approve` | M1 | **Hard** (update allocation.taken, set approver) |
| 64 | `POST` | `/leave-requests/:id/refuse` | M1 | Simple |
| 65 | `POST` | `/leave-requests/:id/withdraw` | M1 | Simple (only from `pending`) |

### Attendance (5)

| # | Method | Endpoint | Owner | Complexity |
|---|--------|----------|-------|------------|
| 66 | `GET` | `/attendance` | M2 | Simple (filters: employee, date range, status) |
| 67 | `GET` | `/attendance/:id` | M2 | Simple |
| 68 | `POST` | `/attendance/check-in` | M1 | Medium (idempotency, duplicate check) |
| 69 | `POST` | `/attendance/check-out` | M1 | Medium (compute worked_hours using schedule breaks) |
| 70 | `PUT` | `/attendance/:id` | M1 | Medium (manual correction: recompute hours, set audit fields) |

### Pay Runs (8)

| # | Method | Endpoint | Owner | Complexity |
|---|--------|----------|-------|------------|
| 71 | `GET` | `/pay-runs` | M2 | Simple |
| 72 | `POST` | `/pay-runs` | M1 | **Hard** (wizard: validate structure, insert pay_run + pay_run_employees) |
| 73 | `GET` | `/pay-runs/:id` | M2 | Simple (include payslip summary list) |
| 74 | `POST` | `/pay-runs/:id/compute` | M1 | **🔴 CRITICAL** (THE payroll computation engine) |
| 75 | `POST` | `/pay-runs/:id/validate` | M1 | Medium (review gate, warning check) |
| 76 | `POST` | `/pay-runs/:id/mark-paid` | M1 | Simple (status transition) |
| 77 | `POST` | `/pay-runs/:id/send-payslips` | M2 | Simple (placeholder/nodemailer stub) |
| 78 | `GET` | `/pay-runs/eligible-employees` | M1 | Medium (active employees with overlapping contracts) |

### Payslips (4)

| # | Method | Endpoint | Owner | Complexity |
|---|--------|----------|-------|------------|
| 79 | `GET` | `/payslips` | M2 | Simple (filters: payrunId, employee, status) |
| 80 | `GET` | `/payslips/:id` | M2 | Simple (include payslip_lines grouped by category) |
| 81 | `POST` | `/payslips/:id/review` | M2 | Simple (set `is_reviewed = true`, `reviewed_by`, `reviewed_at`) |
| 82 | `GET` | `/payslips/:id/pdf` | M1 | Medium (use pdfkit/puppeteer to render) |

### Dashboard (3)

| # | Method | Endpoint | Owner | Complexity |
|---|--------|----------|-------|------------|
| 83 | `GET` | `/dashboard/summary` | M1 | **Hard** (aggregate queries across all modules) |
| 84 | `GET` | `/dashboard/salary-by-dept` | M2 | Medium (single aggregate query) |
| 85 | `GET` | `/dashboard/monthly-trend` | M2 | Medium (single aggregate query) |

---

## Execution Order (5 Phases)

> Both members work in **parallel** within each phase. Dependencies between phases are noted. Phases are time-boxed — if a task isn't done, move on and circle back.

---

### 🔵 Phase 1 — Foundation (1.5 hrs) `3:00 PM – 4:30 PM`

> Goal: Everyone can make authenticated API calls by the end of this phase.

| M1 — Backend Lead | M2 — CRUD & Integrator |
|---|---|
| Set up DB connection pool (`pg` Pool) | `POST /auth/login` (bcrypt compare → JWT sign) |
| Create shared error-response helper (`AppError` class) | `GET /auth/me` (decode JWT → return user) |
| Create pagination utility | `GET/POST` `/departments` , `/departments/:id` `PUT/DELETE` |
| **Auth middleware** (JWT verify → `req.user`) | `GET/POST` `/job-positions` , `/job-positions/:id` `PUT/DELETE` |
| **RBAC middleware** (`authorize('admin','hr_manager')`) | — |

**Deliverable:** Auth works end-to-end. Shared utils importable by both members.

---

### 🟢 Phase 2 — Core Entities (2.5 hrs) `4:30 PM – 7:00 PM`

> Goal: All master data CRUD is complete. Contracts can be created and managed.

| M1 — Backend Lead | M2 — CRUD & Integrator |
|---|---|
| `POST /contracts` (overlap validation, auto-expire old) | `GET/POST/GET/:id/PUT/:id/DELETE` `/employees` (CRUD + filters) |
| `PATCH /contracts/:id` (status transitions only) | Employee sub-resources: `/:id/contracts`, `/:id/attendance`, `/:id/time-off/*` |
| `PUT /employees/:id` (termination side-effects) | `GET/POST/GET/:id/PUT/:id/DELETE` `/schedules` (with lines + `total_weekly_hours` compute) |
| `POST /salary-structures/:structureId/rules` (sequence + dependency validation) | `GET/POST/GET/:id/PUT/:id/DELETE` `/time-off-types` |
| `PUT /salary-rules/:id` (reorder validation) | `GET/POST/GET/:id/PUT/:id/DELETE` `/holidays` |
| — | `GET/POST/GET/:id/PUT/:id/DELETE` `/salary-structures` |
| — | `GET /salary-structures/:structureId/rules`, `GET/DELETE /salary-rules/:id` |

**Deliverable:** Full employee + contract + schedule + salary config management.

---

### 🟡 Phase 3 — Time Tracking (2.5 hrs) `7:00 PM – 9:30 PM`

> Goal: Attendance check-in/out works. Leave requests with balance checking work end-to-end.

| M1 — Backend Lead | M2 — CRUD & Integrator |
|---|---|
| `POST /attendance/check-in` | `GET /attendance` (with date range + employee filters) |
| `POST /attendance/check-out` (compute worked_hours) | `GET /attendance/:id` |
| `PUT /attendance/:id` (manual correction + audit) | `GET /allocations` (with filters) |
| `POST /allocations` (validate type, no duplicate overlap) | `GET /allocations/:id` (with computed `remaining`) |
| `POST /allocations/:id/approve` , `/refuse` | `DELETE /allocations/:id` (only if draft) |
| `POST /leave-requests` (compute `number_of_days`, balance check) | `GET /leave-requests` (with filters) |
| `POST /leave-requests/:id/approve` (update `allocation.taken`) | `GET /leave-requests/:id` |
| `POST /leave-requests/:id/refuse` , `/withdraw` | `GET /contracts` (with filters), `GET /contracts/:id` |

**Deliverable:** Full attendance + leave lifecycle works. Allocation balances are accurate.

---

### 🔴 Phase 4 — Payroll Engine (3 hrs) `9:30 PM – 12:30 AM`

> **This is the most critical phase.** The payroll compute engine is the centrepiece of the hackathon.

| M1 — Backend Lead | M2 — CRUD & Integrator |
|---|---|
| Build `payrollEngine` service module: | `GET /pay-runs` (list with filters) |
| → `resolveContracts(employeeId, start, end)` | `GET /pay-runs/:id` (include payslip summary) |
| → `countWorkdays(start, end, scheduleId)` | `GET /payslips` (filters: payrun, employee, status) |
| → `countHolidays(start, end)` | `GET /payslips/:id` (include lines grouped by category) |
| → `countUnpaidLeaves(empId, start, end)` | `POST /payslips/:id/review` (set `is_reviewed`) |
| → `executeRules(structureId, prorationFactor)` | `POST /pay-runs/:id/send-payslips` (stub: log + 200 OK) |
| → `generateWarnings(employee, contracts, attendance)` | — |
| `POST /pay-runs` (wizard: create + select employees) | — |
| `GET /pay-runs/eligible-employees` | — |
| `POST /pay-runs/:id/compute` (🔴 orchestrates the engine) | — |
| `POST /pay-runs/:id/validate` (review gate) | — |
| `POST /pay-runs/:id/mark-paid` | — |

**⚠️ The `compute` endpoint is the single hardest piece. M1 must build and test it carefully. Use the seed data (5 employees, 1 salary structure with 7 rules) as the test case.**

**Deliverable:** A pay run can be created, computed (with correct payslip lines), validated, and marked paid.

---

### ⚪ Phase 5 — Dashboard & Polish (2 hrs) `Morning 7:00 AM – 9:00 AM`

> Goal: Dashboard returns real data. PDF generation works. All filters working.

| M1 — Backend Lead | M2 — CRUD & Integrator |
|---|---|
| `GET /dashboard/summary` (the big aggregate query) | `GET /dashboard/salary-by-dept` |
| `GET /payslips/:id/pdf` (pdfkit or html-pdf) | `GET /dashboard/monthly-trend` |
| Bug fixes & edge cases from integration testing | Verify all list endpoint filters work |
| — | Verify response shapes match frontend expectations |

**Deliverable:** Dashboard returns live data. Payslip PDF downloads. System is demo-ready.

---

## M1's Critical-Path: The Payroll Computation Engine

These are shared utility functions M1 should build inside `services/payroll.engine.js` during Phase 4. They are reused across multiple endpoints:

```
┌──────────────────────────────────────────────────┐
│              payrollEngine.js                     │
├──────────────────────────────────────────────────┤
│ resolveContracts(employeeId, periodStart, end)   │ → used by: compute, eligible-employees
│ countWorkdays(startDate, endDate, scheduleId)    │ → used by: compute, leave-requests
│ countHolidays(startDate, endDate)                │ → used by: compute, leave-requests
│ countUnpaidLeaves(empId, startDate, endDate)     │ → used by: compute
│ executeRules(structureId, contractWage, factor)  │ → used by: compute
│ generateWarnings(employee, contracts, attendance)│ → used by: compute
│ computePayslip(employee, payrun, contracts)      │ → orchestrator: calls all above
└──────────────────────────────────────────────────┘
```

**Important:** The `BASIC` rule's `fixed_amount` in the DB is `0.00` — it's a template placeholder. During computation, the **contract's `wage`** field must be used as the actual BASIC amount. The engine must substitute `contract.wage` for any rule with `code = 'BASIC'`.

---

## Final Endpoint Ownership Summary

| Owner | Simple | Medium | Hard | Total |
|-------|--------|--------|------|-------|
| **M1** | 4 | 12 | 8 | **24** |
| **M2** | 48 | 13 | 0 | **61** |

> M2 has more endpoints numerically, but they are all CRUD following the same pattern — copy-paste-adapt. M1 has fewer but each requires careful business logic.

---

## What to Cut If Behind Schedule

| Priority | What to cut | Impact |
|----------|-------------|--------|
| 1st cut | `send-payslips` (email) | Just return a stub 200. Frontend shows success toast. |
| 2nd cut | `payslips/:id/pdf` | Skip PDF. Frontend can display payslip data on-screen. |
| 3rd cut | Dashboard endpoints | Hardcode reasonable mock data in the response. |
| 4th cut | Overtime computation on attendance | Leave `overtime_hours = 0` everywhere. It's P2. |
| 5th cut | Salary rule reorder validation | Just do basic sequence uniqueness check, skip dependency graph validation. |

**Do NOT skip:** Auth, Employee CRUD, Contracts, Working Schedules, Salary Structures/Rules CRUD, Pay Runs, and the Compute endpoint. These form the core demo flow: **Employee → Contract → Pay Run → Compute → Payslip**.

---

## Suggested File Structure

```
server/src/
├── app.js                          # Express app setup
├── config/
│   ├── db.js                       # pg Pool singleton
│   └── init.sql                    # Schema + seed
├── middlewares/
│   ├── auth.js                     # JWT verification
│   ├── authorize.js                # Role-based access control
│   └── errorHandler.js             # Global error handler
├── utils/
│   ├── AppError.js                 # Custom error class
│   ├── catchAsync.js               # Async route wrapper
│   └── paginate.js                 # Pagination helper
├── routes/
│   ├── auth.routes.js
│   ├── employee.routes.js
│   ├── department.routes.js
│   ├── jobPosition.routes.js
│   ├── schedule.routes.js
│   ├── contract.routes.js
│   ├── timeOffType.routes.js
│   ├── allocation.routes.js
│   ├── leaveRequest.routes.js
│   ├── attendance.routes.js
│   ├── holiday.routes.js
│   ├── salaryStructure.routes.js
│   ├── salaryRule.routes.js
│   ├── payRun.routes.js
│   ├── payslip.routes.js
│   └── dashboard.routes.js
├── controllers/                    # Thin: parse req → call service → send res
│   └── (mirrors routes)
├── services/                       # Business logic lives here
│   ├── auth.service.js
│   ├── employee.service.js
│   ├── contract.service.js
│   ├── attendance.service.js
│   ├── leaveRequest.service.js
│   ├── allocation.service.js
│   ├── payroll.engine.js           # 🔴 M1's crown jewel
│   └── dashboard.service.js
├── repositories/                   # Raw SQL queries
│   └── (one per table/entity)
└── lib/                            # Shared helpers
    └── dateUtils.js                # Workday counting, date range overlap, etc.
```

---

## Quick-Start Checklist (Before Coding)

- [ ] `npm install pg bcryptjs jsonwebtoken dotenv cors express`
- [ ] Create `.env` with `DATABASE_URL`, `JWT_SECRET`, `PORT`
- [ ] Run `init.sql` against your local Postgres instance
- [ ] Verify seed data loaded (5 employees, 5 contracts, 7 salary rules)
- [ ] Agree on response envelope: `{ success: true, data: ... }` or flat responses
- [ ] Agree on error format: `{ success: false, error: { code, message } }`
