import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, useApp } from './context/AppContext';
import Topbar from './components/Topbar';
import ProtectedRoute from './components/ProtectedRoute';

// Auth
import Login from './pages/auth/Login';
import UserManagement from './pages/auth/UserManagement';

// Employees
import EmployeeList from './pages/employees/EmployeeList';
import EmployeeForm from './pages/employees/EmployeeForm';

// Contracts & Schedules
import ContractList   from './pages/contracts/ContractList';
import ContractForm   from './pages/contracts/ContractForm';
import ScheduleList   from './pages/contracts/ScheduleList';
import ScheduleForm   from './pages/contracts/ScheduleForm';

// Attendance
import AttendanceList from './pages/attendance/AttendanceList';
import AttendanceForm from './pages/attendance/AttendanceForm';

// Time Off
import TimeOffRequests    from './pages/timeoff/TimeOffRequests';
import TimeOffRequestForm from './pages/timeoff/TimeOffRequestForm';
import Allocations        from './pages/timeoff/Allocations';
import AllocationForm     from './pages/timeoff/AllocationForm';
import TimeOffTypes       from './pages/timeoff/TimeOffTypes';
import TimeOffTypeForm    from './pages/timeoff/TimeOffTypeForm';
import Holidays           from './pages/timeoff/Holidays';
import HolidayForm        from './pages/timeoff/HolidayForm';

// Payroll
import PayrunList           from './pages/payroll/PayrunList';
import PayrunForm           from './pages/payroll/PayrunForm';
import PayslipList          from './pages/payroll/PayslipList';
import PayslipForm          from './pages/payroll/PayslipForm';
import SalaryStructures     from './pages/payroll/SalaryStructures';
import SalaryStructureForm  from './pages/payroll/SalaryStructureForm';
import SalaryRules          from './pages/payroll/SalaryRules';
import SalaryRuleForm       from './pages/payroll/SalaryRuleForm';

// Dashboard
import Dashboard from './pages/dashboard/Dashboard';

// Audit Trail
import AuditTrail from './pages/audit/AuditTrail';

const ADMIN = ['admin'];
const HR_ALL = ['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'];
const PAYROLL_ALL = ['hr_payroll_user', 'hr_payroll_manager', 'admin'];
const ALL = ['employee', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'];

function AppShell() {
  const { currentUser, authLoading } = useApp();

  // While restoring session from cookie, show a neutral loading screen
  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary, #4f46e5)' }}>PeoplePay360</div>
        <div style={{ color: 'var(--gray-500, #6b7280)', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (!currentUser) return <Login />;

  return (
    <div className="app-shell">
      <Topbar />
      <div className="main-content">
        <Routes>
          <Route path="/"                           element={<Navigate to={currentUser.role === 'employee' ? '/contracts' : '/employees'} replace />} />

          {/* Employees */}
          <Route path="/employees"                  element={<ProtectedRoute allowedRoles={HR_ALL}><EmployeeList /></ProtectedRoute>} />
          <Route path="/employees/:id"              element={<ProtectedRoute allowedRoles={HR_ALL} ownerIdParam="id"><EmployeeForm /></ProtectedRoute>} />

          {/* Contracts & Schedules */}
          <Route path="/contracts"                  element={<ProtectedRoute allowedRoles={ALL}><ContractList /></ProtectedRoute>} />
          <Route path="/contracts/:id"              element={<ProtectedRoute allowedRoles={ALL}><ContractForm /></ProtectedRoute>} />
          <Route path="/schedules"                  element={<ProtectedRoute allowedRoles={HR_ALL}><ScheduleList /></ProtectedRoute>} />
          <Route path="/schedules/:id"              element={<ProtectedRoute allowedRoles={HR_ALL}><ScheduleForm /></ProtectedRoute>} />

          {/* Attendance */}
          <Route path="/attendance"                 element={<ProtectedRoute allowedRoles={ALL}><AttendanceList /></ProtectedRoute>} />
          <Route path="/attendance/:id"             element={<ProtectedRoute allowedRoles={ALL}><AttendanceForm /></ProtectedRoute>} />

          {/* Time Off */}
          <Route path="/timeoff/requests"           element={<ProtectedRoute allowedRoles={ALL}><TimeOffRequests /></ProtectedRoute>} />
          <Route path="/timeoff/requests/:id"       element={<ProtectedRoute allowedRoles={ALL}><TimeOffRequestForm /></ProtectedRoute>} />
          <Route path="/timeoff/allocations"        element={<ProtectedRoute allowedRoles={ALL}><Allocations /></ProtectedRoute>} />
          <Route path="/timeoff/allocations/:id"    element={<ProtectedRoute allowedRoles={ALL}><AllocationForm /></ProtectedRoute>} />
          <Route path="/timeoff/types"              element={<ProtectedRoute allowedRoles={ALL}><TimeOffTypes /></ProtectedRoute>} />
          <Route path="/timeoff/types/:id"          element={<ProtectedRoute allowedRoles={ALL}><TimeOffTypeForm /></ProtectedRoute>} />
          <Route path="/timeoff/holidays"           element={<ProtectedRoute allowedRoles={ALL}><Holidays /></ProtectedRoute>} />
          <Route path="/timeoff/holidays/:id"       element={<ProtectedRoute allowedRoles={ALL}><HolidayForm /></ProtectedRoute>} />

          {/* Payroll */}
          <Route path="/payroll/runs"               element={<ProtectedRoute allowedRoles={PAYROLL_ALL}><PayrunList /></ProtectedRoute>} />
          <Route path="/payroll/runs/:id"           element={<ProtectedRoute allowedRoles={PAYROLL_ALL}><PayrunForm /></ProtectedRoute>} />
          {/* Payslips are self-service for everyone else: the API scopes the
              list to the caller and rejects anyone else's payslip. */}
          <Route path="/payroll/payslips"           element={<ProtectedRoute allowedRoles={ALL}><PayslipList /></ProtectedRoute>} />
          <Route path="/payroll/payslips/:id"       element={<ProtectedRoute allowedRoles={ALL}><PayslipForm /></ProtectedRoute>} />
          <Route path="/salary/structures"          element={<ProtectedRoute allowedRoles={PAYROLL_ALL}><SalaryStructures /></ProtectedRoute>} />
          <Route path="/salary/structures/:id"      element={<ProtectedRoute allowedRoles={PAYROLL_ALL}><SalaryStructureForm /></ProtectedRoute>} />
          <Route path="/salary/rules"               element={<ProtectedRoute allowedRoles={PAYROLL_ALL}><SalaryRules /></ProtectedRoute>} />
          <Route path="/salary/rules/:id"           element={<ProtectedRoute allowedRoles={PAYROLL_ALL}><SalaryRuleForm /></ProtectedRoute>} />

          {/* Dashboard */}
          <Route path="/dashboard"                  element={<ProtectedRoute allowedRoles={HR_ALL}><Dashboard /></ProtectedRoute>} />

          {/* Users (Admin only) */}
          <Route path="/users"                      element={<ProtectedRoute allowedRoles={ADMIN}><UserManagement /></ProtectedRoute>} />
          <Route path="/audit-trail"                element={<ProtectedRoute allowedRoles={ADMIN}><AuditTrail /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to={currentUser?.role === 'employee' ? '/contracts' : '/employees'} replace />} />
        </Routes>
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppProvider queryClient={queryClient}>
          <AppShell />
        </AppProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
