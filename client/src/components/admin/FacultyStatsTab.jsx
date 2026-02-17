import React, { useState, useMemo } from 'react';
import { Users, UserCheck, Search, Filter, Award, History, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, CheckCircle2, Star, Target, ClipboardList, X, Eye } from 'lucide-react';
import SearchInput from '../ui/SearchInput';

const FacultyDetailModal = ({ faculty, onClose }) => {
    const reviewsByStudent = useMemo(() => {
        const map = new Map();
        (faculty.allReviews || []).forEach(r => {
            const teamMembers = r.team?.members || [];
            teamMembers.forEach(m => {
                const markEntry = r.reviewMarks?.find(rm => rm.studentId === m.userId);

                // Only show attended reviews
                if (markEntry && !markEntry.isAbsent) {
                    if (!map.has(m.userId)) {
                        map.set(m.userId, {
                            studentName: m.user?.name,
                            studentRoll: m.user?.rollNumber,
                            reviews: []
                        });
                    }
                    map.get(m.userId).reviews.push({
                        id: r.id,
                        date: r.createdAt,
                        phase: r.reviewPhase,
                        marks: markEntry.marks,
                        status: r.status,
                        feedback: r.content
                    });
                }
            });
        });
        return Array.from(map.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
    }, [faculty]);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-8 bg-gradient-to-br from-slate-900 to-indigo-900 text-white shrink-0 relative">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                            <span className="text-3xl font-black">{faculty.name?.charAt(0)}</span>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black tracking-tight">{faculty.name}</h2>
                            <p className="text-slate-300 font-medium mt-1">{faculty.email} • {faculty.rollNumber}</p>
                            <div className="flex gap-3 mt-4">
                                <span className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-white/10">{faculty.department || 'GEN'}</span>
                                <span className="bg-blue-500/20 text-blue-200 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-blue-500/30">Faculty</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats Overlay */}
                    <div className="absolute -bottom-6 right-12 flex gap-4">
                        <div className="bg-white text-slate-900 px-6 py-4 rounded-2xl shadow-xl border border-slate-100 min-w-[140px]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Avg marks given</p>
                            <p className="text-2xl font-black text-center mt-1 text-indigo-600">{faculty.averageMarksPercentage}%</p>
                        </div>
                        <div className="bg-white text-slate-900 px-6 py-4 rounded-2xl shadow-xl border border-slate-100 min-w-[140px]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Listed Reviews</p>
                            <p className="text-2xl font-black text-center mt-1 text-blue-600">
                                {reviewsByStudent.reduce((acc, group) => acc + group.reviews.length, 0)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-10 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Left Column: Teams */}
                    <div className="lg:col-span-1 space-y-8">
                        <div>
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                                <Users size={16} /> Guided Teams & Experts
                            </h3>
                            <div className="space-y-3">
                                {faculty.studentsDetails?.length > 0 ? (
                                    faculty.studentsDetails.map((s, idx) => (
                                        <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm leading-tight">{s.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{s.rollNumber}</p>
                                                </div>
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${s.role === 'GUIDE' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                                                    {s.role}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-2 italic line-clamp-1">"{s.project}"</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-400 italic">No teams currently assigned.</p>
                                )}
                            </div>
                        </div>

                        <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100">
                            <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-2">Quota Statistics</h4>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-3xl font-black text-indigo-900">{faculty.quotaStatus}</p>
                                    <p className="text-[10px] font-bold text-indigo-400 mt-1">Teams Assigned / Max Quota</p>
                                </div>
                                <div className="w-12 h-12 rounded-full border-4 border-white shadow-sm flex items-center justify-center bg-indigo-600 text-white font-black text-xs">
                                    {Math.round(((faculty.teamsCount || 0) / 4) * 100)}%
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Section: Review History */}
                    <div className="lg:col-span-2 space-y-6">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <History size={16} /> Detailed Review Log
                        </h3>

                        <div className="space-y-6">
                            {reviewsByStudent.length > 0 ? (
                                reviewsByStudent.map((group, idx) => (
                                    <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                                                    {group.studentName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700 leading-none">{group.studentName}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono mt-1">{group.studentRoll}</p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{group.reviews.length} Grading Point(s)</span>
                                        </div>
                                        <div className="divide-y divide-slate-50">
                                            {group.reviews.map((r, rIdx) => (
                                                <div key={rIdx} className="p-4 hover:bg-slate-50/50 transition-colors">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1 min-w-0 pr-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-tighter">P{r.phase}</span>
                                                                <p className="text-xs font-bold text-slate-600 truncate">{r.project}</p>
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 mt-1">{new Date(r.date).toLocaleDateString('en-GB')} • {new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-right">
                                                                <p className={`text-sm font-black ${r.marks >= 70 ? 'text-green-600' : r.marks >= 40 ? 'text-orange-500' : 'text-red-500'}`}>
                                                                    {r.marks}<span className="text-[10px] opacity-40 ml-0.5">/ 100</span>
                                                                </p>
                                                                <p className="text-[9px] font-bold text-slate-300 uppercase leading-none">{r.status}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {r.feedback && (
                                                        <div className="mt-3 pl-3 border-l-2 border-indigo-100">
                                                            <p className="text-[11px] text-slate-500 italic leading-relaxed">"{r.feedback}"</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                    <ClipboardList size={40} className="mx-auto text-slate-200 mb-3" />
                                    <p className="text-slate-400 font-bold">No review data recorded for this faculty.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function FacultyStatsTab({ facultyMembers, onBack }) {
    const [search, setSearch] = useState('');
    const [selectedFaculty, setSelectedFaculty] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'reviewsCount', direction: 'desc' });

    const filteredFaculty = useMemo(() => {
        const lower = search.toLowerCase();
        return facultyMembers.filter(f =>
            f.name.toLowerCase().includes(lower) ||
            f.email.toLowerCase().includes(lower) ||
            (f.rollNumber && f.rollNumber.toLowerCase().includes(lower))
        );
    }, [facultyMembers, search]);

    const sortedFaculty = useMemo(() => {
        const result = [...filteredFaculty];
        const { key, direction } = sortConfig;

        return result.sort((a, b) => {
            let aVal, bVal;
            switch (key) {
                case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
                case 'reviewsCount': aVal = a.reviewsCount; bVal = b.reviewsCount; break;
                case 'avgMarks': aVal = parseFloat(a.averageMarksPercentage); bVal = parseFloat(b.averageMarksPercentage); break;
                case 'teamsCount': aVal = a.teamsCount; bVal = b.teamsCount; break;
                default: return 0;
            }
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredFaculty, sortConfig]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="opacity-20 ml-auto" />;
        return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600 ml-auto" /> : <ArrowDown size={14} className="text-blue-600 ml-auto" />;
    };

    const aggregateMetrics = useMemo(() => {
        if (facultyMembers.length === 0) return null;
        const totalReviews = facultyMembers.reduce((sum, f) => sum + (f.reviewsCount || 0), 0);
        return { totalReviews };
    }, [facultyMembers]);

    return (
        <div className="space-y-8 animate-in fade-in duration-700 slide-in-from-bottom-5">
            {selectedFaculty && <FacultyDetailModal faculty={selectedFaculty} onClose={() => setSelectedFaculty(null)} />}

            {/* Header Area */}
            <div className="flex flex-col xl:flex-row gap-6">
                <div className="flex-1 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <Target size={32} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Faculty Analytics</h2>
                            <p className="text-slate-400 font-medium">Performance tracking and review distribution.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <SearchInput value={search} onChange={setSearch} placeholder="Search Faculty..." className="w-full md:w-80" />
                        <button onClick={onBack} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                            <ChevronLeft size={24} />
                        </button>
                    </div>
                </div>

                {/* Aggregate Summary */}
                {aggregateMetrics && (
                    <div className="xl:min-w-[240px]">
                        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-6 rounded-[1.5rem] shadow-lg text-white h-full flex flex-col justify-center">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Total Reviews Given</p>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-4xl font-black">{aggregateMetrics.totalReviews}</span>
                                <History size={28} className="opacity-30" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Faculty Table */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => requestSort('name')}>
                                    <div className="flex items-center gap-2">Faculty Member <SortIcon columnKey="name" /></div>
                                </th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center cursor-pointer" onClick={() => requestSort('reviewsCount')}>
                                    <div className="flex items-center gap-2 justify-center">Reviews Done <SortIcon columnKey="reviewsCount" /></div>
                                </th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center cursor-pointer" onClick={() => requestSort('avgMarks')}>
                                    <div className="flex items-center gap-2 justify-center">Avg marks given <SortIcon columnKey="avgMarks" /></div>
                                </th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center cursor-pointer" onClick={() => requestSort('teamsCount')}>
                                    <div className="flex items-center gap-2 justify-center">Quota util. <SortIcon columnKey="teamsCount" /></div>
                                </th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {sortedFaculty.map((f) => (
                                <tr key={f.id} className="group hover:bg-slate-50/70 transition-colors cursor-pointer" onClick={() => setSelectedFaculty(f)}>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-lg group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                                {f.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-base leading-none group-hover:text-blue-600 transition-colors">{f.name}</p>
                                                <p className="text-[11px] text-slate-400 font-medium mt-1.5">{f.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <div className="inline-flex flex-col items-center">
                                            <span className="text-lg font-black text-slate-700 leading-none">{f.reviewsCount}</span>
                                            <span className="text-[9px] font-black text-slate-300 uppercase mt-1">Reviews</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={`text-base font-black ${parseFloat(f.averageMarksPercentage) > aggregateMetrics?.avgMarks ? 'text-indigo-600' : 'text-slate-600'}`}>
                                            {f.averageMarksPercentage}%
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                                <div
                                                    className={`h-full rounded-full ${f.teamsCount >= 4 ? 'bg-orange-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${Math.min((f.teamsCount / 4) * 100, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400">{f.quotaStatus}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <div className="flex justify-center">
                                            {f.reviewsCount > 0 ? (
                                                <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-black uppercase border border-green-100">
                                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                                    Active
                                                </div>
                                            ) : (
                                                <div className="bg-slate-50 text-slate-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase border border-slate-100">
                                                    Inactive
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <button className="p-3 hover:bg-blue-100 text-blue-600 rounded-xl transition-all active:scale-90">
                                            <Eye size={20} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
