# HRMS Odoo

# ER Diagram

```mermaid
erDiagram
    departments {
        SERIAL id PK
        VARCHAR name UK
        TIMESTAMP created_at
    }

    job_positions {
        SERIAL id PK
        VARCHAR title UK
        TIMESTAMP created_at
    }

    company_holidays {
        SERIAL id PK
        VARCHAR name
        DATE date UK
        holiday_type holiday_type
        BOOLEAN is_paid
        TIMESTAMP created_at
    }

    overtime_policies {
        SERIAL id PK
        VARCHAR name
        overtime_threshold_type threshold_type
        DECIMAL daily_threshold_hrs
        DECIMAL weekly_threshold_hrs
        DECIMAL multiplier
        BOOLEAN compensatory_off
        TIMESTAMP created_at
    }

    users {
        SERIAL id PK
        VARCHAR first_name
        VARCHAR last_name
        VARCHAR email UK
        VARCHAR phone
        VARCHAR password_hash
        user_role role
        employment_status employment_status
        employee_type employee_type
        BOOLEAN is_active
        INT department_id FK
        INT job_position_id FK
        INT manager_id FK
        DATE date_of_joining
        DATE date_of_leaving
        DATE date_of_birth
        VARCHAR bank_name
        VARCHAR bank_account
        TEXT address
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    working_schedules {
        SERIAL id PK
        VARCHAR name
        DECIMAL total_weekly_hours
        BOOLEAN is_active
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    schedule_lines {
        SERIAL id PK
        INT schedule_id FK
        day_of_week day_of_week
        TIME start_time
        TIME end_time
        INT break_minutes
        BOOLEAN is_active
    }

    salary_structures {
        SERIAL id PK
        VARCHAR name
        salary_structure_status status
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    salary_rules {
        SERIAL id PK
        INT structure_id FK
        VARCHAR code
        VARCHAR name
        salary_rule_category category
        INT sequence
        salary_rule_type rule_type
        DECIMAL fixed_amount
        DECIMAL percentage
        INT base_rule_id FK
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    contracts {
        SERIAL id PK
        INT employee_id FK
        INT schedule_id FK
        INT salary_structure_id FK
        INT overtime_policy_id FK
        INT department_id FK
        INT job_position_id FK
        DECIMAL wage
        DATE start_date
        DATE end_date
        contract_status status
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    time_off_types {
        SERIAL id PK
        VARCHAR name UK
        time_off_unit unit
        BOOLEAN requires_allocation
        BOOLEAN approval_required
        user_role approver_role
        leave_validation_type leave_validation
        attendance_impact attendance_impact
        BOOLEAN is_paid
        BOOLEAN is_active
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    contract_time_off_types {
        SERIAL id PK
        INT contract_id FK
        INT time_off_type_id FK
    }

    time_off_allocations {
        SERIAL id PK
        INT employee_id FK
        INT time_off_type_id FK
        DATE start_date
        DATE end_date
        DECIMAL allocated_amount
        DECIMAL taken
        allocation_status status
        INT approved_by FK
        TIMESTAMP approved_at
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    time_off_requests {
        SERIAL id PK
        INT employee_id FK
        INT time_off_type_id FK
        INT allocation_id FK
        DATE start_date
        DATE end_date
        TIME start_time
        TIME end_time
        DECIMAL number_of_days
        DECIMAL number_of_hours
        TEXT reason
        leave_request_status status
        INT approver_id FK
        TIMESTAMP approved_at
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    attendance {
        SERIAL id PK
        INT employee_id FK
        DATE date
        TIMESTAMP check_in
        TIMESTAMP check_out
        DECIMAL worked_hours
        DECIMAL overtime_hours
        overtime_type overtime_type
        BOOLEAN is_manual_edit
        INT edited_by FK
        VARCHAR status
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    pay_runs {
        SERIAL id PK
        VARCHAR name
        INT salary_structure_id FK
        DATE start_date
        DATE end_date
        payrun_status status
        INT created_by FK
        TIMESTAMP validated_at
        TIMESTAMP paid_at
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    pay_run_employees {
        SERIAL id PK
        INT pay_run_id FK
        INT employee_id FK
    }

    payslips {
        SERIAL id PK
        INT pay_run_id FK
        INT employee_id FK
        INT contract_id FK
        DECIMAL gross_salary
        DECIMAL net_salary
        DECIMAL total_deductions
        DECIMAL worked_days
        DECIMAL worked_hours
        payslip_status status
        JSONB warnings
        BOOLEAN is_reviewed
        INT reviewed_by FK
        TIMESTAMP reviewed_at
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    payslip_lines {
        SERIAL id PK
        INT payslip_id FK
        INT rule_id FK
        VARCHAR rule_code
        VARCHAR rule_name
        salary_rule_category category
        INT sequence
        DECIMAL amount
        INT contract_id FK
        DATE segment_start
        DATE segment_end
        DECIMAL proration_factor
        TIMESTAMP computed_at
    }

    %% Relationships

    departments ||--o{ users : "has"
    job_positions ||--o{ users : "has"
    users ||--o{ users : "manages"

    working_schedules ||--o{ schedule_lines : "defines"

    salary_structures ||--o{ salary_rules : "contains"
    salary_rules ||--o{ salary_rules : "base_rule"

    users ||--o{ contracts : "has"
    working_schedules ||--o{ contracts : "assigned_to"
    salary_structures ||--o{ contracts : "assigned_to"
    overtime_policies ||--o{ contracts : "applies_to"
    departments ||--o{ contracts : "for"
    job_positions ||--o{ contracts : "for"

    contracts ||--o{ contract_time_off_types : "eligible"
    time_off_types ||--o{ contract_time_off_types : "linked"

    users ||--o{ time_off_allocations : "granted_to"
    time_off_types ||--o{ time_off_allocations : "for"
    users ||--o{ time_off_allocations : "approved_by"

    users ||--o{ time_off_requests : "requested_by"
    time_off_types ||--o{ time_off_requests : "type"
    time_off_allocations ||--o{ time_off_requests : "draws_from"
    users ||--o{ time_off_requests : "approved_by"

    users ||--o{ attendance : "records"
    users ||--o{ attendance : "edited_by"

    salary_structures ||--o{ pay_runs : "uses"
    users ||--o{ pay_runs : "created_by"

    pay_runs ||--o{ pay_run_employees : "includes"
    users ||--o{ pay_run_employees : "selected"

    pay_runs ||--o{ payslips : "generates"
    users ||--o{ payslips : "for"
    contracts ||--o{ payslips : "based_on"
    users ||--o{ payslips : "reviewed_by"

    payslips ||--o{ payslip_lines : "breakdown"
    salary_rules ||--o{ payslip_lines : "from_rule"
    contracts ||--o{ payslip_lines : "segment"
```