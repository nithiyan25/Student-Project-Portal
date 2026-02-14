import React, { useState, useEffect } from 'react';
import { UserX, Filter, Download, AlertCircle, Calendar, Users, Briefcase, User } from 'lucide-react';
import api from '../../api';

export default function AbsenteesTab({ scopes }) {
    const [absentees, setAbsentees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        scopeId: 'ALL',
        phase: 'ALL',
        department: 'ALL'
    });

    const phases = [1, 2, 3, 4, 5]; // Common phases, ideally dynamic
    const departments = [...new Set(absentees.map(a => a.student?.department).filter(Boolean))];

    const fetchAbsentees = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/absentees', { params: filters });
            setAbsentees(res.data);
        } catch (error) {
            console.error('Error fetching absentees:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAbsentees();
    }, [filters]);

    const handleExport = () => {
        const headers = ['Roll Number', 'Name', 'Department', 'Team', 'Project', 'Phase', 'Status', 'Recorded By / Assigned To', 'Session', 'Venue', 'Time Slot', 'Date'];
        const rows = absentees.map(a => [
            a.student?.rollNumber || 'N/A',
            a.student?.name || 'N/A',
            a.student?.department || 'N/A',
            a.teamName || a.team?.name || 'N/A',
            a.projectTitle || a.team?.project?.title || 'N/A',
            a.phase || 'N/A',
            a.type === 'MARKED_ABSENT' ? 'Marked Absent' : 'Deadline Missed',
            a.facultyName || a.faculty?.name || 'System',
            a.sessionName || 'N/A',
            a.venue || 'N/A',
            a.timeSlot || 'N/A',
            a.date ? new Date(a.date).toLocaleDateString() : 'N/A'
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Absentees_Report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                        <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                            <UserX size={24} />
                        </div>
                        Absentees Report
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Track students who were marked absent or missed review deadlines.</p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                        <Filter size={16} className="text-gray-400 ml-1" />
                        <select
                            className="bg-transparent text-sm font-bold text-gray-700 outline-none min-w-[120px]"
                            value={filters.scopeId}
                            onChange={e => setFilters({ ...filters, scopeId: e.target.value })}
                        >
                            <option value="ALL">All Batches</option>
                            {scopes?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                        <Calendar size={16} className="text-gray-400 ml-1" />
                        <select
                            className="bg-transparent text-sm font-bold text-gray-700 outline-none min-w-[100px]"
                            value={filters.phase}
                            onChange={e => setFilters({ ...filters, phase: e.target.value })}
                        >
                            <option value="ALL">All Phases</option>
                            {phases.map(p => <option key={p} value={p}>Phase {p}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                        <Download size={18} /> Export CSV
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-gray-400 font-medium animate-pulse">Analyzing attendance records...</p>
                    </div>
                ) : absentees.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center">
                        <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">No Absentees Found</h3>
                        <p className="text-gray-500 max-w-sm mt-2">Everyone seems to be present and completing their reviews on time for the selected filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Student</th>
                                    <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Team & Project</th>
                                    <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Phase</th>
                                    <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Reason / Status</th>
                                    <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Session / Time Slot</th>
                                    <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Recorded By / Assigned To</th>
                                    <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {absentees.map((record, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center font-bold text-gray-500 shadow-sm">
                                                    {record.student?.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800 leading-none mb-1">{record.student?.name}</p>
                                                    <p className="text-[10px] font-mono font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded inline-block uppercase tracking-tighter">
                                                        {record.student?.rollNumber}
                                                    </p>
                                                    <span className="ml-2 text-[10px] text-gray-400 font-bold uppercase">{record.student?.department}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <Users size={12} className="text-gray-400" />
                                                    <span className="text-xs font-bold text-gray-700">{record.teamName || record.team?.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Briefcase size={12} className="text-gray-400" />
                                                    <span className="text-[11px] text-gray-500 truncate max-w-[200px]">{record.projectTitle || record.team?.project?.title}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black uppercase tracking-wider border border-indigo-100">
                                                Phase {record.phase}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                {record.type === 'MARKED_ABSENT' ? (
                                                    <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100 w-fit">
                                                        <UserX size={12} /> Marked Absent
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 w-fit">
                                                        <AlertCircle size={12} /> Deadline Missed
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-700">{record.sessionName}</span>
                                                <span className="text-[10px] text-gray-400 font-bold">{record.venue} • {record.timeSlot}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                                                    <User size={12} className="text-indigo-600" />
                                                </div>
                                                <span className="text-xs font-medium text-gray-700">{record.facultyName || record.faculty?.name || "System"}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col text-right">
                                                <span className="text-xs font-bold text-gray-700">{record.date ? new Date(record.date).toLocaleDateString() : 'N/A'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Quick Stats Summary */}
            {!loading && absentees.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Absences</p>
                            <p className="text-3xl font-black text-gray-800">{absentees.length}</p>
                        </div>
                        <div className="p-3 bg-red-50 text-red-500 rounded-2xl">
                            <UserX size={24} />
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Explicitly Marked</p>
                            <p className="text-3xl font-black text-indigo-600">{absentees.filter(a => a.isExplicit).length}</p>
                        </div>
                        <div className="p-3 bg-indigo-50 text-indigo-500 rounded-2xl">
                            <User size={24} />
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Missed Deadlines</p>
                            <p className="text-3xl font-black text-amber-600">{absentees.filter(a => !a.isExplicit).length}</p>
                        </div>
                        <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl">
                            <AlertCircle size={24} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
