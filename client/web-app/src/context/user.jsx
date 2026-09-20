import React, { createContext, useState, useEffect } from 'react';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export const UserContext = createContext({
  user: null,
  setUser: () => null,
  updateUser: () => null,
});

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let refreshInterval;
    let cancelled = false;

    const clearSession = () => {
      if (!cancelled) {
        setUser(null);
      }
      localStorage.removeItem('currentUser');
    };

    const getSession = () => fetch(`${API_URL}/auth/jwt-login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    const renewSession = async () => {
      const response = await fetch(`${API_URL}/auth/refresh-token`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Unable to refresh session');
      }
    };

    const handleRenewalFailure = () => {
      if (refreshInterval) {
        window.clearInterval(refreshInterval);
      }
      clearSession();
    };

    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse stored currentUser', e);
        localStorage.removeItem('currentUser'); // remove corrupted entry
      }
    }

    const restoreSession = async () => {
      try {
        let response = await getSession();

        if (response.status === 401) {
          await renewSession();
          response = await getSession();
        }

        if (!response.ok) {
          throw new Error('Session expired');
        }

        const data = await response.json();
        if (!data.data?.user) {
          throw new Error('Session user is missing');
        }

        if (!cancelled) {
          setUser(previousUser => ({ ...previousUser, ...data.data.user }));
          refreshInterval = window.setInterval(() => {
            renewSession().catch(handleRenewalFailure);
          }, 14 * 60 * 1000);
        }
      } catch (error) {
        console.error('Silent auth check failed:', error);
        clearSession();
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
      if (refreshInterval) {
        window.clearInterval(refreshInterval);
      }
    };
  }, []);

  // Save user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      const { token, ...safeUser } = user;
      localStorage.setItem('currentUser', JSON.stringify(safeUser));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, [user]);

  // Listen for changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'currentUser') {
        if (e.newValue) {
          try {
            setUser(JSON.parse(e.newValue));
          } catch (err) {
            console.error('Failed to parse user from storage event', err);
          }
        } else {
          setUser(null);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Helper to update user safely
  const updateUser = (newData) => {
    setUser(prevUser => {
      if (!prevUser) return newData;
      const updated = { ...prevUser, ...newData };
      return updated;
    });
  };

  return (
    <UserContext.Provider value={{ user, setUser, updateUser }}>
      {children}
    </UserContext.Provider>
  );
};
