// ── Employees ──────────────────────────────────────────────────
export const employees = [
  { id: 1, name: 'Aarav Mehta',  initials: 'AM', color: '#4f46e5', jobTitle: 'Payroll Specialist', department: 'Finance',     manager: 'Sara Khan',   schedule: '40 Hours / Week', company: 'OXP Pvt Ltd', email: 'aarav@oxp.com',   phone: '+91 98765 43210', status: 'Active',   contracts: 2, timeOff: 3, attendance: 14 },
  { id: 2, name: 'Sara Khan',    initials: 'SK', color: '#0891b2', jobTitle: 'HR Officer',          department: 'HR',          manager: 'Admin',       schedule: '40 Hours / Week', company: 'OXP Pvt Ltd', email: 'sara@oxp.com',    phone: '+91 98100 00001', status: 'Active',   contracts: 1, timeOff: 2, attendance: 22 },
  { id: 3, name: 'John Dsouza',  initials: 'JD', color: '#059669', jobTitle: 'Developer',           department: 'Engineering', manager: 'Sara Khan',   schedule: 'Night Shift',     company: 'OXP Pvt Ltd', email: 'john@oxp.com',    phone: '+91 98100 00002', status: 'Active',   contracts: 1, timeOff: 1, attendance: 20 },
  { id: 4, name: 'Neha Patel',   initials: 'NP', color: '#d97706', jobTitle: 'Recruiter',           department: 'HR',          manager: 'Sara Khan',   schedule: 'Flexible Hybrid', company: 'OXP Pvt Ltd', email: 'neha@oxp.com',    phone: '+91 98100 00003', status: 'Active',   contracts: 1, timeOff: 4, attendance: 18 },
  { id: 5, name: 'Rohan Patel',  initials: 'RP', color: '#7c3aed', jobTitle: 'Sales Executive',     department: 'Sales',       manager: 'Admin',       schedule: '40 Hours / Week', company: 'OXP Pvt Ltd', email: 'rohan@oxp.com',   phone: '+91 98100 00004', status: 'Active',   contracts: 1, timeOff: 0, attendance: 19 },
  { id: 6, name: 'Nisha Rao',    initials: 'NR', color: '#be185d', jobTitle: 'Payroll Admin',       department: 'Finance',     manager: 'Aarav Mehta', schedule: '40 Hours / Week', company: 'OXP Pvt Ltd', email: 'nisha@oxp.com',   phone: '+91 98100 00005', status: 'Active',   contracts: 1, timeOff: 2, attendance: 17 },
  { id: 7, name: 'Karan Singh',  initials: 'KS', color: '#0f766e', jobTitle: 'Support Lead',        department: 'Support',     manager: 'Admin',       schedule: '40 Hours / Week', company: 'OXP Pvt Ltd', email: 'karan@oxp.com',   phone: '+91 98100 00006', status: 'Inactive', contracts: 1, timeOff: 1, attendance: 10 },
  { id: 8, name: 'Maya Shah',    initials: 'MS', color: '#c2410c', jobTitle: 'IT Analyst',          department: 'IT',          manager: 'Admin',       schedule: '40 Hours / Week', company: 'OXP Pvt Ltd', email: 'maya@oxp.com',    phone: '+91 98100 00007', status: 'Active',   contracts: 1, timeOff: 3, attendance: 21 },
];

// ── Contracts ──────────────────────────────────────────────────
export const contracts = [
  { id: 1, ref: 'CON/2026/0042', employeeId: 1, employeeName: 'Aarav Mehta',  department: 'Finance',     jobPosition: 'Payroll Specialist', startDate: '2026-01-01', endDate: null,         wage: 85000, status: 'Running',  schedule: '40 Hours / Week', structure: 'Employee Salary' },
  { id: 2, ref: 'CON/2025/0018', employeeId: 1, employeeName: 'Aarav Mehta',  department: 'Finance',     jobPosition: 'Payroll Specialist', startDate: '2025-07-01', endDate: '2025-12-31', wage: 78000, status: 'Expired',  schedule: '40 Hours / Week', structure: 'Employee Salary' },
  { id: 3, ref: 'CON/2026/0031', employeeId: 2, employeeName: 'Sara Khan',    department: 'HR',          jobPosition: 'HR Officer',          startDate: '2026-01-01', endDate: null,         wage: 95000, status: 'Running',  schedule: '40 Hours / Week', structure: 'Employee Salary' },
  { id: 4, ref: 'CON/2026/0015', employeeId: 3, employeeName: 'John Dsouza',  department: 'Engineering', jobPosition: 'Developer',           startDate: '2026-01-01', endDate: null,         wage: 120000,status: 'Running',  schedule: 'Night Shift',     structure: 'Employee Salary' },
  { id: 5, ref: 'CON/2026/0019', employeeId: 4, employeeName: 'Neha Patel',   department: 'HR',          jobPosition: 'Recruiter',           startDate: '2026-02-01', endDate: null,         wage: 70000, status: 'Running',  schedule: 'Flexible Hybrid', structure: 'Employee Salary' },
  { id: 6, ref: 'CON/2026/0021', employeeId: 5, employeeName: 'Rohan Patel',  department: 'Sales',       jobPosition: 'Sales Executive',     startDate: '2026-03-01', endDate: null,         wage: 65000, status: 'Running',  schedule: '40 Hours / Week', structure: 'Employee Salary' },
  { id: 7, ref: 'CON/2026/0033', employeeId: 6, employeeName: 'Nisha Rao',    department: 'Finance',     jobPosition: 'Payroll Admin',       startDate: '2026-01-15', endDate: null,         wage: 75000, status: 'Running',  schedule: '40 Hours / Week', structure: 'Employee Salary' },
  { id: 8, ref: 'CON/2025/0009', employeeId: 7, employeeName: 'Karan Singh',  department: 'Support',     jobPosition: 'Support Lead',        startDate: '2025-01-01', endDate: '2026-06-30', wage: 60000, status: 'Expired',  schedule: '40 Hours / Week', structure: 'Employee Salary' },
  { id: 9, ref: 'CON/2026/0044', employeeId: 8, employeeName: 'Maya Shah',    department: 'IT',          jobPosition: 'IT Analyst',          startDate: '2026-01-01', endDate: null,         wage: 90000, status: 'Running',  schedule: '40 Hours / Week', structure: 'Employee Salary' },
];

// ── Working Schedules ──────────────────────────────────────────
export const workingSchedules = [
  { id: 1, name: '40 Hours / Week', daysPerWeek: 5, hoursPerWeek: '40h', company: 'My Company', status: 'Active',
    lines: [
      { day: 'Monday',    start: '09:00 AM', end: '06:00 PM', breakH: '1h', hours: '8h' },
      { day: 'Tuesday',   start: '09:00 AM', end: '06:00 PM', breakH: '1h', hours: '8h' },
      { day: 'Wednesday', start: '09:00 AM', end: '06:00 PM', breakH: '1h', hours: '8h' },
      { day: 'Thursday',  start: '09:00 AM', end: '06:00 PM', breakH: '1h', hours: '8h' },
      { day: 'Friday',    start: '09:00 AM', end: '06:00 PM', breakH: '1h', hours: '8h' },
    ]
  },
  { id: 2, name: 'Night Shift', daysPerWeek: 5, hoursPerWeek: '40h', company: 'My Company', status: 'Active',
    lines: [
      { day: 'Monday',    start: '10:00 PM', end: '07:00 AM', breakH: '1h', hours: '8h' },
      { day: 'Tuesday',   start: '10:00 PM', end: '07:00 AM', breakH: '1h', hours: '8h' },
      { day: 'Wednesday', start: '10:00 PM', end: '07:00 AM', breakH: '1h', hours: '8h' },
      { day: 'Thursday',  start: '10:00 PM', end: '07:00 AM', breakH: '1h', hours: '8h' },
      { day: 'Friday',    start: '10:00 PM', end: '07:00 AM', breakH: '1h', hours: '8h' },
    ]
  },
  { id: 3, name: 'Retail Weekend', daysPerWeek: 5, hoursPerWeek: '40h', company: 'My Company', status: 'Active',
    lines: [
      { day: 'Tuesday',   start: '10:00 AM', end: '07:00 PM', breakH: '1h', hours: '8h' },
      { day: 'Wednesday', start: '10:00 AM', end: '07:00 PM', breakH: '1h', hours: '8h' },
      { day: 'Thursday',  start: '10:00 AM', end: '07:00 PM', breakH: '1h', hours: '8h' },
      { day: 'Saturday',  start: '10:00 AM', end: '07:00 PM', breakH: '1h', hours: '8h' },
      { day: 'Sunday',    start: '10:00 AM', end: '07:00 PM', breakH: '1h', hours: '8h' },
    ]
  },
  { id: 4, name: 'Flexible Hybrid', daysPerWeek: 5, hoursPerWeek: '37.5h', company: 'My Company', status: 'Active',
    lines: [
      { day: 'Monday',    start: '09:30 AM', end: '06:00 PM', breakH: '1h', hours: '7.5h' },
      { day: 'Tuesday',   start: '09:30 AM', end: '06:00 PM', breakH: '1h', hours: '7.5h' },
      { day: 'Wednesday', start: '09:30 AM', end: '06:00 PM', breakH: '1h', hours: '7.5h' },
      { day: 'Thursday',  start: '09:30 AM', end: '06:00 PM', breakH: '1h', hours: '7.5h' },
      { day: 'Friday',    start: '09:30 AM', end: '06:00 PM', breakH: '1h', hours: '7.5h' },
    ]
  },
  { id: 5, name: 'Part-time 20h', daysPerWeek: 4, hoursPerWeek: '20h', company: 'My Company', status: 'Inactive',
    lines: [
      { day: 'Monday',    start: '09:00 AM', end: '02:00 PM', breakH: '—', hours: '5h' },
      { day: 'Tuesday',   start: '09:00 AM', end: '02:00 PM', breakH: '—', hours: '5h' },
      { day: 'Wednesday', start: '09:00 AM', end: '02:00 PM', breakH: '—', hours: '5h' },
      { day: 'Thursday',  start: '09:00 AM', end: '02:00 PM', breakH: '—', hours: '5h' },
    ]
  },
];

// ── Attendance ─────────────────────────────────────────────────
export const attendance = [
  { id: 1,  employeeId: 1, employeeName: 'Aarav Mehta',  department: 'Finance',     manager: 'Sara Khan', checkIn: '2026-09-02 09:05', checkOut: '2026-09-02 18:10', workedHours: 9.08,  overtime: 0.50,  status: 'Present', notes: '' },
  { id: 2,  employeeId: 2, employeeName: 'Sara Khan',    department: 'HR',          manager: 'Admin',     checkIn: '2026-09-02 09:15', checkOut: '2026-09-02 18:02', workedHours: 8.78,  overtime: 0,     status: 'Present', notes: '' },
  { id: 3,  employeeId: 3, employeeName: 'John Dsouza',  department: 'Engineering', manager: 'Sara Khan', checkIn: '2026-09-02 09:32', checkOut: '2026-09-02 17:58', workedHours: 8.43,  overtime: 0,     status: 'Present', notes: '' },
  { id: 4,  employeeId: 4, employeeName: 'Neha Patel',   department: 'HR',          manager: 'Sara Khan', checkIn: '',                 checkOut: '',                 workedHours: 0,     overtime: 0,     status: 'Absent',  notes: '' },
  { id: 5,  employeeId: 5, employeeName: 'Rohan Patel',  department: 'Sales',       manager: 'Admin',     checkIn: '2026-09-02 09:00', checkOut: '2026-09-02 18:00', workedHours: 9.0,   overtime: 1.0,   status: 'Present', notes: '' },
  { id: 6,  employeeId: 6, employeeName: 'Nisha Rao',    department: 'Finance',     manager: 'Aarav Mehta', checkIn: '2026-09-02 10:05', checkOut: '2026-09-02 18:00', workedHours: 7.92, overtime: 0,     status: 'Late',    notes: 'Late arrival' },
  { id: 7,  employeeId: 8, employeeName: 'Maya Shah',    department: 'IT',          manager: 'Admin',     checkIn: '2026-09-02 09:10', checkOut: '2026-09-02 18:05', workedHours: 8.92,  overtime: 0.42,  status: 'Present', notes: '' },
  { id: 8,  employeeId: 1, employeeName: 'Aarav Mehta',  department: 'Finance',     manager: 'Sara Khan', checkIn: '2026-09-01 09:00', checkOut: '2026-09-01 18:00', workedHours: 9.0,   overtime: 1.0,   status: 'Present', notes: '' },
  { id: 9,  employeeId: 2, employeeName: 'Sara Khan',    department: 'HR',          manager: 'Admin',     checkIn: '2026-09-01 09:20', checkOut: '2026-09-01 18:00', workedHours: 8.67,  overtime: 0,     status: 'Present', notes: '' },
  { id: 10, employeeId: 3, employeeName: 'John Dsouza',  department: 'Engineering', manager: 'Sara Khan', checkIn: '2026-09-01 08:55', checkOut: '',                 workedHours: 0,     overtime: 0,     status: 'Present', notes: 'Missing check-out' },
];

// ── Time Off Types ─────────────────────────────────────────────
export const timeOffTypes = [
  { id: 1, name: 'Paid Time Off',  unit: 'Days',  requiresAllocation: 'Yes', approval: 'Manager', payrollEntry: 'Leave Work Entry', color: 'Blue',   status: 'Active',  notes: 'Standard annual leave. Balance comes from approved allocations.' },
  { id: 2, name: 'Sick Leave',     unit: 'Days',  requiresAllocation: 'No',  approval: 'Manager', payrollEntry: 'Sick Work Entry',  color: 'Orange', status: 'Active',  notes: 'No allocation required. Up to 12 days per year.' },
  { id: 3, name: 'Comp Off',       unit: 'Hours', requiresAllocation: 'Yes', approval: 'Officer', payrollEntry: 'Comp Work Entry',  color: 'Green',  status: 'Active',  notes: 'Compensatory time off for extra hours worked.' },
];

// ── Allocations ────────────────────────────────────────────────
export const allocations = [
  { id: 1, employeeId: 1, employeeName: 'Aarav Mehta',  typeId: 1, typeName: 'Paid Time Off', allocated: 20, taken: 8,  remaining: 12, status: 'Approved', approver: 'Sara Khan', validity: '2026 Annual Balance', description: 'Annual leave balance granted at start of policy year.' },
  { id: 2, employeeId: 2, employeeName: 'Sara Khan',    typeId: 1, typeName: 'Paid Time Off', allocated: 18, taken: 4,  remaining: 14, status: 'Approved', approver: 'Admin',     validity: '2026 Annual Balance', description: 'Annual leave balance.' },
  { id: 3, employeeId: 4, employeeName: 'Neha Patel',   typeId: 3, typeName: 'Comp Off',      allocated: 2,  taken: 1,  remaining: 1,  status: 'To Approve', approver: 'Sara Khan', validity: 'Q3 2026', description: 'Comp off for weekend work.' },
  { id: 4, employeeId: 3, employeeName: 'John Dsouza',  typeId: 1, typeName: 'Paid Time Off', allocated: 20, taken: 5,  remaining: 15, status: 'Approved', approver: 'Sara Khan', validity: '2026 Annual Balance', description: 'Annual leave balance.' },
];

// ── Time Off Requests ──────────────────────────────────────────
export const timeOffRequests = [
  { id: 1, employeeId: 1, employeeName: 'Aarav Mehta', typeId: 1, typeName: 'Paid Time Off', startDate: '2026-09-12', endDate: '2026-09-14', duration: 3, status: 'Approved', approver: 'Sara Khan', allocationUsed: 'Paid Time Off 2026', reason: 'Family vacation' },
  { id: 2, employeeId: 2, employeeName: 'Sara Khan',   typeId: 2, typeName: 'Sick Leave',     startDate: '2026-09-18', endDate: '2026-09-18', duration: 1, status: 'Approved', approver: 'Admin',     allocationUsed: '—', reason: 'Fever' },
  { id: 3, employeeId: 4, employeeName: 'Neha Patel',  typeId: 3, typeName: 'Comp Off',       startDate: '2026-09-27', endDate: '2026-09-27', duration: 1, status: 'To Approve', approver: 'Sara Khan', allocationUsed: 'Comp Off 2026', reason: 'Weekend work comp' },
  { id: 4, employeeId: 3, employeeName: 'John Dsouza', typeId: 1, typeName: 'Paid Time Off', startDate: '2026-10-05', endDate: '2026-10-07', duration: 3, status: 'Draft',      approver: 'Sara Khan', allocationUsed: 'Paid Time Off 2026', reason: 'Personal' },
];

// ── Salary Structures ──────────────────────────────────────────
export const salaryStructures = [
  { id: 1, name: 'Employee Salary',    rules: 8, employees: 7, status: 'Active' },
  { id: 2, name: 'Contractor Salary',  rules: 5, employees: 1, status: 'Active' },
  { id: 3, name: 'Intern Stipend',     rules: 3, employees: 0, status: 'Inactive' },
];

// ── Salary Rules ───────────────────────────────────────────────
export const salaryRules = [
  { id: 1, name: 'Basic Salary',        code: 'BASIC',    category: 'Basic',      structure: 'Employee Salary',   sequence: 10,  computation: 'Percentage', value: '100% of Contract Wage',        formula: '' },
  { id: 2, name: 'House Rent Allowance',code: 'HRA',      category: 'Allowance',  structure: 'Employee Salary',   sequence: 20,  computation: 'Percentage', value: '20% of Basic Salary',          formula: '' },
  { id: 3, name: 'Special Allowance',   code: 'SPCL',     category: 'Allowance',  structure: 'Employee Salary',   sequence: 30,  computation: 'Fixed',      value: '₹ 2,000',                      formula: '' },
  { id: 4, name: 'Gross Salary',        code: 'GROSS',    category: 'Gross',      structure: 'Employee Salary',   sequence: 60,  computation: 'Formula',    value: "BASIC + HRA + SPCL",           formula: "result = categories['BASIC'] + categories['HRA'] + categories['SPCL']" },
  { id: 5, name: 'Provident Fund',      code: 'PF',       category: 'Deduction',  structure: 'Employee Salary',   sequence: 70,  computation: 'Percentage', value: '12% of Basic Salary',          formula: '' },
  { id: 6, name: 'ESIC',               code: 'ESIC',     category: 'Deduction',  structure: 'Employee Salary',   sequence: 90,  computation: 'Percentage', value: '0.75% of Gross Salary',        formula: '' },
  { id: 7, name: 'Professional Tax',   code: 'PT',       category: 'Deduction',  structure: 'Employee Salary',   sequence: 100, computation: 'Fixed',      value: '₹ 200',                        formula: '' },
  { id: 8, name: 'Net Salary',         code: 'NET',      category: 'Net',        structure: 'Employee Salary',   sequence: 110, computation: 'Formula',    value: "GROSS - PF - ESIC - PT",       formula: "result = categories['GROSS'] - categories['PF'] - categories['ESIC'] - categories['PT']" },
];

// ── Payruns ────────────────────────────────────────────────────
export const payruns = [
  { id: 1, name: 'PR/2026/09', structure: 'Employee Salary', period: 'Sep 2026', status: 'Paid',    employeeCount: 8, totalNet: 612000 },
  { id: 2, name: 'PR/2026/08', structure: 'Employee Salary', period: 'Aug 2026', status: 'Paid',    employeeCount: 8, totalNet: 600000 },
  { id: 3, name: 'PR/2026/07', structure: 'Employee Salary', period: 'Jul 2026', status: 'Paid',    employeeCount: 7, totalNet: 570000 },
  { id: 4, name: 'PR/2026/10', structure: 'Employee Salary', period: 'Oct 2026', status: 'Draft',   employeeCount: 0, totalNet: 0 },
];

// ── Payslips ───────────────────────────────────────────────────
export const payslips = [
  { id: 1,  payrunId: 1, payrunName: 'PR/2026/09', employeeId: 1, employeeName: 'Aarav Mehta', structure: 'Employee Salary', period: 'Sep 2026', status: 'Paid',    workedDays: 22, lines: [
    { name: 'Basic Salary',         code: 'BASIC', category: 'Basic',     amount: 85000 },
    { name: 'House Rent Allowance', code: 'HRA',   category: 'Allowance', amount: 17000 },
    { name: 'Special Allowance',    code: 'SPCL',  category: 'Allowance', amount: 2000  },
    { name: 'Gross Salary',         code: 'GROSS', category: 'Gross',     amount: 104000},
    { name: 'Provident Fund',       code: 'PF',    category: 'Deduction', amount: -10200},
    { name: 'ESIC',                 code: 'ESIC',  category: 'Deduction', amount: -780  },
    { name: 'Professional Tax',     code: 'PT',    category: 'Deduction', amount: -200  },
    { name: 'Net Salary',           code: 'NET',   category: 'Net',       amount: 92820 },
  ]},
  { id: 2,  payrunId: 1, payrunName: 'PR/2026/09', employeeId: 2, employeeName: 'Sara Khan', structure: 'Employee Salary', period: 'Sep 2026', status: 'Paid',    workedDays: 22, lines: [
    { name: 'Basic Salary',         code: 'BASIC', category: 'Basic',     amount: 95000 },
    { name: 'House Rent Allowance', code: 'HRA',   category: 'Allowance', amount: 19000 },
    { name: 'Special Allowance',    code: 'SPCL',  category: 'Allowance', amount: 2000  },
    { name: 'Gross Salary',         code: 'GROSS', category: 'Gross',     amount: 116000},
    { name: 'Provident Fund',       code: 'PF',    category: 'Deduction', amount: -11400},
    { name: 'ESIC',                 code: 'ESIC',  category: 'Deduction', amount: -870  },
    { name: 'Professional Tax',     code: 'PT',    category: 'Deduction', amount: -200  },
    { name: 'Net Salary',           code: 'NET',   category: 'Net',       amount: 103530},
  ]},
  { id: 3,  payrunId: 1, payrunName: 'PR/2026/09', employeeId: 3, employeeName: 'John Dsouza', structure: 'Employee Salary', period: 'Sep 2026', status: 'Paid',    workedDays: 22, lines: [
    { name: 'Basic Salary',         code: 'BASIC', category: 'Basic',     amount: 120000},
    { name: 'House Rent Allowance', code: 'HRA',   category: 'Allowance', amount: 24000 },
    { name: 'Special Allowance',    code: 'SPCL',  category: 'Allowance', amount: 2000  },
    { name: 'Gross Salary',         code: 'GROSS', category: 'Gross',     amount: 146000},
    { name: 'Provident Fund',       code: 'PF',    category: 'Deduction', amount: -14400},
    { name: 'ESIC',                 code: 'ESIC',  category: 'Deduction', amount: -1095 },
    { name: 'Professional Tax',     code: 'PT',    category: 'Deduction', amount: -200  },
    { name: 'Net Salary',           code: 'NET',   category: 'Net',       amount: 130305},
  ]},
  { id: 4,  payrunId: 1, payrunName: 'PR/2026/09', employeeId: 4, employeeName: 'Neha Patel', structure: 'Employee Salary', period: 'Sep 2026', status: 'Paid',    workedDays: 21, lines: [
    { name: 'Basic Salary',         code: 'BASIC', category: 'Basic',     amount: 70000 },
    { name: 'House Rent Allowance', code: 'HRA',   category: 'Allowance', amount: 14000 },
    { name: 'Special Allowance',    code: 'SPCL',  category: 'Allowance', amount: 2000  },
    { name: 'Gross Salary',         code: 'GROSS', category: 'Gross',     amount: 86000 },
    { name: 'Provident Fund',       code: 'PF',    category: 'Deduction', amount: -8400 },
    { name: 'ESIC',                 code: 'ESIC',  category: 'Deduction', amount: -645  },
    { name: 'Professional Tax',     code: 'PT',    category: 'Deduction', amount: -200  },
    { name: 'Net Salary',           code: 'NET',   category: 'Net',       amount: 76755 },
  ]},
];

// ── Users ──────────────────────────────────────────────────────
export const users = [
  { id: 1, name: 'Aarav Mehta', employeeId: 1, email: 'aarav@company.com', role: 'HR Payroll User',    status: 'Active'   },
  { id: 2, name: 'Maya Shah',   employeeId: 8, email: 'maya@company.com',  role: 'HR Manager',         status: 'Active'   },
  { id: 3, name: 'Rohan Patel', employeeId: 5, email: 'rohan@company.com', role: 'Employee',           status: 'Active'   },
  { id: 4, name: 'Nisha Rao',   employeeId: 6, email: 'nisha@company.com', role: 'HR Payroll Manager', status: 'Active'   },
  { id: 5, name: 'Admin',       employeeId: null, email: 'admin@company.com', role: 'Admin',           status: 'Active'   },
];

export const roles = ['Employee', 'HR Manager', 'HR Payroll User', 'HR Payroll Manager', 'Admin'];

// ── Dashboard data ─────────────────────────────────────────────
export const salaryByDept = [
  { dept: 'Finance',     amount: 160000 },
  { dept: 'HR',          amount: 165000 },
  { dept: 'Engineering', amount: 120000 },
  { dept: 'Sales',       amount: 65000  },
  { dept: 'IT',          amount: 90000  },
  { dept: 'Support',     amount: 60000  },
];

export const monthlySalaryTrend = [
  { month: 'Apr', amount: 1430000 },
  { month: 'May', amount: 1480000 },
  { month: 'Jun', amount: 1500000 },
  { month: 'Jul', amount: 1520000 },
  { month: 'Aug', amount: 1710000 },
  { month: 'Sep', amount: 1840000 },
];
