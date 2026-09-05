import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, useApp } from './context/AppContext';
import Topbar from './components/Topbar';
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

function AppShell() {
  const { currentUser } = useApp();

  if (!currentUser) return <Login />;

  return (
    <div className="app-shell">
      <Topbar />
      <div className="main-content">
        <Routes>
          <Route path="/"                           element={<Navigate to="/employees" replace />} />

          {/* Employees */}
          <Route path="/employees"                  element={<EmployeeList />} />
          <Route path="/employees/:id"              element={<EmployeeForm />} />

          {/* Contracts & Schedules */}
          <Route path="/contracts"                  element={<ContractList />} />
          <Route path="/contracts/:id"              element={<ContractForm />} />
          <Route path="/schedules"                  element={<ScheduleList />} />
          <Route path="/schedules/:id"              element={<ScheduleForm />} />

          {/* Attendance */}
          <Route path="/attendance"                 element={<AttendanceList />} />
          <Route path="/attendance/:id"             element={<AttendanceForm />} />

          {/* Time Off */}
          <Route path="/timeoff/requests"           element={<TimeOffRequests />} />
          <Route path="/timeoff/requests/:id"       element={<TimeOffRequestForm />} />
          <Route path="/timeoff/allocations"        element={<Allocations />} />
          <Route path="/timeoff/allocations/:id"    element={<AllocationForm />} />
          <Route path="/timeoff/types"              element={<TimeOffTypes />} />
          <Route path="/timeoff/types/:id"          element={<TimeOffTypeForm />} />

          {/* Payroll */}
          <Route path="/payroll/runs"               element={<PayrunList />} />
          <Route path="/payroll/runs/:id"           element={<PayrunForm />} />
          <Route path="/payroll/payslips"           element={<PayslipList />} />
          <Route path="/payroll/payslips/:id"       element={<PayslipForm />} />
          <Route path="/salary/structures"          element={<SalaryStructures />} />
          <Route path="/salary/structures/:id"      element={<SalaryStructureForm />} />
          <Route path="/salary/rules"               element={<SalaryRules />} />
          <Route path="/salary/rules/:id"           element={<SalaryRuleForm />} />

          {/* Dashboard */}
          <Route path="/dashboard"                  element={<Dashboard />} />

          {/* Users (Admin only) */}
          <Route path="/users"                      element={<UserManagement />} />

          {/* Fallback */}
          <Route path="*"                           element={<Navigate to="/employees" replace />} />
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
        <AppProvider>
          <AppShell />
        </AppProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
