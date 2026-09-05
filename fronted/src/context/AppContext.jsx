import { createContext, useContext, useState } from 'react';
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
  const [currentUser, setCurrentUser] = useState(null);
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

  const login = (email, password) => {
    // simple mock auth
    const demoUsers = [
      { email: 'admin@company.com',  password: 'admin123',  name: 'Admin',       role: 'Admin',              initials: 'AD' },
      { email: 'aarav@company.com',  password: 'pass123',   name: 'Aarav Mehta', role: 'HR Payroll User',    initials: 'AM' },
      { email: 'maya@company.com',   password: 'pass123',   name: 'Maya Shah',   role: 'HR Manager',         initials: 'MS' },
      { email: 'nisha@company.com',  password: 'pass123',   name: 'Nisha Rao',   role: 'HR Payroll Manager', initials: 'NR' },
    ];
    const found = demoUsers.find(u => u.email === email && u.password === password);
    if (found) { setCurrentUser(found); return true; }
    return false;
  };

  const logout = () => setCurrentUser(null);

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
      currentUser, login, logout,
      employees, setEmployees,
      contracts, setContracts,
      schedules, setSchedules,
      attendanceRecords, setAttendanceRecords,
      timeOffTypes, setTimeOffTypes,
      allocations, setAllocations,
      timeOffRequests, setTimeOffRequests,
      salaryStructures, setSalaryStructures,
      salaryRules, setSalaryRules,
      payruns, setPayruns,
      payslips, setPayslips,
      users, setUsers,
      checkedIn, setCheckedIn,
      checkInTime, setCheckInTime,
      approveRequest, refuseRequest, approveAllocation,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
