import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginRequest, getMeRequest, logoutRequest } from '../api/auth';
import {
  employees as empData,
  contracts as contractData,
  workingSchedules as scheduleData,
  attendance as attendanceData,
  timeOffTypes as typeData,
  allocations as allocationData,
  timeOffRequests as requestData,
  salaryStructures as structureData,
  salaryRules as ruleData,
  payruns as payrunData,
  payslips as payslipData,
  users as userData,
} from '../data/mockData';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // ── Auth state ────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null);
  /**
   * authLoading is true while the app is bootstrapping (i.e., calling /me on mount).
   * Prevents a flash of the Login screen before we know if a valid session exists.
   */
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // ── Other app state (kept for compatibility with existing pages) ──────────
  const [employees, setEmployees] = useState(empData);
  const [contracts, setContracts] = useState(contractData);
  const [schedules, setSchedules] = useState(scheduleData);
  const [attendanceRecords, setAttendanceRecords] = useState(attendanceData);
  const [timeOffTypes, setTimeOffTypes] = useState(typeData);
  const [allocations, setAllocations] = useState(allocationData);
  const [timeOffRequests, setTimeOffRequests] = useState(requestData);
  const [salaryStructures, setSalaryStructures] = useState(structureData);
  const [salaryRules, setSalaryRules] = useState(ruleData);
  const [payruns, setPayruns] = useState(payrunData);
  const [payslips, setPayslips] = useState(payslipData);
  const [users, setUsers] = useState(userData);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);

  // ── Bootstrap: restore session from HttpOnly cookie on first load ─────────
  useEffect(() => {
    (async () => {
      try {
        const result = await getMeRequest();
        if (result?.success && result.data) {
          setCurrentUser(result.data);
        }
      } catch {
        // No valid session — leave currentUser as null
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────

  /**
   * Login with email/password. Calls the backend, which sets an HttpOnly JWT cookie.
   * @param {string} email
   * @param {string} password
   * @throws {Error} with a user-facing message on failure
   */
  const login = useCallback(async (email, password) => {
    setAuthError(null);
    const result = await loginRequest(email, password); // throws on HTTP error
    setCurrentUser(result.data);
    return result.data;
  }, []);

  /**
   * Logout — clears the JWT cookie server-side and resets local auth state.
   */
  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setCurrentUser(null);
    }
  }, []);

  // ── Time-off helpers (unchanged) ──────────────────────────────────────────
  const approveRequest = (id) => {
    setTimeOffRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Approved' } : r));
  };
  const refuseRequest = (id) => {
    setTimeOffRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Refused' } : r));
  };
  const approveAllocation = (id) => {
    setAllocations(prev => prev.map(a => a.id === id ? { ...a, status: 'Approved' } : a));
  };

  return (
    <AppContext.Provider value={{
      // Auth
      currentUser,
      authLoading,
      authError,
      login,
      logout,
      // HR data
      employees,       setEmployees,
      contracts,       setContracts,
      schedules,       setSchedules,
      attendanceRecords, setAttendanceRecords,
      timeOffTypes,    setTimeOffTypes,
      allocations,     setAllocations,
      timeOffRequests, setTimeOffRequests,
      salaryStructures, setSalaryStructures,
      salaryRules,     setSalaryRules,
      payruns,         setPayruns,
      payslips,        setPayslips,
      users,           setUsers,
      checkedIn,       setCheckedIn,
      checkInTime,     setCheckInTime,
      approveRequest, refuseRequest, approveAllocation,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);

/**
 * Convenience hook that returns only auth-related state and actions.
 * Components that only need auth context can import this instead of useApp().
 */
export const useAuth = () => {
  const { currentUser, authLoading, authError, login, logout } = useContext(AppContext);
  return { currentUser, authLoading, authError, login, logout };
};
