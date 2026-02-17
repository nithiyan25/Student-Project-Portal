import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Database, Download, Loader2 } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

export default function Navbar({ compact, variant = 'default' }) {
  const { user, logout } = useContext(AuthContext);
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [isBackingUp, setIsBackingUp] = useState(false);
  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleBackupDownload = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    addToast("Preparing database backup...", "info");

    try {
      const response = await api.get('/admin/backup/download', {
        responseType: 'blob'
      });

      // Get filename from header or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = `db-backup-${new Date().toISOString().split('T')[0]}.sql`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      addToast("Backup downloaded successfully!", "success");
    } catch (error) {
      console.error("Backup failed:", error);
      addToast("Failed to download backup. Please ensure mysqldump is installed on total server.", "error");
    } finally {
      setIsBackingUp(false);
    }
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
        {user.role === 'ADMIN' && user.name === 'Super Admin' && user.email === 'nithiyan.al23@bitsathy.ac.in' && (
          <button
            onClick={handleBackupDownload}
            disabled={isBackingUp}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition font-medium ${isLight
              ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
              : 'bg-blue-900 text-blue-100 hover:bg-blue-950'
              } ${isBackingUp ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Download Instant MySQL Backup"
          >
            {isBackingUp ? <Loader2 className="animate-spin" size={16} /> : <Database size={16} />}
            <span className="hidden sm:inline">Backup</span>
          </button>
        )}
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded text-sm transition font-medium text-white flex items-center gap-2"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}