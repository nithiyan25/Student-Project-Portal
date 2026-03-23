import React, { useState, useEffect } from 'react';
import api from '../../api';
import { 
  ClipboardCheck, 
  Calendar, 
  Clock, 
  User, 
  ShieldAlert, 
  RefreshCcw, 
  ChevronRight,
  Search,
  Users
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function AuditLogTab() {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { addToast } = useToast();

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/admin/late-submission-overrides');
            setLogs(res.data);
        } catch (err) {
            addToast("Failed to fetch override logs", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log => {
        const searchVal = searchTerm.toLowerCase();
        const leaderName = log.team?.members[0]?.user?.name?.toLowerCase() || '';
        const leaderRoll = log.team?.members[0]?.user?.rollNumber?.toLowerCase() || '';
        const reason = log.reason.toLowerCase();
        const adminId = log.grantedBy.toLowerCase();
        
        return leaderName.includes(searchVal) || 
               leaderRoll.includes(searchVal) || 
               reason.includes(searchVal) || 
               adminId.includes(searchVal);
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <RefreshCcw className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                <p className="text-slate-500 font-bold">Loading Audit Logs...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <ClipboardCheck size={28} className="text-indigo-600" />
                        Late Submission Audit Logs
                    </h2>
                    <p className="text-slate-500 font-medium mt-1">
                        Track and audit all phase override exceptions granted to teams.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text"
                            placeholder="Search logs..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-64"
                        />
                    </div>
                    <button 
                        onClick={fetchLogs}
                        className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all"
                        title="Refresh Logs"
                    >
                        <RefreshCcw size={20} />
                    </button>
                </div>
            </div>

            {/* Logs List */}
            {filteredLogs.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-200 py-20 text-center">
                    <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">No logs found</h3>
                    <p className="text-slate-500 mt-2">No phase overrides have been recorded yet.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredLogs.map((log) => (
                        <div 
                            key={log.id}
                            className="bg-white border border-slate-100 rounded-xl overflow-hidden hover:shadow-md transition-all group"
                        >
                            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-start gap-4 flex-1">
                                    <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 text-indigo-600">
                                        <Users size={24} />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                                                Phase {log.phase} Override
                                            </span>
                                            <span className="text-slate-300">•</span>
                                            <span className="text-xs font-bold text-slate-400">
                                                ID: {log.id.slice(-8).toUpperCase()}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            Team #{log.team?.id?.slice(-4).toUpperCase() || '???'} - {log.team?.members[0]?.user?.name || 'Unknown Team'}
                                            <span className="text-xs font-medium text-slate-400">({log.team?.members[0]?.user?.rollNumber})</span>
                                        </h3>
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2 italic text-sm text-slate-600 leading-relaxed border-l-4 border-l-orange-400">
                                            "{log.reason}"
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center gap-6 text-sm bg-slate-50/50 p-4 rounded-xl border border-slate-100 md:bg-transparent md:border-none md:p-0">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <User size={12} /> Authorized By
                                        </p>
                                        <p className="font-bold text-slate-700 break-all max-w-[150px]">
                                            {log.grantedBy}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <Calendar size={12} /> Date
                                        </p>
                                        <p className="font-bold text-slate-700 whitespace-nowrap">
                                            {new Date(log.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <Clock size={12} /> Time
                                        </p>
                                        <p className="font-bold text-slate-700">
                                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
