import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ compact, variant = 'default' }) {
  const { user, logout, lastActivityTime } = useContext(AuthContext);
  const navigate = useNavigate();
  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isLight = variant === 'light';

  return (
    <nav className={`${isLight ? 'bg-white text-slate-800 border-b border-slate-200 shadow-sm' : 'bg-blue-800 text-white shadow-lg'} px-6 ${compact ? 'py-2' : 'py-4'} flex justify-between items-center transition-colors sticky top-0 z-50`}>
      <div className="text-xl font-bold tracking-wide">Project Portal-PCDP</div>
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <div className="text-right leading-none">
            <p className="font-semibold">
              {user.name}
              {user.role === 'FACULTY' && user.rollNumber && <span className="ml-2 opacity-60 font-mono text-[11px]">({user.rollNumber})</span>}
            </p>
            <div className="flex gap-1 mt-1">
              <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${isLight ? 'bg-slate-200 text-slate-700' : 'bg-blue-900 text-blue-200'}`}>
                {user.role}
              </span>
              {user.isTemporaryAdmin && (
                <span className="text-[10px] uppercase bg-orange-500 px-1.5 py-0.5 rounded text-white font-bold animate-pulse">
                  TEMP ADMIN
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded text-sm transition font-medium text-white"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}