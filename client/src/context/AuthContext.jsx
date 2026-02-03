import React, { createContext, useState, useEffect } from 'react';
import { googleLogout } from '@react-oauth/google';
import api from '../api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastActivityTime, setLastActivityTime] = useState(() => {
    const stored = localStorage.getItem('lastActivityTime');
    return stored ? parseInt(stored) : Date.now();
  });

  const resetActivity = () => {
    const now = Date.now();
    setLastActivityTime(now);
    localStorage.setItem('lastActivityTime', now.toString());
  };

  useEffect(() => {
    // Check if user is logged in on refresh
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    const storedActivity = localStorage.getItem('lastActivityTime');

    const IDLE_LIMIT = 10 * 60 * 1000; // 10 minutes

    if (storedUser && token && storedActivity) {
      const now = Date.now();
      if (now - parseInt(storedActivity) > IDLE_LIMIT) {
        logout();
      } else {
        setUser(JSON.parse(storedUser));
      }
    }
    setLoading(false);

    // Silent background idle check
    const interval = setInterval(() => {
      const currentActivity = localStorage.getItem('lastActivityTime');
      if (currentActivity && Date.now() - parseInt(currentActivity) > IDLE_LIMIT) {
        logout();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Idle Tracking Listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    const handler = () => resetActivity();

    events.forEach(e => window.addEventListener(e, handler));
    return () => events.forEach(e => window.removeEventListener(e, handler));
  }, []);

  const login = async (googleToken) => {
    // Send Google token to backend, get app token
    const res = await api.post('/auth/google', { token: googleToken });
    const now = Date.now().toString();
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    localStorage.setItem('lastActivityTime', now);
    setLastActivityTime(parseInt(now));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    googleLogout();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastActivityTime');
    localStorage.removeItem('loginTime');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, lastActivityTime, resetActivity }}>
      {children}
    </AuthContext.Provider>
  );
};