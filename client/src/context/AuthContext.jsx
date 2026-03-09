import React, { createContext, useState, useEffect } from 'react';
import { googleLogout } from '@react-oauth/google';
import api from '../api';
import { encryptData, decryptData } from '../utils/encryption';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastActivityTime, setLastActivityTime] = useState(() => {
    const stored = localStorage.getItem('lastActivityTime');
    return stored ? parseInt(stored) : Date.now();
  });

  const [isTampered, setIsTampered] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState(null);

  useEffect(() => {
    const IDLE_LIMIT = 10 * 60 * 1000; // 10 minutes

    const verifySession = async () => {
      const token = localStorage.getItem('token');
      const storedActivity = localStorage.getItem('lastActivityTime');

      if (token && storedActivity) {
        const now = Date.now();
        if (now - parseInt(storedActivity) > IDLE_LIMIT) {
          logout();
          setLoading(false);
          return;
        }

        try {
          const storedUserStr = localStorage.getItem('user');
          let claimedRole = null;
          if (storedUserStr) {
            const parsed = decryptData(storedUserStr);
            if (parsed) {
              claimedRole = parsed.role;
            }
          }

          // FRESH AUTH: Verify token with backend
          const res = await api.get('/auth/me');

          if (res.data?.isBlocked) {
            setBlockedInfo(res.data);
            setLoading(false);
            return;
          }

          const realUser = res.data;

          // TAMPER CHECK: If they claim to be ADMIN but are not
          if (claimedRole === 'ADMIN' && realUser.role !== 'ADMIN' && !realUser.isTemporaryAdmin) {
            setIsTampered(true);
            localStorage.removeItem('token'); // Nuke the token so they can't just refresh to retry easily
            return; // Stop loading, show trap
          }

          setUser(realUser);
          setBlockedInfo(null);
          localStorage.setItem('user', encryptData(realUser));
        } catch (err) {
          console.error("Session verification failed:", err.message);
          logout();
        }
      } else {
        // No token, ensure clean state
        logout();
      }
      setLoading(false);
    };

    verifySession();

    // Silent background idle check
    const interval = setInterval(() => {
      const currentActivity = localStorage.getItem('lastActivityTime');
      if (currentActivity && Date.now() - parseInt(currentActivity) > IDLE_LIMIT) {
        logout();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const resetActivity = () => {
    const now = Date.now();
    setLastActivityTime(now);
    localStorage.setItem('lastActivityTime', now.toString());
  };

  // Idle Tracking Listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    const handler = () => resetActivity();

    events.forEach(e => window.addEventListener(e, handler));
    return () => events.forEach(e => window.removeEventListener(e, handler));
  }, []);

  const login = async (googleToken) => {
    try {
      // Send Google token to backend, get app token
      const res = await api.post('/auth/google', { token: googleToken });

      if (res.data?.isBlocked) {
        setBlockedInfo(res.data);
        return null;
      }

      const now = Date.now().toString();
      localStorage.setItem('token', res.data.token); // Note: Keep Token as-is, since it is a JWT string
      localStorage.setItem('user', encryptData(res.data.user));
      localStorage.setItem('lastActivityTime', now);
      setLastActivityTime(parseInt(now));
      setUser(res.data.user);
      setBlockedInfo(null);
      return res.data.user;
    } catch (err) {
      console.error("Login failed:", err.message);
      throw err;
    }
  };

  const logout = () => {
    googleLogout();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastActivityTime');
    localStorage.removeItem('loginTime');
    setUser(null);
    setBlockedInfo(null);
  };

  if (isTampered) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex items-center justify-center text-white">
        <div className="text-center animate-pulse">
          <h1 className="text-6xl font-mono mb-4">ACCESS DENIED</h1>
          <p className="text-2xl font-mono text-red-500">That's not possible</p>
        </div>
      </div>
    );
  }

  if (blockedInfo) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[9999] flex items-center justify-center p-6 text-white overflow-y-auto font-sans">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-lg border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          </div>
          <h1 className="text-3xl font-black text-center mb-2 tracking-tight">Access Suspended</h1>
          <p className="text-slate-400 text-center mb-8 font-medium">Your credentials have been restricted by the administrator.</p>

          <div className="space-y-4 mb-8">
            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Reason</span>
              <p className="text-sm font-bold text-rose-400">{blockedInfo.error?.split('. Reason: ')[1]?.split('. Please')[0] || blockedInfo.blockReason || "Administrative suspension"}</p>
            </div>

            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Status</span>
              <p className="text-sm font-bold text-slate-300">
                {blockedInfo.blockedUntil
                  ? `Suspended until ${new Date(blockedInfo.blockedUntil).toLocaleString()}`
                  : "Indefinitely Suspended"}
              </p>
            </div>
          </div>

          <div className="p-6 bg-rose-500/10 rounded-lg border border-rose-500/20 mb-8 text-center text-sm">
            Please contact the administrator at the <span className="text-white font-bold underline decoration-rose-500 decoration-2 underline-offset-4">Learning Centre IV floor</span> to resolve this.
          </div>

          <button
            onClick={logout}
            className="w-full py-4 bg-white text-slate-950 rounded-lg font-black hover:bg-slate-100 transition-all active:scale-95 shadow-lg"
          >
            Go Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, lastActivityTime, resetActivity }}>
      {children}
    </AuthContext.Provider>
  );
};
