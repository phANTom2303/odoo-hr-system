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
DROP FUNCTION IF EXISTS log_audit_event() CASCADE;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS audit_logs            CASCADE;
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
-- PHASE 5: SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════════
-- A complete, self-consistent demo dataset:
--   • 18 employees covering all 5 user roles and all 4 employee types
--   • 4 working schedules, 3 salary structures, 25 salary rules
--   • 22 contracts including renewals, a mid-month wage change and a draft
--   • Leave allocations + ~55 leave requests (approved / pending / refused /
--     draft / withdrawn), with allocation balances consumed to match
--   • 848 attendance rows for Jul 1 – Sep 5 2026, including holidays,
--     leave days, overtime, half days, absences and missing check-outs
--   • July + August 2026 pay runs, fully computed and marked PAID
--
-- Login for every seeded user:  <email> / password123
-- (password_hash below is bcrypt("password123") — dev/demo only)

-- ─────────────────────────────────────────────────────────────────────────────
-- Departments
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO departments (name) VALUES
  ('Engineering'),
  ('Human Resources'),
  ('Sales'),
  ('Finance'),
  ('Marketing'),
  ('Operations'),
  ('Customer Support');

-- ─────────────────────────────────────────────────────────────────────────────
-- Job Positions
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO job_positions (title) VALUES
  ('Software Engineer'),
  ('HR Manager'),
  ('Sales Executive'),
  ('Finance Analyst'),
  ('Engineering Manager'),
  ('Payroll Manager'),
  ('Payroll Executive'),
  ('Senior Software Engineer'),
  ('Sales Manager'),
  ('HR Business Partner'),
  ('QA Engineer'),
  ('Marketing Specialist'),
  ('Operations Executive'),
  ('Support Engineer'),
  ('Content Writer');

-- ─────────────────────────────────────────────────────────────────────────────
-- Company Holidays (2026)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO company_holidays (name, date, holiday_type, is_paid) VALUES
  ('New Year''s Day'         , '2026-01-01', 'company'  , TRUE),
  ('Republic Day'            , '2026-01-26', 'national' , TRUE),
  ('Holi'                    , '2026-03-04', 'festival' , TRUE),
  ('Good Friday'             , '2026-04-03', 'festival' , TRUE),
  ('May Day'                 , '2026-05-01', 'national' , TRUE),
  ('Company Foundation Day'  , '2026-06-01', 'company'  , TRUE),
  ('Company Annual Day'      , '2026-07-24', 'company'  , TRUE),
  ('Independence Day'        , '2026-08-15', 'national' , TRUE),
  ('Onam'                    , '2026-08-26', 'festival' , TRUE),
  ('Gandhi Jayanti'          , '2026-10-02', 'national' , TRUE),
  ('Diwali'                  , '2026-10-20', 'festival' , TRUE),
  ('Christmas'               , '2026-12-25', 'festival' , TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- Overtime Policies
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO overtime_policies (name, threshold_type, daily_threshold_hrs, weekly_threshold_hrs, multiplier, compensatory_off) VALUES
  ('Standard OT (1.5x)'        , 'daily_hours'       , 8.00, 40.00, 1.50, FALSE),
  ('Premium OT (2.0x)'         , 'outside_schedule'  , 8.00, 40.00, 2.00, FALSE),
  ('Comp-Off in lieu of OT'    , 'daily_hours'       , 8.00, 40.00, 1.00, TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- Users — every role is represented; login with <email> / password123
-- ─────────────────────────────────────────────────────────────────────────────
--   admin              → anish@peoplepay.dev
--   hr_payroll_manager → kavya@peoplepay.dev
--   hr_payroll_user    → rohan@peoplepay.dev
--   hr_manager         → priya@peoplepay.dev, meera@peoplepay.dev
--   employee           → rahul@peoplepay.dev (and 12 others)
INSERT INTO users (id, first_name, last_name, email, phone, password_hash, role, employment_status, employee_type, is_active, department_id, job_position_id, manager_id, date_of_joining, date_of_leaving, date_of_birth, bank_name, bank_account, address) VALUES
  (1, 'Anish', 'Goenka', 'anish@peoplepay.dev', '+91-98765-00001',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'admin', 'active', 'full_time', TRUE,
   1, 5, NULL,
   '2024-01-15', NULL, '1995-06-20',
   'HDFC Bank', 'HDFC0001234567', '42 MG Road, Bengaluru 560001'),
  (2, 'Priya', 'Sharma', 'priya@peoplepay.dev', '+91-98765-00002',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'hr_manager', 'active', 'full_time', TRUE,
   2, 2, 1,
   '2024-03-01', NULL, '1993-11-05',
   'ICICI Bank', 'ICIC0006789012', '15 Indiranagar, Bengaluru 560038'),
  (3, 'Rahul', 'Verma', 'rahul@peoplepay.dev', '+91-98765-00003',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'active', 'full_time', TRUE,
   1, 1, 8,
   '2024-06-10', NULL, '1998-02-14',
   'State Bank of India', 'SBIN0011122233', '78 Koramangala, Bengaluru 560034'),
  (4, 'Neha', 'Patel', 'neha@peoplepay.dev', '+91-98765-00004',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'active', 'part_time', TRUE,
   3, 3, 9,
   '2025-01-20', NULL, '1997-08-30',
   'Axis Bank', 'UTIB0033344455', '22 Whitefield, Bengaluru 560066'),
  (5, 'Arjun', 'Mehta', 'arjun@peoplepay.dev', '+91-98765-00005',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'active', 'intern', TRUE,
   4, 4, 6,
   '2026-07-01', NULL, '2003-04-18',
   NULL, NULL, '9 JP Nagar, Bengaluru 560078'),
  (6, 'Kavya', 'Iyer', 'kavya@peoplepay.dev', '+91-98765-00006',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'hr_payroll_manager', 'active', 'full_time', TRUE,
   4, 6, 1,
   '2024-02-05', NULL, '1990-09-12',
   'HDFC Bank', 'HDFC0007788990', '5 Jayanagar 4th Block, Bengaluru 560011'),
  (7, 'Rohan', 'Desai', 'rohan@peoplepay.dev', '+91-98765-00007',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'hr_payroll_user', 'active', 'full_time', TRUE,
   4, 7, 6,
   '2025-04-14', NULL, '1996-01-27',
   'Kotak Mahindra Bank', 'KKBK0004455667', '31 BTM Layout, Bengaluru 560076'),
  (8, 'Vikram', 'Singh', 'vikram@peoplepay.dev', '+91-98765-00008',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'active', 'full_time', TRUE,
   1, 8, 1,
   '2023-09-11', NULL, '1992-07-03',
   'HDFC Bank', 'HDFC0002211334', '11 HSR Layout, Bengaluru 560102'),
  (9, 'Karthik', 'Reddy', 'karthik@peoplepay.dev', '+91-98765-00009',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'active', 'full_time', TRUE,
   3, 9, 1,
   '2023-11-06', NULL, '1991-12-19',
   'ICICI Bank', 'ICIC0009900112', '64 Domlur, Bengaluru 560071'),
  (10, 'Meera', 'Krishnan', 'meera@peoplepay.dev', '+91-98765-00010',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'hr_manager', 'active', 'full_time', TRUE,
   2, 10, 2,
   '2025-02-17', NULL, '1994-05-22',
   'Axis Bank', 'UTIB0005566778', '3 Malleshwaram, Bengaluru 560003'),
  (11, 'Ananya', 'Rao', 'ananya@peoplepay.dev', '+91-98765-00011',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'active', 'full_time', TRUE,
   1, 11, 8,
   '2025-07-21', NULL, '1999-03-08',
   'State Bank of India', 'SBIN0044556677', '18 Bellandur, Bengaluru 560103'),
  (12, 'Divya', 'Menon', 'divya@peoplepay.dev', '+91-98765-00012',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'active', 'full_time', TRUE,
   5, 12, 1,
   '2025-03-03', NULL, '1996-10-30',
   'HDFC Bank', 'HDFC0006677889', '27 Rajajinagar, Bengaluru 560010'),
  (13, 'Sameer', 'Khan', 'sameer@peoplepay.dev', '+91-98765-00013',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'active', 'full_time', TRUE,
   6, 13, 1,
   '2024-08-19', NULL, '1995-04-11',
   'Kotak Mahindra Bank', 'KKBK0008899001', '52 Banashankari, Bengaluru 560070'),
  (14, 'Ishita', 'Bose', 'ishita@peoplepay.dev', '+91-98765-00014',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'active', 'contract', TRUE,
   7, 14, 13,
   '2026-02-02', NULL, '1997-06-25',
   'ICICI Bank', 'ICIC0002233445', '7 Marathahalli, Bengaluru 560037'),
  (15, 'Aditya', 'Kulkarni', 'aditya@peoplepay.dev', '+91-98765-00015',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'active', 'full_time', TRUE,
   1, 1, 8,
   '2025-10-06', NULL, '1997-11-17',
   'Axis Bank', 'UTIB0001122998', '39 Electronic City, Bengaluru 560100'),
  (16, 'Pooja', 'Gupta', 'pooja@peoplepay.dev', '+91-98765-00016',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'on_notice', 'full_time', TRUE,
   4, 4, 6,
   '2024-12-02', NULL, '1994-08-09',
   'State Bank of India', 'SBIN0077889900', '14 Basavanagudi, Bengaluru 560004'),
  (17, 'Nikhil', 'Bhat', 'nikhil@peoplepay.dev', '+91-98765-00017',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'active', 'part_time', TRUE,
   5, 15, 12,
   '2026-03-16', NULL, '2000-02-02',
   NULL, NULL, '61 Yelahanka, Bengaluru 560064'),
  (18, 'Tara', 'D''Souza', 'tara@peoplepay.dev', '+91-98765-00018',
   '$2b$10$y1rrCL1JNgQGfCwkAwy00uIQinUDxpKKN4.W6EwwqpcOTKWFmv32S',
   'employee', 'terminated', 'full_time', FALSE,
   6, 13, 13,
   '2023-05-08', '2026-08-21', '1993-01-15',
   'HDFC Bank', 'HDFC0003344556', '8 Frazer Town, Bengaluru 560005');
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- ─────────────────────────────────────────────────────────────────────────────
-- Working Schedules
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO working_schedules (id, name, total_weekly_hours) VALUES
  (1, 'Standard 40h (Mon-Fri)'          , 40.00),
  (2, 'Part-Time 20h (Mon-Fri)'         , 20.00),
  (3, 'Support Shift 40h (Tue-Sat)'     , 40.00),
  (4, 'Compressed 36h (Mon-Thu)'        , 36.00);
SELECT setval('working_schedules_id_seq', (SELECT MAX(id) FROM working_schedules));

INSERT INTO schedule_lines (schedule_id, day_of_week, start_time, end_time, break_minutes) VALUES
  (1, 'monday'    , '09:00', '18:00', 60),
  (1, 'tuesday'   , '09:00', '18:00', 60),
  (1, 'wednesday' , '09:00', '18:00', 60),
  (1, 'thursday'  , '09:00', '18:00', 60),
  (1, 'friday'    , '09:00', '18:00', 60),
  (2, 'monday'    , '09:00', '13:00', 0),
  (2, 'tuesday'   , '09:00', '13:00', 0),
  (2, 'wednesday' , '09:00', '13:00', 0),
  (2, 'thursday'  , '09:00', '13:00', 0),
  (2, 'friday'    , '09:00', '13:00', 0),
  (3, 'tuesday'   , '10:00', '19:00', 60),
  (3, 'wednesday' , '10:00', '19:00', 60),
  (3, 'thursday'  , '10:00', '19:00', 60),
  (3, 'friday'    , '10:00', '19:00', 60),
  (3, 'saturday'  , '10:00', '19:00', 60),
  (4, 'monday'    , '09:00', '19:00', 60),
  (4, 'tuesday'   , '09:00', '19:00', 60),
  (4, 'wednesday' , '09:00', '19:00', 60),
  (4, 'thursday'  , '09:00', '19:00', 60);

-- ─────────────────────────────────────────────────────────────────────────────
-- Salary Structures & Rules
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO salary_structures (id, name, status) VALUES
  (1, 'India Standard CTC'          , 'active'),
  (2, 'Senior Management CTC'       , 'active'),
  (3, 'Intern & Contract Stipend'   , 'active');
SELECT setval('salary_structures_id_seq', (SELECT MAX(id) FROM salary_structures));

-- BASIC takes its amount from the contract wage at compute time; GROSS and NET
-- are placeholders back-filled by the engine from the computed line totals.
INSERT INTO salary_rules (id, structure_id, code, name, category, sequence, rule_type, fixed_amount, percentage, base_rule_id) VALUES
  ( 1, 1, 'BASIC' , 'Basic Salary'          , 'basic'    ,  10, 'fixed'     ,     0.00,   NULL, NULL),
  ( 2, 1, 'HRA'   , 'House Rent Allowance'  , 'allowance',  20, 'percentage',     NULL,  40.00, 1),
  ( 3, 1, 'CONV'  , 'Conveyance Allowance'  , 'allowance',  30, 'fixed'     ,  1600.00,   NULL, NULL),
  ( 4, 1, 'MED'   , 'Medical Allowance'     , 'allowance',  40, 'fixed'     ,  1250.00,   NULL, NULL),
  ( 5, 1, 'SPA'   , 'Special Allowance'     , 'allowance',  50, 'percentage',     NULL,  10.00, 1),
  ( 6, 1, 'GROSS' , 'Gross Salary'          , 'gross'    , 100, 'fixed'     ,     0.00,   NULL, NULL),
  ( 7, 1, 'PF'    , 'Provident Fund'        , 'deduction', 110, 'percentage',     NULL,  12.00, 1),
  ( 8, 1, 'PT'    , 'Professional Tax'      , 'deduction', 120, 'fixed'     ,   200.00,   NULL, NULL),
  ( 9, 1, 'TDS'   , 'Income Tax (TDS)'      , 'deduction', 130, 'percentage',     NULL,   5.00, 1),
  (10, 1, 'NET'   , 'Net Salary'            , 'net'      , 200, 'fixed'     ,     0.00,   NULL, NULL),
  (11, 2, 'BASIC' , 'Basic Salary'          , 'basic'    ,  10, 'fixed'     ,     0.00,   NULL, NULL),
  (12, 2, 'HRA'   , 'House Rent Allowance'  , 'allowance',  20, 'percentage',     NULL,  50.00, 11),
  (13, 2, 'CONV'  , 'Conveyance Allowance'  , 'allowance',  30, 'fixed'     ,  3000.00,   NULL, NULL),
  (14, 2, 'MED'   , 'Medical Allowance'     , 'allowance',  40, 'fixed'     ,  2500.00,   NULL, NULL),
  (15, 2, 'SPA'   , 'Special Allowance'     , 'allowance',  50, 'percentage',     NULL,  15.00, 11),
  (16, 2, 'GROSS' , 'Gross Salary'          , 'gross'    , 100, 'fixed'     ,     0.00,   NULL, NULL),
  (17, 2, 'PF'    , 'Provident Fund'        , 'deduction', 110, 'percentage',     NULL,  12.00, 11),
  (18, 2, 'PT'    , 'Professional Tax'      , 'deduction', 120, 'fixed'     ,   200.00,   NULL, NULL),
  (19, 2, 'TDS'   , 'Income Tax (TDS)'      , 'deduction', 130, 'percentage',     NULL,  12.00, 11),
  (20, 2, 'NET'   , 'Net Salary'            , 'net'      , 200, 'fixed'     ,     0.00,   NULL, NULL),
  (21, 3, 'BASIC' , 'Stipend'               , 'basic'    ,  10, 'fixed'     ,     0.00,   NULL, NULL),
  (22, 3, 'CONV'  , 'Conveyance Allowance'  , 'allowance',  30, 'fixed'     ,   800.00,   NULL, NULL),
  (23, 3, 'GROSS' , 'Gross Salary'          , 'gross'    , 100, 'fixed'     ,     0.00,   NULL, NULL),
  (24, 3, 'PT'    , 'Professional Tax'      , 'deduction', 120, 'fixed'     ,   200.00,   NULL, NULL),
  (25, 3, 'NET'   , 'Net Salary'            , 'net'      , 200, 'fixed'     ,     0.00,   NULL, NULL);
SELECT setval('salary_rules_id_seq', (SELECT MAX(id) FROM salary_rules));

-- ─────────────────────────────────────────────────────────────────────────────
-- Contracts — history preserved; exactly one active contract per employee
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO contracts (id, employee_id, schedule_id, salary_structure_id, overtime_policy_id, department_id, job_position_id, wage, start_date, end_date, status) VALUES
  -- Anish Goenka
  ( 1,  1, 1, 1,    1, 1,  5,  90000.00, '2024-01-15', '2026-08-15', 'expired' ),
  -- Anish Goenka
  ( 2,  1, 1, 2,    1, 1,  5, 105000.00, '2026-08-16', NULL        , 'active'  ),
  -- Priya Sharma
  ( 3,  2, 1, 1,    1, 2,  2,  62000.00, '2024-03-01', NULL        , 'active'  ),
  -- Rahul Verma
  ( 4,  3, 1, 1,    1, 1,  1,  48000.00, '2024-06-10', '2026-06-30', 'expired' ),
  -- Rahul Verma
  ( 5,  3, 1, 1,    1, 1,  1,  55000.00, '2026-07-01', NULL        , 'active'  ),
  -- Neha Patel
  ( 6,  4, 2, 1, NULL, 3,  3,  26000.00, '2025-01-20', '2026-01-19', 'expired' ),
  -- Neha Patel
  ( 7,  4, 2, 1, NULL, 3,  3,  28000.00, '2026-01-20', '2027-01-19', 'active'  ),
  -- Arjun Mehta
  ( 8,  5, 1, 3, NULL, 4,  4,  25000.00, '2026-07-01', '2026-12-31', 'active'  ),
  -- Kavya Iyer
  ( 9,  6, 1, 2,    1, 4,  6,  85000.00, '2024-02-05', NULL        , 'active'  ),
  -- Rohan Desai
  (10,  7, 1, 1,    1, 4,  7,  40000.00, '2025-04-14', NULL        , 'active'  ),
  -- Vikram Singh
  (11,  8, 1, 2,    1, 1,  8,  75000.00, '2023-09-11', NULL        , 'active'  ),
  -- Karthik Reddy
  (12,  9, 1, 2,    1, 3,  9,  68000.00, '2023-11-06', NULL        , 'active'  ),
  -- Meera Krishnan
  (13, 10, 1, 1,    1, 2, 10,  44000.00, '2025-02-17', NULL        , 'active'  ),
  -- Ananya Rao
  (14, 11, 1, 1,    1, 1, 11,  38000.00, '2025-07-21', NULL        , 'active'  ),
  -- Divya Menon
  (15, 12, 1, 1,    1, 5, 12,  42000.00, '2025-03-03', NULL        , 'active'  ),
  -- Sameer Khan
  (16, 13, 1, 1,    2, 6, 13,  36000.00, '2024-08-19', NULL        , 'active'  ),
  -- Ishita Bose
  (17, 14, 3, 3,    3, 7, 14,  52000.00, '2026-02-02', '2026-09-30', 'active'  ),
  -- Aditya Kulkarni
  (18, 15, 4, 1,    1, 1,  1,  46000.00, '2025-10-06', NULL        , 'active'  ),
  -- Pooja Gupta
  (19, 16, 1, 1,    1, 4,  4,  41000.00, '2024-12-02', NULL        , 'active'  ),
  -- Nikhil Bhat
  (20, 17, 2, 1, NULL, 5, 15,  20000.00, '2026-03-16', NULL        , 'active'  ),
  -- Tara D'Souza
  (21, 18, 1, 1,    1, 6, 13,  38000.00, '2023-05-08', '2026-08-21', 'expired' ),
  -- Ishita Bose
  (22, 14, 3, 1,    3, 7, 14,  38000.00, '2026-10-01', '2027-09-30', 'draft'   );
SELECT setval('contracts_id_seq', (SELECT MAX(id) FROM contracts));

-- ─────────────────────────────────────────────────────────────────────────────
-- Time Off Types
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO time_off_types (id, name, unit, requires_allocation, approval_required, approver_role, leave_validation, attendance_impact, is_paid) VALUES
  (1, 'Casual Leave'      , 'days', TRUE , TRUE , 'hr_manager', 'manager' , 'absent' , TRUE),
  (2, 'Sick Leave'        , 'days', TRUE , TRUE , 'hr_manager', 'hr'      , 'absent' , TRUE),
  (3, 'Earned Leave'      , 'days', TRUE , TRUE , 'hr_manager', 'both'    , 'absent' , TRUE),
  (4, 'Work From Home'    , 'days', FALSE, TRUE , 'hr_manager', 'manager' , 'present', TRUE),
  (5, 'Unpaid Leave'      , 'days', FALSE, TRUE , 'hr_manager', 'hr'      , 'absent' , FALSE),
  (6, 'Compensatory Off'  , 'days', TRUE , TRUE , 'hr_manager', 'manager' , 'absent' , TRUE);
SELECT setval('time_off_types_id_seq', (SELECT MAX(id) FROM time_off_types));

-- Contract → eligible time off types
INSERT INTO contract_time_off_types (contract_id, time_off_type_id) VALUES
  (1,1),(1,2),(1,3),(1,4),(1,5),(1,6),
  (2,1),(2,2),(2,3),(2,4),(2,5),(2,6),
  (3,1),(3,2),(3,3),(3,4),(3,5),(3,6),
  (4,1),(4,2),(4,3),(4,4),(4,5),(4,6),
  (5,1),(5,2),(5,3),(5,4),(5,5),(5,6),
  (6,1),(6,2),(6,4),(6,5),
  (7,1),(7,2),(7,4),(7,5),
  (8,1),(8,2),(8,5),
  (9,1),(9,2),(9,3),(9,4),(9,5),(9,6),
  (10,1),(10,2),(10,3),(10,4),(10,5),(10,6),
  (11,1),(11,2),(11,3),(11,4),(11,5),(11,6),
  (12,1),(12,2),(12,3),(12,4),(12,5),(12,6),
  (13,1),(13,2),(13,3),(13,4),(13,5),(13,6),
  (14,1),(14,2),(14,3),(14,4),(14,5),(14,6),
  (15,1),(15,2),(15,3),(15,4),(15,5),(15,6),
  (16,1),(16,2),(16,3),(16,4),(16,5),(16,6),
  (17,1),(17,2),(17,4),(17,5),(17,6),
  (18,1),(18,2),(18,3),(18,4),(18,5),(18,6),
  (19,1),(19,2),(19,3),(19,4),(19,5),(19,6),
  (20,1),(20,2),(20,4),(20,5),
  (21,1),(21,2),(21,3),(21,4),(21,5),(21,6),
  (22,1),(22,2),(22,4),(22,5),(22,6);

-- ─────────────────────────────────────────────────────────────────────────────
-- Time Off Allocations — `taken` matches the approved requests below exactly
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO time_off_allocations (id, employee_id, time_off_type_id, start_date, end_date, allocated_amount, taken, status, approved_by, approved_at) VALUES
  -- Anish Goenka / Casual Leave
  ( 1,  1, 1, '2026-01-01', '2026-12-31', 12.00, 2.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Anish Goenka / Sick Leave
  ( 2,  1, 2, '2026-01-01', '2026-12-31', 10.00, 0.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Anish Goenka / Earned Leave
  ( 3,  1, 3, '2026-01-01', '2026-12-31', 15.00, 5.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Priya Sharma / Casual Leave
  ( 4,  2, 1, '2026-01-01', '2026-12-31', 12.00, 1.00, 'approved',    1, '2026-01-02 10:00:00'),
  -- Priya Sharma / Sick Leave
  ( 5,  2, 2, '2026-01-01', '2026-12-31', 10.00, 1.00, 'approved',    1, '2026-01-02 10:00:00'),
  -- Priya Sharma / Earned Leave
  ( 6,  2, 3, '2026-01-01', '2026-12-31', 15.00, 5.00, 'approved',    1, '2026-01-02 10:00:00'),
  -- Rahul Verma / Casual Leave
  ( 7,  3, 1, '2026-01-01', '2026-12-31', 12.00, 5.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Rahul Verma / Sick Leave
  ( 8,  3, 2, '2026-01-01', '2026-12-31', 10.00, 4.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Rahul Verma / Earned Leave
  ( 9,  3, 3, '2026-01-01', '2026-12-31', 15.00, 0.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Neha Patel / Casual Leave
  (10,  4, 1, '2026-01-01', '2026-12-31', 6.00, 1.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Neha Patel / Sick Leave
  (11,  4, 2, '2026-01-01', '2026-12-31', 5.00, 0.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Arjun Mehta / Casual Leave
  (12,  5, 1, '2026-07-01', '2026-12-31', 3.00, 1.00, 'approved',    2, '2026-07-02 10:00:00'),
  -- Arjun Mehta / Sick Leave
  (13,  5, 2, '2026-07-01', '2026-12-31', 3.00, 1.00, 'approved',    2, '2026-07-02 10:00:00'),
  -- Kavya Iyer / Casual Leave
  (14,  6, 1, '2026-01-01', '2026-12-31', 12.00, 2.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Kavya Iyer / Sick Leave
  (15,  6, 2, '2026-01-01', '2026-12-31', 10.00, 0.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Kavya Iyer / Earned Leave
  (16,  6, 3, '2026-01-01', '2026-12-31', 15.00, 3.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Rohan Desai / Casual Leave
  (17,  7, 1, '2026-01-01', '2026-12-31', 12.00, 1.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Rohan Desai / Sick Leave
  (18,  7, 2, '2026-01-01', '2026-12-31', 10.00, 0.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Rohan Desai / Earned Leave
  (19,  7, 3, '2026-01-01', '2026-12-31', 15.00, 0.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Vikram Singh / Casual Leave
  (20,  8, 1, '2026-01-01', '2026-12-31', 12.00, 1.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Vikram Singh / Sick Leave
  (21,  8, 2, '2026-01-01', '2026-12-31', 10.00, 2.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Vikram Singh / Earned Leave
  (22,  8, 3, '2026-01-01', '2026-12-31', 15.00, 5.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Karthik Reddy / Casual Leave
  (23,  9, 1, '2026-01-01', '2026-12-31', 12.00, 0.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Karthik Reddy / Sick Leave
  (24,  9, 2, '2026-01-01', '2026-12-31', 10.00, 2.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Karthik Reddy / Earned Leave
  (25,  9, 3, '2026-01-01', '2026-12-31', 15.00, 4.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Meera Krishnan / Casual Leave
  (26, 10, 1, '2026-01-01', '2026-12-31', 12.00, 2.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Meera Krishnan / Sick Leave
  (27, 10, 2, '2026-01-01', '2026-12-31', 10.00, 0.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Meera Krishnan / Earned Leave
  (28, 10, 3, '2026-01-01', '2026-12-31', 15.00, 0.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Ananya Rao / Casual Leave
  (29, 11, 1, '2026-01-01', '2026-12-31', 12.00, 1.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Ananya Rao / Sick Leave
  (30, 11, 2, '2026-01-01', '2026-12-31', 10.00, 2.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Ananya Rao / Earned Leave
  (31, 11, 3, '2026-01-01', '2026-12-31', 15.00, 0.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Divya Menon / Casual Leave
  (32, 12, 1, '2026-01-01', '2026-12-31', 12.00, 0.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Divya Menon / Sick Leave
  (33, 12, 2, '2026-01-01', '2026-12-31', 10.00, 2.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Divya Menon / Earned Leave
  (34, 12, 3, '2026-01-01', '2026-12-31', 15.00, 5.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Sameer Khan / Casual Leave
  (35, 13, 1, '2026-01-01', '2026-12-31', 12.00, 1.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Sameer Khan / Sick Leave
  (36, 13, 2, '2026-01-01', '2026-12-31', 10.00, 2.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Sameer Khan / Earned Leave
  (37, 13, 3, '2026-01-01', '2026-12-31', 15.00, 0.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Ishita Bose / Casual Leave
  (38, 14, 1, '2026-02-02', '2026-12-31', 6.00, 1.00, 'approved',    2, '2026-02-03 10:00:00'),
  -- Ishita Bose / Sick Leave
  (39, 14, 2, '2026-02-02', '2026-12-31', 5.00, 0.00, 'approved',    2, '2026-02-03 10:00:00'),
  -- Aditya Kulkarni / Casual Leave
  (40, 15, 1, '2026-01-01', '2026-12-31', 12.00, 2.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Aditya Kulkarni / Sick Leave
  (41, 15, 2, '2026-01-01', '2026-12-31', 10.00, 1.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Aditya Kulkarni / Earned Leave
  (42, 15, 3, '2026-01-01', '2026-12-31', 15.00, 3.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Pooja Gupta / Casual Leave
  (43, 16, 1, '2026-01-01', '2026-12-31', 12.00, 2.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Pooja Gupta / Sick Leave
  (44, 16, 2, '2026-01-01', '2026-12-31', 10.00, 1.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Pooja Gupta / Earned Leave
  (45, 16, 3, '2026-01-01', '2026-12-31', 15.00, 5.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Nikhil Bhat / Casual Leave
  (46, 17, 1, '2026-03-16', '2026-12-31', 6.00, 1.00, 'approved',    2, '2026-03-17 10:00:00'),
  -- Nikhil Bhat / Sick Leave
  (47, 17, 2, '2026-03-16', '2026-12-31', 5.00, 1.00, 'approved',    2, '2026-03-17 10:00:00'),
  -- Tara D'Souza / Casual Leave
  (48, 18, 1, '2026-01-01', '2026-12-31', 12.00, 0.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Tara D'Souza / Sick Leave
  (49, 18, 2, '2026-01-01', '2026-12-31', 10.00, 2.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Tara D'Souza / Earned Leave
  (50, 18, 3, '2026-01-01', '2026-12-31', 15.00, 5.00, 'approved',    2, '2026-01-02 10:00:00'),
  -- Ishita Bose / Compensatory Off
  (51, 14, 6, '2026-08-16', '2026-12-31', 2.00, 1.00, 'approved',   13, '2026-08-16 09:00:00'),
  -- Ananya Rao / Earned Leave
  (52, 11, 3, '2026-09-01', '2026-12-31', 5.00, 0.00, 'draft'   , NULL, NULL                 ),
  -- Arjun Mehta / Earned Leave
  (53,  5, 3, '2026-09-01', '2026-12-31', 5.00, 0.00, 'draft'   , NULL, NULL                 ),
  -- Nikhil Bhat / Earned Leave
  (54, 17, 3, '2026-06-01', '2026-12-31', 5.00, 0.00, 'refused' ,    2, '2026-06-03 11:30:00');
SELECT setval('time_off_allocations_id_seq', (SELECT MAX(id) FROM time_off_allocations));

-- ─────────────────────────────────────────────────────────────────────────────
-- Time Off Requests
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO time_off_requests (id, employee_id, time_off_type_id, allocation_id, start_date, end_date, number_of_days, reason, status, approver_id, approved_at) VALUES
  -- Kavya Iyer
  ( 1,  6, 1,   14, '2026-02-09', '2026-02-10', 2.00, 'Family function in Chennai', 'approved' ,    1, '2026-02-05 10:20:00'),
  -- Rahul Verma
  ( 2,  3, 1,    7, '2026-02-16', '2026-02-17', 2.00, 'Cousin''s wedding', 'approved' ,    8, '2026-02-12 09:40:00'),
  -- Vikram Singh
  ( 3,  8, 2,   21, '2026-03-05', '2026-03-06', 2.00, 'Influenza, doctor advised rest', 'approved' ,    1, '2026-03-05 08:15:00'),
  -- Sameer Khan
  ( 4, 13, 1,   35, '2026-03-23', '2026-03-23', 1.00, 'RTO appointment', 'approved' ,    1, '2026-03-20 15:10:00'),
  -- Aditya Kulkarni
  ( 5, 15, 1,   40, '2026-04-06', '2026-04-07', 2.00, 'Moving apartments', 'approved' ,    8, '2026-04-02 11:05:00'),
  -- Priya Sharma
  ( 6,  2, 3,    6, '2026-04-13', '2026-04-17', 5.00, 'Annual leave - Goa', 'approved' ,    1, '2026-04-03 10:00:00'),
  -- Anish Goenka
  ( 7,  1, 3,    3, '2026-05-11', '2026-05-15', 5.00, 'Family holiday', 'approved' ,    2, '2026-05-04 09:30:00'),
  -- Ananya Rao
  ( 8, 11, 2,   30, '2026-05-19', '2026-05-20', 2.00, 'Viral fever', 'approved' ,    8, '2026-05-19 08:05:00'),
  -- Karthik Reddy
  ( 9,  9, 2,   24, '2026-06-08', '2026-06-09', 2.00, 'Dengue - hospitalised one night', 'approved' ,    1, '2026-06-08 07:50:00'),
  -- Pooja Gupta
  (10, 16, 3,   45, '2026-06-15', '2026-06-19', 5.00, 'Annual leave - Himachal trek', 'approved' ,    6, '2026-06-05 14:25:00'),
  -- Tara D'Souza
  (11, 18, 3,   50, '2026-06-22', '2026-06-26', 5.00, 'Annual leave', 'approved' ,   13, '2026-06-12 16:40:00'),
  -- Rohan Desai
  (12,  7, 1,   17, '2026-07-03', '2026-07-03', 1.00, 'Personal work', 'approved' ,    6, '2026-07-01 10:15:00'),
  -- Ananya Rao
  (13, 11, 1,   29, '2026-07-02', '2026-07-02', 1.00, 'Bank documentation', 'approved' ,    8, '2026-06-30 17:20:00'),
  -- Pooja Gupta
  (14, 16, 1,   43, '2026-07-06', '2026-07-07', 2.00, 'House shifting', 'approved' ,    6, '2026-07-01 11:00:00'),
  -- Rahul Verma
  (15,  3, 2,    8, '2026-07-07', '2026-07-08', 2.00, 'Viral fever', 'approved' ,    8, '2026-07-07 08:10:00'),
  -- Sameer Khan
  (16, 13, 4, NULL, '2026-07-09', '2026-07-09', 1.00, 'Society maintenance work at home', 'approved' ,    1, '2026-07-08 18:30:00'),
  -- Neha Patel
  (17,  4, 1,   10, '2026-07-10', '2026-07-10', 1.00, 'Personal work', 'approved' ,    9, '2026-07-08 12:00:00'),
  -- Vikram Singh
  (18,  8, 3,   22, '2026-07-13', '2026-07-17', 5.00, 'Annual family vacation', 'approved' ,    1, '2026-07-02 09:50:00'),
  -- Ishita Bose
  (19, 14, 1,   38, '2026-07-14', '2026-07-14', 1.00, 'Passport appointment', 'approved' ,   13, '2026-07-10 13:45:00'),
  -- Anish Goenka
  (20,  1, 1,    1, '2026-07-15', '2026-07-16', 2.00, 'Family function', 'approved' ,    2, '2026-07-10 10:00:00'),
  -- Divya Menon
  (21, 12, 2,   33, '2026-07-20', '2026-07-21', 2.00, 'Severe migraine', 'approved' ,    1, '2026-07-20 08:25:00'),
  -- Karthik Reddy
  (22,  9, 3,   25, '2026-07-20', '2026-07-23', 4.00, 'Vacation - Kerala', 'approved' ,    1, '2026-07-10 15:30:00'),
  -- Priya Sharma
  (23,  2, 1,    4, '2026-07-22', '2026-07-22', 1.00, 'Personal errand', 'approved' ,    1, '2026-07-20 11:00:00'),
  -- Nikhil Bhat
  (24, 17, 2,   47, '2026-07-23', '2026-07-23', 1.00, 'Dental surgery', 'approved' ,   12, '2026-07-23 08:40:00'),
  -- Aditya Kulkarni
  (25, 15, 3,   42, '2026-07-27', '2026-07-29', 3.00, 'Wedding in the family', 'approved' ,    8, '2026-07-17 10:30:00'),
  -- Tara D'Souza
  (26, 18, 2,   49, '2026-07-30', '2026-07-31', 2.00, 'Back injury - advised rest', 'approved' ,   13, '2026-07-30 07:55:00'),
  -- Meera Krishnan
  (27, 10, 1,   26, '2026-08-03', '2026-08-04', 2.00, 'Parents visiting', 'approved' ,    2, '2026-07-30 16:20:00'),
  -- Priya Sharma
  (28,  2, 2,    5, '2026-08-05', '2026-08-05', 1.00, 'Fever', 'approved' ,    1, '2026-08-05 08:00:00'),
  -- Arjun Mehta
  (29,  5, 1,   12, '2026-08-06', '2026-08-06', 1.00, 'College convocation', 'approved' ,    6, '2026-08-03 10:10:00'),
  -- Nikhil Bhat
  (30, 17, 1,   46, '2026-08-07', '2026-08-07', 1.00, 'Personal work', 'approved' ,   12, '2026-08-05 14:00:00'),
  -- Divya Menon
  (31, 12, 3,   34, '2026-08-10', '2026-08-14', 5.00, 'Europe trip', 'approved' ,    1, '2026-07-28 11:45:00'),
  -- Rahul Verma
  (32,  3, 2,    8, '2026-08-11', '2026-08-12', 2.00, 'Stomach infection', 'approved' ,    8, '2026-08-11 07:30:00'),
  -- Aditya Kulkarni
  (33, 15, 2,   41, '2026-08-13', '2026-08-13', 1.00, 'Fever', 'approved' ,    8, '2026-08-13 08:20:00'),
  -- Kavya Iyer
  (34,  6, 3,   16, '2026-08-17', '2026-08-19', 3.00, 'Short break before payroll close', 'approved' ,    1, '2026-08-07 09:15:00'),
  -- Pooja Gupta
  (35, 16, 2,   44, '2026-08-18', '2026-08-18', 1.00, 'Doctor consultation', 'approved' ,    6, '2026-08-18 08:35:00'),
  -- Karthik Reddy
  (36,  9, 4, NULL, '2026-08-19', '2026-08-19', 1.00, 'Back-to-back client calls from home', 'approved' ,    1, '2026-08-18 17:00:00'),
  -- Rahul Verma
  (37,  3, 5, NULL, '2026-08-20', '2026-08-21', 2.00, 'Personal emergency - leave balance exhausted', 'approved' ,    8, '2026-08-19 10:00:00'),
  -- Ishita Bose
  (38, 14, 6,   51, '2026-08-21', '2026-08-21', 1.00, 'Comp off for Independence Day shift', 'approved' ,   13, '2026-08-18 12:30:00'),
  -- Ananya Rao
  (39, 11, 4, NULL, '2026-08-24', '2026-08-25', 2.00, 'Home renovation', 'approved' ,    8, '2026-08-21 16:10:00'),
  -- Neha Patel
  (40,  4, 5, NULL, '2026-08-24', '2026-08-25', 2.00, 'Extended personal leave - no balance left', 'approved' ,    9, '2026-08-20 11:20:00'),
  -- Sameer Khan
  (41, 13, 2,   36, '2026-08-27', '2026-08-28', 2.00, 'Food poisoning', 'approved' ,    1, '2026-08-27 07:45:00'),
  -- Vikram Singh
  (42,  8, 1,   20, '2026-08-31', '2026-08-31', 1.00, 'Personal work', 'approved' ,    1, '2026-08-27 15:50:00'),
  -- Rahul Verma
  (43,  3, 1,    7, '2026-09-01', '2026-09-03', 3.00, 'Vacation trip', 'approved' ,    8, '2026-08-25 16:00:00'),
  -- Arjun Mehta
  (44,  5, 2,   13, '2026-09-02', '2026-09-02', 1.00, 'Fever', 'approved' ,    6, '2026-09-02 08:15:00'),
  -- Sameer Khan
  (45, 13, 2,   36, '2026-09-07', '2026-09-07', 1.00, 'Fever - will share prescription', 'pending'  , NULL, NULL),
  -- Rahul Verma
  (46,  3, 4, NULL, '2026-09-08', '2026-09-08', 1.00, 'Plumber visiting home', 'pending'  , NULL, NULL),
  -- Pooja Gupta
  (47, 16, 1,   43, '2026-09-09', '2026-09-09', 1.00, 'Personal work', 'pending'  , NULL, NULL),
  -- Aditya Kulkarni
  (48, 15, 1,   40, '2026-09-11', '2026-09-11', 1.00, 'Yet to confirm dates', 'draft'    , NULL, NULL),
  -- Ananya Rao
  (49, 11, 3,   31, '2026-09-14', '2026-09-18', 5.00, 'Family wedding', 'pending'  , NULL, NULL),
  -- Divya Menon
  (50, 12, 3,   34, '2026-09-21', '2026-09-25', 5.00, 'Vacation - clashes with campaign launch week', 'refused'  ,    1, '2026-09-04 10:40:00'),
  -- Rohan Desai
  (51,  7, 1,   17, '2026-09-04', '2026-09-04', 1.00, 'Plans cancelled', 'withdrawn', NULL, NULL);
SELECT setval('time_off_requests_id_seq', (SELECT MAX(id) FROM time_off_requests));

-- ─────────────────────────────────────────────────────────────────────────────
-- Attendance — 2026-07-01 .. 2026-09-05 (848 rows)
-- ─────────────────────────────────────────────────────────────────────────────
-- Every row respects the employee's working schedule, joining/leaving dates,
-- company holidays and approved leave. Statuses in play: present, on_leave,
-- holiday, half_day, absent. Rows with a check-in but no check-out are
-- deliberate — they drive the "unreviewed attendance" payroll warning.
INSERT INTO attendance (employee_id, date, check_in, check_out, worked_hours, overtime_hours, overtime_type, is_manual_edit, edited_by, status) VALUES
  -- Anish Goenka (#1)
  ( 1, '2026-07-01', '2026-07-01 08:52:00'  , '2026-07-01 17:22:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-02', '2026-07-02 08:48:00'  , '2026-07-02 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-03', '2026-07-03 08:55:00'  , '2026-07-03 17:40:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-06', '2026-07-06 09:04:00'  , '2026-07-06 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-07', '2026-07-07 08:52:00'  , '2026-07-07 18:07:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-08', '2026-07-08 09:51:00'  , '2026-07-08 18:51:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-09', '2026-07-09 08:58:00'  , '2026-07-09 17:28:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-10', '2026-07-10 09:51:00'  , '2026-07-10 19:06:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-13', '2026-07-13 09:04:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-14', '2026-07-14 08:48:00'  , '2026-07-14 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-15', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 1, '2026-07-16', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 1, '2026-07-17', '2026-07-17 09:00:00'  , '2026-07-17 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-20', '2026-07-20 08:52:00'  , '2026-07-20 17:37:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-21', '2026-07-21 09:00:00'  , '2026-07-21 17:45:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-22', '2026-07-22 09:07:00'  , '2026-07-22 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-23', '2026-07-23 08:58:00'  , '2026-07-23 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 1, '2026-07-27', '2026-07-27 08:48:00'  , '2026-07-27 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-28', '2026-07-28 09:09:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-07-29', '2026-07-29 09:05:00'  , '2026-07-29 14:05:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'half_day'),
  ( 1, '2026-07-30', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'absent'),
  ( 1, '2026-07-31', '2026-07-31 08:55:00'  , '2026-07-31 18:10:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-03', '2026-08-03 09:28:00'  , '2026-08-03 18:43:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-04', '2026-08-04 08:55:00'  , '2026-08-04 19:25:00'  ,  9.50, 1.50, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 1, '2026-08-05', '2026-08-05 08:55:00'  , '2026-08-05 17:25:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-06', '2026-08-06 09:04:00'  , '2026-08-06 18:19:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-07', '2026-08-07 08:52:00'  , '2026-08-07 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-10', '2026-08-10 09:00:00'  , '2026-08-10 17:30:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-11', '2026-08-11 08:48:00'  , '2026-08-11 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-12', '2026-08-12 09:04:00'  , '2026-08-12 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-13', '2026-08-13 09:07:00'  , '2026-08-13 17:52:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-14', '2026-08-14 09:00:00'  , '2026-08-14 17:30:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-17', '2026-08-17 09:02:00'  , '2026-08-17 18:02:00'  ,  8.00, 0.00, NULL            , TRUE ,   10, 'present'),
  ( 1, '2026-08-18', '2026-08-18 09:07:00'  , '2026-08-18 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-19', '2026-08-19 09:07:00'  , '2026-08-19 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-20', '2026-08-20 09:02:00'  , '2026-08-20 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-21', '2026-08-21 09:51:00'  , '2026-08-21 18:51:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-24', '2026-08-24 09:28:00'  , '2026-08-24 18:28:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-25', '2026-08-25 08:55:00'  , '2026-08-25 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 1, '2026-08-27', '2026-08-27 09:09:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-28', '2026-08-28 09:51:00'  , '2026-08-28 19:06:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-08-31', '2026-08-31 09:04:00'  , '2026-08-31 18:34:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-09-01', '2026-09-01 09:42:00'  , '2026-09-01 18:42:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-09-02', '2026-09-02 08:58:00'  , '2026-09-02 17:28:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-09-03', '2026-09-03 09:07:00'  , '2026-09-03 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 1, '2026-09-04', '2026-09-04 08:58:00'  , '2026-09-04 18:13:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Priya Sharma (#2)
  ( 2, '2026-07-01', '2026-07-01 09:07:00'  , '2026-07-01 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-02', '2026-07-02 08:55:00'  , '2026-07-02 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-03', '2026-07-03 08:52:00'  , '2026-07-03 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-06', '2026-07-06 08:58:00'  , '2026-07-06 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-07', '2026-07-07 09:02:00'  , '2026-07-07 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-08', '2026-07-08 09:35:00'  , '2026-07-08 18:35:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-09', '2026-07-09 08:48:00'  , '2026-07-09 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-10', '2026-07-10 08:50:00'  , '2026-07-10 19:50:00'  , 10.00, 2.00, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 2, '2026-07-13', '2026-07-13 09:07:00'  , '2026-07-13 17:37:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-14', '2026-07-14 09:02:00'  , '2026-07-14 17:32:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-15', '2026-07-15 09:51:00'  , '2026-07-15 19:21:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-16', '2026-07-16 09:04:00'  , '2026-07-16 18:34:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-17', '2026-07-17 09:00:00'  , '2026-07-17 17:30:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-20', '2026-07-20 08:48:00'  , '2026-07-20 18:18:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-21', '2026-07-21 09:07:00'  , '2026-07-21 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-22', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 2, '2026-07-23', '2026-07-23 08:58:00'  , '2026-07-23 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 2, '2026-07-27', '2026-07-27 09:02:00'  , '2026-07-27 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-28', '2026-07-28 08:48:00'  , '2026-07-28 18:03:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-29', '2026-07-29 08:52:00'  , '2026-07-29 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-30', '2026-07-30 09:04:00'  , '2026-07-30 18:19:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-07-31', '2026-07-31 09:04:00'  , '2026-07-31 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-03', '2026-08-03 09:04:00'  , '2026-08-03 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-04', '2026-08-04 09:04:00'  , '2026-08-04 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-05', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 2, '2026-08-06', '2026-08-06 09:00:00'  , '2026-08-06 21:00:00'  , 11.00, 3.00, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 2, '2026-08-07', '2026-08-07 09:07:00'  , '2026-08-07 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-10', '2026-08-10 08:55:00'  , '2026-08-10 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-11', '2026-08-11 08:48:00'  , '2026-08-11 18:03:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-12', '2026-08-12 08:52:00'  , '2026-08-12 17:37:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-13', '2026-08-13 08:55:00'  , '2026-08-13 19:55:00'  , 10.00, 2.00, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 2, '2026-08-14', '2026-08-14 09:02:00'  , '2026-08-14 17:32:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-17', '2026-08-17 09:04:00'  , '2026-08-17 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-18', '2026-08-18 08:58:00'  , '2026-08-18 17:43:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-19', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'absent'),
  ( 2, '2026-08-20', '2026-08-20 09:04:00'  , '2026-08-20 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-21', '2026-08-21 09:02:00'  , '2026-08-21 18:32:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-24', '2026-08-24 09:04:00'  , '2026-08-24 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-25', '2026-08-25 09:02:00'  , '2026-08-25 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 2, '2026-08-27', '2026-08-27 09:00:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-28', '2026-08-28 09:02:00'  , '2026-08-28 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-08-31', '2026-08-31 09:28:00'  , '2026-08-31 18:28:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-09-01', '2026-09-01 09:00:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-09-02', '2026-09-02 08:58:00'  , '2026-09-02 18:28:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-09-03', '2026-09-03 09:04:00'  , '2026-09-03 18:34:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 2, '2026-09-04', '2026-09-04 08:52:00'  , '2026-09-04 17:37:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Rahul Verma (#3)
  ( 3, '2026-07-01', '2026-07-01 08:52:00'  , '2026-07-01 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-02', '2026-07-02 09:04:00'  , '2026-07-02 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-03', '2026-07-03 09:07:00'  , '2026-07-03 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-06', '2026-07-06 08:52:00'  , '2026-07-06 17:22:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-07', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 3, '2026-07-08', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 3, '2026-07-09', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'absent'),
  ( 3, '2026-07-10', '2026-07-10 08:55:00'  , '2026-07-10 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-11', '2026-07-11 10:00:00'  , '2026-07-11 14:00:00'  ,  4.00, 4.00, 'rest_day_work' , FALSE, NULL, 'present'),
  ( 3, '2026-07-13', '2026-07-13 09:04:00'  , '2026-07-13 17:34:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-14', '2026-07-14 09:35:00'  , '2026-07-14 18:35:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-15', '2026-07-15 08:52:00'  , '2026-07-15 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-16', '2026-07-16 09:00:00'  , '2026-07-16 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-17', '2026-07-17 08:48:00'  , '2026-07-17 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-20', '2026-07-20 08:52:00'  , '2026-07-20 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-21', '2026-07-21 09:04:00'  , '2026-07-21 18:19:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-22', '2026-07-22 09:07:00'  , '2026-07-22 18:22:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-23', '2026-07-23 09:00:00'  , '2026-07-23 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 3, '2026-07-27', '2026-07-27 09:07:00'  , '2026-07-27 18:37:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-28', '2026-07-28 09:35:00'  , '2026-07-28 18:35:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-29', '2026-07-29 08:52:00'  , '2026-07-29 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-30', '2026-07-30 09:28:00'  , '2026-07-30 18:28:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-07-31', '2026-07-31 08:48:00'  , '2026-07-31 17:18:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-08-03', '2026-08-03 08:58:00'  , '2026-08-03 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-08-04', '2026-08-04 08:55:00'  , '2026-08-04 19:55:00'  , 10.00, 2.00, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 3, '2026-08-05', '2026-08-05 09:00:00'  , '2026-08-05 17:45:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-08-06', '2026-08-06 09:09:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-08-07', '2026-08-07 09:02:00'  , '2026-08-07 18:32:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-08-10', '2026-08-10 08:55:00'  , '2026-08-10 18:10:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-08-11', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 3, '2026-08-12', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 3, '2026-08-13', '2026-08-13 09:00:00'  , '2026-08-13 18:30:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-08-14', '2026-08-14 09:42:00'  , '2026-08-14 18:57:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-08-17', '2026-08-17 09:02:00'  , '2026-08-17 18:17:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-08-18', '2026-08-18 08:52:00'  , '2026-08-18 18:07:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-08-19', '2026-08-19 09:07:00'  , '2026-08-19 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-08-20', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 3, '2026-08-21', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 3, '2026-08-24', '2026-08-24 08:52:00'  , '2026-08-24 17:37:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-08-25', '2026-08-25 08:48:00'  , '2026-08-25 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 3, '2026-08-27', '2026-08-27 09:02:00'  , '2026-08-27 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-08-28', '2026-08-28 09:04:00'  , '2026-08-28 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-08-31', '2026-08-31 09:07:00'  , '2026-08-31 18:22:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 3, '2026-09-01', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 3, '2026-09-02', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 3, '2026-09-03', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 3, '2026-09-04', '2026-09-04 08:52:00'  , '2026-09-04 18:22:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Neha Patel (#4)
  ( 4, '2026-07-01', '2026-07-01 09:07:00'  , '2026-07-01 13:37:00'  ,  4.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-02', '2026-07-02 09:04:00'  , '2026-07-02 13:04:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-03', '2026-07-03 09:00:00'  , '2026-07-03 13:15:00'  ,  4.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-06', '2026-07-06 09:28:00'  , '2026-07-06 12:58:00'  ,  3.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-07', '2026-07-07 09:02:00'  , '2026-07-07 13:02:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-08', '2026-07-08 09:02:00'  , '2026-07-08 12:47:00'  ,  3.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-09', '2026-07-09 09:07:00'  , '2026-07-09 13:07:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-10', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 4, '2026-07-13', '2026-07-13 09:07:00'  , '2026-07-13 13:07:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-14', '2026-07-14 09:28:00'  , '2026-07-14 13:28:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-15', '2026-07-15 09:00:00'  , '2026-07-15 13:15:00'  ,  4.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-16', '2026-07-16 08:52:00'  , '2026-07-16 13:07:00'  ,  4.25, 0.00, NULL            , TRUE ,   10, 'present'),
  ( 4, '2026-07-17', '2026-07-17 09:04:00'  , '2026-07-17 12:34:00'  ,  3.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-20', '2026-07-20 09:02:00'  , '2026-07-20 13:02:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-21', '2026-07-21 09:02:00'  , '2026-07-21 13:02:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-22', '2026-07-22 09:00:00'  , '2026-07-22 13:00:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-23', '2026-07-23 08:58:00'  , '2026-07-23 13:13:00'  ,  4.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 4, '2026-07-27', '2026-07-27 09:02:00'  , '2026-07-27 13:02:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-28', '2026-07-28 09:35:00'  , '2026-07-28 13:35:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-29', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'absent'),
  ( 4, '2026-07-30', '2026-07-30 09:28:00'  , '2026-07-30 13:58:00'  ,  4.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-07-31', '2026-07-31 09:04:00'  , '2026-07-31 13:04:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-03', '2026-08-03 08:58:00'  , '2026-08-03 12:58:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-04', '2026-08-04 09:07:00'  , '2026-08-04 13:37:00'  ,  4.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-05', '2026-08-05 08:55:00'  , '2026-08-05 12:55:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-06', '2026-08-06 09:02:00'  , '2026-08-06 13:02:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-07', '2026-08-07 08:48:00'  , '2026-08-07 12:48:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-10', '2026-08-10 09:00:00'  , '2026-08-10 13:15:00'  ,  4.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-11', '2026-08-11 08:58:00'  , '2026-08-11 12:58:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-12', '2026-08-12 08:55:00'  , '2026-08-12 12:55:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-13', '2026-08-13 09:00:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-14', '2026-08-14 08:52:00'  , '2026-08-14 12:22:00'  ,  3.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-17', '2026-08-17 09:42:00'  , '2026-08-17 14:12:00'  ,  4.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-18', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'absent'),
  ( 4, '2026-08-19', '2026-08-19 09:04:00'  , '2026-08-19 12:49:00'  ,  3.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-20', '2026-08-20 09:00:00'  , '2026-08-20 13:30:00'  ,  4.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-21', '2026-08-21 09:02:00'  , '2026-08-21 13:02:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 4, '2026-08-25', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 4, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 4, '2026-08-27', '2026-08-27 08:48:00'  , '2026-08-27 12:33:00'  ,  3.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-28', '2026-08-28 09:51:00'  , '2026-08-28 14:21:00'  ,  4.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-08-31', '2026-08-31 09:04:00'  , '2026-08-31 13:04:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-09-01', '2026-09-01 08:52:00'  , '2026-09-01 13:22:00'  ,  4.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-09-02', '2026-09-02 09:07:00'  , '2026-09-02 13:07:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-09-03', '2026-09-03 08:55:00'  , '2026-09-03 12:25:00'  ,  3.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 4, '2026-09-04', '2026-09-04 09:51:00'  , '2026-09-04 13:51:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Arjun Mehta (#5)
  ( 5, '2026-07-01', '2026-07-01 09:07:00'  , '2026-07-01 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-02', '2026-07-02 09:04:00'  , '2026-07-02 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-03', '2026-07-03 09:04:00'  , '2026-07-03 17:34:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-06', '2026-07-06 09:07:00'  , '2026-07-06 17:52:00'  ,  7.75, 0.00, NULL            , TRUE ,    2, 'present'),
  ( 5, '2026-07-07', '2026-07-07 09:02:00'  , '2026-07-07 17:47:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-08', '2026-07-08 08:58:00'  , '2026-07-08 17:43:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-09', '2026-07-09 08:52:00'  , '2026-07-09 18:22:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-10', '2026-07-10 09:42:00'  , '2026-07-10 19:12:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-13', '2026-07-13 08:58:00'  , '2026-07-13 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-14', '2026-07-14 08:55:00'  , '2026-07-14 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-15', '2026-07-15 09:07:00'  , '2026-07-15 18:37:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-16', '2026-07-16 09:07:00'  , '2026-07-16 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-17', '2026-07-17 08:58:00'  , '2026-07-17 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-20', '2026-07-20 09:00:00'  , '2026-07-20 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-21', '2026-07-21 08:58:00'  , '2026-07-21 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-22', '2026-07-22 08:52:00'  , '2026-07-22 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-23', '2026-07-23 09:04:00'  , '2026-07-23 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 5, '2026-07-27', '2026-07-27 08:52:00'  , '2026-07-27 17:37:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-28', '2026-07-28 08:52:00'  , '2026-07-28 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-29', '2026-07-29 08:58:00'  , '2026-07-29 17:28:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-30', '2026-07-30 09:51:00'  , '2026-07-30 18:51:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-07-31', '2026-07-31 09:00:00'  , '2026-07-31 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-03', '2026-08-03 08:55:00'  , '2026-08-03 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-04', '2026-08-04 08:48:00'  , '2026-08-04 17:33:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-05', '2026-08-05 09:07:00'  , '2026-08-05 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-06', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 5, '2026-08-07', '2026-08-07 09:07:00'  , '2026-08-07 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-10', '2026-08-10 08:52:00'  , '2026-08-10 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-11', '2026-08-11 09:04:00'  , '2026-08-11 17:49:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-12', '2026-08-12 09:42:00'  , '2026-08-12 18:42:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-13', '2026-08-13 09:42:00'  , '2026-08-13 18:27:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-14', '2026-08-14 09:00:00'  , '2026-08-14 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-17', '2026-08-17 09:28:00'  , '2026-08-17 18:13:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-18', '2026-08-18 08:55:00'  , '2026-08-18 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-19', '2026-08-19 09:00:00'  , '2026-08-19 17:30:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-20', '2026-08-20 08:48:00'  , '2026-08-20 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-21', '2026-08-21 09:04:00'  , '2026-08-21 17:49:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-24', '2026-08-24 09:04:00'  , '2026-08-24 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-25', '2026-08-25 09:00:00'  , '2026-08-25 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 5, '2026-08-27', '2026-08-27 09:28:00'  , '2026-08-27 17:58:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-28', '2026-08-28 09:00:00'  , '2026-08-28 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-08-31', '2026-08-31 09:51:00'  , '2026-08-31 18:21:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-09-01', '2026-09-01 09:35:00'  , '2026-09-01 18:05:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-09-02', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 5, '2026-09-03', '2026-09-03 09:00:00'  , '2026-09-03 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 5, '2026-09-04', '2026-09-04 09:28:00'  , '2026-09-04 18:28:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Kavya Iyer (#6)
  ( 6, '2026-07-01', '2026-07-01 09:04:00'  , '2026-07-01 17:34:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-02', '2026-07-02 08:55:00'  , '2026-07-02 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-03', '2026-07-03 08:48:00'  , '2026-07-03 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-06', '2026-07-06 08:48:00'  , '2026-07-06 17:33:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-07', '2026-07-07 09:04:00'  , '2026-07-07 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-08', '2026-07-08 08:52:00'  , '2026-07-08 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-09', '2026-07-09 09:02:00'  , '2026-07-09 17:32:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-10', '2026-07-10 09:51:00'  , '2026-07-10 18:51:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-13', '2026-07-13 09:00:00'  , '2026-07-13 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-14', '2026-07-14 09:07:00'  , '2026-07-14 18:22:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-15', '2026-07-15 08:48:00'  , '2026-07-15 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-16', '2026-07-16 08:48:00'  , '2026-07-16 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-17', '2026-07-17 08:50:00'  , '2026-07-17 18:50:00'  ,  9.00, 1.00, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 6, '2026-07-20', '2026-07-20 09:07:00'  , '2026-07-20 17:37:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-21', '2026-07-21 08:48:00'  , '2026-07-21 17:33:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-22', '2026-07-22 08:55:00'  , '2026-07-22 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-23', '2026-07-23 08:55:00'  , '2026-07-23 18:10:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 6, '2026-07-27', '2026-07-27 09:02:00'  , '2026-07-27 17:32:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-28', '2026-07-28 09:04:00'  , '2026-07-28 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-29', '2026-07-29 09:04:00'  , '2026-07-29 18:19:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-30', '2026-07-30 08:58:00'  , '2026-07-30 18:13:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-07-31', '2026-07-31 08:48:00'  , '2026-07-31 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-08-03', '2026-08-03 09:00:00'  , '2026-08-03 17:30:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-08-04', '2026-08-04 09:42:00'  , '2026-08-04 18:42:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-08-05', '2026-08-05 09:51:00'  , '2026-08-05 18:51:00'  ,  8.00, 0.00, NULL            , TRUE ,    2, 'present'),
  ( 6, '2026-08-06', '2026-08-06 08:55:00'  , '2026-08-06 19:25:00'  ,  9.50, 1.50, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 6, '2026-08-07', '2026-08-07 09:28:00'  , '2026-08-07 18:28:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-08-10', '2026-08-10 08:55:00'  , '2026-08-10 19:25:00'  ,  9.50, 1.50, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 6, '2026-08-11', '2026-08-11 09:07:00'  , '2026-08-11 18:37:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-08-12', '2026-08-12 08:52:00'  , '2026-08-12 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-08-13', '2026-08-13 09:00:00'  , '2026-08-13 14:00:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'half_day'),
  ( 6, '2026-08-14', '2026-08-14 09:02:00'  , '2026-08-14 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-08-17', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 6, '2026-08-18', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 6, '2026-08-19', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 6, '2026-08-20', '2026-08-20 09:02:00'  , '2026-08-20 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-08-21', '2026-08-21 08:50:00'  , '2026-08-21 19:50:00'  , 10.00, 2.00, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 6, '2026-08-24', '2026-08-24 08:48:00'  , '2026-08-24 18:18:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-08-25', '2026-08-25 09:07:00'  , '2026-08-25 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 6, '2026-08-27', '2026-08-27 08:52:00'  , '2026-08-27 18:22:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-08-28', '2026-08-28 09:07:00'  , '2026-08-28 17:37:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-08-31', '2026-08-31 08:50:00'  , '2026-08-31 20:50:00'  , 11.00, 3.00, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 6, '2026-09-01', '2026-09-01 09:04:00'  , '2026-09-01 18:19:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-09-02', '2026-09-02 09:04:00'  , '2026-09-02 18:34:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-09-03', '2026-09-03 09:00:00'  , '2026-09-03 17:45:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 6, '2026-09-04', '2026-09-04 08:58:00'  , '2026-09-04 17:28:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Rohan Desai (#7)
  ( 7, '2026-07-01', '2026-07-01 09:02:00'  , '2026-07-01 18:32:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-07-02', '2026-07-02 08:52:00'  , '2026-07-02 17:37:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-07-03', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 7, '2026-07-06', '2026-07-06 08:55:00'  , '2026-07-06 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-07-07', '2026-07-07 08:50:00'  , '2026-07-07 20:20:00'  , 10.50, 2.50, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 7, '2026-07-08', '2026-07-08 08:58:00'  , '2026-07-08 18:13:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-07-09', '2026-07-09 09:04:00'  , '2026-07-09 18:19:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-07-10', '2026-07-10 08:55:00'  , '2026-07-10 17:55:00'  ,  8.00, 0.00, NULL            , TRUE ,    2, 'present'),
  ( 7, '2026-07-13', '2026-07-13 08:52:00'  , '2026-07-13 17:52:00'  ,  8.00, 0.00, NULL            , TRUE ,   10, 'present'),
  ( 7, '2026-07-14', '2026-07-14 09:35:00'  , '2026-07-14 18:35:00'  ,  8.00, 0.00, NULL            , TRUE ,   10, 'present'),
  ( 7, '2026-07-15', '2026-07-15 09:02:00'  , '2026-07-15 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-07-16', '2026-07-16 09:04:00'  , '2026-07-16 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-07-17', '2026-07-17 09:35:00'  , '2026-07-17 18:50:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-07-20', '2026-07-20 09:04:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-07-21', '2026-07-21 09:07:00'  , '2026-07-21 17:52:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-07-22', '2026-07-22 08:50:00'  , '2026-07-22 20:50:00'  , 11.00, 3.00, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 7, '2026-07-23', '2026-07-23 09:07:00'  , '2026-07-23 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 7, '2026-07-27', '2026-07-27 09:02:00'  , '2026-07-27 18:17:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-07-28', '2026-07-28 09:07:00'  , '2026-07-28 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-07-29', '2026-07-29 09:04:00'  , '2026-07-29 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-07-30', '2026-07-30 09:07:00'  , '2026-07-30 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-07-31', '2026-07-31 09:07:00'  , '2026-07-31 17:37:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-03', '2026-08-03 09:02:00'  , '2026-08-03 17:32:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-04', '2026-08-04 09:02:00'  , '2026-08-04 17:32:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-05', '2026-08-05 08:50:00'  , '2026-08-05 20:50:00'  , 11.00, 3.00, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 7, '2026-08-06', '2026-08-06 09:00:00'  , '2026-08-06 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-07', '2026-08-07 08:52:00'  , '2026-08-07 17:22:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-10', '2026-08-10 08:58:00'  , '2026-08-10 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-11', '2026-08-11 08:48:00'  , '2026-08-11 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-12', '2026-08-12 08:58:00'  , '2026-08-12 18:13:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-13', '2026-08-13 09:02:00'  , '2026-08-13 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-14', '2026-08-14 09:00:00'  , '2026-08-14 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-17', '2026-08-17 08:55:00'  , '2026-08-17 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-18', '2026-08-18 08:55:00'  , '2026-08-18 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-19', '2026-08-19 09:04:00'  , '2026-08-19 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-20', '2026-08-20 09:00:00'  , '2026-08-20 18:15:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-21', '2026-08-21 08:58:00'  , '2026-08-21 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-24', '2026-08-24 08:55:00'  , '2026-08-24 18:10:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-25', '2026-08-25 09:02:00'  , '2026-08-25 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 7, '2026-08-27', '2026-08-27 09:07:00'  , '2026-08-27 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-28', '2026-08-28 08:52:00'  , '2026-08-28 17:22:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-08-31', '2026-08-31 09:07:00'  , '2026-08-31 18:22:00'  ,  8.25, 0.00, NULL            , TRUE ,    2, 'present'),
  ( 7, '2026-09-01', '2026-09-01 08:55:00'  , '2026-09-01 17:55:00'  ,  8.00, 0.00, NULL            , TRUE ,    2, 'present'),
  ( 7, '2026-09-02', '2026-09-02 08:55:00'  , '2026-09-02 18:25:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-09-03', '2026-09-03 09:00:00'  , '2026-09-03 18:15:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 7, '2026-09-04', '2026-09-04 09:04:00'  , '2026-09-04 18:19:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Vikram Singh (#8)
  ( 8, '2026-07-01', '2026-07-01 08:58:00'  , '2026-07-01 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-07-02', '2026-07-02 09:07:00'  , '2026-07-02 17:52:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-07-03', '2026-07-03 09:02:00'  , '2026-07-03 18:02:00'  ,  8.00, 0.00, NULL            , TRUE ,   10, 'present'),
  ( 8, '2026-07-06', '2026-07-06 08:58:00'  , '2026-07-06 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-07-07', '2026-07-07 08:55:00'  , '2026-07-07 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-07-08', '2026-07-08 09:09:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-07-09', '2026-07-09 08:55:00'  , '2026-07-09 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-07-10', '2026-07-10 09:04:00'  , '2026-07-10 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-07-11', '2026-07-11 10:00:00'  , '2026-07-11 14:00:00'  ,  4.00, 4.00, 'rest_day_work' , FALSE, NULL, 'present'),
  ( 8, '2026-07-13', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 8, '2026-07-14', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 8, '2026-07-15', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 8, '2026-07-16', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 8, '2026-07-17', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 8, '2026-07-20', '2026-07-20 09:51:00'  , '2026-07-20 18:51:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-07-21', '2026-07-21 09:51:00'  , '2026-07-21 18:51:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-07-22', '2026-07-22 08:55:00'  , '2026-07-22 17:25:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-07-23', '2026-07-23 09:28:00'  , '2026-07-23 17:58:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 8, '2026-07-27', '2026-07-27 09:07:00'  , '2026-07-27 18:22:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-07-28', '2026-07-28 09:07:00'  , '2026-07-28 17:37:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-07-29', '2026-07-29 08:58:00'  , '2026-07-29 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-07-30', '2026-07-30 09:04:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-07-31', '2026-07-31 09:04:00'  , '2026-07-31 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-03', '2026-08-03 09:04:00'  , '2026-08-03 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-04', '2026-08-04 08:52:00'  , '2026-08-04 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-05', '2026-08-05 09:00:00'  , '2026-08-05 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-06', '2026-08-06 08:55:00'  , '2026-08-06 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-07', '2026-08-07 09:02:00'  , '2026-08-07 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-10', '2026-08-10 09:00:00'  , '2026-08-10 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-11', '2026-08-11 08:52:00'  , '2026-08-11 18:22:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-12', '2026-08-12 09:42:00'  , '2026-08-12 18:12:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-13', '2026-08-13 09:09:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-14', '2026-08-14 09:04:00'  , '2026-08-14 17:34:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-17', '2026-08-17 08:48:00'  , '2026-08-17 17:18:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-18', '2026-08-18 09:04:00'  , '2026-08-18 17:49:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-19', '2026-08-19 09:09:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-20', '2026-08-20 09:00:00'  , '2026-08-20 21:00:00'  , 11.00, 3.00, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 8, '2026-08-21', '2026-08-21 08:50:00'  , '2026-08-21 19:20:00'  ,  9.50, 1.50, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 8, '2026-08-24', '2026-08-24 09:00:00'  , '2026-08-24 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-25', '2026-08-25 09:04:00'  , '2026-08-25 18:04:00'  ,  8.00, 0.00, NULL            , TRUE ,   10, 'present'),
  ( 8, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 8, '2026-08-27', '2026-08-27 09:04:00'  , '2026-08-27 17:34:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-08-28', '2026-08-28 09:00:00'  , '2026-08-28 19:30:00'  ,  9.50, 1.50, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 8, '2026-08-31', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 8, '2026-09-01', '2026-09-01 08:48:00'  , '2026-09-01 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-09-02', '2026-09-02 08:58:00'  , '2026-09-02 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-09-03', '2026-09-03 09:02:00'  , '2026-09-03 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 8, '2026-09-04', '2026-09-04 08:55:00'  , '2026-09-04 20:25:00'  , 10.50, 2.50, 'regular_ot'    , FALSE, NULL, 'present'),
  -- Karthik Reddy (#9)
  ( 9, '2026-07-01', '2026-07-01 08:48:00'  , '2026-07-01 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-02', '2026-07-02 09:07:00'  , '2026-07-02 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-03', '2026-07-03 08:48:00'  , '2026-07-03 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-06', '2026-07-06 09:02:00'  , '2026-07-06 18:17:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-07', '2026-07-07 09:00:00'  , '2026-07-07 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-08', '2026-07-08 08:58:00'  , '2026-07-08 18:28:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-09', '2026-07-09 09:02:00'  , '2026-07-09 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-10', '2026-07-10 08:52:00'  , '2026-07-10 18:07:00'  ,  8.25, 0.00, NULL            , TRUE ,   10, 'present'),
  ( 9, '2026-07-13', '2026-07-13 09:04:00'  , '2026-07-13 17:49:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-14', '2026-07-14 09:28:00'  , '2026-07-14 17:58:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-15', '2026-07-15 08:58:00'  , '2026-07-15 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-16', '2026-07-16 09:00:00'  , '2026-07-16 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-17', '2026-07-17 08:55:00'  , '2026-07-17 18:25:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-20', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 9, '2026-07-21', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 9, '2026-07-22', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 9, '2026-07-23', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  ( 9, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 9, '2026-07-27', '2026-07-27 09:07:00'  , '2026-07-27 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-28', '2026-07-28 08:55:00'  , '2026-07-28 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-29', '2026-07-29 09:04:00'  , '2026-07-29 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-30', '2026-07-30 09:00:00'  , '2026-07-30 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-07-31', '2026-07-31 09:00:00'  , '2026-07-31 18:15:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-03', '2026-08-03 08:55:00'  , '2026-08-03 20:25:00'  , 10.50, 2.50, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 9, '2026-08-04', '2026-08-04 08:52:00'  , '2026-08-04 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-05', '2026-08-05 09:07:00'  , '2026-08-05 17:52:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-06', '2026-08-06 09:04:00'  , '2026-08-06 17:34:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-07', '2026-08-07 08:58:00'  , '2026-08-07 17:43:00'  ,  7.75, 0.00, NULL            , TRUE ,   10, 'present'),
  ( 9, '2026-08-08', '2026-08-08 10:00:00'  , '2026-08-08 14:00:00'  ,  4.00, 4.00, 'rest_day_work' , FALSE, NULL, 'present'),
  ( 9, '2026-08-10', '2026-08-10 09:02:00'  , '2026-08-10 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-11', '2026-08-11 09:42:00'  , '2026-08-11 18:42:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-12', '2026-08-12 09:02:00'  , '2026-08-12 18:17:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-13', '2026-08-13 08:55:00'  , '2026-08-13 18:55:00'  ,  9.00, 1.00, 'regular_ot'    , FALSE, NULL, 'present'),
  ( 9, '2026-08-14', '2026-08-14 09:02:00'  , '2026-08-14 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-17', '2026-08-17 09:04:00'  , '2026-08-17 18:34:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-18', '2026-08-18 08:48:00'  , '2026-08-18 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-19', '2026-08-19 09:05:00'  , '2026-08-19 18:05:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-20', '2026-08-20 08:52:00'  , '2026-08-20 18:22:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-21', '2026-08-21 09:00:00'  , '2026-08-21 17:30:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-24', '2026-08-24 09:02:00'  , '2026-08-24 18:17:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-25', '2026-08-25 08:55:00'  , '2026-08-25 17:25:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  ( 9, '2026-08-27', '2026-08-27 08:55:00'  , '2026-08-27 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-28', '2026-08-28 08:48:00'  , '2026-08-28 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-08-31', '2026-08-31 09:28:00'  , '2026-08-31 18:28:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-09-01', '2026-09-01 09:00:00'  , '2026-09-01 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-09-02', '2026-09-02 08:58:00'  , '2026-09-02 17:28:00'  ,  7.50, 0.00, NULL            , TRUE ,    2, 'present'),
  ( 9, '2026-09-03', '2026-09-03 09:51:00'  , '2026-09-03 18:51:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  ( 9, '2026-09-04', '2026-09-04 09:09:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Meera Krishnan (#10)
  (10, '2026-07-01', '2026-07-01 09:00:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-02', '2026-07-02 08:55:00'  , '2026-07-02 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-03', '2026-07-03 09:00:00'  , '2026-07-03 17:30:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-06', '2026-07-06 08:52:00'  , '2026-07-06 17:37:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-07', '2026-07-07 08:52:00'  , '2026-07-07 18:22:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-08', '2026-07-08 09:28:00'  , '2026-07-08 18:58:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-09', '2026-07-09 09:07:00'  , '2026-07-09 17:37:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-10', '2026-07-10 08:48:00'  , '2026-07-10 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-13', '2026-07-13 09:07:00'  , '2026-07-13 17:37:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-14', '2026-07-14 08:55:00'  , '2026-07-14 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-15', '2026-07-15 09:42:00'  , '2026-07-15 18:42:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-16', '2026-07-16 08:48:00'  , '2026-07-16 18:18:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-17', '2026-07-17 09:00:00'  , '2026-07-17 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-20', '2026-07-20 08:48:00'  , '2026-07-20 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-21', '2026-07-21 09:28:00'  , '2026-07-21 18:28:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-22', '2026-07-22 09:28:00'  , '2026-07-22 18:28:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-23', '2026-07-23 08:52:00'  , '2026-07-23 18:22:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  (10, '2026-07-27', '2026-07-27 09:35:00'  , '2026-07-27 18:35:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-28', '2026-07-28 08:58:00'  , '2026-07-28 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-29', '2026-07-29 09:42:00'  , '2026-07-29 18:42:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-30', '2026-07-30 09:02:00'  , '2026-07-30 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-07-31', '2026-07-31 09:00:00'  , '2026-07-31 17:30:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-03', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (10, '2026-08-04', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (10, '2026-08-05', '2026-08-05 08:48:00'  , '2026-08-05 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-06', '2026-08-06 08:55:00'  , '2026-08-06 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-07', '2026-08-07 09:51:00'  , '2026-08-07 19:21:00'  ,  8.50, 0.00, NULL            , TRUE ,    2, 'present'),
  (10, '2026-08-10', '2026-08-10 09:07:00'  , '2026-08-10 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-11', '2026-08-11 08:48:00'  , '2026-08-11 17:33:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-12', '2026-08-12 08:58:00'  , '2026-08-12 17:28:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-13', '2026-08-13 09:04:00'  , '2026-08-13 18:19:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-14', '2026-08-14 08:48:00'  , '2026-08-14 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-17', '2026-08-17 08:52:00'  , '2026-08-17 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-18', '2026-08-18 09:07:00'  , '2026-08-18 18:22:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-19', '2026-08-19 08:58:00'  , '2026-08-19 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-20', '2026-08-20 09:42:00'  , '2026-08-20 18:12:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-21', '2026-08-21 09:07:00'  , '2026-08-21 18:37:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-24', '2026-08-24 08:52:00'  , '2026-08-24 18:22:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-25', '2026-08-25 09:04:00'  , '2026-08-25 17:34:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  (10, '2026-08-27', '2026-08-27 08:55:00'  , '2026-08-27 17:25:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-28', '2026-08-28 09:02:00'  , '2026-08-28 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-08-31', '2026-08-31 08:52:00'  , '2026-08-31 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-09-01', '2026-09-01 09:00:00'  , '2026-09-01 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-09-02', '2026-09-02 09:04:00'  , '2026-09-02 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-09-03', '2026-09-03 09:07:00'  , '2026-09-03 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (10, '2026-09-04', '2026-09-04 09:00:00'  , '2026-09-04 18:30:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Ananya Rao (#11)
  (11, '2026-07-01', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'absent'),
  (11, '2026-07-02', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (11, '2026-07-03', '2026-07-03 09:02:00'  , '2026-07-03 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-06', '2026-07-06 08:58:00'  , '2026-07-06 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-07', '2026-07-07 08:55:00'  , '2026-07-07 18:25:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-08', '2026-07-08 09:28:00'  , '2026-07-08 18:28:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-09', '2026-07-09 08:55:00'  , '2026-07-09 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-10', '2026-07-10 08:52:00'  , '2026-07-10 17:22:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-13', '2026-07-13 08:52:00'  , '2026-07-13 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-14', '2026-07-14 09:51:00'  , '2026-07-14 18:51:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-15', '2026-07-15 09:07:00'  , '2026-07-15 17:37:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-16', '2026-07-16 08:52:00'  , '2026-07-16 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-17', '2026-07-17 09:35:00'  , '2026-07-17 18:35:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-20', '2026-07-20 08:55:00'  , '2026-07-20 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-21', '2026-07-21 09:00:00'  , '2026-07-21 17:45:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-22', '2026-07-22 09:02:00'  , '2026-07-22 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-23', '2026-07-23 08:58:00'  , '2026-07-23 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  (11, '2026-07-27', '2026-07-27 08:48:00'  , '2026-07-27 18:03:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-28', '2026-07-28 08:52:00'  , '2026-07-28 17:52:00'  ,  8.00, 0.00, NULL            , TRUE ,   10, 'present'),
  (11, '2026-07-29', '2026-07-29 09:09:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-07-30', '2026-07-30 08:50:00'  , '2026-07-30 19:20:00'  ,  9.50, 1.50, 'regular_ot'    , FALSE, NULL, 'present'),
  (11, '2026-07-31', '2026-07-31 08:52:00'  , '2026-07-31 17:37:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-03', '2026-08-03 08:55:00'  , '2026-08-03 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-04', '2026-08-04 09:04:00'  , '2026-08-04 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-05', '2026-08-05 09:04:00'  , '2026-08-05 17:49:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-06', '2026-08-06 09:42:00'  , '2026-08-06 18:12:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-07', '2026-08-07 09:00:00'  , '2026-08-07 20:30:00'  , 10.50, 2.50, 'regular_ot'    , FALSE, NULL, 'present'),
  (11, '2026-08-10', '2026-08-10 08:48:00'  , '2026-08-10 17:18:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-11', '2026-08-11 09:02:00'  , '2026-08-11 18:32:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-12', '2026-08-12 09:35:00'  , '2026-08-12 18:35:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-13', '2026-08-13 08:58:00'  , '2026-08-13 18:28:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-14', '2026-08-14 09:07:00'  , '2026-08-14 17:37:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-17', '2026-08-17 09:00:00'  , '2026-08-17 19:00:00'  ,  9.00, 1.00, 'regular_ot'    , FALSE, NULL, 'present'),
  (11, '2026-08-18', '2026-08-18 09:35:00'  , '2026-08-18 18:35:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-19', '2026-08-19 08:58:00'  , '2026-08-19 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-20', '2026-08-20 09:00:00'  , '2026-08-20 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-21', '2026-08-21 09:51:00'  , '2026-08-21 19:21:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-24', '2026-08-24 09:05:00'  , '2026-08-24 18:05:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-25', '2026-08-25 09:02:00'  , '2026-08-25 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  (11, '2026-08-27', '2026-08-27 09:07:00'  , '2026-08-27 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-28', '2026-08-28 08:52:00'  , '2026-08-28 18:22:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-08-31', '2026-08-31 09:02:00'  , '2026-08-31 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-09-01', '2026-09-01 09:07:00'  , '2026-09-01 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-09-02', '2026-09-02 08:48:00'  , '2026-09-02 18:03:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-09-03', '2026-09-03 08:58:00'  , '2026-09-03 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (11, '2026-09-04', '2026-09-04 09:00:00'  , '2026-09-04 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Divya Menon (#12)
  (12, '2026-07-01', '2026-07-01 09:02:00'  , '2026-07-01 17:47:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-07-02', '2026-07-02 09:04:00'  , '2026-07-02 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-07-03', '2026-07-03 09:05:00'  , '2026-07-03 14:05:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'half_day'),
  (12, '2026-07-06', '2026-07-06 09:42:00'  , '2026-07-06 18:42:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-07-07', '2026-07-07 08:52:00'  , '2026-07-07 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-07-08', '2026-07-08 09:04:00'  , '2026-07-08 18:34:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-07-09', '2026-07-09 09:02:00'  , '2026-07-09 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-07-10', '2026-07-10 09:04:00'  , '2026-07-10 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-07-13', '2026-07-13 09:09:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-07-14', '2026-07-14 08:58:00'  , '2026-07-14 18:28:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-07-15', '2026-07-15 09:07:00'  , '2026-07-15 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-07-16', '2026-07-16 08:48:00'  , '2026-07-16 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-07-17', '2026-07-17 09:07:00'  , '2026-07-17 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-07-20', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (12, '2026-07-21', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (12, '2026-07-22', '2026-07-22 08:55:00'  , '2026-07-22 18:55:00'  ,  9.00, 1.00, 'regular_ot'    , FALSE, NULL, 'present'),
  (12, '2026-07-23', '2026-07-23 08:52:00'  , '2026-07-23 18:22:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  (12, '2026-07-27', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'absent'),
  (12, '2026-07-28', '2026-07-28 09:02:00'  , '2026-07-28 18:32:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-07-29', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'absent'),
  (12, '2026-07-30', '2026-07-30 09:07:00'  , '2026-07-30 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-07-31', '2026-07-31 09:00:00'  , '2026-07-31 20:30:00'  , 10.50, 2.50, 'regular_ot'    , FALSE, NULL, 'present'),
  (12, '2026-08-03', '2026-08-03 09:28:00'  , '2026-08-03 18:28:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-08-04', '2026-08-04 08:55:00'  , '2026-08-04 20:25:00'  , 10.50, 2.50, 'regular_ot'    , FALSE, NULL, 'present'),
  (12, '2026-08-05', '2026-08-05 08:58:00'  , '2026-08-05 17:43:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-08-06', '2026-08-06 09:00:00'  , '2026-08-06 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-08-07', '2026-08-07 09:02:00'  , '2026-08-07 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-08-10', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (12, '2026-08-11', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (12, '2026-08-12', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (12, '2026-08-13', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (12, '2026-08-14', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (12, '2026-08-17', '2026-08-17 08:58:00'  , '2026-08-17 17:43:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-08-18', '2026-08-18 08:58:00'  , '2026-08-18 18:28:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-08-19', '2026-08-19 09:00:00'  , '2026-08-19 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-08-20', '2026-08-20 08:55:00'  , '2026-08-20 18:25:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-08-21', '2026-08-21 08:52:00'  , '2026-08-21 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-08-24', '2026-08-24 09:00:00'  , '2026-08-24 21:00:00'  , 11.00, 3.00, 'regular_ot'    , FALSE, NULL, 'present'),
  (12, '2026-08-25', '2026-08-25 08:55:00'  , '2026-08-25 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  (12, '2026-08-27', '2026-08-27 09:00:00'  , '2026-08-27 18:30:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-08-28', '2026-08-28 09:04:00'  , '2026-08-28 17:34:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-08-31', '2026-08-31 09:00:00'  , '2026-08-31 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-09-01', '2026-09-01 09:35:00'  , '2026-09-01 18:50:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-09-02', '2026-09-02 09:07:00'  , '2026-09-02 18:37:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-09-03', '2026-09-03 09:07:00'  , '2026-09-03 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (12, '2026-09-04', '2026-09-04 09:00:00'  , '2026-09-04 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Sameer Khan (#13)
  (13, '2026-07-01', '2026-07-01 09:02:00'  , '2026-07-01 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-02', '2026-07-02 09:04:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-03', '2026-07-03 08:48:00'  , '2026-07-03 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-06', '2026-07-06 08:58:00'  , '2026-07-06 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-07', '2026-07-07 08:50:00'  , '2026-07-07 20:20:00'  , 10.50, 2.50, 'regular_ot'    , FALSE, NULL, 'present'),
  (13, '2026-07-08', '2026-07-08 09:04:00'  , '2026-07-08 18:34:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-09', '2026-07-09 09:02:00'  , '2026-07-09 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-10', '2026-07-10 08:52:00'  , '2026-07-10 17:37:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-13', '2026-07-13 08:58:00'  , '2026-07-13 17:58:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-14', '2026-07-14 08:48:00'  , '2026-07-14 17:33:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-15', '2026-07-15 09:02:00'  , '2026-07-15 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-16', '2026-07-16 09:02:00'  , '2026-07-16 18:17:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-17', '2026-07-17 09:07:00'  , '2026-07-17 17:37:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-20', '2026-07-20 09:00:00'  , '2026-07-20 18:30:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-21', '2026-07-21 08:55:00'  , '2026-07-21 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-22', '2026-07-22 09:00:00'  , '2026-07-22 21:00:00'  , 11.00, 3.00, 'regular_ot'    , FALSE, NULL, 'present'),
  (13, '2026-07-23', '2026-07-23 08:48:00'  , '2026-07-23 18:18:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  (13, '2026-07-27', '2026-07-27 08:48:00'  , '2026-07-27 18:03:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-28', '2026-07-28 09:07:00'  , '2026-07-28 17:52:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-29', '2026-07-29 09:07:00'  , '2026-07-29 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-30', '2026-07-30 08:58:00'  , '2026-07-30 17:43:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-07-31', '2026-07-31 08:52:00'  , '2026-07-31 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-03', '2026-08-03 09:00:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-04', '2026-08-04 09:02:00'  , '2026-08-04 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-05', '2026-08-05 08:52:00'  , '2026-08-05 18:07:00'  ,  8.25, 0.00, NULL            , TRUE ,   10, 'present'),
  (13, '2026-08-06', '2026-08-06 08:55:00'  , '2026-08-06 17:25:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-07', '2026-08-07 09:07:00'  , '2026-08-07 17:37:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-10', '2026-08-10 09:02:00'  , '2026-08-10 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-11', '2026-08-11 09:00:00'  , '2026-08-11 17:30:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-12', '2026-08-12 08:52:00'  , '2026-08-12 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-13', '2026-08-13 09:07:00'  , '2026-08-13 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-14', '2026-08-14 09:07:00'  , '2026-08-14 18:22:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-17', '2026-08-17 09:02:00'  , '2026-08-17 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-18', '2026-08-18 08:48:00'  , '2026-08-18 17:18:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-19', '2026-08-19 08:52:00'  , '2026-08-19 17:22:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-20', '2026-08-20 09:07:00'  , '2026-08-20 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-21', '2026-08-21 09:07:00'  , '2026-08-21 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-24', '2026-08-24 08:55:00'  , '2026-08-24 20:55:00'  , 11.00, 3.00, 'regular_ot'    , FALSE, NULL, 'present'),
  (13, '2026-08-25', '2026-08-25 09:04:00'  , '2026-08-25 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-08-26', '2026-08-26 09:00:00'  , '2026-08-26 18:00:00'  ,  8.00, 8.00, 'holiday_work'  , FALSE, NULL, 'holiday'),
  (13, '2026-08-27', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (13, '2026-08-28', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (13, '2026-08-31', '2026-08-31 08:48:00'  , '2026-08-31 18:03:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-09-01', '2026-09-01 09:04:00'  , '2026-09-01 18:34:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-09-02', '2026-09-02 08:52:00'  , '2026-09-02 18:07:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-09-03', '2026-09-03 09:28:00'  , '2026-09-03 18:28:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (13, '2026-09-04', '2026-09-04 08:52:00'  , '2026-09-04 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Ishita Bose (#14)
  (14, '2026-07-01', '2026-07-01 10:05:00'  , '2026-07-01 15:05:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'half_day'),
  (14, '2026-07-02', '2026-07-02 09:52:00'  , '2026-07-02 18:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-07-03', '2026-07-03 10:09:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-07-04', '2026-07-04 10:04:00'  , '2026-07-04 18:49:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-07-07', '2026-07-07 10:04:00'  , '2026-07-07 19:19:00'  ,  8.25, 0.00, NULL            , TRUE ,    2, 'present'),
  (14, '2026-07-08', '2026-07-08 09:48:00'  , '2026-07-08 19:18:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-07-09', '2026-07-09 09:52:00'  , '2026-07-09 18:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-07-10', '2026-07-10 10:42:00'  , '2026-07-10 19:27:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-07-11', '2026-07-11 09:48:00'  , '2026-07-11 18:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-07-14', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (14, '2026-07-15', '2026-07-15 09:48:00'  , '2026-07-15 18:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-07-16', '2026-07-16 10:00:00'  , '2026-07-16 19:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-07-17', '2026-07-17 10:07:00'  , '2026-07-17 19:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-07-18', '2026-07-18 10:04:00'  , '2026-07-18 18:49:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-07-21', '2026-07-21 10:00:00'  , '2026-07-21 22:00:00'  , 11.00, 3.00, 'regular_ot'    , FALSE, NULL, 'present'),
  (14, '2026-07-22', '2026-07-22 09:50:00'  , '2026-07-22 20:20:00'  ,  9.50, 1.50, 'regular_ot'    , FALSE, NULL, 'present'),
  (14, '2026-07-23', '2026-07-23 10:02:00'  , '2026-07-23 19:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  (14, '2026-07-25', '2026-07-25 10:35:00'  , '2026-07-25 20:05:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-07-28', '2026-07-28 09:48:00'  , '2026-07-28 19:18:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-07-29', '2026-07-29 09:50:00'  , '2026-07-29 19:50:00'  ,  9.00, 1.00, 'regular_ot'    , FALSE, NULL, 'present'),
  (14, '2026-07-30', '2026-07-30 09:58:00'  , '2026-07-30 18:43:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-07-31', '2026-07-31 10:02:00'  , '2026-07-31 19:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-01', '2026-08-01 09:52:00'  , '2026-08-01 18:22:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-04', '2026-08-04 10:28:00'  , '2026-08-04 19:28:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-05', '2026-08-05 09:48:00'  , '2026-08-05 19:03:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-06', '2026-08-06 09:58:00'  , '2026-08-06 18:28:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-07', '2026-08-07 09:52:00'  , '2026-08-07 19:22:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-08', '2026-08-08 10:02:00'  , '2026-08-08 19:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-11', '2026-08-11 10:07:00'  , '2026-08-11 19:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-12', '2026-08-12 10:02:00'  , '2026-08-12 19:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-13', '2026-08-13 09:52:00'  , '2026-08-13 19:22:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-14', '2026-08-14 10:00:00'  , '2026-08-14 15:00:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'half_day'),
  (14, '2026-08-15', '2026-08-15 10:00:00'  , '2026-08-15 19:00:00'  ,  8.00, 8.00, 'holiday_work'  , FALSE, NULL, 'holiday'),
  (14, '2026-08-18', '2026-08-18 10:07:00'  , '2026-08-18 18:52:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-19', '2026-08-19 09:55:00'  , '2026-08-19 19:10:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-20', '2026-08-20 10:28:00'  , '2026-08-20 18:58:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-21', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (14, '2026-08-22', '2026-08-22 10:02:00'  , '2026-08-22 19:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-25', '2026-08-25 09:58:00'  , '2026-08-25 19:13:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  (14, '2026-08-27', '2026-08-27 10:07:00'  , '2026-08-27 18:52:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-08-28', '2026-08-28 10:00:00'  , '2026-08-28 20:30:00'  ,  9.50, 1.50, 'regular_ot'    , FALSE, NULL, 'present'),
  (14, '2026-08-29', '2026-08-29 09:55:00'  , '2026-08-29 21:55:00'  , 11.00, 3.00, 'regular_ot'    , FALSE, NULL, 'present'),
  (14, '2026-09-01', '2026-09-01 10:04:00'  , '2026-09-01 18:34:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-09-02', '2026-09-02 09:55:00'  , '2026-09-02 20:55:00'  , 10.00, 2.00, 'regular_ot'    , FALSE, NULL, 'present'),
  (14, '2026-09-03', '2026-09-03 10:00:00'  , '2026-09-03 19:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-09-04', '2026-09-04 10:07:00'  , '2026-09-04 18:37:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (14, '2026-09-05', '2026-09-05 10:51:00'  , '2026-09-05 19:51:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Aditya Kulkarni (#15)
  (15, '2026-07-01', '2026-07-01 08:58:00'  , '2026-07-01 18:43:00'  ,  8.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-07-02', '2026-07-02 08:48:00'  , '2026-07-02 18:33:00'  ,  8.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-07-06', '2026-07-06 09:02:00'  , '2026-07-06 18:32:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-07-07', '2026-07-07 09:00:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-07-08', '2026-07-08 08:48:00'  , '2026-07-08 19:03:00'  ,  9.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-07-09', '2026-07-09 09:04:00'  , '2026-07-09 19:04:00'  ,  9.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-07-13', '2026-07-13 09:07:00'  , '2026-07-13 19:37:00'  ,  9.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-07-14', '2026-07-14 08:48:00'  , '2026-07-14 19:03:00'  ,  9.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-07-15', '2026-07-15 09:04:00'  , '2026-07-15 19:34:00'  ,  9.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-07-16', '2026-07-16 09:05:00'  , '2026-07-16 14:35:00'  ,  4.50, 0.00, NULL            , FALSE, NULL, 'half_day'),
  (15, '2026-07-20', '2026-07-20 08:52:00'  , '2026-07-20 19:22:00'  ,  9.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-07-21', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'absent'),
  (15, '2026-07-22', '2026-07-22 09:00:00'  , '2026-07-22 19:30:00'  ,  9.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-07-23', '2026-07-23 08:52:00'  , '2026-07-23 18:52:00'  ,  9.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-07-27', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (15, '2026-07-28', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (15, '2026-07-29', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (15, '2026-07-30', '2026-07-30 08:55:00'  , '2026-07-30 18:25:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-08-03', '2026-08-03 09:07:00'  , '2026-08-03 19:07:00'  ,  9.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-08-04', '2026-08-04 08:52:00'  , '2026-08-04 18:52:00'  ,  9.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-08-05', '2026-08-05 08:48:00'  , '2026-08-05 19:03:00'  ,  9.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-08-06', '2026-08-06 08:55:00'  , '2026-08-06 18:55:00'  ,  9.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-08-10', '2026-08-10 09:00:00'  , '2026-08-10 19:30:00'  ,  9.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-08-11', '2026-08-11 09:02:00'  , '2026-08-11 19:32:00'  ,  9.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-08-12', '2026-08-12 08:52:00'  , '2026-08-12 18:52:00'  ,  9.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-08-13', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (15, '2026-08-17', '2026-08-17 08:48:00'  , '2026-08-17 18:48:00'  ,  9.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-08-18', '2026-08-18 09:02:00'  , '2026-08-18 19:17:00'  ,  9.25, 0.00, NULL            , TRUE ,   10, 'present'),
  (15, '2026-08-19', '2026-08-19 09:00:00'  , '2026-08-19 19:30:00'  ,  9.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-08-20', '2026-08-20 09:07:00'  , '2026-08-20 19:07:00'  ,  9.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-08-24', '2026-08-24 09:00:00'  , '2026-08-24 20:00:00'  , 10.00, 1.00, 'regular_ot'    , FALSE, NULL, 'present'),
  (15, '2026-08-25', '2026-08-25 09:02:00'  , '2026-08-25 19:02:00'  ,  9.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  (15, '2026-08-27', '2026-08-27 09:07:00'  , '2026-08-27 18:52:00'  ,  8.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-08-31', '2026-08-31 09:42:00'  , '2026-08-31 19:42:00'  ,  9.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-09-01', '2026-09-01 08:58:00'  , '2026-09-01 18:58:00'  ,  9.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-09-02', '2026-09-02 09:42:00'  , '2026-09-02 19:42:00'  ,  9.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (15, '2026-09-03', '2026-09-03 09:00:00'  , '2026-09-03 19:00:00'  ,  9.00, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Pooja Gupta (#16)
  (16, '2026-07-01', '2026-07-01 08:52:00'  , '2026-07-01 17:22:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-07-02', '2026-07-02 08:58:00'  , '2026-07-02 17:28:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-07-03', '2026-07-03 08:58:00'  , '2026-07-03 17:43:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-07-06', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (16, '2026-07-07', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (16, '2026-07-08', '2026-07-08 08:52:00'  , '2026-07-08 17:37:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-07-09', '2026-07-09 09:05:00'  , '2026-07-09 14:05:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'half_day'),
  (16, '2026-07-10', '2026-07-10 09:05:00'  , '2026-07-10 14:05:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'half_day'),
  (16, '2026-07-13', '2026-07-13 09:04:00'  , '2026-07-13 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-07-14', '2026-07-14 09:35:00'  , '2026-07-14 18:35:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-07-15', '2026-07-15 08:55:00'  , '2026-07-15 18:25:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-07-16', '2026-07-16 09:04:00'  , '2026-07-16 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-07-17', '2026-07-17 08:58:00'  , '2026-07-17 18:28:00'  ,  8.50, 0.00, NULL            , TRUE ,    2, 'present'),
  (16, '2026-07-20', '2026-07-20 08:55:00'  , '2026-07-20 20:25:00'  , 10.50, 2.50, 'regular_ot'    , FALSE, NULL, 'present'),
  (16, '2026-07-21', '2026-07-21 09:07:00'  , '2026-07-21 17:52:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-07-22', '2026-07-22 09:04:00'  , '2026-07-22 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-07-23', '2026-07-23 09:02:00'  , '2026-07-23 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  (16, '2026-07-27', '2026-07-27 08:52:00'  , '2026-07-27 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-07-28', '2026-07-28 08:48:00'  , '2026-07-28 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-07-29', '2026-07-29 08:52:00'  , '2026-07-29 17:37:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-07-30', '2026-07-30 09:00:00'  , '2026-07-30 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-07-31', '2026-07-31 09:02:00'  , '2026-07-31 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-03', '2026-08-03 08:58:00'  , '2026-08-03 18:28:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-04', '2026-08-04 09:02:00'  , '2026-08-04 18:02:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-05', '2026-08-05 09:02:00'  , '2026-08-05 18:17:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-06', '2026-08-06 08:50:00'  , '2026-08-06 20:20:00'  , 10.50, 2.50, 'regular_ot'    , FALSE, NULL, 'present'),
  (16, '2026-08-07', '2026-08-07 08:48:00'  , '2026-08-07 18:03:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-10', '2026-08-10 09:00:00'  , '2026-08-10 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-11', '2026-08-11 08:55:00'  , '2026-08-11 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-12', '2026-08-12 08:48:00'  , '2026-08-12 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-13', '2026-08-13 08:55:00'  , '2026-08-13 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-14', '2026-08-14 09:04:00'  , '2026-08-14 18:19:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-17', '2026-08-17 08:48:00'  , '2026-08-17 17:33:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-18', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (16, '2026-08-19', '2026-08-19 08:55:00'  , '2026-08-19 17:55:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-20', '2026-08-20 09:51:00'  , '2026-08-20 19:21:00'  ,  8.50, 0.00, NULL            , TRUE ,   10, 'present'),
  (16, '2026-08-21', '2026-08-21 09:28:00'  , '2026-08-21 18:28:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-24', '2026-08-24 09:00:00'  , '2026-08-24 18:00:00'  ,  8.00, 0.00, NULL            , TRUE ,   10, 'present'),
  (16, '2026-08-25', '2026-08-25 09:51:00'  , '2026-08-25 18:51:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  (16, '2026-08-27', '2026-08-27 09:00:00'  , '2026-08-27 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-28', '2026-08-28 09:07:00'  , '2026-08-28 18:37:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-08-31', '2026-08-31 08:48:00'  , '2026-08-31 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-09-01', '2026-09-01 08:58:00'  , '2026-09-01 18:13:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (16, '2026-09-02', '2026-09-02 08:58:00'  , '2026-09-02 17:28:00'  ,  7.50, 0.00, NULL            , TRUE ,   10, 'present'),
  (16, '2026-09-03', '2026-09-03 09:05:00'  , '2026-09-03 14:05:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'half_day'),
  (16, '2026-09-04', '2026-09-04 08:48:00'  , '2026-09-04 17:18:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Nikhil Bhat (#17)
  (17, '2026-07-01', '2026-07-01 09:04:00'  , '2026-07-01 13:04:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-02', '2026-07-02 08:52:00'  , '2026-07-02 12:22:00'  ,  3.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-03', '2026-07-03 08:48:00'  , '2026-07-03 12:33:00'  ,  3.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-06', '2026-07-06 08:55:00'  , '2026-07-06 12:55:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-07', '2026-07-07 09:04:00'  , '2026-07-07 13:04:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-08', '2026-07-08 09:42:00'  , '2026-07-08 13:12:00'  ,  3.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-09', '2026-07-09 08:48:00'  , '2026-07-09 12:48:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-10', '2026-07-10 09:28:00'  , '2026-07-10 13:28:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-13', '2026-07-13 08:52:00'  , '2026-07-13 13:07:00'  ,  4.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-14', '2026-07-14 08:55:00'  , '2026-07-14 12:55:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-15', '2026-07-15 09:35:00'  , '2026-07-15 13:35:00'  ,  4.00, 0.00, NULL            , TRUE ,   10, 'present'),
  (17, '2026-07-16', '2026-07-16 08:48:00'  , '2026-07-16 12:48:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-17', '2026-07-17 09:04:00'  , '2026-07-17 13:34:00'  ,  4.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-20', '2026-07-20 09:51:00'  , '2026-07-20 13:51:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-21', '2026-07-21 09:05:00'  , '2026-07-21 11:05:00'  ,  2.00, 0.00, NULL            , FALSE, NULL, 'half_day'),
  (17, '2026-07-22', '2026-07-22 09:04:00'  , '2026-07-22 13:04:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-23', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (17, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  (17, '2026-07-27', '2026-07-27 08:48:00'  , '2026-07-27 12:18:00'  ,  3.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-28', '2026-07-28 08:52:00'  , '2026-07-28 12:37:00'  ,  3.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-29', '2026-07-29 09:07:00'  , '2026-07-29 13:37:00'  ,  4.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-30', '2026-07-30 09:02:00'  , '2026-07-30 13:17:00'  ,  4.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-07-31', '2026-07-31 09:09:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-03', '2026-08-03 08:55:00'  , '2026-08-03 13:10:00'  ,  4.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-04', '2026-08-04 09:02:00'  , '2026-08-04 13:17:00'  ,  4.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-05', '2026-08-05 08:52:00'  , '2026-08-05 12:52:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-06', '2026-08-06 09:04:00'  , '2026-08-06 13:04:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-07', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (17, '2026-08-10', '2026-08-10 09:00:00'  , '2026-08-10 13:00:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-11', '2026-08-11 09:07:00'  , '2026-08-11 13:07:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-12', '2026-08-12 09:00:00'  , '2026-08-12 13:00:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-13', '2026-08-13 09:04:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-14', '2026-08-14 09:02:00'  , '2026-08-14 12:47:00'  ,  3.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-17', '2026-08-17 09:51:00'  , '2026-08-17 13:51:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-18', '2026-08-18 08:58:00'  , '2026-08-18 12:58:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-19', '2026-08-19 08:48:00'  , '2026-08-19 12:18:00'  ,  3.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-20', '2026-08-20 08:55:00'  , '2026-08-20 12:55:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-21', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'absent'),
  (17, '2026-08-24', '2026-08-24 09:04:00'  , '2026-08-24 13:04:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-25', '2026-08-25 09:04:00'  , '2026-08-25 12:49:00'  ,  3.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-26', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  (17, '2026-08-27', '2026-08-27 08:58:00'  , '2026-08-27 13:13:00'  ,  4.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-08-28', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'absent'),
  (17, '2026-08-31', '2026-08-31 08:48:00'  , '2026-08-31 12:48:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-09-01', '2026-09-01 08:48:00'  , '2026-09-01 12:48:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-09-02', '2026-09-02 09:02:00'  , '2026-09-02 13:17:00'  ,  4.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-09-03', '2026-09-03 09:07:00'  , '2026-09-03 12:52:00'  ,  3.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (17, '2026-09-04', '2026-09-04 08:48:00'  , '2026-09-04 12:33:00'  ,  3.75, 0.00, NULL            , FALSE, NULL, 'present'),
  -- Tara D'Souza (#18)
  (18, '2026-07-01', '2026-07-01 08:52:00'  , '2026-07-01 17:37:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-02', '2026-07-02 09:04:00'  , '2026-07-02 17:34:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-03', '2026-07-03 09:07:00'  , '2026-07-03 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-06', '2026-07-06 09:00:00'  , '2026-07-06 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-07', '2026-07-07 08:55:00'  , '2026-07-07 18:25:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-08', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'absent'),
  (18, '2026-07-09', '2026-07-09 08:48:00'  , '2026-07-09 17:33:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-10', '2026-07-10 08:52:00'  , '2026-07-10 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-13', '2026-07-13 09:09:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-14', '2026-07-14 08:48:00'  , '2026-07-14 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-15', '2026-07-15 09:00:00'  , '2026-07-15 14:00:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'half_day'),
  (18, '2026-07-16', '2026-07-16 09:00:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-17', '2026-07-17 09:00:00'  , '2026-07-17 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-20', '2026-07-20 09:04:00'  , '2026-07-20 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-21', '2026-07-21 09:35:00'  , '2026-07-21 18:35:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-22', '2026-07-22 09:04:00'  , '2026-07-22 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-23', '2026-07-23 09:07:00'  , '2026-07-23 17:37:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-24', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'holiday'),
  (18, '2026-07-27', '2026-07-27 09:02:00'  , '2026-07-27 17:32:00'  ,  7.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-28', '2026-07-28 08:55:00'  , '2026-07-28 19:25:00'  ,  9.50, 1.50, 'regular_ot'    , FALSE, NULL, 'present'),
  (18, '2026-07-29', '2026-07-29 09:00:00'  , '2026-07-29 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-07-30', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (18, '2026-07-31', NULL                   , NULL                   ,  0.00, 0.00, NULL            , FALSE, NULL, 'on_leave'),
  (18, '2026-08-03', '2026-08-03 08:52:00'  , '2026-08-03 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-08-04', '2026-08-04 09:42:00'  , '2026-08-04 19:12:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-08-05', '2026-08-05 09:02:00'  , '2026-08-05 18:32:00'  ,  8.50, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-08-06', '2026-08-06 08:52:00'  , '2026-08-06 18:07:00'  ,  8.25, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-08-07', '2026-08-07 09:07:00'  , '2026-08-07 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-08-10', '2026-08-10 09:00:00'  , '2026-08-10 14:00:00'  ,  4.00, 0.00, NULL            , FALSE, NULL, 'half_day'),
  (18, '2026-08-11', '2026-08-11 09:07:00'  , '2026-08-11 17:52:00'  ,  7.75, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-08-12', '2026-08-12 08:52:00'  , '2026-08-12 17:52:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-08-13', '2026-08-13 09:09:00'  , NULL                   ,  NULL, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-08-14', '2026-08-14 09:04:00'  , '2026-08-14 18:04:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-08-17', '2026-08-17 08:55:00'  , '2026-08-17 18:55:00'  ,  9.00, 1.00, 'regular_ot'    , FALSE, NULL, 'present'),
  (18, '2026-08-18', '2026-08-18 08:48:00'  , '2026-08-18 17:48:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-08-19', '2026-08-19 09:00:00'  , '2026-08-19 18:00:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-08-20', '2026-08-20 09:07:00'  , '2026-08-20 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present'),
  (18, '2026-08-21', '2026-08-21 09:07:00'  , '2026-08-21 18:07:00'  ,  8.00, 0.00, NULL            , FALSE, NULL, 'present');

-- ─────────────────────────────────────────────────────────────────────────────
-- Pay Runs — July and August 2026 are closed and PAID; September is left open
-- so the pay run wizard can be demonstrated end to end on live data.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO pay_runs (id, name, start_date, end_date, status, created_by, validated_at, paid_at) VALUES
  (1, 'July 2026 Payroll', '2026-07-01', '2026-07-31', 'paid', 6, '2026-07-30 11:20:00', '2026-07-31 15:40:00'),
  (2, 'August 2026 Payroll', '2026-08-01', '2026-08-31', 'paid', 6, '2026-08-30 12:05:00', '2026-08-31 16:15:00');
SELECT setval('pay_runs_id_seq', (SELECT MAX(id) FROM pay_runs));

INSERT INTO pay_run_employees (pay_run_id, employee_id) VALUES
  (1, 1),
  (1, 2),
  (1, 3),
  (1, 4),
  (1, 5),
  (1, 6),
  (1, 7),
  (1, 8),
  (1, 9),
  (1, 10),
  (1, 11),
  (1, 12),
  (1, 13),
  (1, 14),
  (1, 15),
  (1, 16),
  (1, 17),
  (1, 18),
  (2, 1),
  (2, 2),
  (2, 3),
  (2, 4),
  (2, 5),
  (2, 6),
  (2, 7),
  (2, 8),
  (2, 9),
  (2, 10),
  (2, 11),
  (2, 12),
  (2, 13),
  (2, 14),
  (2, 15),
  (2, 16),
  (2, 17),
  (2, 18);

-- ─────────────────────────────────────────────────────────────────────────────
-- Payslips — computed with the same rules the payroll engine applies:
--   BASIC = contract wage x proration factor, percentage rules off BASIC,
--   GROSS = basic + allowances (incl. overtime), NET = GROSS - deductions.
-- Deduction lines are stored negative, exactly as the engine writes them.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO payslips (id, pay_run_id, employee_id, contract_id, gross_salary, net_salary, total_deductions, worked_days, worked_hours, status, warnings, is_reviewed, reviewed_by, reviewed_at) VALUES
  -- Anish Goenka — July 2026 Payroll
  ( 1, 1,  1,    1,  137850.00,  122350.00,  15500.00, 19.00, 127.00, 'paid',
   '[{"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "2 attendance records have check-in but no check-out", "details": {"employee_id": 1, "count": 2}}, {"code": "MISSING_CHECKIN_DAYS", "severity": "warning", "message": "1 workdays have no attendance and no approved leave", "details": {"employee_id": 1, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Priya Sharma — July 2026 Payroll
  ( 2, 1,  2,    3,   96860.87,   86120.87,  10740.00, 22.00, 170.50, 'paid',
   '[]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Rahul Verma — July 2026 Payroll
  ( 3, 1,  3,    5,   87143.48,   77593.48,   9550.00, 21.00, 155.50, 'paid',
   '[{"code": "MISSING_CHECKIN_DAYS", "severity": "warning", "message": "1 workdays have no attendance and no approved leave", "details": {"employee_id": 3, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Neha Patel — July 2026 Payroll
  ( 4, 1,  4,    7,   44850.00,   39890.00,   4960.00, 21.00,  80.75, 'paid',
   '[{"code": "MISSING_CHECKIN_DAYS", "severity": "warning", "message": "1 workdays have no attendance and no approved leave", "details": {"employee_id": 4, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Arjun Mehta — July 2026 Payroll
  ( 5, 1,  5,    8,   25800.00,   25600.00,    200.00, 23.00, 175.50, 'paid',
   '[{"code": "MISSING_BANK_DETAILS", "severity": "warning", "message": "No bank account on file for Arjun Mehta", "details": {"employee_id": 5, "fields_missing": ["bank_name", "bank_account"]}}]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Kavya Iyer — July 2026 Payroll
  ( 6, 1,  6,    9,  146442.93,  125842.93,  20600.00, 23.00, 175.50, 'paid',
   '[]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Rohan Desai — July 2026 Payroll
  ( 7, 1,  7,   10,   64643.48,   57643.48,   7000.00, 22.00, 166.00, 'paid',
   '[{"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "1 attendance records have check-in but no check-out", "details": {"employee_id": 7, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Vikram Singh — July 2026 Payroll
  ( 8, 1,  8,   11,  131695.65,  113495.65,  18200.00, 19.00, 122.50, 'paid',
   '[{"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "2 attendance records have check-in but no check-out", "details": {"employee_id": 8, "count": 2}}]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Karthik Reddy — July 2026 Payroll
  ( 9, 1,  9,   12,  117700.00,  101180.00,  16520.00, 19.00, 145.00, 'paid',
   '[]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Meera Krishnan — July 2026 Payroll
  (10, 1, 10,   13,   68850.00,   61170.00,   7680.00, 23.00, 167.75, 'paid',
   '[{"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "1 attendance records have check-in but no check-out", "details": {"employee_id": 10, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Ananya Rao — July 2026 Payroll
  (11, 1, 11,   14,   60314.67,   53654.67,   6660.00, 21.00, 152.75, 'paid',
   '[{"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "1 attendance records have check-in but no check-out", "details": {"employee_id": 11, "count": 1}}, {"code": "MISSING_CHECKIN_DAYS", "severity": "warning", "message": "1 workdays have no attendance and no approved leave", "details": {"employee_id": 11, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Divya Menon — July 2026 Payroll
  (12, 1, 12,   15,   67048.37,   59708.37,   7340.00, 18.00, 133.25, 'paid',
   '[{"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "1 attendance records have check-in but no check-out", "details": {"employee_id": 12, "count": 1}}, {"code": "MISSING_CHECKIN_DAYS", "severity": "warning", "message": "2 workdays have no attendance and no approved leave", "details": {"employee_id": 12, "count": 2}}]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Sameer Khan — July 2026 Payroll
  (13, 1, 13,   16,   59002.17,   52682.17,   6320.00, 23.00, 174.00, 'paid',
   '[{"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "1 attendance records have check-in but no check-out", "details": {"employee_id": 13, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Ishita Bose — July 2026 Payroll
  (14, 1, 14,   17,   52800.00,   52600.00,    200.00, 21.00, 158.25, 'paid',
   '[{"code": "COMP_OFF_CREDITED", "severity": "info", "message": "5.5 overtime hours converted to compensatory off; no OT pay", "details": {"employee_id": 14, "contract_id": 17, "hours": 5.5, "message": "Overtime converted to compensatory off; no OT pay"}}, {"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "1 attendance records have check-in but no check-out", "details": {"employee_id": 14, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Aditya Kulkarni — July 2026 Payroll
  (15, 1, 15,   18,   71850.00,   63830.00,   8020.00, 13.00, 109.00, 'paid',
   '[{"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "1 attendance records have check-in but no check-out", "details": {"employee_id": 15, "count": 1}}, {"code": "MISSING_CHECKIN_DAYS", "severity": "warning", "message": "1 workdays have no attendance and no approved leave", "details": {"employee_id": 15, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Pooja Gupta — July 2026 Payroll
  (16, 1, 16,   19,   65185.60,   58015.60,   7170.00, 19.00, 145.50, 'paid',
   '[{"code": "MISSING_DATA", "severity": "warning", "message": "Pooja Gupta is not active at compute time", "details": {"employee_id": 16, "reason": "Employee not active at compute time", "employment_status": "on_notice", "is_active": true}}]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Nikhil Bhat — July 2026 Payroll
  (17, 1, 17,   20,   32850.00,   29250.00,   3600.00, 21.00,  75.50, 'paid',
   '[{"code": "MISSING_BANK_DETAILS", "severity": "warning", "message": "No bank account on file for Nikhil Bhat", "details": {"employee_id": 17, "fields_missing": ["bank_name", "bank_account"]}}, {"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "1 attendance records have check-in but no check-out", "details": {"employee_id": 17, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Tara D'Souza — July 2026 Payroll
  (18, 1, 18,   21,   60314.67,   53654.67,   6660.00, 19.00, 128.00, 'paid',
   '[{"code": "MISSING_DATA", "severity": "warning", "message": "Tara D''Souza is not active at compute time", "details": {"employee_id": 18, "reason": "Employee not active at compute time", "employment_status": "terminated", "is_active": false}}, {"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "2 attendance records have check-in but no check-out", "details": {"employee_id": 18, "count": 2}}, {"code": "MISSING_CHECKIN_DAYS", "severity": "warning", "message": "1 workdays have no attendance and no approved leave", "details": {"employee_id": 18, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-07-30 11:20:00'),
  -- Anish Goenka — August 2026 Payroll
  (19, 2,  1, NULL,  160479.16,  139793.44,  20685.72, 21.00, 153.00, 'paid',
   '[{"code": "MULTIPLE_CONTRACTS", "severity": "info", "message": "2 active contracts overlap the pay period for Anish Goenka", "details": {"employee_id": 1, "contract_count": 2}}, {"code": "PRORATED_PAYSLIP", "severity": "info", "message": "Payslip is prorated across 2 contract segments", "details": {"employee_id": 1, "contract_count": 2}}, {"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "1 attendance records have check-in but no check-out", "details": {"employee_id": 1, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Priya Sharma — August 2026 Payroll
  (20, 2,  2,    3,   98617.86,   87877.86,  10740.00, 19.00, 140.75, 'paid',
   '[{"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "1 attendance records have check-in but no check-out", "details": {"employee_id": 2, "count": 1}}, {"code": "MISSING_CHECKIN_DAYS", "severity": "warning", "message": "1 workdays have no attendance and no approved leave", "details": {"employee_id": 2, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Rahul Verma — August 2026 Payroll
  (21, 2,  3,    5,   86332.14,   68560.03,  17772.11, 17.00, 123.75, 'paid',
   '[{"code": "UNPAID_LEAVE_DEDUCTION", "severity": "info", "message": "2 unpaid leave days deducted", "details": {"employee_id": 3, "days": 2, "per_day_rate": 4111.05, "deduction_amount": 8222.11}}, {"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "1 attendance records have check-in but no check-out", "details": {"employee_id": 3, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Neha Patel — August 2026 Payroll
  (22, 2,  4,    7,   44850.00,   35618.57,   9231.43, 18.00,  65.25, 'paid',
   '[{"code": "UNPAID_LEAVE_DEDUCTION", "severity": "info", "message": "2 unpaid leave days deducted", "details": {"employee_id": 4, "days": 2, "per_day_rate": 2135.71, "deduction_amount": 4271.43}}, {"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "1 attendance records have check-in but no check-out", "details": {"employee_id": 4, "count": 1}}, {"code": "MISSING_CHECKIN_DAYS", "severity": "warning", "message": "1 workdays have no attendance and no approved leave", "details": {"employee_id": 4, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Arjun Mehta — August 2026 Payroll
  (23, 2,  5,    8,   25800.00,   25600.00,    200.00, 20.00, 149.25, 'paid',
   '[{"code": "MISSING_BANK_DETAILS", "severity": "warning", "message": "No bank account on file for Arjun Mehta", "details": {"employee_id": 5, "fields_missing": ["bank_name", "bank_account"]}}]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Kavya Iyer — August 2026 Payroll
  (24, 2,  6,    9,  151821.43,  131221.43,  20600.00, 17.00, 136.50, 'paid',
   '[]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Rohan Desai — August 2026 Payroll
  (25, 2,  7,   10,   63921.43,   56921.43,   7000.00, 21.00, 162.00, 'paid',
   '[]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Vikram Singh — August 2026 Payroll
  (26, 2,  8,   11,  133267.86,  115067.86,  18200.00, 20.00, 140.25, 'paid',
   '[{"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "2 attendance records have check-in but no check-out", "details": {"employee_id": 8, "count": 2}}]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Karthik Reddy — August 2026 Payroll
  (27, 2,  9,   12,  122253.57,  105733.57,  16520.00, 22.00, 167.00, 'paid',
   '[]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Meera Krishnan — August 2026 Payroll
  (28, 2, 10,   13,   68850.00,   61170.00,   7680.00, 19.00, 143.75, 'paid',
   '[]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Ananya Rao — August 2026 Payroll
  (29, 2, 11,   14,   61037.50,   54377.50,   6660.00, 21.00, 163.75, 'paid',
   '[]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Divya Menon — August 2026 Payroll
  (30, 2, 12,   15,   67912.50,   60572.50,   7340.00, 16.00, 126.00, 'paid',
   '[]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Sameer Khan — August 2026 Payroll
  (31, 2, 13,   16,   61564.29,   55244.29,   6320.00, 19.00, 137.25, 'paid',
   '[{"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "1 attendance records have check-in but no check-out", "details": {"employee_id": 13, "count": 1}}, {"code": "HOLIDAY_WORK_DETECTED", "severity": "info", "message": "1 paid company holidays were worked", "details": {"employee_id": 13, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Ishita Bose — August 2026 Payroll
  (32, 2, 14,   17,   52800.00,   52600.00,    200.00, 19.00, 140.25, 'paid',
   '[{"code": "COMP_OFF_CREDITED", "severity": "info", "message": "12.5 overtime hours converted to compensatory off; no OT pay", "details": {"employee_id": 14, "contract_id": 17, "hours": 12.5, "message": "Overtime converted to compensatory off; no OT pay"}}, {"code": "HOLIDAY_WORK_DETECTED", "severity": "info", "message": "1 paid company holidays were worked", "details": {"employee_id": 14, "count": 1}}]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Aditya Kulkarni — August 2026 Payroll
  (33, 2, 15,   18,   72300.98,   64280.98,   8020.00, 16.00, 137.75, 'paid',
   '[]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Pooja Gupta — August 2026 Payroll
  (34, 2, 16,   19,   65265.18,   58095.18,   7170.00, 20.00, 156.50, 'paid',
   '[{"code": "MISSING_DATA", "severity": "warning", "message": "Pooja Gupta is not active at compute time", "details": {"employee_id": 16, "reason": "Employee not active at compute time", "employment_status": "on_notice", "is_active": true}}]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Nikhil Bhat — August 2026 Payroll
  (35, 2, 17,   20,   32850.00,   29250.00,   3600.00, 18.00,  63.75, 'paid',
   '[{"code": "MISSING_BANK_DETAILS", "severity": "warning", "message": "No bank account on file for Nikhil Bhat", "details": {"employee_id": 17, "fields_missing": ["bank_name", "bank_account"]}}, {"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "1 attendance records have check-in but no check-out", "details": {"employee_id": 17, "count": 1}}, {"code": "MISSING_CHECKIN_DAYS", "severity": "warning", "message": "2 workdays have no attendance and no approved leave", "details": {"employee_id": 17, "count": 2}}]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00'),
  -- Tara D'Souza — August 2026 Payroll
  (36, 2, 18,   21,   43089.30,   38332.16,   4757.14, 15.00, 106.00, 'paid',
   '[{"code": "MISSING_DATA", "severity": "warning", "message": "Tara D''Souza is not active at compute time", "details": {"employee_id": 18, "reason": "Employee not active at compute time", "employment_status": "terminated", "is_active": false}}, {"code": "UNREVIEWED_ATTENDANCE", "severity": "warning", "message": "1 attendance records have check-in but no check-out", "details": {"employee_id": 18, "count": 1}}, {"code": "MISSING_CHECKIN_DAYS", "severity": "warning", "message": "5 workdays have no attendance and no approved leave", "details": {"employee_id": 18, "count": 5}}]'::JSONB,
   TRUE, 6, '2026-08-30 12:05:00');
SELECT setval('payslips_id_seq', (SELECT MAX(id) FROM payslips));

INSERT INTO payslip_lines (payslip_id, rule_id, rule_code, rule_name, category, sequence, amount, contract_id, segment_start, segment_end, proration_factor) VALUES
  ( 1,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    90000.00,    1, '2026-07-01', '2026-07-31', 1.0000),
  ( 1,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    36000.00,    1, '2026-07-01', '2026-07-31', 1.0000),
  ( 1,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,    1, '2026-07-01', '2026-07-31', 1.0000),
  ( 1,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,    1, '2026-07-01', '2026-07-31', 1.0000),
  ( 1,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     9000.00,    1, '2026-07-01', '2026-07-31', 1.0000),
  ( 1,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,   137850.00,    1, '2026-07-01', '2026-07-31', 1.0000),
  ( 1,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,   -10800.00,    1, '2026-07-01', '2026-07-31', 1.0000),
  ( 1,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,    1, '2026-07-01', '2026-07-31', 1.0000),
  ( 1,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -4500.00,    1, '2026-07-01', '2026-07-31', 1.0000),
  ( 1,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,   122350.00,    1, '2026-07-01', '2026-07-31', 1.0000),
  ( 2,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    62000.00,    3, '2026-07-01', '2026-07-31', 1.0000),
  ( 2,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    24800.00,    3, '2026-07-01', '2026-07-31', 1.0000),
  ( 2,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,    3, '2026-07-01', '2026-07-31', 1.0000),
  ( 2,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,    3, '2026-07-01', '2026-07-31', 1.0000),
  ( 2,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     6200.00,    3, '2026-07-01', '2026-07-31', 1.0000),
  ( 2,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    96860.87,    3, '2026-07-01', '2026-07-31', 1.0000),
  ( 2,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -7440.00,    3, '2026-07-01', '2026-07-31', 1.0000),
  ( 2,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,    3, '2026-07-01', '2026-07-31', 1.0000),
  ( 2,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -3100.00,    3, '2026-07-01', '2026-07-31', 1.0000),
  ( 2,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    86120.87,    3, '2026-07-01', '2026-07-31', 1.0000),
  ( 2, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,     1010.87,    3, '2026-07-01', '2026-07-31',   NULL),
  ( 3,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    55000.00,    5, '2026-07-01', '2026-07-31', 1.0000),
  ( 3,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    22000.00,    5, '2026-07-01', '2026-07-31', 1.0000),
  ( 3,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,    5, '2026-07-01', '2026-07-31', 1.0000),
  ( 3,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,    5, '2026-07-01', '2026-07-31', 1.0000),
  ( 3,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     5500.00,    5, '2026-07-01', '2026-07-31', 1.0000),
  ( 3,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    87143.48,    5, '2026-07-01', '2026-07-31', 1.0000),
  ( 3,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -6600.00,    5, '2026-07-01', '2026-07-31', 1.0000),
  ( 3,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,    5, '2026-07-01', '2026-07-31', 1.0000),
  ( 3,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -2750.00,    5, '2026-07-01', '2026-07-31', 1.0000),
  ( 3,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    77593.48,    5, '2026-07-01', '2026-07-31', 1.0000),
  ( 3, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,     1793.48,    5, '2026-07-01', '2026-07-31',   NULL),
  ( 4,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    28000.00,    7, '2026-07-01', '2026-07-31', 1.0000),
  ( 4,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    11200.00,    7, '2026-07-01', '2026-07-31', 1.0000),
  ( 4,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,    7, '2026-07-01', '2026-07-31', 1.0000),
  ( 4,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,    7, '2026-07-01', '2026-07-31', 1.0000),
  ( 4,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     2800.00,    7, '2026-07-01', '2026-07-31', 1.0000),
  ( 4,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    44850.00,    7, '2026-07-01', '2026-07-31', 1.0000),
  ( 4,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -3360.00,    7, '2026-07-01', '2026-07-31', 1.0000),
  ( 4,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,    7, '2026-07-01', '2026-07-31', 1.0000),
  ( 4,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -1400.00,    7, '2026-07-01', '2026-07-31', 1.0000),
  ( 4,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    39890.00,    7, '2026-07-01', '2026-07-31', 1.0000),
  ( 5,   21, 'BASIC'    , 'Stipend'               , 'basic'    ,   10,    25000.00,    8, '2026-07-01', '2026-07-31', 1.0000),
  ( 5,   22, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,      800.00,    8, '2026-07-01', '2026-07-31', 1.0000),
  ( 5,   23, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    25800.00,    8, '2026-07-01', '2026-07-31', 1.0000),
  ( 5,   24, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,    8, '2026-07-01', '2026-07-31', 1.0000),
  ( 5,   25, 'NET'      , 'Net Salary'            , 'net'      ,  200,    25600.00,    8, '2026-07-01', '2026-07-31', 1.0000),
  ( 6,   11, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    85000.00,    9, '2026-07-01', '2026-07-31', 1.0000),
  ( 6,   12, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    42500.00,    9, '2026-07-01', '2026-07-31', 1.0000),
  ( 6,   13, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     3000.00,    9, '2026-07-01', '2026-07-31', 1.0000),
  ( 6,   14, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     2500.00,    9, '2026-07-01', '2026-07-31', 1.0000),
  ( 6,   15, 'SPA'      , 'Special Allowance'     , 'allowance',   50,    12750.00,    9, '2026-07-01', '2026-07-31', 1.0000),
  ( 6,   16, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,   146442.93,    9, '2026-07-01', '2026-07-31', 1.0000),
  ( 6,   17, 'PF'       , 'Provident Fund'        , 'deduction',  110,   -10200.00,    9, '2026-07-01', '2026-07-31', 1.0000),
  ( 6,   18, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,    9, '2026-07-01', '2026-07-31', 1.0000),
  ( 6,   19, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,   -10200.00,    9, '2026-07-01', '2026-07-31', 1.0000),
  ( 6,   20, 'NET'      , 'Net Salary'            , 'net'      ,  200,   125842.93,    9, '2026-07-01', '2026-07-31', 1.0000),
  ( 6, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,      692.93,    9, '2026-07-01', '2026-07-31',   NULL),
  ( 7,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    40000.00,   10, '2026-07-01', '2026-07-31', 1.0000),
  ( 7,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    16000.00,   10, '2026-07-01', '2026-07-31', 1.0000),
  ( 7,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   10, '2026-07-01', '2026-07-31', 1.0000),
  ( 7,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   10, '2026-07-01', '2026-07-31', 1.0000),
  ( 7,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     4000.00,   10, '2026-07-01', '2026-07-31', 1.0000),
  ( 7,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    64643.48,   10, '2026-07-01', '2026-07-31', 1.0000),
  ( 7,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -4800.00,   10, '2026-07-01', '2026-07-31', 1.0000),
  ( 7,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   10, '2026-07-01', '2026-07-31', 1.0000),
  ( 7,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -2000.00,   10, '2026-07-01', '2026-07-31', 1.0000),
  ( 7,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    57643.48,   10, '2026-07-01', '2026-07-31', 1.0000),
  ( 7, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,     1793.48,   10, '2026-07-01', '2026-07-31',   NULL),
  ( 8,   11, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    75000.00,   11, '2026-07-01', '2026-07-31', 1.0000),
  ( 8,   12, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    37500.00,   11, '2026-07-01', '2026-07-31', 1.0000),
  ( 8,   13, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     3000.00,   11, '2026-07-01', '2026-07-31', 1.0000),
  ( 8,   14, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     2500.00,   11, '2026-07-01', '2026-07-31', 1.0000),
  ( 8,   15, 'SPA'      , 'Special Allowance'     , 'allowance',   50,    11250.00,   11, '2026-07-01', '2026-07-31', 1.0000),
  ( 8,   16, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,   131695.65,   11, '2026-07-01', '2026-07-31', 1.0000),
  ( 8,   17, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -9000.00,   11, '2026-07-01', '2026-07-31', 1.0000),
  ( 8,   18, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   11, '2026-07-01', '2026-07-31', 1.0000),
  ( 8,   19, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -9000.00,   11, '2026-07-01', '2026-07-31', 1.0000),
  ( 8,   20, 'NET'      , 'Net Salary'            , 'net'      ,  200,   113495.65,   11, '2026-07-01', '2026-07-31', 1.0000),
  ( 8, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,     2445.65,   11, '2026-07-01', '2026-07-31',   NULL),
  ( 9,   11, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    68000.00,   12, '2026-07-01', '2026-07-31', 1.0000),
  ( 9,   12, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    34000.00,   12, '2026-07-01', '2026-07-31', 1.0000),
  ( 9,   13, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     3000.00,   12, '2026-07-01', '2026-07-31', 1.0000),
  ( 9,   14, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     2500.00,   12, '2026-07-01', '2026-07-31', 1.0000),
  ( 9,   15, 'SPA'      , 'Special Allowance'     , 'allowance',   50,    10200.00,   12, '2026-07-01', '2026-07-31', 1.0000),
  ( 9,   16, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,   117700.00,   12, '2026-07-01', '2026-07-31', 1.0000),
  ( 9,   17, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -8160.00,   12, '2026-07-01', '2026-07-31', 1.0000),
  ( 9,   18, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   12, '2026-07-01', '2026-07-31', 1.0000),
  ( 9,   19, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -8160.00,   12, '2026-07-01', '2026-07-31', 1.0000),
  ( 9,   20, 'NET'      , 'Net Salary'            , 'net'      ,  200,   101180.00,   12, '2026-07-01', '2026-07-31', 1.0000),
  (10,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    44000.00,   13, '2026-07-01', '2026-07-31', 1.0000),
  (10,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    17600.00,   13, '2026-07-01', '2026-07-31', 1.0000),
  (10,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   13, '2026-07-01', '2026-07-31', 1.0000),
  (10,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   13, '2026-07-01', '2026-07-31', 1.0000),
  (10,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     4400.00,   13, '2026-07-01', '2026-07-31', 1.0000),
  (10,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    68850.00,   13, '2026-07-01', '2026-07-31', 1.0000),
  (10,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -5280.00,   13, '2026-07-01', '2026-07-31', 1.0000),
  (10,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   13, '2026-07-01', '2026-07-31', 1.0000),
  (10,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -2200.00,   13, '2026-07-01', '2026-07-31', 1.0000),
  (10,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    61170.00,   13, '2026-07-01', '2026-07-31', 1.0000),
  (11,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    38000.00,   14, '2026-07-01', '2026-07-31', 1.0000),
  (11,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    15200.00,   14, '2026-07-01', '2026-07-31', 1.0000),
  (11,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   14, '2026-07-01', '2026-07-31', 1.0000),
  (11,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   14, '2026-07-01', '2026-07-31', 1.0000),
  (11,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     3800.00,   14, '2026-07-01', '2026-07-31', 1.0000),
  (11,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    60314.67,   14, '2026-07-01', '2026-07-31', 1.0000),
  (11,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -4560.00,   14, '2026-07-01', '2026-07-31', 1.0000),
  (11,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   14, '2026-07-01', '2026-07-31', 1.0000),
  (11,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -1900.00,   14, '2026-07-01', '2026-07-31', 1.0000),
  (11,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    53654.67,   14, '2026-07-01', '2026-07-31', 1.0000),
  (11, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,      464.67,   14, '2026-07-01', '2026-07-31',   NULL),
  (12,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    42000.00,   15, '2026-07-01', '2026-07-31', 1.0000),
  (12,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    16800.00,   15, '2026-07-01', '2026-07-31', 1.0000),
  (12,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   15, '2026-07-01', '2026-07-31', 1.0000),
  (12,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   15, '2026-07-01', '2026-07-31', 1.0000),
  (12,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     4200.00,   15, '2026-07-01', '2026-07-31', 1.0000),
  (12,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    67048.37,   15, '2026-07-01', '2026-07-31', 1.0000),
  (12,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -5040.00,   15, '2026-07-01', '2026-07-31', 1.0000),
  (12,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   15, '2026-07-01', '2026-07-31', 1.0000),
  (12,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -2100.00,   15, '2026-07-01', '2026-07-31', 1.0000),
  (12,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    59708.37,   15, '2026-07-01', '2026-07-31', 1.0000),
  (12, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,     1198.37,   15, '2026-07-01', '2026-07-31',   NULL),
  (13,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    36000.00,   16, '2026-07-01', '2026-07-31', 1.0000),
  (13,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    14400.00,   16, '2026-07-01', '2026-07-31', 1.0000),
  (13,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   16, '2026-07-01', '2026-07-31', 1.0000),
  (13,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   16, '2026-07-01', '2026-07-31', 1.0000),
  (13,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     3600.00,   16, '2026-07-01', '2026-07-31', 1.0000),
  (13,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    59002.17,   16, '2026-07-01', '2026-07-31', 1.0000),
  (13,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -4320.00,   16, '2026-07-01', '2026-07-31', 1.0000),
  (13,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   16, '2026-07-01', '2026-07-31', 1.0000),
  (13,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -1800.00,   16, '2026-07-01', '2026-07-31', 1.0000),
  (13,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    52682.17,   16, '2026-07-01', '2026-07-31', 1.0000),
  (13, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,     2152.17,   16, '2026-07-01', '2026-07-31',   NULL),
  (14,   21, 'BASIC'    , 'Stipend'               , 'basic'    ,   10,    52000.00,   17, '2026-07-01', '2026-07-31', 1.0000),
  (14,   22, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,      800.00,   17, '2026-07-01', '2026-07-31', 1.0000),
  (14,   23, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    52800.00,   17, '2026-07-01', '2026-07-31', 1.0000),
  (14,   24, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   17, '2026-07-01', '2026-07-31', 1.0000),
  (14,   25, 'NET'      , 'Net Salary'            , 'net'      ,  200,    52600.00,   17, '2026-07-01', '2026-07-31', 1.0000),
  (15,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    46000.00,   18, '2026-07-01', '2026-07-31', 1.0000),
  (15,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    18400.00,   18, '2026-07-01', '2026-07-31', 1.0000),
  (15,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   18, '2026-07-01', '2026-07-31', 1.0000),
  (15,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   18, '2026-07-01', '2026-07-31', 1.0000),
  (15,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     4600.00,   18, '2026-07-01', '2026-07-31', 1.0000),
  (15,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    71850.00,   18, '2026-07-01', '2026-07-31', 1.0000),
  (15,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -5520.00,   18, '2026-07-01', '2026-07-31', 1.0000),
  (15,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   18, '2026-07-01', '2026-07-31', 1.0000),
  (15,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -2300.00,   18, '2026-07-01', '2026-07-31', 1.0000),
  (15,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    63830.00,   18, '2026-07-01', '2026-07-31', 1.0000),
  (16,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    41000.00,   19, '2026-07-01', '2026-07-31', 1.0000),
  (16,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    16400.00,   19, '2026-07-01', '2026-07-31', 1.0000),
  (16,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   19, '2026-07-01', '2026-07-31', 1.0000),
  (16,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   19, '2026-07-01', '2026-07-31', 1.0000),
  (16,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     4100.00,   19, '2026-07-01', '2026-07-31', 1.0000),
  (16,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    65185.60,   19, '2026-07-01', '2026-07-31', 1.0000),
  (16,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -4920.00,   19, '2026-07-01', '2026-07-31', 1.0000),
  (16,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   19, '2026-07-01', '2026-07-31', 1.0000),
  (16,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -2050.00,   19, '2026-07-01', '2026-07-31', 1.0000),
  (16,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    58015.60,   19, '2026-07-01', '2026-07-31', 1.0000),
  (16, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,      835.60,   19, '2026-07-01', '2026-07-31',   NULL),
  (17,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    20000.00,   20, '2026-07-01', '2026-07-31', 1.0000),
  (17,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,     8000.00,   20, '2026-07-01', '2026-07-31', 1.0000),
  (17,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   20, '2026-07-01', '2026-07-31', 1.0000),
  (17,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   20, '2026-07-01', '2026-07-31', 1.0000),
  (17,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     2000.00,   20, '2026-07-01', '2026-07-31', 1.0000),
  (17,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    32850.00,   20, '2026-07-01', '2026-07-31', 1.0000),
  (17,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -2400.00,   20, '2026-07-01', '2026-07-31', 1.0000),
  (17,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   20, '2026-07-01', '2026-07-31', 1.0000),
  (17,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -1000.00,   20, '2026-07-01', '2026-07-31', 1.0000),
  (17,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    29250.00,   20, '2026-07-01', '2026-07-31', 1.0000),
  (18,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    38000.00,   21, '2026-07-01', '2026-07-31', 1.0000),
  (18,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    15200.00,   21, '2026-07-01', '2026-07-31', 1.0000),
  (18,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   21, '2026-07-01', '2026-07-31', 1.0000),
  (18,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   21, '2026-07-01', '2026-07-31', 1.0000),
  (18,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     3800.00,   21, '2026-07-01', '2026-07-31', 1.0000),
  (18,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    60314.67,   21, '2026-07-01', '2026-07-31', 1.0000),
  (18,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -4560.00,   21, '2026-07-01', '2026-07-31', 1.0000),
  (18,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   21, '2026-07-01', '2026-07-31', 1.0000),
  (18,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -1900.00,   21, '2026-07-01', '2026-07-31', 1.0000),
  (18,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    53654.67,   21, '2026-07-01', '2026-07-31', 1.0000),
  (18, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,      464.67,   21, '2026-07-01', '2026-07-31',   NULL),
  (19,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    42857.14,    1, '2026-08-01', '2026-08-15', 0.4762),
  (19,   11, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    55000.00,    2, '2026-08-16', '2026-08-31', 0.5238),
  (19,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    17142.86,    1, '2026-08-01', '2026-08-15', 0.4762),
  (19,   12, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    27500.00,    2, '2026-08-16', '2026-08-31', 0.5238),
  (19,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,      761.90,    1, '2026-08-01', '2026-08-15', 0.4762),
  (19,   13, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1571.43,    2, '2026-08-16', '2026-08-31', 0.5238),
  (19,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,      595.24,    1, '2026-08-01', '2026-08-15', 0.4762),
  (19,   14, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1309.52,    2, '2026-08-16', '2026-08-31', 0.5238),
  (19,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     4285.71,    1, '2026-08-01', '2026-08-15', 0.4762),
  (19,   15, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     8250.00,    2, '2026-08-16', '2026-08-31', 0.5238),
  (19,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,   160479.16,    1, '2026-08-01', '2026-08-15', 0.4762),
  (19,   16, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,   160479.16,    2, '2026-08-16', '2026-08-31', 0.5238),
  (19,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -5142.86,    1, '2026-08-01', '2026-08-15', 0.4762),
  (19,   17, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -6600.00,    2, '2026-08-16', '2026-08-31', 0.5238),
  (19,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,      -95.24,    1, '2026-08-01', '2026-08-15', 0.4762),
  (19,   18, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -104.76,    2, '2026-08-16', '2026-08-31', 0.5238),
  (19,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -2142.86,    1, '2026-08-01', '2026-08-15', 0.4762),
  (19,   19, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -6600.00,    2, '2026-08-16', '2026-08-31', 0.5238),
  (19,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,   139793.44,    1, '2026-08-01', '2026-08-15', 0.4762),
  (19,   20, 'NET'      , 'Net Salary'            , 'net'      ,  200,   139793.44,    2, '2026-08-16', '2026-08-31', 0.5238),
  (19, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,     1205.36,    1, '2026-08-01', '2026-08-15',   NULL),
  (20,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    62000.00,    3, '2026-08-01', '2026-08-31', 1.0000),
  (20,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    24800.00,    3, '2026-08-01', '2026-08-31', 1.0000),
  (20,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,    3, '2026-08-01', '2026-08-31', 1.0000),
  (20,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,    3, '2026-08-01', '2026-08-31', 1.0000),
  (20,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     6200.00,    3, '2026-08-01', '2026-08-31', 1.0000),
  (20,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    98617.86,    3, '2026-08-01', '2026-08-31', 1.0000),
  (20,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -7440.00,    3, '2026-08-01', '2026-08-31', 1.0000),
  (20,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,    3, '2026-08-01', '2026-08-31', 1.0000),
  (20,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -3100.00,    3, '2026-08-01', '2026-08-31', 1.0000),
  (20,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    87877.86,    3, '2026-08-01', '2026-08-31', 1.0000),
  (20, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,     2767.86,    3, '2026-08-01', '2026-08-31',   NULL),
  (21,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    55000.00,    5, '2026-08-01', '2026-08-31', 1.0000),
  (21,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    22000.00,    5, '2026-08-01', '2026-08-31', 1.0000),
  (21,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,    5, '2026-08-01', '2026-08-31', 1.0000),
  (21,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,    5, '2026-08-01', '2026-08-31', 1.0000),
  (21,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     5500.00,    5, '2026-08-01', '2026-08-31', 1.0000),
  (21,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    86332.14,    5, '2026-08-01', '2026-08-31', 1.0000),
  (21,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -6600.00,    5, '2026-08-01', '2026-08-31', 1.0000),
  (21,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,    5, '2026-08-01', '2026-08-31', 1.0000),
  (21,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -2750.00,    5, '2026-08-01', '2026-08-31', 1.0000),
  (21,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    68560.03,    5, '2026-08-01', '2026-08-31', 1.0000),
  (21, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,      982.14,    5, '2026-08-01', '2026-08-31',   NULL),
  (21, NULL, 'UNPAID_LV', 'Unpaid Leave Deduction', 'deduction', 9998,    -8222.11,    5, NULL        , NULL        ,   NULL),
  (22,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    28000.00,    7, '2026-08-01', '2026-08-31', 1.0000),
  (22,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    11200.00,    7, '2026-08-01', '2026-08-31', 1.0000),
  (22,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,    7, '2026-08-01', '2026-08-31', 1.0000),
  (22,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,    7, '2026-08-01', '2026-08-31', 1.0000),
  (22,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     2800.00,    7, '2026-08-01', '2026-08-31', 1.0000),
  (22,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    44850.00,    7, '2026-08-01', '2026-08-31', 1.0000),
  (22,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -3360.00,    7, '2026-08-01', '2026-08-31', 1.0000),
  (22,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,    7, '2026-08-01', '2026-08-31', 1.0000),
  (22,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -1400.00,    7, '2026-08-01', '2026-08-31', 1.0000),
  (22,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    35618.57,    7, '2026-08-01', '2026-08-31', 1.0000),
  (22, NULL, 'UNPAID_LV', 'Unpaid Leave Deduction', 'deduction', 9998,    -4271.43,    7, NULL        , NULL        ,   NULL),
  (23,   21, 'BASIC'    , 'Stipend'               , 'basic'    ,   10,    25000.00,    8, '2026-08-01', '2026-08-31', 1.0000),
  (23,   22, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,      800.00,    8, '2026-08-01', '2026-08-31', 1.0000),
  (23,   23, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    25800.00,    8, '2026-08-01', '2026-08-31', 1.0000),
  (23,   24, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,    8, '2026-08-01', '2026-08-31', 1.0000),
  (23,   25, 'NET'      , 'Net Salary'            , 'net'      ,  200,    25600.00,    8, '2026-08-01', '2026-08-31', 1.0000),
  (24,   11, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    85000.00,    9, '2026-08-01', '2026-08-31', 1.0000),
  (24,   12, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    42500.00,    9, '2026-08-01', '2026-08-31', 1.0000),
  (24,   13, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     3000.00,    9, '2026-08-01', '2026-08-31', 1.0000),
  (24,   14, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     2500.00,    9, '2026-08-01', '2026-08-31', 1.0000),
  (24,   15, 'SPA'      , 'Special Allowance'     , 'allowance',   50,    12750.00,    9, '2026-08-01', '2026-08-31', 1.0000),
  (24,   16, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,   151821.43,    9, '2026-08-01', '2026-08-31', 1.0000),
  (24,   17, 'PF'       , 'Provident Fund'        , 'deduction',  110,   -10200.00,    9, '2026-08-01', '2026-08-31', 1.0000),
  (24,   18, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,    9, '2026-08-01', '2026-08-31', 1.0000),
  (24,   19, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,   -10200.00,    9, '2026-08-01', '2026-08-31', 1.0000),
  (24,   20, 'NET'      , 'Net Salary'            , 'net'      ,  200,   131221.43,    9, '2026-08-01', '2026-08-31', 1.0000),
  (24, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,     6071.43,    9, '2026-08-01', '2026-08-31',   NULL),
  (25,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    40000.00,   10, '2026-08-01', '2026-08-31', 1.0000),
  (25,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    16000.00,   10, '2026-08-01', '2026-08-31', 1.0000),
  (25,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   10, '2026-08-01', '2026-08-31', 1.0000),
  (25,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   10, '2026-08-01', '2026-08-31', 1.0000),
  (25,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     4000.00,   10, '2026-08-01', '2026-08-31', 1.0000),
  (25,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    63921.43,   10, '2026-08-01', '2026-08-31', 1.0000),
  (25,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -4800.00,   10, '2026-08-01', '2026-08-31', 1.0000),
  (25,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   10, '2026-08-01', '2026-08-31', 1.0000),
  (25,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -2000.00,   10, '2026-08-01', '2026-08-31', 1.0000),
  (25,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    56921.43,   10, '2026-08-01', '2026-08-31', 1.0000),
  (25, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,     1071.43,   10, '2026-08-01', '2026-08-31',   NULL),
  (26,   11, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    75000.00,   11, '2026-08-01', '2026-08-31', 1.0000),
  (26,   12, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    37500.00,   11, '2026-08-01', '2026-08-31', 1.0000),
  (26,   13, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     3000.00,   11, '2026-08-01', '2026-08-31', 1.0000),
  (26,   14, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     2500.00,   11, '2026-08-01', '2026-08-31', 1.0000),
  (26,   15, 'SPA'      , 'Special Allowance'     , 'allowance',   50,    11250.00,   11, '2026-08-01', '2026-08-31', 1.0000),
  (26,   16, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,   133267.86,   11, '2026-08-01', '2026-08-31', 1.0000),
  (26,   17, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -9000.00,   11, '2026-08-01', '2026-08-31', 1.0000),
  (26,   18, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   11, '2026-08-01', '2026-08-31', 1.0000),
  (26,   19, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -9000.00,   11, '2026-08-01', '2026-08-31', 1.0000),
  (26,   20, 'NET'      , 'Net Salary'            , 'net'      ,  200,   115067.86,   11, '2026-08-01', '2026-08-31', 1.0000),
  (26, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,     4017.86,   11, '2026-08-01', '2026-08-31',   NULL),
  (27,   11, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    68000.00,   12, '2026-08-01', '2026-08-31', 1.0000),
  (27,   12, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    34000.00,   12, '2026-08-01', '2026-08-31', 1.0000),
  (27,   13, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     3000.00,   12, '2026-08-01', '2026-08-31', 1.0000),
  (27,   14, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     2500.00,   12, '2026-08-01', '2026-08-31', 1.0000),
  (27,   15, 'SPA'      , 'Special Allowance'     , 'allowance',   50,    10200.00,   12, '2026-08-01', '2026-08-31', 1.0000),
  (27,   16, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,   122253.57,   12, '2026-08-01', '2026-08-31', 1.0000),
  (27,   17, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -8160.00,   12, '2026-08-01', '2026-08-31', 1.0000),
  (27,   18, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   12, '2026-08-01', '2026-08-31', 1.0000),
  (27,   19, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -8160.00,   12, '2026-08-01', '2026-08-31', 1.0000),
  (27,   20, 'NET'      , 'Net Salary'            , 'net'      ,  200,   105733.57,   12, '2026-08-01', '2026-08-31', 1.0000),
  (27, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,     4553.57,   12, '2026-08-01', '2026-08-31',   NULL),
  (28,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    44000.00,   13, '2026-08-01', '2026-08-31', 1.0000),
  (28,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    17600.00,   13, '2026-08-01', '2026-08-31', 1.0000),
  (28,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   13, '2026-08-01', '2026-08-31', 1.0000),
  (28,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   13, '2026-08-01', '2026-08-31', 1.0000),
  (28,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     4400.00,   13, '2026-08-01', '2026-08-31', 1.0000),
  (28,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    68850.00,   13, '2026-08-01', '2026-08-31', 1.0000),
  (28,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -5280.00,   13, '2026-08-01', '2026-08-31', 1.0000),
  (28,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   13, '2026-08-01', '2026-08-31', 1.0000),
  (28,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -2200.00,   13, '2026-08-01', '2026-08-31', 1.0000),
  (28,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    61170.00,   13, '2026-08-01', '2026-08-31', 1.0000),
  (29,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    38000.00,   14, '2026-08-01', '2026-08-31', 1.0000),
  (29,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    15200.00,   14, '2026-08-01', '2026-08-31', 1.0000),
  (29,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   14, '2026-08-01', '2026-08-31', 1.0000),
  (29,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   14, '2026-08-01', '2026-08-31', 1.0000),
  (29,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     3800.00,   14, '2026-08-01', '2026-08-31', 1.0000),
  (29,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    61037.50,   14, '2026-08-01', '2026-08-31', 1.0000),
  (29,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -4560.00,   14, '2026-08-01', '2026-08-31', 1.0000),
  (29,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   14, '2026-08-01', '2026-08-31', 1.0000),
  (29,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -1900.00,   14, '2026-08-01', '2026-08-31', 1.0000),
  (29,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    54377.50,   14, '2026-08-01', '2026-08-31', 1.0000),
  (29, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,     1187.50,   14, '2026-08-01', '2026-08-31',   NULL),
  (30,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    42000.00,   15, '2026-08-01', '2026-08-31', 1.0000),
  (30,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    16800.00,   15, '2026-08-01', '2026-08-31', 1.0000),
  (30,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   15, '2026-08-01', '2026-08-31', 1.0000),
  (30,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   15, '2026-08-01', '2026-08-31', 1.0000),
  (30,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     4200.00,   15, '2026-08-01', '2026-08-31', 1.0000),
  (30,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    67912.50,   15, '2026-08-01', '2026-08-31', 1.0000),
  (30,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -5040.00,   15, '2026-08-01', '2026-08-31', 1.0000),
  (30,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   15, '2026-08-01', '2026-08-31', 1.0000),
  (30,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -2100.00,   15, '2026-08-01', '2026-08-31', 1.0000),
  (30,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    60572.50,   15, '2026-08-01', '2026-08-31', 1.0000),
  (30, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,     2062.50,   15, '2026-08-01', '2026-08-31',   NULL),
  (31,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    36000.00,   16, '2026-08-01', '2026-08-31', 1.0000),
  (31,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    14400.00,   16, '2026-08-01', '2026-08-31', 1.0000),
  (31,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   16, '2026-08-01', '2026-08-31', 1.0000),
  (31,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   16, '2026-08-01', '2026-08-31', 1.0000),
  (31,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     3600.00,   16, '2026-08-01', '2026-08-31', 1.0000),
  (31,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    61564.29,   16, '2026-08-01', '2026-08-31', 1.0000),
  (31,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -4320.00,   16, '2026-08-01', '2026-08-31', 1.0000),
  (31,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   16, '2026-08-01', '2026-08-31', 1.0000),
  (31,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -1800.00,   16, '2026-08-01', '2026-08-31', 1.0000),
  (31,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    55244.29,   16, '2026-08-01', '2026-08-31', 1.0000),
  (31, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,     4714.29,   16, '2026-08-01', '2026-08-31',   NULL),
  (32,   21, 'BASIC'    , 'Stipend'               , 'basic'    ,   10,    52000.00,   17, '2026-08-01', '2026-08-31', 1.0000),
  (32,   22, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,      800.00,   17, '2026-08-01', '2026-08-31', 1.0000),
  (32,   23, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    52800.00,   17, '2026-08-01', '2026-08-31', 1.0000),
  (32,   24, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   17, '2026-08-01', '2026-08-31', 1.0000),
  (32,   25, 'NET'      , 'Net Salary'            , 'net'      ,  200,    52600.00,   17, '2026-08-01', '2026-08-31', 1.0000),
  (33,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    46000.00,   18, '2026-08-01', '2026-08-31', 1.0000),
  (33,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    18400.00,   18, '2026-08-01', '2026-08-31', 1.0000),
  (33,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   18, '2026-08-01', '2026-08-31', 1.0000),
  (33,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   18, '2026-08-01', '2026-08-31', 1.0000),
  (33,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     4600.00,   18, '2026-08-01', '2026-08-31', 1.0000),
  (33,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    72300.98,   18, '2026-08-01', '2026-08-31', 1.0000),
  (33,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -5520.00,   18, '2026-08-01', '2026-08-31', 1.0000),
  (33,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   18, '2026-08-01', '2026-08-31', 1.0000),
  (33,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -2300.00,   18, '2026-08-01', '2026-08-31', 1.0000),
  (33,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    64280.98,   18, '2026-08-01', '2026-08-31', 1.0000),
  (33, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,      450.98,   18, '2026-08-01', '2026-08-31',   NULL),
  (34,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    41000.00,   19, '2026-08-01', '2026-08-31', 1.0000),
  (34,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    16400.00,   19, '2026-08-01', '2026-08-31', 1.0000),
  (34,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   19, '2026-08-01', '2026-08-31', 1.0000),
  (34,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   19, '2026-08-01', '2026-08-31', 1.0000),
  (34,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     4100.00,   19, '2026-08-01', '2026-08-31', 1.0000),
  (34,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    65265.18,   19, '2026-08-01', '2026-08-31', 1.0000),
  (34,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -4920.00,   19, '2026-08-01', '2026-08-31', 1.0000),
  (34,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   19, '2026-08-01', '2026-08-31', 1.0000),
  (34,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -2050.00,   19, '2026-08-01', '2026-08-31', 1.0000),
  (34,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    58095.18,   19, '2026-08-01', '2026-08-31', 1.0000),
  (34, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,      915.18,   19, '2026-08-01', '2026-08-31',   NULL),
  (35,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    20000.00,   20, '2026-08-01', '2026-08-31', 1.0000),
  (35,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,     8000.00,   20, '2026-08-01', '2026-08-31', 1.0000),
  (35,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1600.00,   20, '2026-08-01', '2026-08-31', 1.0000),
  (35,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,     1250.00,   20, '2026-08-01', '2026-08-31', 1.0000),
  (35,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     2000.00,   20, '2026-08-01', '2026-08-31', 1.0000),
  (35,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    32850.00,   20, '2026-08-01', '2026-08-31', 1.0000),
  (35,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -2400.00,   20, '2026-08-01', '2026-08-31', 1.0000),
  (35,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -200.00,   20, '2026-08-01', '2026-08-31', 1.0000),
  (35,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -1000.00,   20, '2026-08-01', '2026-08-31', 1.0000),
  (35,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    29250.00,   20, '2026-08-01', '2026-08-31', 1.0000),
  (36,    1, 'BASIC'    , 'Basic Salary'          , 'basic'    ,   10,    27142.86,   21, '2026-08-01', '2026-08-21', 0.7143),
  (36,    2, 'HRA'      , 'House Rent Allowance'  , 'allowance',   20,    10857.14,   21, '2026-08-01', '2026-08-21', 0.7143),
  (36,    3, 'CONV'     , 'Conveyance Allowance'  , 'allowance',   30,     1142.86,   21, '2026-08-01', '2026-08-21', 0.7143),
  (36,    4, 'MED'      , 'Medical Allowance'     , 'allowance',   40,      892.86,   21, '2026-08-01', '2026-08-21', 0.7143),
  (36,    5, 'SPA'      , 'Special Allowance'     , 'allowance',   50,     2714.29,   21, '2026-08-01', '2026-08-21', 0.7143),
  (36,    6, 'GROSS'    , 'Gross Salary'          , 'gross'    ,  100,    43089.30,   21, '2026-08-01', '2026-08-21', 0.7143),
  (36,    7, 'PF'       , 'Provident Fund'        , 'deduction',  110,    -3257.14,   21, '2026-08-01', '2026-08-21', 0.7143),
  (36,    8, 'PT'       , 'Professional Tax'      , 'deduction',  120,     -142.86,   21, '2026-08-01', '2026-08-21', 0.7143),
  (36,    9, 'TDS'      , 'Income Tax (TDS)'      , 'deduction',  130,    -1357.14,   21, '2026-08-01', '2026-08-21', 0.7143),
  (36,   10, 'NET'      , 'Net Salary'            , 'net'      ,  200,    38332.16,   21, '2026-08-01', '2026-08-21', 0.7143),
  (36, NULL, 'OT_PAY'   , 'Overtime Pay'          , 'allowance', 9000,      339.29,   21, '2026-08-01', '2026-08-21',   NULL);


-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 6: AUDIT TRAIL — generic trigger-based change log
-- ═══════════════════════════════════════════════════════════════════════════════
-- One JSONB table + one trigger function, attached to the tables judges care
-- about seeing tracked. Attached AFTER seeding on purpose, so the demo starts
-- with an empty, clean audit log instead of 100s of INSERT rows from the seed
-- data above.

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(255) NOT NULL,
    record_id INT NOT NULL,
    action VARCHAR(10) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_changed_at ON audit_logs(changed_at DESC);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);

CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD)::jsonb);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF row_to_json(OLD)::jsonb = row_to_json(NEW)::jsonb THEN
            RETURN NEW;
        END IF;
        INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW)::jsonb);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_users_changes     AFTER INSERT OR UPDATE OR DELETE ON users              FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_contracts_changes AFTER INSERT OR UPDATE OR DELETE ON contracts          FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_attendance_changes AFTER INSERT OR UPDATE OR DELETE ON attendance        FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_time_off_changes  AFTER INSERT OR UPDATE OR DELETE ON time_off_requests  FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_pay_runs_changes  AFTER INSERT OR UPDATE OR DELETE ON pay_runs            FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_payslips_changes  AFTER INSERT OR UPDATE OR DELETE ON payslips            FOR EACH ROW EXECUTE FUNCTION log_audit_event();


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE! Schema created and seeded successfully.
-- ═══════════════════════════════════════════════════════════════════════════════
