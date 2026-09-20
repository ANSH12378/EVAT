import React, { createContext, useState, useEffect } from 'react';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
const REFRESH_LOCK_NAME = 'evat-token-refresh';
const REFRESH_TIMESTAMP_KEY = 'evat-token-refreshed-at';
const REFRESH_INTERVAL_MS = 14 * 60 * 1000;

const withRefreshLock = async (callback) => {
  if (!navigator.locks) {
    return callback();
  }

  return navigator.locks.request(REFRESH_LOCK_NAME, callback);
};

const wasRecentlyRefreshed = () => {
  const refreshedAt = Number(localStorage.getItem(REFRESH_TIMESTAMP_KEY));
  return Number.isFinite(refreshedAt) && Date.now() - refreshedAt < REFRESH_INTERVAL_MS;
};

export const UserContext = createContext({
  user: null,
  authReady: false,
  setUser: () => null,
  updateUser: () => null,
});

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const clearSession = () => {
      if (!cancelled) {
        setUser(null);
      }
      localStorage.removeItem('currentUser');
      localStorage.removeItem(REFRESH_TIMESTAMP_KEY);
    };

    const getSession = () => fetch(`${API_URL}/auth/jwt-login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    const restoreExpiredSession = () => withRefreshLock(async () => {
      const currentResponse = await getSession();
      if (currentResponse.ok || currentResponse.status !== 401) {
        return currentResponse;
      }

      const refreshResponse = await fetch(`${API_URL}/auth/refresh-token`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!refreshResponse.ok) {
        return refreshResponse;
      }

      localStorage.setItem(REFRESH_TIMESTAMP_KEY, String(Date.now()));
      return getSession();
    });

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
      let clearOnFailure = false;

      try {
        let response = await getSession();

        if (response.status === 401) {
          response = await restoreExpiredSession();
        }

        if (!response.ok) {
          clearOnFailure = response.status === 400 || response.status === 401 || response.status === 404;
          throw new Error('Session expired');
        }

        const data = await response.json();
        if (!data.data?.user) {
          throw new Error('Session user is missing');
        }

        if (!cancelled) {
          setUser(previousUser => ({ ...previousUser, ...data.data.user }));
        }
      } catch (error) {
        console.error('Silent auth check failed:', error);
        if (clearOnFailure) {
          clearSession();
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      return undefined;
    }

    let cancelled = false;

    const refreshInterval = window.setInterval(async () => {
      try {
        const response = await withRefreshLock(async () => {
          if (wasRecentlyRefreshed()) {
            return null;
          }

          const refreshResponse = await fetch(`${API_URL}/auth/refresh-token`, {
            method: 'POST',
            credentials: 'include',
          });

          if (refreshResponse.ok) {
            localStorage.setItem(REFRESH_TIMESTAMP_KEY, String(Date.now()));
          }

          return refreshResponse;
        });

        if (response && !response.ok) {
          if (!cancelled && (response.status === 400 || response.status === 401)) {
            setUser(null);
            localStorage.removeItem('currentUser');
            localStorage.removeItem(REFRESH_TIMESTAMP_KEY);
          } else {
            console.error('Session renewal failed:', new Error(`Unexpected status ${response.status}`));
          }
        }
      } catch (error) {
        console.error('Session renewal failed:', error);
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [authReady, user]);

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
    <UserContext.Provider value={{ user, authReady, setUser, updateUser }}>
      {children}
    </UserContext.Provider>
  );
};
