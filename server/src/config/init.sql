-- ============================================================================
-- PeoplePay360 — PostgreSQL Schema (init.sql)
-- ============================================================================
-- Generated: 2026-09-05
-- DEV-FRIENDLY: This script is fully idempotent.
--   1. Drops ALL tables, triggers, functions, and types from this schema.
--   2. Recreates everything from scratch.
--   3. Seeds dummy data for development/testing.
--
-- Usage:  psql -U <user> -d <db> -f init.sql
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 1: TEAR DOWN (reverse dependency order)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop triggers first (they depend on the function)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users', 'working_schedules', 'salary_structures', 'salary_rules',
      'contracts', 'time_off_types', 'time_off_allocations', 'time_off_requests',
      'attendance', 'pay_runs', 'payslips'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tbl, tbl);
  END LOOP;
END;
$$;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS payslip_lines        CASCADE;
DROP TABLE IF EXISTS payslips              CASCADE;
DROP TABLE IF EXISTS pay_run_employees     CASCADE;
DROP TABLE IF EXISTS pay_runs              CASCADE;
DROP TABLE IF EXISTS attendance            CASCADE;
DROP TABLE IF EXISTS time_off_requests     CASCADE;
DROP TABLE IF EXISTS time_off_allocations  CASCADE;
DROP TABLE IF EXISTS contract_time_off_types CASCADE;
DROP TABLE IF EXISTS time_off_types        CASCADE;
DROP TABLE IF EXISTS contracts             CASCADE;
DROP TABLE IF EXISTS salary_rules          CASCADE;
DROP TABLE IF EXISTS salary_structures     CASCADE;
DROP TABLE IF EXISTS schedule_lines        CASCADE;
DROP TABLE IF EXISTS working_schedules     CASCADE;
DROP TABLE IF EXISTS users                 CASCADE;
DROP TABLE IF EXISTS overtime_policies     CASCADE;
DROP TABLE IF EXISTS company_holidays      CASCADE;
DROP TABLE IF EXISTS job_positions         CASCADE;
DROP TABLE IF EXISTS departments           CASCADE;

-- Drop all custom ENUM types
DROP TYPE IF EXISTS holiday_type           CASCADE;
DROP TYPE IF EXISTS overtime_type          CASCADE;
DROP TYPE IF EXISTS overtime_threshold_type CASCADE;
DROP TYPE IF EXISTS payslip_status         CASCADE;
DROP TYPE IF EXISTS payrun_status          CASCADE;
DROP TYPE IF EXISTS salary_rule_category   CASCADE;
DROP TYPE IF EXISTS salary_rule_type       CASCADE;
DROP TYPE IF EXISTS salary_structure_status CASCADE;
DROP TYPE IF EXISTS leave_request_status   CASCADE;
DROP TYPE IF EXISTS allocation_status      CASCADE;
DROP TYPE IF EXISTS attendance_impact      CASCADE;
DROP TYPE IF EXISTS leave_validation_type  CASCADE;
DROP TYPE IF EXISTS time_off_unit          CASCADE;
DROP TYPE IF EXISTS day_of_week            CASCADE;
DROP TYPE IF EXISTS contract_status        CASCADE;
DROP TYPE IF EXISTS employee_type          CASCADE;
DROP TYPE IF EXISTS employment_status      CASCADE;
DROP TYPE IF EXISTS user_role              CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 2: CREATE ENUMS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE user_role AS ENUM (
  'employee',
  'hr_manager',
  'hr_payroll_user',
  'hr_payroll_manager',
  'admin'
);

CREATE TYPE employment_status AS ENUM (
  'active',
  'on_notice',
  'terminated',
  'inactive'
);

CREATE TYPE employee_type AS ENUM (
  'full_time',
  'part_time',
  'contract',
  'intern'
);

CREATE TYPE contract_status AS ENUM (
  'draft',
  'active',
  'expired',
  'cancelled'
);

CREATE TYPE day_of_week AS ENUM (
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
);

CREATE TYPE time_off_unit AS ENUM (
  'days',
  'hours'
);

CREATE TYPE leave_validation_type AS ENUM (
  'no_validation',
  'hr',
  'manager',
  'both'
);

CREATE TYPE attendance_impact AS ENUM (
  'absent',
  'present',
  'none'
);

CREATE TYPE allocation_status AS ENUM (
  'draft',
  'approved',
  'refused',
  'expired'
);

CREATE TYPE leave_request_status AS ENUM (
  'draft',
  'pending',
  'approved',
  'refused',
  'withdrawn'
);

CREATE TYPE salary_structure_status AS ENUM (
  'active',
  'inactive'
);

CREATE TYPE salary_rule_type AS ENUM (
  'fixed',
  'percentage'
);

CREATE TYPE salary_rule_category AS ENUM (
  'basic',
  'allowance',
  'gross',
  'deduction',
  'net'
);

CREATE TYPE payrun_status AS ENUM (
  'draft',
  'computed',
  'validated',
  'paid',
  'cancelled'
);

CREATE TYPE payslip_status AS ENUM (
  'draft',
  'computed',
  'validated',
  'paid',
  'cancelled'
);

CREATE TYPE overtime_threshold_type AS ENUM (
  'daily_hours',
  'weekly_hours',
  'outside_schedule'
);

CREATE TYPE overtime_type AS ENUM (
  'regular_ot',
  'rest_day_work',
  'holiday_work'
);

CREATE TYPE holiday_type AS ENUM (
  'national',
  'festival',
  'company'
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 3: CREATE TABLES & INDICES
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- FOUNDATION TABLES (no FK dependencies)
-- ─────────────────────────────────────────────────────────────────────────────

-- Departments (simple lookup; can be just a VARCHAR on users if short on time)
CREATE TABLE departments (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Job positions (simple lookup)
CREATE TABLE job_positions (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(100) NOT NULL UNIQUE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Company holiday calendar [P0 edge case]
CREATE TABLE company_holidays (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  date          DATE NOT NULL UNIQUE,
  holiday_type  holiday_type NOT NULL DEFAULT 'company',
  is_paid       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Overtime policies [P2 edge case]
CREATE TABLE overtime_policies (
  id                    SERIAL PRIMARY KEY,
  name                  VARCHAR(100) NOT NULL,
  threshold_type        overtime_threshold_type NOT NULL DEFAULT 'daily_hours',
  daily_threshold_hrs   DECIMAL(5,2),
  weekly_threshold_hrs  DECIMAL(5,2),
  multiplier            DECIMAL(4,2) NOT NULL DEFAULT 1.50,
  compensatory_off      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ─────────────────────────────────────────────────────────────────────────────
-- USERS / EMPLOYEES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                  SERIAL PRIMARY KEY,

  -- Identity
  first_name          VARCHAR(100) NOT NULL,
  last_name           VARCHAR(100) NOT NULL,
  email               VARCHAR(255) NOT NULL UNIQUE,
  phone               VARCHAR(20),
  password_hash       VARCHAR(255) NOT NULL,

  -- Role & status
  role                user_role NOT NULL DEFAULT 'employee',
  employment_status   employment_status NOT NULL DEFAULT 'active',
  employee_type       employee_type NOT NULL DEFAULT 'full_time',
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,

  -- Organizational
  department_id       INT REFERENCES departments(id) ON DELETE SET NULL,
  job_position_id     INT REFERENCES job_positions(id) ON DELETE SET NULL,
  manager_id          INT REFERENCES users(id) ON DELETE SET NULL,

  -- Dates
  date_of_joining     DATE,
  date_of_leaving     DATE,
  date_of_birth       DATE,

  -- Financial (needed for payslip warnings)
  bank_name           VARCHAR(100),
  bank_account        VARCHAR(50),

  -- Address (optional, but useful for payslips)
  address             TEXT,

  -- Metadata
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_manager ON users(manager_id);
CREATE INDEX idx_users_employment_status ON users(employment_status);


-- ─────────────────────────────────────────────────────────────────────────────
-- WORKING SCHEDULES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE working_schedules (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(100) NOT NULL,
  total_weekly_hours  DECIMAL(5,2) NOT NULL DEFAULT 0,  -- recomputed on save
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE schedule_lines (
  id              SERIAL PRIMARY KEY,
  schedule_id     INT NOT NULL REFERENCES working_schedules(id) ON DELETE CASCADE,
  day_of_week     day_of_week NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  break_minutes   INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  UNIQUE (schedule_id, day_of_week)
);

CREATE INDEX idx_schedule_lines_schedule ON schedule_lines(schedule_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- SALARY STRUCTURES & RULES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE salary_structures (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  status      salary_structure_status NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE salary_rules (
  id              SERIAL PRIMARY KEY,
  structure_id    INT NOT NULL REFERENCES salary_structures(id) ON DELETE CASCADE,
  code            VARCHAR(20) NOT NULL,         -- short identifier e.g. "BASIC", "HRA"
  name            VARCHAR(100) NOT NULL,        -- display name
  category        salary_rule_category NOT NULL,
  sequence        INT NOT NULL,                 -- execution order (lower = earlier)
  rule_type       salary_rule_type NOT NULL,

  -- For 'fixed' rules
  fixed_amount    DECIMAL(12,2),

  -- For 'percentage' rules: amount = base_rule's result * percentage / 100
  percentage      DECIMAL(6,2),
  base_rule_id    INT REFERENCES salary_rules(id) ON DELETE RESTRICT,

  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- A rule code must be unique within its structure
  UNIQUE (structure_id, code),
  -- Sequence must be unique within its structure
  UNIQUE (structure_id, sequence),

  -- Constraint: fixed rules need fixed_amount; percentage rules need percentage + base_rule_id
  CONSTRAINT chk_fixed_rule CHECK (
    rule_type != 'fixed' OR fixed_amount IS NOT NULL
  ),
  CONSTRAINT chk_pct_rule CHECK (
    rule_type != 'percentage' OR (percentage IS NOT NULL AND base_rule_id IS NOT NULL)
  )
);

CREATE INDEX idx_salary_rules_structure ON salary_rules(structure_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- CONTRACTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE contracts (
  id                    SERIAL PRIMARY KEY,
  employee_id           INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  schedule_id           INT NOT NULL REFERENCES working_schedules(id) ON DELETE RESTRICT,
  salary_structure_id   INT NOT NULL REFERENCES salary_structures(id) ON DELETE RESTRICT,
  overtime_policy_id    INT REFERENCES overtime_policies(id) ON DELETE SET NULL,  -- [P2]

  -- Terms
  department_id         INT REFERENCES departments(id) ON DELETE SET NULL,
  job_position_id       INT REFERENCES job_positions(id) ON DELETE SET NULL,
  wage                  DECIMAL(12,2) NOT NULL,  -- monthly base wage

  -- Validity
  start_date            DATE NOT NULL,
  end_date              DATE,  -- NULL = open-ended
  status                contract_status NOT NULL DEFAULT 'draft',

  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contracts_employee ON contracts(employee_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_dates ON contracts(start_date, end_date);

-- NOTE: Overlap prevention for active contracts of the same employee is
-- enforced in app logic (PostgreSQL exclusion constraints require btree_gist
-- extension; app logic is simpler for a hackathon).


-- ─────────────────────────────────────────────────────────────────────────────
-- TIME OFF TYPES & ALLOCATIONS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE time_off_types (
  id                    SERIAL PRIMARY KEY,
  name                  VARCHAR(100) NOT NULL UNIQUE,
  unit                  time_off_unit NOT NULL DEFAULT 'days',
  requires_allocation   BOOLEAN NOT NULL DEFAULT TRUE,
  approval_required     BOOLEAN NOT NULL DEFAULT TRUE,
  approver_role         user_role DEFAULT 'hr_manager',
  leave_validation      leave_validation_type NOT NULL DEFAULT 'hr',

  -- [P1] Special attendance impact
  attendance_impact     attendance_impact NOT NULL DEFAULT 'absent',

  -- Payroll impact
  is_paid               BOOLEAN NOT NULL DEFAULT TRUE,  -- FALSE for unpaid leave

  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Junction: which time off types are eligible under a contract
CREATE TABLE contract_time_off_types (
  id                SERIAL PRIMARY KEY,
  contract_id       INT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  time_off_type_id  INT NOT NULL REFERENCES time_off_types(id) ON DELETE RESTRICT,

  UNIQUE (contract_id, time_off_type_id)
);

-- Allocations: balance grants per employee per type
CREATE TABLE time_off_allocations (
  id                SERIAL PRIMARY KEY,
  employee_id       INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  time_off_type_id  INT NOT NULL REFERENCES time_off_types(id) ON DELETE RESTRICT,

  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  allocated_amount  DECIMAL(6,2) NOT NULL,  -- days or hours depending on type's unit
  taken             DECIMAL(6,2) NOT NULL DEFAULT 0,  -- pre-computed; updated on approval

  status            allocation_status NOT NULL DEFAULT 'draft',
  approved_by       INT REFERENCES users(id) ON DELETE SET NULL,
  approved_at       TIMESTAMP,

  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_alloc_dates CHECK (end_date >= start_date),
  CONSTRAINT chk_alloc_taken CHECK (taken <= allocated_amount)
);

CREATE INDEX idx_allocations_employee ON time_off_allocations(employee_id);
CREATE INDEX idx_allocations_type ON time_off_allocations(time_off_type_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- TIME OFF REQUESTS (Leave Requests)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE time_off_requests (
  id                SERIAL PRIMARY KEY,
  employee_id       INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  time_off_type_id  INT NOT NULL REFERENCES time_off_types(id) ON DELETE RESTRICT,
  allocation_id     INT REFERENCES time_off_allocations(id) ON DELETE RESTRICT,  -- NULL for non-allocation types

  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  start_time        TIME,          -- only relevant when unit = 'hours'
  end_time          TIME,          -- only relevant when unit = 'hours'
  number_of_days    DECIMAL(5,2),  -- always stored (computed at request time)
  number_of_hours   DECIMAL(6,2),  -- when unit = 'hours'
  reason            TEXT,

  status            leave_request_status NOT NULL DEFAULT 'draft',
  approver_id       INT REFERENCES users(id) ON DELETE SET NULL,
  approved_at       TIMESTAMP,

  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_requests_employee ON time_off_requests(employee_id);
CREATE INDEX idx_leave_requests_type ON time_off_requests(time_off_type_id);
CREATE INDEX idx_leave_requests_dates ON time_off_requests(start_date, end_date);
CREATE INDEX idx_leave_requests_status ON time_off_requests(status);


-- ─────────────────────────────────────────────────────────────────────────────
-- ATTENDANCE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE attendance (
  id              SERIAL PRIMARY KEY,
  employee_id     INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  date            DATE NOT NULL,
  check_in        TIMESTAMP,
  check_out       TIMESTAMP,
  worked_hours    DECIMAL(5,2),  -- stored for fast reads; derived from check_in/check_out - breaks

  -- Overtime [P2]
  overtime_hours  DECIMAL(5,2) NOT NULL DEFAULT 0,
  overtime_type   overtime_type,

  -- Manual edit audit trail
  is_manual_edit  BOOLEAN NOT NULL DEFAULT FALSE,
  edited_by       INT REFERENCES users(id) ON DELETE SET NULL,

  -- Status: computed in app, but stored for fast list/dashboard reads
  -- 'present','absent','on_leave','holiday','half_day','special_leave'
  status          VARCHAR(20) NOT NULL DEFAULT 'present',

  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- One attendance record per employee per date
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_attendance_employee ON attendance(employee_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_status ON attendance(status);


-- ─────────────────────────────────────────────────────────────────────────────
-- PAY RUNS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE pay_runs (
  id                    SERIAL PRIMARY KEY,
  name                  VARCHAR(200) NOT NULL,

  start_date            DATE NOT NULL,
  end_date              DATE NOT NULL,
  status                payrun_status NOT NULL DEFAULT 'draft',

  created_by            INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  validated_at          TIMESTAMP,
  paid_at               TIMESTAMP,

  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_payrun_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_payruns_dates ON pay_runs(start_date, end_date);
CREATE INDEX idx_payruns_status ON pay_runs(status);

-- Many-to-many: employees selected for a pay run
CREATE TABLE pay_run_employees (
  id            SERIAL PRIMARY KEY,
  pay_run_id    INT NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
  employee_id   INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  UNIQUE (pay_run_id, employee_id)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- PAYSLIPS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE payslips (
  id              SERIAL PRIMARY KEY,
  pay_run_id      INT NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
  employee_id     INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  contract_id     INT REFERENCES contracts(id) ON DELETE RESTRICT,  -- primary contract; NULL if multi-contract pro-ration

  -- Aggregates (stored for fast dashboard / list views)
  gross_salary    DECIMAL(14,2) NOT NULL DEFAULT 0,
  net_salary      DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_deductions DECIMAL(14,2) NOT NULL DEFAULT 0,
  worked_days     DECIMAL(5,2) NOT NULL DEFAULT 0,
  worked_hours    DECIMAL(7,2) NOT NULL DEFAULT 0,

  status          payslip_status NOT NULL DEFAULT 'draft',

  -- Warnings (JSONB array of structured warning objects)
  warnings        JSONB DEFAULT '[]'::JSONB,

  -- Review gate [P1]
  is_reviewed     BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by     INT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMP,

  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- One payslip per employee per pay run
  UNIQUE (pay_run_id, employee_id)
);

CREATE INDEX idx_payslips_payrun ON payslips(pay_run_id);
CREATE INDEX idx_payslips_employee ON payslips(employee_id);
CREATE INDEX idx_payslips_status ON payslips(status);


-- ─────────────────────────────────────────────────────────────────────────────
-- PAYSLIP LINES (Salary Breakdown — SNAPSHOT, never recomputed from live rules)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE payslip_lines (
  id                SERIAL PRIMARY KEY,
  payslip_id        INT NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
  rule_id           INT REFERENCES salary_rules(id) ON DELETE SET NULL,  -- original rule ref (can change; snapshot fields below are authoritative)

  -- Snapshot fields (frozen at compute time)
  rule_code         VARCHAR(20) NOT NULL,
  rule_name         VARCHAR(100) NOT NULL,
  category          salary_rule_category NOT NULL,
  sequence          INT NOT NULL,
  amount            DECIMAL(14,2) NOT NULL,

  -- Pro-ration metadata [P0 — mid-period contract changes]
  contract_id       INT REFERENCES contracts(id) ON DELETE SET NULL,
  segment_start     DATE,
  segment_end       DATE,
  proration_factor  DECIMAL(6,4),  -- 1.0000 = full period, 0.5333 = 16/30, etc.

  computed_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payslip_lines_payslip ON payslip_lines(payslip_id);
CREATE INDEX idx_payslip_lines_category ON payslip_lines(category);


-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 4: UTILITY — updated_at trigger
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users', 'working_schedules', 'salary_structures', 'salary_rules',
      'contracts', 'time_off_types', 'time_off_allocations', 'time_off_requests',
      'attendance', 'pay_runs', 'payslips'
    ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW
         EXECUTE FUNCTION update_updated_at_column()',
      tbl, tbl
    );
  END LOOP;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 5: SEED DUMMY DATA
-- ═══════════════════════════════════════════════════════════════════════════════
-- NOTE: Pay runs and payslips are intentionally NOT seeded.
-- Password hash below is bcrypt for "password123" — for dev/testing only.

-- ─────────────────────────────────────────────────────────────────────────────
-- Departments
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO departments (name) VALUES
  ('Engineering'),
  ('Human Resources'),
  ('Sales'),
  ('Finance');

-- ─────────────────────────────────────────────────────────────────────────────
-- Job Positions
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO job_positions (title) VALUES
  ('Software Engineer'),
  ('HR Manager'),
  ('Sales Executive'),
  ('Finance Analyst'),
  ('Engineering Manager');

-- ─────────────────────────────────────────────────────────────────────────────
-- Company Holidays (2026 sample)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO company_holidays (name, date, holiday_type, is_paid) VALUES
  ('Republic Day',       '2026-01-26', 'national', TRUE),
  ('Holi',               '2026-03-10', 'festival', TRUE),
  ('Independence Day',   '2026-08-15', 'national', TRUE),
  ('Diwali',             '2026-10-20', 'festival', TRUE),
  ('Christmas',          '2026-12-25', 'festival', TRUE),
  ('Company Foundation', '2026-06-01', 'company',  TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- Overtime Policies
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO overtime_policies (name, threshold_type, daily_threshold_hrs, weekly_threshold_hrs, multiplier, compensatory_off) VALUES
  ('Standard OT', 'daily_hours', 8.00, 40.00, 1.50, FALSE);

-- ─────────────────────────────────────────────────────────────────────────────
-- Users (5 employees)
-- ─────────────────────────────────────────────────────────────────────────────
-- password_hash = bcrypt('password123', 10)
INSERT INTO users (first_name, last_name, email, phone, password_hash, role, employment_status, employee_type, department_id, job_position_id, manager_id, date_of_joining, date_of_birth, bank_name, bank_account, address) VALUES
  -- 1: Admin / Engineering Manager (no manager — top-level)
  ('Anish',  'Goenka',   'anish@peoplepay.dev',   '+91-9876500001',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'admin', 'active', 'full_time',
   1, 5, NULL,
   '2024-01-15', '1995-06-20',
   'HDFC Bank', 'HDFC00012345', '42 MG Road, Bengaluru 560001'),

  -- 2: HR Manager (reports to Anish)
  ('Priya',  'Sharma',   'priya@peoplepay.dev',   '+91-9876500002',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'hr_manager', 'active', 'full_time',
   2, 2, 1,
   '2024-03-01', '1993-11-05',
   'ICICI Bank', 'ICICI0067890', '15 Indiranagar, Bengaluru 560038'),

  -- 3: Software Engineer (reports to Anish)
  ('Rahul',  'Verma',    'rahul@peoplepay.dev',   '+91-9876500003',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'active', 'full_time',
   1, 1, 1,
   '2024-06-10', '1998-02-14',
   'SBI', 'SBI000111222', '78 Koramangala, Bengaluru 560034'),

  -- 4: Sales Executive (reports to Anish)
  ('Neha',   'Patel',    'neha@peoplepay.dev',    '+91-9876500004',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'active', 'part_time',
   3, 3, 1,
   '2025-01-20', '1997-08-30',
   'Axis Bank', 'AXIS0033344', '22 Whitefield, Bengaluru 560066'),

  -- 5: Intern — Finance (reports to Priya)
  ('Arjun',  'Mehta',    'arjun@peoplepay.dev',   '+91-9876500005',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'active', 'intern',
   4, 4, 2,
   '2026-07-01', '2003-04-18',
   NULL, NULL, '9 JP Nagar, Bengaluru 560078');

-- ─────────────────────────────────────────────────────────────────────────────
-- Working Schedules
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO working_schedules (name, total_weekly_hours) VALUES
  ('Standard 40h (Mon-Fri)',  40.00),  -- id 1
  ('Part-Time 20h (Mon-Fri)', 20.00); -- id 2

-- Schedule Lines — Standard 40h
INSERT INTO schedule_lines (schedule_id, day_of_week, start_time, end_time, break_minutes) VALUES
  (1, 'monday',    '09:00', '18:00', 60),
  (1, 'tuesday',   '09:00', '18:00', 60),
  (1, 'wednesday', '09:00', '18:00', 60),
  (1, 'thursday',  '09:00', '18:00', 60),
  (1, 'friday',    '09:00', '18:00', 60);

-- Schedule Lines — Part-Time 20h
INSERT INTO schedule_lines (schedule_id, day_of_week, start_time, end_time, break_minutes) VALUES
  (2, 'monday',    '09:00', '13:00', 0),
  (2, 'tuesday',   '09:00', '13:00', 0),
  (2, 'wednesday', '09:00', '13:00', 0),
  (2, 'thursday',  '09:00', '13:00', 0),
  (2, 'friday',    '09:00', '13:00', 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- Salary Structures & Rules
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO salary_structures (name, status) VALUES
  ('India Standard CTC', 'active'),  -- id 1
  ('Senior Management CTC', 'active');  -- id 2

-- Salary rules (sequence determines execution order)
-- BASIC (fixed — overridden per contract via wage, but rule exists as template)
INSERT INTO salary_rules (structure_id, code, name, category, sequence, rule_type, fixed_amount) VALUES
  (1, 'BASIC', 'Basic Salary', 'basic', 10, 'fixed', 0.00);  -- id 1: actual amount comes from contract wage

-- HRA = 40% of BASIC
INSERT INTO salary_rules (structure_id, code, name, category, sequence, rule_type, percentage, base_rule_id) VALUES
  (1, 'HRA', 'House Rent Allowance', 'allowance', 20, 'percentage', 40.00, 1);

-- CONV = fixed conveyance allowance
INSERT INTO salary_rules (structure_id, code, name, category, sequence, rule_type, fixed_amount) VALUES
  (1, 'CONV', 'Conveyance Allowance', 'allowance', 30, 'fixed', 1600.00);

-- GROSS (placeholder — computed in app as sum of basic + allowances)
INSERT INTO salary_rules (structure_id, code, name, category, sequence, rule_type, fixed_amount) VALUES
  (1, 'GROSS', 'Gross Salary', 'gross', 100, 'fixed', 0.00);  -- id 4

-- PF = 12% of BASIC
INSERT INTO salary_rules (structure_id, code, name, category, sequence, rule_type, percentage, base_rule_id) VALUES
  (1, 'PF', 'Provident Fund', 'deduction', 110, 'percentage', 12.00, 1);

-- PT = fixed professional tax
INSERT INTO salary_rules (structure_id, code, name, category, sequence, rule_type, fixed_amount) VALUES
  (1, 'PT', 'Professional Tax', 'deduction', 120, 'fixed', 200.00);

-- NET (placeholder — computed in app as gross - deductions)
INSERT INTO salary_rules (structure_id, code, name, category, sequence, rule_type, fixed_amount) VALUES
  (1, 'NET', 'Net Salary', 'net', 200, 'fixed', 0.00);

-- Salary rules for Senior Management CTC (structure 2)
INSERT INTO salary_rules (structure_id, code, name, category, sequence, rule_type, fixed_amount) VALUES
  (2, 'BASIC', 'Basic Salary', 'basic', 10, 'fixed', 0.00);  -- id 8: actual amount comes from contract wage

-- HRA = 50% of BASIC
INSERT INTO salary_rules (structure_id, code, name, category, sequence, rule_type, percentage, base_rule_id) VALUES
  (2, 'HRA', 'House Rent Allowance', 'allowance', 20, 'percentage', 50.00, 8);

-- CONV = fixed conveyance allowance
INSERT INTO salary_rules (structure_id, code, name, category, sequence, rule_type, fixed_amount) VALUES
  (2, 'CONV', 'Conveyance Allowance', 'allowance', 30, 'fixed', 3000.00);

-- GROSS (placeholder — computed in app as sum of basic + allowances)
INSERT INTO salary_rules (structure_id, code, name, category, sequence, rule_type, fixed_amount) VALUES
  (2, 'GROSS', 'Gross Salary', 'gross', 100, 'fixed', 0.00);

-- PF = 12% of BASIC
INSERT INTO salary_rules (structure_id, code, name, category, sequence, rule_type, percentage, base_rule_id) VALUES
  (2, 'PF', 'Provident Fund', 'deduction', 110, 'percentage', 12.00, 8);

-- PT = fixed professional tax
INSERT INTO salary_rules (structure_id, code, name, category, sequence, rule_type, fixed_amount) VALUES
  (2, 'PT', 'Professional Tax', 'deduction', 120, 'fixed', 200.00);

-- NET (placeholder — computed in app as gross - deductions)
INSERT INTO salary_rules (structure_id, code, name, category, sequence, rule_type, fixed_amount) VALUES
  (2, 'NET', 'Net Salary', 'net', 200, 'fixed', 0.00);

-- ─────────────────────────────────────────────────────────────────────────────
-- Contracts (one per employee)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO contracts (employee_id, schedule_id, salary_structure_id, overtime_policy_id, department_id, job_position_id, wage, start_date, end_date, status) VALUES
  -- Anish — Engineering Manager, 1.5L/month, ended
  (1, 1, 1, 1, 1, 5, 150000.00, '2024-01-15', '2026-08-15', 'expired'),
  -- Anish — Mid month change to 1.8L/month
  (1, 1, 2, 1, 1, 5, 180000.00, '2026-08-16', NULL,          'active'),
  -- Priya — HR Manager, 1.0L/month, open-ended
  (2, 1, 1, 1, 2, 2, 100000.00, '2024-03-01', NULL,          'active'),
  -- Rahul — Software Engineer, 80K/month, open-ended
  (3, 1, 1, 1, 1, 1,  80000.00, '2024-06-10', NULL,          'active'),
  -- Neha — Sales (part-time), 40K/month, 1-year contract
  (4, 2, 1, NULL, 3, 3, 40000.00, '2025-01-20', '2026-01-19', 'active'),
  -- Arjun — Intern, 25K/month, 6-month internship
  (5, 1, 1, NULL, 4, 4, 25000.00, '2026-07-01', '2026-12-31', 'active');

-- ─────────────────────────────────────────────────────────────────────────────
-- Time Off Types
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO time_off_types (name, unit, requires_allocation, approval_required, leave_validation, attendance_impact, is_paid) VALUES
  ('Casual Leave',    'days', TRUE,  TRUE, 'manager', 'absent',  TRUE),
  ('Sick Leave',      'days', TRUE,  TRUE, 'hr',      'absent',  TRUE),
  ('Earned Leave',    'days', TRUE,  TRUE, 'both',    'absent',  TRUE),
  ('Work From Home',  'days', FALSE, TRUE, 'manager', 'present', TRUE),
  ('Unpaid Leave',    'days', FALSE, TRUE, 'hr',      'absent',  FALSE);

-- Link time off types to contracts (all 5 types for all 5 contracts)
INSERT INTO contract_time_off_types (contract_id, time_off_type_id) VALUES
  (1,1),(1,2),(1,3),(1,4),(1,5),
  (2,1),(2,2),(2,3),(2,4),(2,5),
  (3,1),(3,2),(3,3),(3,4),(3,5),
  (4,1),(4,2),(4,4),(4,5),          -- part-time: no earned leave
  (5,1),(5,2),(5,4),(5,5);          -- intern: no earned leave

-- ─────────────────────────────────────────────────────────────────────────────
-- Time Off Allocations (annual 2026)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO time_off_allocations (employee_id, time_off_type_id, start_date, end_date, allocated_amount, taken, status, approved_by, approved_at) VALUES
  -- Anish: CL=12, SL=10, EL=15
  (1, 1, '2026-01-01', '2026-12-31', 12.00, 2.00, 'approved', 2, '2026-01-02 10:00:00'),
  (1, 2, '2026-01-01', '2026-12-31', 10.00, 0.00, 'approved', 2, '2026-01-02 10:00:00'),
  (1, 3, '2026-01-01', '2026-12-31', 15.00, 0.00, 'approved', 2, '2026-01-02 10:00:00'),
  -- Priya: CL=12, SL=10, EL=15
  (2, 1, '2026-01-01', '2026-12-31', 12.00, 1.00, 'approved', 1, '2026-01-02 10:00:00'),
  (2, 2, '2026-01-01', '2026-12-31', 10.00, 1.00, 'approved', 1, '2026-01-02 10:00:00'),
  (2, 3, '2026-01-01', '2026-12-31', 15.00, 0.00, 'approved', 1, '2026-01-02 10:00:00'),
  -- Rahul: CL=12, SL=10, EL=15
  (3, 1, '2026-01-01', '2026-12-31', 12.00, 3.00, 'approved', 1, '2026-01-03 09:00:00'),
  (3, 2, '2026-01-01', '2026-12-31', 10.00, 2.00, 'approved', 1, '2026-01-03 09:00:00'),
  (3, 3, '2026-01-01', '2026-12-31', 15.00, 0.00, 'approved', 1, '2026-01-03 09:00:00'),
  -- Neha (part-time): CL=6, SL=5
  (4, 1, '2026-01-01', '2026-12-31',  6.00, 0.00, 'approved', 1, '2026-01-03 09:00:00'),
  (4, 2, '2026-01-01', '2026-12-31',  5.00, 0.00, 'approved', 1, '2026-01-03 09:00:00'),
  -- Arjun (intern): CL=3, SL=3
  (5, 1, '2026-07-01', '2026-12-31',  3.00, 0.00, 'approved', 2, '2026-07-02 10:00:00'),
  (5, 2, '2026-07-01', '2026-12-31',  3.00, 0.00, 'approved', 2, '2026-07-02 10:00:00');

-- ─────────────────────────────────────────────────────────────────────────────
-- Time Off Requests (a few sample requests)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO time_off_requests (employee_id, time_off_type_id, allocation_id, start_date, end_date, number_of_days, reason, status, approver_id, approved_at) VALUES
  -- Anish: 2 days casual leave (matches allocation id 1 taken=2.00)
  (1, 1, 1, '2026-07-15', '2026-07-16', 2.00, 'Family function', 'approved', 2, '2026-07-10 10:00:00'),
  -- Priya: 1 day casual leave (matches allocation id 4 taken=1.00)
  (2, 1, 4, '2026-07-22', '2026-07-22', 1.00, 'Personal errand', 'approved', 1, '2026-07-20 11:00:00'),
  -- Priya: 1 day sick leave (matches allocation id 5 taken=1.00)
  (2, 2, 5, '2026-08-05', '2026-08-05', 1.00, 'Fever', 'approved', 1, '2026-08-05 08:00:00'),
  -- Rahul: 2 days sick leave (matches allocation id 8 taken=2.00)
  (3, 2, 8, '2026-08-11', '2026-08-12', 2.00, 'Stomach bug', 'approved', 1, '2026-08-11 07:30:00'),
  -- Rahul: 3 days casual leave / vacation (matches allocation id 7 taken=3.00)
  (3, 1, 7, '2026-09-01', '2026-09-03', 3.00, 'Vacation trip', 'approved', 1, '2026-08-25 16:00:00'),
  -- Rahul: 2 days unpaid leave (Thu-Fri only; Aug 22 falls on a Saturday, a non-workday)
  (3, 5, NULL, '2026-08-20', '2026-08-21', 2.00, 'Personal emergency', 'approved', 1, '2026-08-19 10:00:00'),
  -- Rahul: pending WFH request for a future date — no allocation/attendance impact until approved
  (3, 4, NULL, '2026-09-08', '2026-09-08', 1.00, 'Plumber visiting home', 'pending', NULL, NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- Attendance (Comprehensive July 2026 - Today)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO attendance (employee_id, date, check_in, check_out, worked_hours, overtime_hours, overtime_type, status) VALUES
  (1, '2026-07-01', '2026-07-01 09:00:00', '2026-07-01 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-02', '2026-07-02 09:00:00', '2026-07-02 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-03', '2026-07-03 09:00:00', '2026-07-03 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-06', '2026-07-06 09:00:00', '2026-07-06 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-07', '2026-07-07 09:00:00', '2026-07-07 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-08', '2026-07-08 09:00:00', '2026-07-08 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-09', '2026-07-09 09:00:00', '2026-07-09 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-10', '2026-07-10 09:00:00', '2026-07-10 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-13', '2026-07-13 09:00:00', '2026-07-13 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-14', '2026-07-14 09:00:00', '2026-07-14 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-15', NULL, NULL, 0.00, 0.00, NULL, 'on_leave'),
  (1, '2026-07-16', NULL, NULL, 0.00, 0.00, NULL, 'on_leave'),
  (1, '2026-07-17', '2026-07-17 09:00:00', '2026-07-17 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-20', '2026-07-20 09:00:00', '2026-07-20 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-21', '2026-07-21 09:00:00', '2026-07-21 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-22', '2026-07-22 09:00:00', '2026-07-22 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-23', '2026-07-23 09:00:00', '2026-07-23 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-24', '2026-07-24 09:00:00', '2026-07-24 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-27', '2026-07-27 09:00:00', '2026-07-27 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-28', '2026-07-28 09:00:00', '2026-07-28 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-29', '2026-07-29 09:00:00', '2026-07-29 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-30', '2026-07-30 09:00:00', '2026-07-30 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-07-31', '2026-07-31 09:00:00', '2026-07-31 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-03', '2026-08-03 09:00:00', '2026-08-03 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-04', '2026-08-04 09:00:00', '2026-08-04 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-05', '2026-08-05 09:00:00', '2026-08-05 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-06', '2026-08-06 09:00:00', '2026-08-06 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-07', '2026-08-07 09:00:00', '2026-08-07 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-10', '2026-08-10 09:00:00', '2026-08-10 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-11', '2026-08-11 09:00:00', '2026-08-11 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-12', '2026-08-12 09:00:00', '2026-08-12 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-13', '2026-08-13 09:00:00', '2026-08-13 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-14', '2026-08-14 09:00:00', '2026-08-14 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-15', NULL, NULL, 0.00, 0.00, NULL, 'holiday'),
  (1, '2026-08-17', '2026-08-17 09:00:00', '2026-08-17 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-18', '2026-08-18 09:00:00', '2026-08-18 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-19', '2026-08-19 09:00:00', '2026-08-19 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-20', '2026-08-20 09:00:00', '2026-08-20 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-21', '2026-08-21 09:00:00', '2026-08-21 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-24', '2026-08-24 09:00:00', '2026-08-24 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-25', '2026-08-25 09:00:00', '2026-08-25 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-26', '2026-08-26 09:00:00', '2026-08-26 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-27', '2026-08-27 09:00:00', '2026-08-27 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-28', '2026-08-28 09:00:00', '2026-08-28 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-08-31', '2026-08-31 09:00:00', '2026-08-31 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-09-01', '2026-09-01 09:00:00', '2026-09-01 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-09-02', '2026-09-02 09:00:00', '2026-09-02 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-09-03', '2026-09-03 09:00:00', '2026-09-03 18:00:00', 8.00, 0.00, NULL, 'present'),
  (1, '2026-09-04', '2026-09-04 09:00:00', '2026-09-04 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-01', '2026-07-01 09:00:00', '2026-07-01 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-02', '2026-07-02 09:00:00', '2026-07-02 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-03', '2026-07-03 09:00:00', '2026-07-03 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-04', '2026-07-04 09:00:00', '2026-07-04 13:00:00', 4.00, 4.00, 'rest_day_work', 'present'),
  (2, '2026-07-06', '2026-07-06 09:00:00', '2026-07-06 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-07', '2026-07-07 09:00:00', '2026-07-07 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-08', '2026-07-08 09:00:00', '2026-07-08 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-09', '2026-07-09 09:00:00', '2026-07-09 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-10', '2026-07-10 09:00:00', '2026-07-10 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-13', '2026-07-13 09:00:00', '2026-07-13 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-14', '2026-07-14 09:00:00', '2026-07-14 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-15', '2026-07-15 09:00:00', '2026-07-15 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-16', '2026-07-16 09:00:00', '2026-07-16 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-17', '2026-07-17 09:00:00', '2026-07-17 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-20', '2026-07-20 09:00:00', '2026-07-20 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-21', '2026-07-21 09:00:00', '2026-07-21 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-22', NULL, NULL, 0.00, 0.00, NULL, 'on_leave'),
  (2, '2026-07-23', '2026-07-23 09:00:00', '2026-07-23 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-24', '2026-07-24 09:00:00', '2026-07-24 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-27', '2026-07-27 09:00:00', '2026-07-27 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-28', '2026-07-28 09:00:00', '2026-07-28 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-29', '2026-07-29 09:00:00', '2026-07-29 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-30', '2026-07-30 09:00:00', '2026-07-30 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-07-31', '2026-07-31 09:00:00', '2026-07-31 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-03', '2026-08-03 09:00:00', '2026-08-03 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-04', '2026-08-04 09:00:00', '2026-08-04 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-05', NULL, NULL, 0.00, 0.00, NULL, 'on_leave'),
  (2, '2026-08-06', '2026-08-06 09:00:00', '2026-08-06 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-07', '2026-08-07 09:00:00', '2026-08-07 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-10', '2026-08-10 09:00:00', '2026-08-10 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-11', '2026-08-11 09:00:00', '2026-08-11 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-12', '2026-08-12 09:00:00', '2026-08-12 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-13', '2026-08-13 09:00:00', '2026-08-13 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-14', '2026-08-14 09:00:00', '2026-08-14 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-15', '2026-08-15 09:00:00', '2026-08-15 18:00:00', 8.00, 8.00, 'holiday_work', 'holiday'),
  (2, '2026-08-17', '2026-08-17 09:00:00', '2026-08-17 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-18', '2026-08-18 09:00:00', '2026-08-18 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-19', '2026-08-19 09:00:00', '2026-08-19 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-20', '2026-08-20 09:00:00', '2026-08-20 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-21', '2026-08-21 09:00:00', '2026-08-21 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-24', '2026-08-24 09:00:00', '2026-08-24 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-25', '2026-08-25 09:00:00', '2026-08-25 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-26', '2026-08-26 09:00:00', '2026-08-26 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-27', '2026-08-27 09:00:00', '2026-08-27 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-28', '2026-08-28 09:00:00', '2026-08-28 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-08-31', '2026-08-31 09:00:00', '2026-08-31 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-09-01', '2026-09-01 09:00:00', '2026-09-01 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-09-02', '2026-09-02 09:00:00', '2026-09-02 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-09-03', '2026-09-03 09:00:00', '2026-09-03 18:00:00', 8.00, 0.00, NULL, 'present'),
  (2, '2026-09-04', '2026-09-04 09:00:00', '2026-09-04 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-01', '2026-07-01 09:00:00', '2026-07-01 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-02', '2026-07-02 09:00:00', '2026-07-02 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-03', '2026-07-03 09:00:00', '2026-07-03 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-06', '2026-07-06 09:00:00', '2026-07-06 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-07', '2026-07-07 09:00:00', '2026-07-07 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-08', '2026-07-08 09:00:00', '2026-07-08 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-09', '2026-07-09 09:00:00', '2026-07-09 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-10', '2026-07-10 09:00:00', '2026-07-10 20:00:00', 10.00, 2.00, 'regular_ot', 'present'),
  (3, '2026-07-13', '2026-07-13 09:00:00', '2026-07-13 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-14', '2026-07-14 09:00:00', '2026-07-14 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-15', '2026-07-15 09:00:00', '2026-07-15 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-16', '2026-07-16 09:00:00', '2026-07-16 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-17', '2026-07-17 09:00:00', '2026-07-17 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-20', '2026-07-20 09:00:00', '2026-07-20 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-21', '2026-07-21 09:00:00', '2026-07-21 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-22', '2026-07-22 09:00:00', '2026-07-22 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-23', '2026-07-23 09:00:00', '2026-07-23 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-24', '2026-07-24 09:00:00', '2026-07-24 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-27', '2026-07-27 09:00:00', '2026-07-27 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-28', '2026-07-28 09:00:00', '2026-07-28 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-29', '2026-07-29 09:00:00', '2026-07-29 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-30', '2026-07-30 09:00:00', '2026-07-30 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-07-31', '2026-07-31 09:00:00', '2026-07-31 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-03', '2026-08-03 09:00:00', '2026-08-03 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-04', '2026-08-04 09:00:00', '2026-08-04 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-05', '2026-08-05 09:00:00', '2026-08-05 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-06', '2026-08-06 09:00:00', '2026-08-06 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-07', '2026-08-07 09:00:00', '2026-08-07 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-10', '2026-08-10 09:00:00', '2026-08-10 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-11', NULL, NULL, 0.00, 0.00, NULL, 'on_leave'),
  (3, '2026-08-12', NULL, NULL, 0.00, 0.00, NULL, 'on_leave'),
  (3, '2026-08-13', '2026-08-13 09:00:00', '2026-08-13 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-14', '2026-08-14 09:00:00', '2026-08-14 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-15', NULL, NULL, 0.00, 0.00, NULL, 'holiday'),
  (3, '2026-08-17', '2026-08-17 09:00:00', '2026-08-17 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-18', '2026-08-18 09:00:00', '2026-08-18 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-19', '2026-08-19 09:00:00', '2026-08-19 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-20', NULL, NULL, 0.00, 0.00, NULL, 'on_leave'),
  (3, '2026-08-21', NULL, NULL, 0.00, 0.00, NULL, 'on_leave'),
  (3, '2026-08-24', '2026-08-24 09:00:00', '2026-08-24 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-25', '2026-08-25 09:00:00', '2026-08-25 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-26', '2026-08-26 09:00:00', '2026-08-26 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-27', '2026-08-27 09:00:00', '2026-08-27 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-28', '2026-08-28 09:00:00', '2026-08-28 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-08-31', '2026-08-31 09:00:00', '2026-08-31 18:00:00', 8.00, 0.00, NULL, 'present'),
  (3, '2026-09-01', NULL, NULL, 0.00, 0.00, NULL, 'on_leave'),
  (3, '2026-09-02', NULL, NULL, 0.00, 0.00, NULL, 'on_leave'),
  (3, '2026-09-03', NULL, NULL, 0.00, 0.00, NULL, 'on_leave'),
  (3, '2026-09-04', '2026-09-04 09:00:00', '2026-09-04 18:00:00', 8.00, 0.00, NULL, 'present'),
  (4, '2026-09-02', '2026-09-02 09:00:00', '2026-09-02 13:00:00', 4.00, 0.00, NULL, 'present'),
  (4, '2026-09-03', '2026-09-03 09:00:00', '2026-09-03 13:00:00', 4.00, 0.00, NULL, 'present'),
  (4, '2026-09-04', '2026-09-04 09:00:00', '2026-09-04 13:00:00', 4.00, 0.00, NULL, 'present'),
  (5, '2026-09-02', '2026-09-02 09:00:00', '2026-09-02 18:00:00', 8.00, 0.00, NULL, 'present'),
  (5, '2026-09-03', '2026-09-03 09:00:00', '2026-09-03 18:00:00', 8.00, 0.00, NULL, 'present'),
  (5, '2026-09-04', '2026-09-04 09:00:00', '2026-09-04 18:00:00', 8.00, 0.00, NULL, 'present');


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE! Schema created and seeded successfully.
-- ═══════════════════════════════════════════════════════════════════════════════
