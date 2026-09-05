/**
 * @fileoverview Payroll engine constants — day-of-week mapping, warning/rule
 * codes, synthetic line sequences, and status enums shared by the payroll
 * engine service, pay run service, and payslip service.
 *
 * See `payroll-computation-algorithm.md` §2 (Phase 0 constants) and §15
 * (Warning Reference Table) for the source of truth.
 */

/**
 * Maps the `day_of_week` Postgres enum values to ISO day-of-week integers
 * (1 = Monday … 7 = Sunday), matching `EXTRACT(ISODOW FROM date)`.
 *
 * @readonly
 * @enum {number}
 */
export const DOW_MAP = Object.freeze({
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
});

/**
 * Warning severity levels stored in `payslips.warnings[].severity`.
 *
 * @readonly
 * @enum {string}
 */
export const SEVERITY = Object.freeze({
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
});

/**
 * Warning codes emitted by the payroll engine. See algorithm doc §15 for the
 * trigger condition of each code.
 *
 * @readonly
 * @enum {string}
 */
export const WARNING = Object.freeze({
  NO_ACTIVE_CONTRACT: 'NO_ACTIVE_CONTRACT',
  DUPLICATE_PAYSLIP: 'DUPLICATE_PAYSLIP',
  MULTIPLE_CONTRACTS: 'MULTIPLE_CONTRACTS',
  PRORATED_PAYSLIP: 'PRORATED_PAYSLIP',
  MISSING_BANK_DETAILS: 'MISSING_BANK_DETAILS',
  MISSING_DATA: 'MISSING_DATA',
  UNREVIEWED_ATTENDANCE: 'UNREVIEWED_ATTENDANCE',
  MISSING_CHECKIN_DAYS: 'MISSING_CHECKIN_DAYS',
  UNPAID_LEAVE_DEDUCTION: 'UNPAID_LEAVE_DEDUCTION',
  HOLIDAY_WORK_DETECTED: 'HOLIDAY_WORK_DETECTED',
  OT_NO_POLICY: 'OT_NO_POLICY',
  COMP_OFF_CREDITED: 'COMP_OFF_CREDITED',
  NEGATIVE_NET: 'NEGATIVE_NET',
  STRUCTURE_INACTIVE: 'STRUCTURE_INACTIVE',
});

/**
 * Well-known salary rule codes referenced by name in the engine (BASIC uses
 * contract wage instead of `fixed_amount`; GROSS/NET are placeholders).
 *
 * @readonly
 * @enum {string}
 */
export const RULE_CODE = Object.freeze({
  BASIC: 'BASIC',
  GROSS: 'GROSS',
  NET: 'NET',
  OT_PAY: 'OT_PAY',
  UNPAID_LV: 'UNPAID_LV',
});

/** Codes whose amount is a placeholder in Phase 5A and back-filled in Phase 7. */
export const PLACEHOLDER_CODES = Object.freeze(new Set([RULE_CODE.GROSS, RULE_CODE.NET]));

/**
 * Synthetic payslip_line sequences for lines generated outside the
 * `salary_rules` sequence space (OT pay, unpaid leave deduction).
 *
 * @readonly
 * @enum {number}
 */
export const SYNTHETIC_SEQUENCE = Object.freeze({
  OT_PAY: 9000,
  UNPAID_LV: 9998,
});

/**
 * `salary_rules.category` / `payslip_lines.category` enum values.
 *
 * @readonly
 * @enum {string}
 */
export const CATEGORY = Object.freeze({
  BASIC: 'basic',
  ALLOWANCE: 'allowance',
  GROSS: 'gross',
  DEDUCTION: 'deduction',
  NET: 'net',
});

/** Categories that roll up into `gross_salary` (Phase 7). */
export const EARNING_CATEGORIES = Object.freeze(new Set([CATEGORY.BASIC, CATEGORY.ALLOWANCE]));

/**
 * `pay_runs.status` enum values.
 *
 * @readonly
 * @enum {string}
 */
export const PAYRUN_STATUS = Object.freeze({
  DRAFT: 'draft',
  COMPUTED: 'computed',
  VALIDATED: 'validated',
  PAID: 'paid',
  CANCELLED: 'cancelled',
});

/**
 * `payslips.status` enum values.
 *
 * @readonly
 * @enum {string}
 */
export const PAYSLIP_STATUS = Object.freeze({
  DRAFT: 'draft',
  COMPUTED: 'computed',
  VALIDATED: 'validated',
  PAID: 'paid',
  CANCELLED: 'cancelled',
});

/** `attendance.status` values that count toward worked days (Phase 8). */
export const PRESENT_STATUSES = Object.freeze(['present', 'special_leave']);

/**
 * Builds a warning object in the shape stored in `payslips.warnings` (JSONB).
 *
 * @param {string} code - One of {@link WARNING}.
 * @param {string} severity - One of {@link SEVERITY}.
 * @param {string} message - Human-readable message, with counts interpolated.
 * @param {object} [details] - Structured details (e.g. { days, per_day_rate }).
 * @returns {{code: string, severity: string, message: string, details: object}}
 */
export const makeWarning = (code, severity, message, details = {}) => ({
  code,
  severity,
  message,
  details,
});
