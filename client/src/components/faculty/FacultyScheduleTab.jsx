import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api';
import { Calendar, Clock, MapPin, Users, Search, Filter, Mail, IdCard, CheckCircle2 } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function FacultyScheduleTab({ onViewProject, scopes = [] }) {
    const { user } = useContext(AuthContext);
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState('today'); // today | upcoming | history
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copyStatus, setCopyStatus] = useState(null); // 'email' | 'roll' | null
    const [studentPages, setStudentPages] = useState({}); // { sessionId: pageNumber }

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVenueId, setSelectedVenueId] = useState('ALL');
    const [selectedScopeId, setSelectedScopeId] = useState('ALL');
    const [selectedSrsStatus, setSelectedSrsStatus] = useState('ALL'); // ALL | SUBMITTED | PENDING
    const [selectedTechStackStatus, setSelectedTechStackStatus] = useState('ALL'); // ALL | DEFINED | NOT_DEFINED
    const [selectedPhaseCompletion, setSelectedPhaseCompletion] = useState('ALL'); // ALL | 0 | 1 | 2 | 3 | 4

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

            let start, end;

            if (activeTab === 'today') {
                start = startOfDay.toISOString();
                end = endOfDay.toISOString();
            } else if (activeTab === 'upcoming') {
                // Next day start to 1 year ahead
                const tomorrow = new Date(startOfDay);
                tomorrow.setDate(tomorrow.getDate() + 1);
                start = tomorrow.toISOString();
                end = new Date(now.getFullYear() + 1, 0, 1).toISOString();
            } else {
                // 1 year back to yesterday end
                const yesterdayEnd = new Date(startOfDay);
                yesterdayEnd.setMilliseconds(-1);
                start = new Date(now.getFullYear() - 1, 0, 1).toISOString();
                end = yesterdayEnd.toISOString();
            }

            const res = await api.get('/venues/sessions', { params: { start, end } });

            // Filter for THIS faculty
            const mySessions = res.data.filter(s => s.facultyId === user?.id);
            setSessions(mySessions);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Derived unique venues from sessions for filter dropdown
    const uniqueVenues = useMemo(() => {
        const venueMap = new Map();
        sessions.forEach(s => {
            if (s.venue) venueMap.set(s.venue.id, s.venue);
        });
        return Array.from(venueMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [sessions]);

    // Filtering Logic
    const filteredSessions = useMemo(() => {
        const lowerTerm = searchTerm.toLowerCase();

        return sessions
            .map(session => {
                // Determine which students to show based on all filters
                let displayStudents = session.students || [];

                // 1. Filter by Search Term (if not venue match)
                if (searchTerm) {
                    const venueMatches = session.venue?.name?.toLowerCase().includes(lowerTerm);
                    if (!venueMatches) {
                        displayStudents = displayStudents.filter(s =>
                            s.name?.toLowerCase().includes(lowerTerm) ||
                            s.rollNumber?.toLowerCase().includes(lowerTerm)
                        );
                    }
                }

                // 2. Filter by SRS Status
                if (selectedSrsStatus !== 'ALL') {
                    displayStudents = displayStudents.filter(s => {
                        const project = s.teamMemberships?.[0]?.team?.project;
                        const hasSrs = project?.srs && project.srs.trim() !== '';
                        return selectedSrsStatus === 'SUBMITTED' ? hasSrs : !hasSrs;
                    });
                }

                // 3. Filter by Tech Stack Status
                if (selectedTechStackStatus !== 'ALL') {
                    displayStudents = displayStudents.filter(s => {
                        const project = s.teamMemberships?.[0]?.team?.project;
                        const hasTechStack = project?.techStack && project.techStack.trim() !== '';
                        return selectedTechStackStatus === 'DEFINED' ? hasTechStack : !hasTechStack;
                    });
                }

                // 4. Filter by Phase Completion
                if (selectedPhaseCompletion !== 'ALL') {
                    const targetPhases = parseInt(selectedPhaseCompletion);
                    displayStudents = displayStudents.filter(s => {
                        const completedPhases = s.teamMemberships?.[0]?.team?.reviews?.length || 0;
                        return completedPhases === targetPhases;
                    });
                }

                // 5. Sort by Name Ascending
                displayStudents.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                return { ...session, displayStudents };
            })
            .filter(session => {
                const matchesVenue = selectedVenueId === 'ALL' || session.venueId === selectedVenueId;
                const matchesScope = selectedScopeId === 'ALL' || session.scopeId === selectedScopeId;

                // Match session if searching for venue OR if at least one student remains after filtering
                const matchesSearch = !searchTerm ||
                    session.venue?.name?.toLowerCase().includes(lowerTerm) ||
                    session.displayStudents.length > 0;

                // For SRS/Tech filters: if selected, only show sessions that contain at least one matching student
                const matchesSrs = selectedSrsStatus === 'ALL' || session.displayStudents.length > 0;
                const matchesTech = selectedTechStackStatus === 'ALL' || session.displayStudents.length > 0;
                const matchesPhase = selectedPhaseCompletion === 'ALL' || session.displayStudents.length > 0;

                return matchesVenue && matchesScope && matchesSearch && matchesSrs && matchesTech && matchesPhase;
            });
    }, [sessions, searchTerm, selectedVenueId, selectedScopeId, selectedSrsStatus, selectedTechStackStatus, selectedPhaseCompletion]);

    const handleStudentClick = async (student, scopeId) => {
        if (!onViewProject) return;
        try {
            // Find student's team in this batch/scope
            const res = await api.get('/admin/teams', {
                params: {
                    search: student.rollNumber,
                    scopeId: scopeId || 'ALL'
                }
            });
            const team = res.data.teams?.find(t =>
                t.members.some(m => m.user.id === student.id)
            );

            if (team) {
                onViewProject(team);
            } else {
                addToast("This student is not yet assigned to any team in this batch.", 'info');
            }
        } catch (err) {
            console.error("Error fetching student team:", err);
        }
    };

    const copyIdentifiers = (type) => {
        const identifiers = new Set();
        filteredSessions.forEach(session => {
            session.displayStudents.forEach(student => {
                const val = type === 'email' ? student.email : student.rollNumber;
                if (val) identifiers.add(val);
            });
        });

        const text = Array.from(identifiers).join(', ');
        navigator.clipboard.writeText(text).then(() => {
            setCopyStatus(type);
            setTimeout(() => setCopyStatus(null), 2000);
        });
    };

    useEffect(() => {
        fetchSessions();
    }, [activeTab]);

    const venueSummary = useMemo(() => {
        const stats = {};
        filteredSessions.forEach(session => {
            const venueName = session.venue?.name || "Other";
            if (!stats[venueName]) {
                stats[venueName] = {
                    name: venueName,
                    assigned: 0,
                    completed: 0,
                    absent: 0,
                    students: new Set()
                };
            }

            session.displayStudents.forEach(student => {
                if (!stats[venueName].students.has(student.id)) {
                    stats[venueName].students.add(student.id);
                    stats[venueName].assigned++;

                    const team = student.teamMemberships?.[0]?.team;
                    const reviews = team?.reviews || [];

                    // Check if completed or absent
                    const isCompleted = reviews.some(r => r.reviewMarks?.some(m => !m.isAbsent));
                    const isAbsent = reviews.some(r => r.reviewMarks?.some(m => m.isAbsent));

                    if (isCompleted) stats[venueName].completed++;
                    else if (isAbsent) stats[venueName].absent++;
                }
            });
        });
        return Object.values(stats);
    }, [filteredSessions]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header with Search and Tabs */}
            <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                    <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-full lg:w-fit overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('today')}
                            className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'today' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setActiveTab('upcoming')}
                            className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'upcoming' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Upcoming
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            History
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Student or Venue..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 ring-blue-500 outline-none transition-all text-sm"
                            />
                        </div>

                        {/* Venue Filter */}
                        <select
                            value={selectedVenueId}
                            onChange={(e) => setSelectedVenueId(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 focus:ring-2 ring-blue-500 outline-none"
                        >
                            <option value="ALL">All Venues</option>
                            {uniqueVenues.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>

                        {/* Batch Filter */}
                        <select
                            value={selectedScopeId}
                            onChange={(e) => setSelectedScopeId(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 focus:ring-2 ring-blue-500 outline-none"
                        >
                            <option value="ALL">All Batches</option>
                            {scopes.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Second filter row for SRS & Tech Stack */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-wider mr-2">
                        <Filter size={14} /> Refine Students:
                    </div>

                    {/* SRS Filter */}
                    <select
                        value={selectedSrsStatus}
                        onChange={(e) => setSelectedSrsStatus(e.target.value)}
                        className="px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-blue-200 transition-colors"
                    >
                        <option value="ALL">SRS: All Status</option>
                        <option value="SUBMITTED">SRS: Submitted</option>
                        <option value="PENDING">SRS: Pending</option>
                    </select>

                    {/* Tech Stack Filter */}
                    <select
                        value={selectedTechStackStatus}
                        onChange={(e) => setSelectedTechStackStatus(e.target.value)}
                        className="px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-blue-200 transition-colors"
                    >
                        <option value="ALL">Tech Stack: All</option>
                        <option value="DEFINED">Tech Stack: Defined</option>
                        <option value="NOT_DEFINED">Tech Stack: Not Defined</option>
                    </select>

                    {/* Phase Completion Filter */}
                    <select
                        value={selectedPhaseCompletion}
                        onChange={(e) => setSelectedPhaseCompletion(e.target.value)}
                        className="px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-blue-200 transition-colors"
                    >
                        <option value="ALL">Phases: All</option>
                        <option value="0">0 Phases Done</option>
                        <option value="1">1 Phase Done</option>
                        <option value="2">2 Phases Done</option>
                        <option value="3">3 Phases Done</option>
                        <option value="4">4 Phases Done</option>
                    </select>

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={() => copyIdentifiers('email')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${copyStatus === 'email' ? 'bg-green-600 text-white shadow-md' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'}`}
                        >
                            {copyStatus === 'email' ? <CheckCircle2 size={14} /> : <Mail size={14} />}
                            {copyStatus === 'email' ? 'Emails Copied' : 'Copy Emails'}
                        </button>
                        <button
                            onClick={() => copyIdentifiers('roll')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${copyStatus === 'roll' ? 'bg-green-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-700 hover:text-white'}`}
                        >
                            {copyStatus === 'roll' ? <CheckCircle2 size={14} /> : <IdCard size={14} />}
                            {copyStatus === 'roll' ? 'Roll Numbers Copied' : 'Copy Roll Nos'}
                        </button>
                    </div>

                    {(selectedSrsStatus !== 'ALL' || selectedTechStackStatus !== 'ALL' || selectedPhaseCompletion !== 'ALL') && (
                        <button
                            onClick={() => { setSelectedSrsStatus('ALL'); setSelectedTechStackStatus('ALL'); setSelectedPhaseCompletion('ALL'); }}
                            className="text-xs font-black text-blue-600 hover:underline px-2 py-1"
                        >
                            Reset Refinements
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="grid gap-4">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="font-medium animate-pulse">Fetching your schedule...</p>
                    </div>
                ) : filteredSessions.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                        <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-bold text-lg">No sessions found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                        {(searchTerm || selectedVenueId !== 'ALL' || selectedScopeId !== 'ALL' || selectedSrsStatus !== 'ALL' || selectedTechStackStatus !== 'ALL' || selectedPhaseCompletion !== 'ALL') && (
                            <button
                                onClick={() => { setSearchTerm(''); setSelectedVenueId('ALL'); setSelectedScopeId('ALL'); setSelectedSrsStatus('ALL'); setSelectedTechStackStatus('ALL'); setSelectedPhaseCompletion('ALL'); }}
                                className="mt-4 text-blue-600 font-bold text-sm hover:underline"
                            >
                                Clear All Filters
                            </button>
                        )}
                    </div>
                ) : (
                    filteredSessions.map(session => (
                        <div key={session.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                            <div className="flex flex-col md:flex-row justify-between gap-6">

                                {/* Time & Venue */}
                                <div className="flex gap-4 items-start min-w-[240px]">
                                    <div className={`p-4 rounded-2xl shadow-sm ${isSessionToday(session.startTime) ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
                                        <Calendar size={28} />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-black text-xl text-slate-800">{new Date(session.startTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</h4>
                                        <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                                            <Clock size={16} className="text-blue-500" />
                                            <span>
                                                {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                                {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-700 font-black text-base pt-1">
                                            <MapPin size={16} className="text-indigo-500" />
                                            {session.venue?.name}
                                        </div>
                                        {session.scope && (
                                            <div className="mt-3 text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase w-fit border border-indigo-100 tracking-wider">
                                                Batch: {session.scope.name}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Students */}
                                <div className="flex-1 space-y-3">
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Users size={14} /> {searchTerm && !session.venue?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ? 'Matching Students' : 'Scheduled Students'} ({session.displayStudents?.length})
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                                        {(session.displayStudents || []).slice(((studentPages[session.id] || 1) - 1) * 50, (studentPages[session.id] || 1) * 50).map((student, sIdx) => {
                                            const globalIdx = ((studentPages[session.id] || 1) - 1) * 50 + sIdx;
                                            return (
                                                <button
                                                    key={student.id}
                                                    onClick={() => handleStudentClick(student, session.scopeId)}
                                                    className="group flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-transparent hover:border-blue-200 hover:bg-white hover:shadow-md transition-all text-left"
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0 group-hover:scale-110 transition-transform relative">
                                                        {student.name?.charAt(0)}
                                                        <div className="absolute -top-1 -left-1 w-5 h-5 bg-slate-800 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-white">
                                                            {globalIdx + 1}
                                                        </div>
                                                    </div>
                                                    <div className="overflow-hidden flex-1">
                                                        <div className="font-bold text-sm text-slate-700 truncate flex justify-between items-center gap-2">
                                                            <span className="truncate">{student.name}</span>
                                                            {(() => {
                                                                const reviews = student.teamMemberships?.[0]?.team?.reviews || [];
                                                                if (reviews.length === 0) return null;

                                                                let totalScored = 0;
                                                                let totalPossible = 0;

                                                                reviews.forEach(r => {
                                                                    const mark = r.reviewMarks?.[0]; // In sessions, student is direct, but team reviews have all marks
                                                                    // We need to find the mark for THIS student specifically
                                                                    const studentMark = r.reviewMarks?.find(m => m.studentId === student.id) || r.reviewMarks?.[0]; // Fallback to first if only 1 student in team or something

                                                                    if (studentMark) {
                                                                        totalScored += studentMark.marks;
                                                                        let max = 100;
                                                                        if (studentMark.criterionMarks) {
                                                                            try {
                                                                                const cm = JSON.parse(studentMark.criterionMarks);
                                                                                if (cm._total) max = cm._total;
                                                                            } catch (e) { }
                                                                        }
                                                                        totalPossible += max;
                                                                    }
                                                                });

                                                                if (totalPossible === 0) return null;
                                                                const avg = ((totalScored / totalPossible) * 100).toFixed(0);

                                                                return (
                                                                    <span className="shrink-0 text-[10px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded leading-none">
                                                                        {avg}%
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="flex items-center justify-between gap-2 mt-0.5">
                                                            <span className="text-[10px] font-black text-slate-400 font-mono uppercase tracking-tighter">{student.rollNumber}</span>
                                                            <div className="flex gap-1 items-center">
                                                                {(() => {
                                                                    const completed = student.teamMemberships?.[0]?.team?.reviews?.length || 0;
                                                                    if (completed === 0) return null;
                                                                    return <span className="text-[9px] font-black text-blue-500 mr-1 uppercase">P{completed}</span>
                                                                })()}
                                                                {student.teamMemberships?.[0]?.team?.project?.srs && (
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="SRS Submitted" />
                                                                )}
                                                                {student.teamMemberships?.[0]?.team?.project?.techStack && (
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Tech Stack Defined" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}

                                        {(!session.displayStudents || session.displayStudents.length === 0) && (
                                            <span className="text-sm text-slate-400 italic bg-slate-50 px-4 py-3 rounded-xl border border-dashed border-slate-200 w-full text-center sm:col-span-2 xl:col-span-3">
                                                No matching students found
                                            </span>
                                        )}
                                    </div>

                                    {/* Student Pagination Controls */}
                                    {session.displayStudents?.length > 50 && (
                                        <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-50 mt-2">
                                            <button
                                                disabled={(studentPages[session.id] || 1) === 1}
                                                onClick={() => setStudentPages(prev => ({ ...prev, [session.id]: (prev[session.id] || 1) - 1 }))}
                                                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-30"
                                            >
                                                Previous
                                            </button>
                                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                                Page {studentPages[session.id] || 1} of {Math.ceil(session.displayStudents.length / 50)}
                                            </span>
                                            <button
                                                disabled={(studentPages[session.id] || 1) >= Math.ceil(session.displayStudents.length / 50)}
                                                onClick={() => setStudentPages(prev => ({ ...prev, [session.id]: (prev[session.id] || 1) + 1 }))}
                                                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-30"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}


