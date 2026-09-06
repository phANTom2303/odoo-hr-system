import { createContext, useContext, useState, useEffect } from 'react';
import { loginRequest, getMeRequest, logoutRequest } from '../api/auth';

const AppContext = createContext(null);

export function AppProvider({ children, queryClient }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Restore session from HttpOnly cookie on every page load / refresh
  useEffect(() => {
    getMeRequest()
      .then((res) => {
        if (res?.data) setCurrentUser(res.data);
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await loginRequest(email, password); // throws on failure
    setCurrentUser(res.data);
    return true;
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } finally {
      setCurrentUser(null);
      // Wipe the entire React Query cache so the next user never sees
      // stale data (attendance, employees, etc.) from the previous session
      queryClient?.clear();
    }
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      authLoading,
      login,
      logout,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp  = () => useContext(AppContext);
export const useAuth = useApp; // alias kept for backwards-compat
