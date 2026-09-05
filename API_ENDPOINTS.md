# PeoplePay360 — API Endpoint Reference

---

## Base URL

```
/api/v1
```

All endpoints return JSON. Protected routes require `Authorization: Bearer <token>`.

---

## 1. Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | Login and get JWT token |
| `POST` | `/auth/logout` | Invalidate token |
| `GET` | `/auth/me` | Get current authenticated user |

**POST /auth/login — Body**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response**
```json
{
  "token": "string",
  "user": {
    "id": "number",
    "name": "string",
    "email": "string",
    "role": "string"
  }
}
```

---

## 2. Users *(Admin only)*

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users` | List all users |
| `POST` | `/users` | Create a new user |
| `GET` | `/users/:id` | Get user by ID |
| `PUT` | `/users/:id` | Update user (role, status, email) |
| `DELETE` | `/users/:id` | Delete user |

**Query params for GET /users**
- `search` — string (name or email)
- `role` — `Employee | HR Manager | HR Payroll User | HR Payroll Manager | Admin`
- `status` — `Active | Inactive`

**User Object**
```json
{
  "id": "number",
  "name": "string",
  "email": "string",
  "employeeId": "number | null",
  "role": "Employee | HR Manager | HR Payroll User | HR Payroll Manager | Admin",
  "status": "Active | Inactive"
}
```

---

## 3. Employees

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/employees` | List all employees |
| `POST` | `/employees` | Create employee |
| `GET` | `/employees/:id` | Get employee by ID |
| `PUT` | `/employees/:id` | Update employee |
| `DELETE` | `/employees/:id` | Delete employee |
| `GET` | `/employees/:id/contracts` | Contracts linked to employee |
| `GET` | `/employees/:id/attendance` | Attendance records for employee |
| `GET` | `/employees/:id/timeoff/requests` | Time-off requests for employee |
| `GET` | `/employees/:id/timeoff/allocations` | Allocations for employee |

**Query params for GET /employees**
- `search` — string (name / department / jobTitle)
- `department` — string
- `status` — `Active | Inactive`

**Employee Object**
```json
{
  "id": "number",
  "name": "string",
  "initials": "string",
  "email": "string",
  "phone": "string",
  "jobTitle": "string",
  "department": "string",
  "manager": "string",
  "schedule": "string",
  "workLocation": "string",
  "company": "string",
  "status": "Active | Inactive",
  "color": "string",
  "personalEmail": "string",
  "dateOfBirth": "date",
  "gender": "Male | Female | Other",
  "bankAccount": "string",
  "panNumber": "string"
}
```

---

## 4. Contracts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/contracts` | List all contracts |
| `POST` | `/contracts` | Create contract |
| `GET` | `/contracts/:id` | Get contract by ID |
| `PUT` | `/contracts/:id` | Update contract |
| `DELETE` | `/contracts/:id` | Delete contract |

**Query params for GET /contracts**
- `employee` — employee ID
- `status` — `Draft | Running | Expired`

**Contract Object**
```json
{
  "id": "number",
  "ref": "string",
  "employeeId": "number",
  "employeeName": "string",
  "department": "string",
  "jobPosition": "string",
  "startDate": "date",
  "endDate": "date | null",
  "wage": "number",
  "status": "Draft | Running | Expired",
  "schedule": "string",
  "structure": "string"
}
```

> **Business rule:** Only one contract with `status: Running` is allowed per employee at any time. The backend must enforce this and reject concurrent active contracts. Payroll must always use the `Running` contract applicable to the selected pay period.

---

## 5. Working Schedules

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/schedules` | List all working schedules |
| `POST` | `/schedules` | Create schedule |
| `GET` | `/schedules/:id` | Get schedule by ID |
| `PUT` | `/schedules/:id` | Update schedule |
| `DELETE` | `/schedules/:id` | Delete schedule |

**Query params for GET /schedules**
- `search` — string (name)
- `status` — `Active | Inactive`

**Schedule Object**
```json
{
  "id": "number",
  "name": "string",
  "company": "string",
  "timezone": "string",
  "status": "Active | Inactive",
  "daysPerWeek": "number",
  "hoursPerWeek": "number",
  "lines": [
    {
      "day": "Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday",
      "start": "string (HH:MM AM/PM)",
      "end": "string (HH:MM AM/PM)",
      "breakH": "string (e.g. 1h)",
      "hours": "string (computed)"
    }
  ]
}
```

> **Business rule:** `daysPerWeek` and `hoursPerWeek` must be computed server-side from `lines`, not manually entered.

---

## 6. Attendance

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/attendance` | List all attendance records |
| `POST` | `/attendance` | Create attendance record |
| `GET` | `/attendance/:id` | Get record by ID |
| `PUT` | `/attendance/:id` | Update record (manual correction) |
| `DELETE` | `/attendance/:id` | Delete record |

**Query params for GET /attendance**
- `employee` — employee ID
- `status` — `Present | Absent | Late`
- `dateRange` — `today | week | month`
- `from` — ISO date
- `to` — ISO date

**Attendance Object**
```json
{
  "id": "number",
  "employeeId": "number",
  "employeeName": "string",
  "department": "string",
  "manager": "string",
  "checkIn": "datetime",
  "checkOut": "datetime | null",
  "workedHours": "number",
  "overtime": "number",
  "status": "Present | Absent | Late",
  "notes": "string"
}
```

> Records with no `checkOut` are flagged as missing punches on the dashboard. Records whose `notes` contain `"manual"` or `"corrected"` are tracked separately for audit purposes.

---

## 7. Time Off Types

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/timeoff/types` | List all time-off types |
| `POST` | `/timeoff/types` | Create type |
| `GET` | `/timeoff/types/:id` | Get type by ID |
| `PUT` | `/timeoff/types/:id` | Update type |
| `DELETE` | `/timeoff/types/:id` | Delete type |

**Query params for GET /timeoff/types**
- `search` — string (name)
- `status` — `Active | Inactive`

**Time Off Type Object**
```json
{
  "id": "number",
  "name": "string",
  "unit": "Days | Hours",
  "requiresAllocation": "Yes | No",
  "approval": "Manager | Officer | HR Manager | No Validation",
  "payrollEntry": "string",
  "color": "Blue | Green | Orange | Red | Purple",
  "status": "Active | Inactive",
  "notes": "string"
}
```

---

## 8. Time Off Allocations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/timeoff/allocations` | List all allocations |
| `POST` | `/timeoff/allocations` | Create allocation |
| `GET` | `/timeoff/allocations/:id` | Get allocation by ID |
| `PUT` | `/timeoff/allocations/:id` | Update allocation |
| `DELETE` | `/timeoff/allocations/:id` | Delete allocation |
| `POST` | `/timeoff/allocations/:id/approve` | Approve allocation |
| `POST` | `/timeoff/allocations/:id/refuse` | Refuse allocation |

**Query params for GET /timeoff/allocations**
- `employee` — employee ID
- `status` — `To Approve | Approved | Refused`
- `type` — time-off type ID

**Allocation Object**
```json
{
  "id": "number",
  "employeeId": "number",
  "employeeName": "string",
  "typeId": "number",
  "typeName": "string",
  "allocated": "number",
  "taken": "number",
  "remaining": "number",
  "status": "To Approve | Approved | Refused",
  "approver": "string",
  "validity": "string",
  "description": "string"
}
```

> **Business rule:** `remaining` is always computed as `allocated - taken`. An allocation must be `Approved` before its balance becomes available to time-off requests.

---

## 9. Time Off Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/timeoff/requests` | List all requests |
| `POST` | `/timeoff/requests` | Submit a request |
| `GET` | `/timeoff/requests/:id` | Get request by ID |
| `PUT` | `/timeoff/requests/:id` | Update request |
| `DELETE` | `/timeoff/requests/:id` | Delete request |
| `POST` | `/timeoff/requests/:id/approve` | Approve request |
| `POST` | `/timeoff/requests/:id/refuse` | Refuse request |

**Query params for GET /timeoff/requests**
- `employee` — employee ID
- `status` — `Draft | To Approve | Approved | Refused`
- `type` — time-off type ID

**Time Off Request Object**
```json
{
  "id": "number",
  "employeeId": "number",
  "employeeName": "string",
  "typeId": "number",
  "typeName": "string",
  "startDate": "date",
  "endDate": "date",
  "duration": "number",
  "status": "Draft | To Approve | Approved | Refused",
  "approver": "string",
  "allocationUsed": "string",
  "reason": "string"
}
```

> **Business rule:** Approving a request must automatically add `duration` to the matching allocation's `taken` and recompute `remaining`. If the leave type requires allocation and the balance is insufficient, the request should be rejected.

---

## 10. Salary Structures

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/salary/structures` | List all structures |
| `POST` | `/salary/structures` | Create structure |
| `GET` | `/salary/structures/:id` | Get structure by ID (includes linked rules) |
| `PUT` | `/salary/structures/:id` | Update structure |
| `DELETE` | `/salary/structures/:id` | Delete structure |

**Query params for GET /salary/structures**
- `search` — string (name)
- `status` — `Active | Inactive`

**Salary Structure Object**
```json
{
  "id": "number",
  "name": "string",
  "rules": "number",
  "employees": "number",
  "status": "Active | Inactive"
}
```

---

## 11. Salary Rules

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/salary/rules` | List all rules |
| `POST` | `/salary/rules` | Create rule |
| `GET` | `/salary/rules/:id` | Get rule by ID |
| `PUT` | `/salary/rules/:id` | Update rule |
| `DELETE` | `/salary/rules/:id` | Delete rule |

**Query params for GET /salary/rules**
- `structure` — structure name or ID
- `category` — `Basic | Allowance | Gross | Deduction | Net`
- `search` — string (name or code)

**Salary Rule Object**
```json
{
  "id": "number",
  "name": "string",
  "code": "string (e.g. BASIC, HRA, PF)",
  "category": "Basic | Allowance | Gross | Deduction | Net",
  "structure": "string",
  "sequence": "number",
  "computation": "Fixed | Percentage | Formula",
  "value": "string",
  "formula": "string"
}
```

> **Business rule:** Rules are processed in ascending `sequence` order during payslip computation. Later rules (e.g. `GROSS`, `NET`) can reference the computed amounts of earlier rules by their `code`. Fixed = exact amount. Percentage = % of a base rule. Formula = expression using rule codes.

---

## 12. Pay Runs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/payroll/runs` | List all pay runs |
| `POST` | `/payroll/runs` | Create a pay run (wizard result) |
| `GET` | `/payroll/runs/:id` | Get pay run by ID (includes payslip list) |
| `PUT` | `/payroll/runs/:id` | Update pay run metadata |
| `DELETE` | `/payroll/runs/:id` | Delete pay run |
| `POST` | `/payroll/runs/:id/compute` | Compute all payslips in the run |
| `POST` | `/payroll/runs/:id/validate` | Validate computed payslips |
| `POST` | `/payroll/runs/:id/mark-paid` | Mark pay run and all payslips as paid |
| `POST` | `/payroll/runs/:id/send-payslips` | Bulk email payslips to employees |

**Query params for GET /payroll/runs**
- `status` — `Draft | Computed | Validated | Paid`
- `period` — e.g. `Oct 2026`

**POST /payroll/runs — Body** *(from wizard)*
```json
{
  "structure": "string",
  "period": "string (e.g. Oct 2026)",
  "employeeIds": [1, 2, 3]
}
```

**Pay Run Object**
```json
{
  "id": "number",
  "name": "string (auto-generated, e.g. PR/2026/OCT)",
  "structure": "string",
  "period": "string",
  "status": "Draft | Computed | Validated | Paid",
  "employeeCount": "number",
  "totalNet": "number"
}
```

> **Status flow:** `Draft` → `Computed` (via `/compute`) → `Validated` (via `/validate`) → `Paid` (via `/mark-paid`). Each step is irreversible. `/send-payslips` is available once the run is `Validated` or `Paid`.

> **Business rule:** `/compute` uses the `Running` contract for each employee that falls within the pay period. If no running contract exists, a warning is surfaced. Warnings (missing bank details, duplicate payslips) are surfaced before `/validate` is allowed.

---

## 13. Payslips

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/payroll/payslips` | List all payslips |
| `GET` | `/payroll/payslips/:id` | Get payslip by ID (includes salary lines) |
| `GET` | `/payroll/payslips/:id/pdf` | Download payslip as PDF |

**Query params for GET /payroll/payslips**
- `payrunId` — filter by pay run
- `employee` — employee ID
- `period` — e.g. `Oct 2026`
- `status` — `Draft | Computed | Validated | Paid`

**Payslip Object**
```json
{
  "id": "number",
  "payrunId": "number",
  "payrunName": "string",
  "employeeId": "number",
  "employeeName": "string",
  "structure": "string",
  "period": "string",
  "status": "Draft | Computed | Validated | Paid",
  "workedDays": "number",
  "lines": [
    {
      "name": "string",
      "code": "string",
      "category": "Basic | Allowance | Gross | Deduction | Net",
      "amount": "number"
    }
  ]
}
```

> Payslip `lines` are generated by the pay run's `/compute` action, using the employee's active contract for the period and the salary rules of the assigned structure. Deduction amounts are stored as negative numbers.

---

## 14. Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/dashboard/summary` | All KPIs, alerts, and overviews in one call |
| `GET` | `/dashboard/salary-by-dept` | Bar chart data: net salary per department |
| `GET` | `/dashboard/monthly-trend` | Line chart data: monthly net salary totals |

**Query params for all dashboard endpoints**
- `period` — e.g. `Sep 2026`
- `department` — string or `All Departments`
- `employeeType` — `All Types | Full-time | Contract`

**GET /dashboard/summary — Response Shape**
```json
{
  "kpis": {
    "totalNetPaid": "number",
    "payslipsGenerated": "number",
    "paidPayslips": "number",
    "pendingPayslips": "number",
    "avgSalary": "number",
    "approvedTimeOffDays": "number",
    "attendanceHealth": "number (0–100)"
  },
  "alerts": [
    { "type": "warning | danger", "message": "string" }
  ],
  "payslipStatusCounts": {
    "Paid": "number",
    "Validated": "number",
    "Computed": "number",
    "Draft": "number"
  },
  "attendanceOverview": {
    "present": "number",
    "late": "number",
    "absent": "number",
    "overtime": "number",
    "missingCheckouts": "number",
    "manualEdits": "number",
    "coveragePercent": "number"
  },
  "timeOffOverview": [
    {
      "type": "string",
      "approvedDays": "number",
      "pending": "number",
      "remainingBalance": "number"
    }
  ],
  "departmentOverview": [
    {
      "dept": "string",
      "headcount": "number",
      "monthlySalary": "number"
    }
  ]
}
```

**GET /dashboard/salary-by-dept — Response Shape**
```json
[
  { "dept": "string", "amount": "number" }
]
```

**GET /dashboard/monthly-trend — Response Shape**
```json
[
  { "month": "string (e.g. Jan 2026)", "amount": "number" }
]
```

---

## Summary Table

| Module | CRUD Endpoints | Special Actions | Total |
|--------|---------------|-----------------|-------|
| Auth | 3 | login, logout, me | 3 |
| Users | 5 | — | 5 |
| Employees | 5 + 4 sub-resource | — | 9 |
| Contracts | 5 | — | 5 |
| Working Schedules | 5 | — | 5 |
| Attendance | 5 | — | 5 |
| Time Off Types | 5 | — | 5 |
| Time Off Allocations | 5 | approve, refuse | 7 |
| Time Off Requests | 5 | approve, refuse | 7 |
| Salary Structures | 5 | — | 5 |
| Salary Rules | 5 | — | 5 |
| Pay Runs | 5 | compute, validate, mark-paid, send-payslips | 9 |
| Payslips | 2 | PDF download | 3 |
| Dashboard | — | summary, salary-by-dept, monthly-trend | 3 |
| **Total** | | | **76** |

---

## Role Permission Matrix

| Endpoint Group | Employee | HR Manager | HR Payroll User | HR Payroll Manager | Admin |
|----------------|----------|------------|-----------------|-------------------|-------|
| Auth | ✅ | ✅ | ✅ | ✅ | ✅ |
| Users | ❌ | ❌ | ❌ | ❌ | ✅ |
| Employees | Read own | Full CRUD | Full CRUD | Full CRUD | Full CRUD |
| Contracts | Read own | Full CRUD | Full CRUD | Full CRUD | Full CRUD |
| Working Schedules | Read | Full CRUD | Full CRUD | Full CRUD | Full CRUD |
| Attendance | Read/Create own | Full CRUD | Full CRUD | Full CRUD | Full CRUD |
| Time Off Types | Read | Full CRUD | Full CRUD | Full CRUD | Full CRUD |
| Time Off Allocations | Read own | Full CRUD | Full CRUD | Full CRUD | Full CRUD |
| Time Off Requests | Create/Read own | Approve/Refuse | Approve/Refuse | Approve/Refuse | Full CRUD |
| Salary Structures | ❌ | ❌ | Read | Full CRUD | Full CRUD |
| Salary Rules | ❌ | ❌ | Read | Full CRUD | Full CRUD |
| Pay Runs | ❌ | ❌ | Create/Read/Update | Full CRUD | Full CRUD |
| Payslips | Read own | ❌ | Read/Update | Full CRUD | Full CRUD |
| Dashboard | ❌ | Read | Read | Read | Read |
