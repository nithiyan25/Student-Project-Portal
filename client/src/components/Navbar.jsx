import React, { useContext, useState, useRef, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Database, Loader2, LogOut, User as UserIcon, X, ShieldCheck, Mail, Briefcase, GraduationCap, BookOpen } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

export default function Navbar({ compact }) {
  const { user, logout } = useContext(AuthContext);
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [projectStats, setProjectStats] = useState({ completed: 0, ongoing: 0 });
  const [loadingStats, setLoadingStats] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    };
    if (showProfile) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfile]);

  if (!user) return null;

  const handleAvatarClick = async () => {
    const opening = !showProfile;
    setShowProfile(opening);
    if (opening) {
      if (user.role === 'STUDENT') {
        setLoadingStats(true);
        try {
          const res = await api.get('/teams/my-teams');
          const teams = res.data || [];
          let completed = 0;
          for (const t of teams) {
            const totalPhases = t.scope?.numberOfPhases || t.scope?.deadlines?.length || 0;
            if (totalPhases > 0) {
              const finishedPhases = new Set(
                (t.reviews || [])
                  .filter(r => (r.status === 'COMPLETED' || r.status === 'NOT_COMPLETED') && r.reviewPhase != null)
                  .map(r => r.reviewPhase)
              ).size;
              if (finishedPhases >= totalPhases) {
                completed++;
              }
            }
          }
          setProjectStats({ completed, ongoing: teams.length - completed });
        } catch {
          setProjectStats({ completed: 0, ongoing: 0 });
        } finally {
          setLoadingStats(false);
        }
      }
    }
  };

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
      addToast("Failed to download backup.", "error");
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <nav className={`sticky top-0 z-50 bg-white border-b border-gray-200 px-6 ${compact ? 'py-2' : 'py-3'} flex justify-between items-center shadow-sm`}>
      <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigate(user.role === 'ADMIN' ? '/admin' : user.role === 'FACULTY' ? '/faculty' : '/student')}>
        <div className="relative">
          <img src={`${import.meta.env.BASE_URL}new_logoimg.png`} alt="Logo" className="h-10 w-auto transition-transform duration-300 group-hover:scale-105" />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold text-gray-900 leading-tight tracking-tight">Project Portal</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end">
            <p className="font-bold text-sm text-gray-900 leading-none mb-1">{user.name}</p>
            <div className="flex gap-2">
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
                {user.role}
              </span>
              {user.isTemporaryAdmin && (
                <span className="text-[9px] font-bold uppercase bg-amber-50 text-amber-600 px-2 py-0.5 rounded border border-amber-200">
                  TEMP ADMIN
                </span>
              )}
            </div>
          </div>

          <div className="relative" ref={profileRef}>
            <button
              onClick={handleAvatarClick}
              className="h-10 w-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center font-bold text-gray-700 hover:border-blue-300 hover:bg-white transition-all shadow-sm"
            >
              {user.name.charAt(0)}
            </button>

            {/* Centered Profile Modal */}
            {showProfile && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-300"
                  onClick={() => setShowProfile(false)}
                />

                {/* Modal Content */}
                <div
                  className="relative w-full max-w-sm bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 scale-100"
                >
                  {/* ============= FACULTY PROFILE CARD ============= */}
                  {user.role === 'FACULTY' ? (
                    <>
                      {/* Faculty Banner — Teal/Emerald horizontal design */}
                      <div className="relative bg-gradient-to-br from-teal-800 via-emerald-900 to-teal-900 px-6 pt-8 pb-6 overflow-hidden">
                        <div className="absolute top-0 right-0 w-40 h-40 rounded-full -mr-20 -mt-20 bg-teal-500/10 blur-2xl" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full -ml-12 -mb-12 bg-emerald-400/10 blur-xl" />

                        <button
                          onClick={() => setShowProfile(false)}
                          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
                        >
                          <X size={18} />
                        </button>

                        <div className="flex items-center gap-4 relative z-10">
                          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-2xl font-bold text-teal-800 shadow-xl border-2 border-white/30 shrink-0">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-lg font-bold text-white leading-tight">{user.name}</p>
                            <p className="text-xs font-semibold text-emerald-300 uppercase tracking-widest mt-0.5">Faculty</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 space-y-5">
                        {/* Faculty Details */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-teal-50 border border-teal-100 rounded-lg flex items-center justify-center text-teal-600">
                              <Briefcase size={16} />
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Faculty ID</p>
                              <p className="text-sm font-semibold text-gray-800">{user.rollNumber || 'System Registered'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                              <Mail size={16} />
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Email</p>
                              <p className="text-sm font-semibold text-gray-800">{user.email}</p>
                            </div>
                          </div>

                          {user.department && (
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                                <BookOpen size={16} />
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Department</p>
                                <p className="text-sm font-semibold text-gray-800">{user.department}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center justify-center gap-2 p-3 text-sm font-medium text-red-600 hover:bg-red-50 bg-red-50/50 border border-red-100 rounded-lg transition-all"
                        >
                          <LogOut size={16} /> Sign Out
                        </button>
                      </div>
                    </>
                  ) : (
                    /* ============= STUDENT & ADMIN PROFILE CARD ============= */
                    <>
                      {/* Header/Banner */}
                      <div className={`px-6 py-12 flex flex-col items-center relative overflow-hidden ${user.role === 'ADMIN' ? 'bg-slate-900' : 'bg-indigo-900'}`}>
                        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 blur-2xl ${user.role === 'ADMIN' ? 'bg-rose-500/20' : 'bg-blue-500/20'}`} />
                        <div className={`absolute bottom-0 left-0 w-24 h-24 rounded-full -ml-12 -mb-12 blur-xl ${user.role === 'ADMIN' ? 'bg-orange-500/20' : 'bg-indigo-500/20'}`} />

                        <button
                          onClick={() => setShowProfile(false)}
                          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
                        >
                          <X size={18} />
                        </button>

                        <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center text-3xl font-bold text-gray-900 shadow-xl mb-4 relative z-10 border-4 border-white/20 bg-clip-padding">
                          {user.name.charAt(0)}
                        </div>
                        <p className="text-xl font-bold text-white tracking-tight relative z-10">{user.name}</p>
                        <p className={`text-xs font-bold uppercase tracking-widest mt-1 relative z-10 ${user.role === 'ADMIN' ? 'text-rose-400' : 'text-blue-400'}`}>
                          {user.role}
                        </p>
                      </div>

                      <div className="p-8">
                        <div className="space-y-6">
                          <div className="space-y-4">
                            {user.role === 'STUDENT' && (
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-500 shadow-inner">
                                  <GraduationCap size={18} />
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Roll Number</p>
                                  <p className="text-sm font-bold text-gray-800">{user.rollNumber || 'N/A'}</p>
                                </div>
                              </div>
                            )}

                            {user.role === 'ADMIN' && (
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-rose-50 border border-rose-100 rounded-lg flex items-center justify-center text-rose-500 shadow-inner">
                                  <ShieldCheck size={18} />
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Access Level</p>
                                  <p className="text-sm font-bold text-gray-800">{user.isTemporaryAdmin ? 'Temporary Admin' : 'Full Administrator'}</p>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-500 shadow-inner">
                                <Mail size={18} />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Address</p>
                                <p className="text-sm font-bold text-gray-800">{user.email}</p>
                              </div>
                            </div>
                          </div>

                          {/* Stats - Student only */}
                          {user.role === 'STUDENT' && (
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                              {loadingStats ? (
                                <div className="col-span-2 flex items-center justify-center py-4">
                                  <Loader2 className="animate-spin text-indigo-500" size={18} />
                                </div>
                              ) : (
                                <>
                                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-center shadow-sm">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Completed</p>
                                    <p className="text-xl font-bold text-emerald-600">{projectStats.completed}</p>
                                  </div>
                                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-center shadow-sm">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Ongoing</p>
                                    <p className="text-xl font-bold text-blue-600">{projectStats.ongoing}</p>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-2 p-4 text-sm font-bold text-red-600 hover:bg-red-50 hover:border-red-200 bg-red-50/50 border border-red-100 rounded-lg transition-all"
                          >
                            <LogOut size={16} /> Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
          {user.role === 'ADMIN' && (
            <button
              onClick={handleBackupDownload}
              disabled={isBackingUp}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-all"
              title="Database Backup"
            >
              {isBackingUp ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />}
            </button>
          )}

          <button
            onClick={handleLogout}
            className="md:hidden p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
}

