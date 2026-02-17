import React, { useState, useMemo } from 'react';
import { Users, UserCheck, UserX, Search, Filter, Crown, Folder, X, Edit2, Save, Award, History, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, CheckCircle2, Clock, Download, Eye, RotateCcw, AlertCircle, MessageSquare } from 'lucide-react';
import SearchInput from '../ui/SearchInput';
import SearchableDropdown from '../ui/SearchableDropdown';
import api from '../../api';
import { useToast } from '../../context/ToastContext';

const StudentDetailView = ({ student, onClose, updateMark, updateReview, addToast }) => {
    const [editingMarkId, setEditingMarkId] = useState(null);
    const [editMarkValue, setEditMarkValue] = useState('');
    const [editingReviewId, setEditingReviewId] = useState(null);
    const [editReviewValue, setEditReviewValue] = useState('');

    const handleMarkUpdate = async (markId) => {
        if (isNaN(editMarkValue) || editMarkValue < 0 || editMarkValue > 100) {
            addToast("Score must be between 0 and 100", 'warning');
            return;
        }
        await updateMark(markId, parseInt(editMarkValue), student.id);
        setEditingMarkId(null);
    };

    const handleReviewUpdate = async (reviewId) => {
        await updateReview(reviewId, { content: editReviewValue });
        setEditingReviewId(null);
    };

    const teamReviews = student.teamData?.reviews || [];

    const reviewsByPhase = teamReviews.reduce((acc, review) => {
        const phase = review.reviewPhase || 1;
        if (!acc[phase]) acc[phase] = [];
        acc[phase].push(review);
        return acc;
    }, {});

    const phases = Object.keys(reviewsByPhase).sort();

    const stats = useMemo(() => {
        const phaseMarksMap = new Map();
        const reviews = student.teamData?.reviews || [];

        reviews.forEach(r => {
            const phase = r.reviewPhase !== undefined && r.reviewPhase !== null ? r.reviewPhase : 1;
            const mark = r.reviewMarks?.find(m => m.studentId === student.id)?.marks;
            if (mark !== undefined && mark !== null && !phaseMarksMap.has(phase)) {
                phaseMarksMap.set(phase, mark);
            }
        });

        const studentMarks = Array.from(phaseMarksMap.values());
        const overallAverage = studentMarks.length > 0
            ? (studentMarks.reduce((a, b) => a + b, 0) / studentMarks.length).toFixed(1)
            : "N/A";

        return { overallAverage, reviewCount: studentMarks.length };
    }, [student.id, student.teamData]);

    const getMemberMark = (review, studentId) => {
        const entry = review.reviewMarks?.find(m => m.studentId === studentId);
        return entry ? entry.marks : null;
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-start shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            {student.name}
                            {student.isLeader && <Crown size={20} className="text-yellow-300 fill-yellow-300" />}
                        </h2>
                        <p className="opacity-90 font-mono text-sm mt-1">{student.email} • {student.rollNumber || "No Roll #"}</p>
                        <div className="flex gap-2 mt-4">
                            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold border border-white/10 uppercase">{student.department || "No Dept"}</span>
                            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold border border-white/10 uppercase">Year {student.year || "?"}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors cursor-pointer"><X size={24} /></button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar space-y-8 flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-1 bg-gray-50 p-5 rounded-3xl border border-gray-100 flex flex-col justify-center gap-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm text-blue-600"><Folder size={20} /></div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Project</p>
                            </div>
                            <h3 className="text-sm font-bold text-gray-800 line-clamp-1">{student.project}</h3>
                            <div className="flex flex-col gap-1 mt-1">
                                <p className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 w-fit">Batch: {student.batch}</p>
                                {student.projectDescription && (
                                    <p className="text-[10px] text-gray-500 line-clamp-2 italic" title={student.projectDescription}>
                                        {student.projectDescription}
                                    </p>
                                )}
                            </div>
                            {student.isInTeam && (
                                <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded uppercase border w-fit ${student.teamStatus === 'COMPLETED' ? 'bg-green-100 text-green-700 border-green-200' :
                                    student.teamStatus === 'CHANGES_REQUIRED' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                        student.teamStatus === 'READY_FOR_REVIEW' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                            student.teamStatus === 'NOT_COMPLETED' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                                                'bg-indigo-50 text-indigo-700 border-indigo-100'
                                    }`}>
                                    {student.teamStatus.replace('_', ' ')}
                                </span>
                            )}
                        </div>

                        <div className="bg-gradient-to-br from-green-50 to-green-100/50 p-5 rounded-3xl border border-green-100 flex items-center gap-4">
                            <div className="p-3 bg-white rounded-2xl shadow-sm text-green-600"><Award size={24} /></div>
                            <div>
                                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Overall Score</p>
                                <h3 className="text-3xl font-black text-green-800 leading-none mt-1">{stats.overallAverage}<span className="text-sm font-bold text-green-400 ml-1">/ 100</span></h3>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-5 rounded-3xl border border-purple-100 flex items-center gap-4">
                            <div className="p-3 bg-white rounded-2xl shadow-sm text-purple-600"><History size={24} /></div>
                            <div>
                                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Graded reviews</p>
                                <h3 className="text-3xl font-black text-purple-800 leading-none mt-1">{stats.reviewCount}</h3>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <History size={20} className="text-gray-400" />
                            Review History & Performance
                        </h3>

                        {!student.isInTeam ? (
                            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <p className="text-gray-400 font-medium">Student is not part of any team yet.</p>
                            </div>
                        ) : phases.length === 0 ? (
                            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <p className="text-gray-400 font-medium">No reviews submitted yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {phases.map(phase => (
                                    <div key={phase} className="border border-gray-200 rounded-2xl overflow-hidden">
                                        <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                                            <h4 className="font-bold text-gray-700">Phase {phase}</h4>
                                            <span className="text-xs font-bold bg-white border px-2 py-1 rounded text-gray-500">{reviewsByPhase[phase].length} Review(s)</span>
                                        </div>
                                        <div className="bg-white">
                                            {reviewsByPhase[phase]
                                                .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                                                .map((review, idx) => {
                                                    const marks = getMemberMark(review, student.id);
                                                    const isLatest = idx === reviewsByPhase[phase].length - 1;
                                                    const effectiveStatus = review.status || 'PENDING';

                                                    return (
                                                        <div key={review.id} className={`p-5 relative ${idx !== 0 ? 'border-t border-gray-50' : ''}`}>
                                                            {/* Timeline connector */}
                                                            {reviewsByPhase[phase].length > 1 && !isLatest && (
                                                                <div className="absolute left-8 top-16 bottom-0 w-0.5 bg-gray-100 z-0" />
                                                            )}

                                                            <div className="flex justify-between items-start mb-3 relative z-10">
                                                                <div className="flex gap-4">
                                                                    <div className={`mt-1 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${effectiveStatus === 'COMPLETED' ? 'bg-green-100 text-green-600' :
                                                                        effectiveStatus === 'CHANGES_REQUIRED' ? 'bg-red-100 text-red-600' :
                                                                            'bg-blue-100 text-blue-600'
                                                                        }`}>
                                                                        {idx + 1}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-bold text-gray-800 flex items-center gap-2">
                                                                            {review.faculty?.name || "Faculty Review"}
                                                                            {review.faculty?.rollNumber && <span className="opacity-40 font-mono text-[9px]">({review.faculty.rollNumber})</span>}
                                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase ${(effectiveStatus === 'APPROVED' || effectiveStatus === 'COMPLETED') ? 'bg-green-50 text-green-600 border border-green-100' :
                                                                                effectiveStatus === 'CHANGES_REQUIRED' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                                                    'bg-blue-50 text-blue-600 border border-blue-100'
                                                                                }`}>
                                                                                {effectiveStatus.replace('_', ' ')}
                                                                            </span>
                                                                        </p>
                                                                        <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                                                                            <span>{new Date(review.createdAt).toLocaleDateString('en-GB')} {new Date(review.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                            {review.resubmittedAt && (
                                                                                <div className="flex flex-col mt-1">
                                                                                    <span className="text-[9px] font-black text-orange-600 uppercase tracking-wider mb-1">Resubmission context</span>
                                                                                    {review.resubmissionNote && (
                                                                                        <pre className="text-[10px] text-gray-500 italic bg-orange-50/50 p-2 rounded border border-orange-100 whitespace-pre-wrap font-sans leading-tight">
                                                                                            {review.resubmissionNote}
                                                                                        </pre>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            {review.completedAt && review.status === 'COMPLETED' && <span className="text-green-600 font-bold">Closed</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-col items-end">
                                                                    {editingMarkId === (review.reviewMarks?.find(m => m.studentId === student.id)?.id || `new-${review.id}`) ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <input type="number" min="0" max="100" className="w-14 border rounded px-1 py-0.5 text-xs font-bold" value={editMarkValue} onChange={e => setEditMarkValue(e.target.value)} />
                                                                            <button onClick={() => handleMarkUpdate(editingMarkId)} className="text-green-600"><Save size={14} /></button>
                                                                            <button onClick={() => setEditingMarkId(null)} className="text-red-600"><X size={14} /></button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex flex-col items-end gap-1">
                                                                            <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded text-gray-600 border border-gray-100 cursor-pointer hover:bg-gray-100"
                                                                                onClick={() => {
                                                                                    const mId = review.reviewMarks?.find(m => m.studentId === student.id)?.id || `new-${review.id}`;
                                                                                    setEditingMarkId(mId);
                                                                                    setEditMarkValue(marks !== null ? marks : '');
                                                                                }}>
                                                                                <span className="text-[10px] font-bold">
                                                                                    {(() => {
                                                                                        const mEntry = review.reviewMarks?.find(m => m.studentId === student.id);
                                                                                        let totalScale = "100";
                                                                                        if (mEntry?.criterionMarks) {
                                                                                            try {
                                                                                                const cm = typeof mEntry.criterionMarks === 'string' ? JSON.parse(mEntry.criterionMarks) : mEntry.criterionMarks;
                                                                                                if (cm._total) totalScale = cm._total;
                                                                                            } catch (e) { }
                                                                                        } else if (marks <= 20 && marks !== null) {
                                                                                            totalScale = "20";
                                                                                        }
                                                                                        return `${marks !== null ? marks : 'Set'} / ${totalScale}`;
                                                                                    })()}
                                                                                </span>
                                                                                <Edit2 size={10} className="opacity-40" />
                                                                            </div>
                                                                            {/* Criterion Breakdown */}
                                                                            {(() => {
                                                                                const cmRaw = review.reviewMarks?.find(m => m.studentId === student.id)?.criterionMarks;
                                                                                if (!cmRaw) return null;
                                                                                try {
                                                                                    const cm = typeof cmRaw === 'string' ? JSON.parse(cmRaw) : cmRaw;
                                                                                    return (
                                                                                        <div className="flex flex-col gap-0.5 items-end">
                                                                                            {Object.entries(cm)
                                                                                                .filter(([k]) => k !== '_total')
                                                                                                .map(([k, v]) => (
                                                                                                    <span key={k} className="text-[9px] text-gray-400 bg-gray-50 px-1.5 rounded border border-gray-50 cursor-help" title={k}>
                                                                                                        {k.length > 15 ? k.substring(0, 15) + '...' : k}: <span className="text-gray-600 font-bold">{typeof v === 'object' ? `${v.score}/${v.max}` : v}</span>
                                                                                                    </span>
                                                                                                ))}
                                                                                        </div>
                                                                                    );
                                                                                } catch (e) { return null; }
                                                                            })()}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {review.content && (
                                                                <div className="ml-10 mb-2 p-3 bg-gray-50/50 rounded-xl text-xs relative group border border-gray-100">
                                                                    {editingReviewId === review.id ? (
                                                                        <div className="space-y-2">
                                                                            <textarea className="w-full border rounded p-2 text-xs" value={editReviewValue} onChange={e => setEditReviewValue(e.target.value)} rows={3} />
                                                                            <div className="flex justify-end gap-2">
                                                                                <button onClick={() => setEditingReviewId(null)} className="px-2 py-1 bg-gray-200 rounded text-gray-600">Cancel</button>
                                                                                <button onClick={() => handleReviewUpdate(review.id)} className="px-2 py-1 bg-blue-600 text-white rounded">Save</button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <p className="text-gray-700 pr-6 whitespace-pre-wrap">{review.content}</p>
                                                                            <button className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600" onClick={() => { setEditingReviewId(review.id); setEditReviewValue(review.content); }}><Edit2 size={14} /></button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {student.isInTeam && student.teamData.members.length > 1 && (
                                                                <div className="ml-10 flex flex-wrap items-center gap-1.5">
                                                                    {student.teamData.members.filter(m => m.user.id !== student.id).map(m => {
                                                                        const tMark = getMemberMark(review, m.user.id);
                                                                        return (
                                                                            <div key={m.user.id} className="flex items-center gap-1.5 bg-white border border-gray-100 px-2 py-0.5 rounded text-[9px] text-gray-400" title={`${m.user.name}: ${tMark !== null ? tMark : 'No marks'}`}>
                                                                                <span className="font-medium">{m.user.name.split(' ')[0]}</span>
                                                                                <span className={`font-black ${tMark >= 7 ? 'text-green-500' : tMark >= 4 ? 'text-orange-400' : 'text-red-400'}`}>{tMark !== null ? tMark : '-'}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function IndividualStatsTab({ users, teams, onBack, updateMark, updateReview, scopes, facultyList = [] }) {
    const { addToast } = useToast();
    const [search, setSearch] = useState('');
    const [facultySearch, setFacultySearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [deptFilter, setDeptFilter] = useState('ALL');
    const [yearFilter, setYearFilter] = useState('ALL');
    const [phaseFilter, setPhaseFilter] = useState('ALL');
    const [batchFilter, setBatchFilter] = useState('ALL');
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [localPage, setLocalPage] = useState(1);
    const [localLimit, setLocalLimit] = useState(50);

    const maxPhases = useMemo(() => {
        if (!scopes || scopes.length === 0) return 3;
        if (batchFilter !== 'ALL') {
            const selectedScope = scopes.find(s => s.id === batchFilter);
            return selectedScope?.numberOfPhases || 3;
        }
        return Math.max(...scopes.map(s => s.numberOfPhases || 0), 3);
    }, [scopes, batchFilter]);

    const resetFilters = () => {
        setSearch('');
        setFacultySearch('');
        setStatusFilter('ALL');
        setDeptFilter('ALL');
        setYearFilter('ALL');
        setPhaseFilter('ALL');
        setBatchFilter('ALL');
        setLocalPage(1);
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
        setLocalPage(1);
    };

    const SortIndicator = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="text-gray-300 ml-1" />;
        return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-500 ml-1" /> : <ArrowDown size={12} className="text-blue-500 ml-1" />;
    };

    const userToTeamMap = useMemo(() => {
        const map = new Map();
        teams.forEach(team => {
            team.members.forEach(member => {
                map.set(member.userId, { team, isLeader: member.isLeader });
            });
        });
        return map;
    }, [teams]);

    const departments = useMemo(() => {
        return [...new Set(users.filter(u => u.role === 'STUDENT').map(u => u.department || 'Unassigned'))].sort();
    }, [users]);

    const students = useMemo(() => {
        return users.filter(u => u.role === 'STUDENT').map(student => {
            const studentTeams = teams.filter(t => t.members.some(m => m.userId === student.id));

            // Prioritize the team matching the batch filter
            let selectedTeam = null;
            if (batchFilter !== 'ALL') {
                selectedTeam = studentTeams.find(t => t.scopeId === batchFilter || t.project?.scopeId === batchFilter);
            }

            // If no match or ALL, pick the most recent
            if (!selectedTeam && studentTeams.length > 0) {
                selectedTeam = studentTeams.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
            }

            const teamInfo = selectedTeam ? {
                team: selectedTeam,
                isLeader: selectedTeam.members.find(m => m.userId === student.id)?.isLeader
            } : null;

            const teamReviews = teamInfo?.team?.reviews || [];
            const phaseMarksMap = new Map();
            teamReviews.forEach(r => {
                const phase = r.reviewPhase !== undefined && r.reviewPhase !== null ? r.reviewPhase : 1;
                const m = r.reviewMarks?.find(m => m.studentId === student.id);
                if (m && m.marks !== undefined && m.marks !== null && !phaseMarksMap.has(phase)) {
                    phaseMarksMap.set(phase, m.marks);
                }
            });
            const studentMarks = Array.from(phaseMarksMap.values());

            const overallScore = studentMarks.length > 0
                ? (studentMarks.reduce((a, b) => a + b, 0) / studentMarks.length).toFixed(1)
                : "-";

            const getPhaseStatus = (phase) => {
                if (!teamInfo?.team?.reviews) return 'NOT_STARTED';
                const phaseReviews = teamInfo.team.reviews.filter(r => (r.reviewPhase !== undefined && r.reviewPhase !== null ? r.reviewPhase : 1) === phase);
                if (phaseReviews.length === 0) return 'NOT_STARTED';

                const latest = phaseReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                return latest.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS';
            };

            return {
                ...student,
                isInTeam: !!teamInfo,
                isLeader: teamInfo?.isLeader || false,
                project: teamInfo?.team?.project?.title || "No Project",
                projectDescription: teamInfo?.team?.project?.description || "",
                batch: teamInfo?.team?.project?.scope?.name || teamInfo?.team?.scope?.name || student.scopes?.[0]?.name || "N/A",
                teamStatus: teamInfo?.team?.status || "N/A",
                teamData: teamInfo?.team,
                overallScore,
                ...Array.from({ length: 10 }, (_, i) => i + 1).reduce((acc, p) => ({
                    ...acc,
                    [`phase${p}`]: getPhaseStatus(p)
                }), {})
            };
        });
    }, [users, teams, batchFilter]);

    const filteredStudents = useMemo(() => {
        const searchLower = search.toLowerCase();
        const facSearchLower = facultySearch.toLowerCase();

        return students.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchLower) || s.email.toLowerCase().includes(searchLower) || (s.rollNumber && s.rollNumber.toLowerCase().includes(searchLower)) || (s.department && s.department.toLowerCase().includes(searchLower));

            // Faculty Search - check if any review in this student's team was given by the searched faculty
            const matchesFaculty = !facultySearch || (s.teamData?.reviews || []).some(r =>
                r.faculty?.name?.toLowerCase().includes(facSearchLower)
            );

            const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'IN_TEAM' && s.isInTeam) || (statusFilter === 'NO_TEAM' && !s.isInTeam);
            const matchesDept = deptFilter === 'ALL' || (s.department || 'Unassigned') === deptFilter;
            const matchesYear = yearFilter === 'ALL' || String(s.year) === yearFilter;
            const matchesPhase = phaseFilter === 'ALL' ||
                (phaseFilter.startsWith('P') && s[`phase${phaseFilter.substring(1)}`] === 'COMPLETED') ||
                (phaseFilter === 'NOT_STARTED' && s.phase1 === 'NOT_STARTED');
            const matchesBatch = batchFilter === 'ALL' ||
                s.teamData?.scopeId === batchFilter ||
                s.teamData?.project?.scopeId === batchFilter ||
                s.scopes?.some(sc => sc.id === batchFilter);

            return matchesSearch && matchesFaculty && matchesStatus && matchesDept && matchesYear && matchesPhase && matchesBatch;
        });
    }, [students, search, facultySearch, statusFilter, deptFilter, yearFilter, phaseFilter, batchFilter]);


    const selectedStudent = useMemo(() => {
        if (!selectedStudentId) return null;
        return students.find(s => s.id === selectedStudentId);
    }, [selectedStudentId, students]);

    const sortedStudents = useMemo(() => {
        const result = [...filteredStudents];
        if (!sortConfig.key) return result;
        return result.sort((a, b) => {
            let aVal, bVal;
            switch (sortConfig.key) {
                case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
                case 'dept': aVal = a.department || ''; bVal = b.department || ''; break;
                case 'year': aVal = a.year || 0; bVal = b.year || 0; break;
                case 'status': aVal = a.teamStatus || ''; bVal = b.teamStatus || ''; break;
                case 'project': aVal = a.project || ''; bVal = b.project || ''; break;
                case 'batch': aVal = a.batch || ''; bVal = b.batch || ''; break;
                case 'score': aVal = a.overallScore === '-' ? -1 : parseFloat(a.overallScore); bVal = b.overallScore === '-' ? -1 : parseFloat(b.overallScore); break;
                case 'role': aVal = a.isLeader ? 'Leader' : 'Member'; bVal = b.isLeader ? 'Leader' : 'Member'; break;
                default: return 0;
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredStudents, sortConfig]);

    const totalPages = Math.ceil(filteredStudents.length / localLimit);
    const paginatedStudents = sortedStudents.slice((localPage - 1) * localLimit, localPage * localLimit);

    const handleExportStats = async () => {
        try {
            const params = new URLSearchParams();
            if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
            if (deptFilter && deptFilter !== 'ALL') params.append('department', deptFilter);
            if (yearFilter && yearFilter !== 'ALL') params.append('year', yearFilter);
            if (phaseFilter && phaseFilter !== 'ALL') params.append('phase', phaseFilter);
            if (batchFilter && batchFilter !== 'ALL') params.append('scopeId', batchFilter);
            if (search) params.append('search', search);

            const response = await api.get(`/export/student-stats?${params.toString()}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `student_statistics_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Export failed:', err);
            addToast('Failed to export data. Please try again.', 'error');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            {selectedStudent && <StudentDetailView student={selectedStudent} onClose={() => setSelectedStudentId(null)} updateMark={updateMark} updateReview={updateReview} addToast={addToast} />}

            <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors group px-1">
                <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                Back to Dashboard Overview
            </button>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl"><Users size={24} /></div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                            Individual Student Statistics
                            <span className="text-xs font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 shrink-0">
                                {filteredStudents.length} Students
                            </span>
                        </h2>
                        <p className="text-sm text-gray-500">Click on any student to view detailed performance</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <button
                        onClick={resetFilters}
                        className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95"
                        title="Clear all filters"
                    >
                        <RotateCcw size={16} />
                        Reset
                    </button>
                    <button
                        onClick={handleExportStats}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-md active:scale-95"
                    >
                        <Download size={16} />
                        Export
                    </button>
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        <Filter size={16} className="text-gray-400" />
                        <select className="bg-transparent text-sm font-bold text-gray-600 outline-none cursor-pointer" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setLocalPage(1); }}>
                            <option value="ALL">Status</option>
                            <option value="IN_TEAM">In Team</option>
                            <option value="NO_TEAM">No Team</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        <select className="bg-transparent text-sm font-bold text-gray-600 outline-none cursor-pointer" value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setLocalPage(1); }}>
                            <option value="ALL">All Departments</option>
                            {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        <select className="bg-transparent text-sm font-bold text-gray-600 outline-none cursor-pointer" value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setLocalPage(1); }}>
                            <option value="ALL">All Years</option>
                            {[1, 2, 3, 4].map(y => <option key={y} value={String(y)}>Year {y}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        <select className="bg-transparent text-sm font-bold text-gray-600 outline-none cursor-pointer" value={phaseFilter} onChange={(e) => { setPhaseFilter(e.target.value); setLocalPage(1); }}>
                            <option value="ALL">All Phases</option>
                            {Array.from({ length: maxPhases }, (_, i) => i + 1).map(p => (
                                <option key={p} value={`P${p}`}>P{p} Completed</option>
                            ))}
                            <option value="NOT_STARTED">Not Started</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        <select className="bg-transparent text-sm font-bold text-gray-600 outline-none cursor-pointer" value={batchFilter} onChange={(e) => { setBatchFilter(e.target.value); setLocalPage(1); }}>
                            <option value="ALL">All Batches</option>
                            {scopes?.map(scope => (
                                <option key={scope.id} value={scope.id}>{scope.name}</option>
                            ))}
                        </select>
                    </div>
                    <SearchInput value={search} onChange={(v) => { setSearch(v); setLocalPage(1); }} placeholder="Search students..." className="w-full md:w-64" />

                    <SearchableDropdown
                        options={facultyList}
                        value={facultySearch}
                        onChange={(v) => { setFacultySearch(v); setLocalPage(1); }}
                        placeholder="Filter by Faculty"
                        searchPlaceholder="Search faculty name..."
                        className="w-full md:w-80"
                    />
                </div>
            </div>


            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-3 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center cursor-pointer hover:bg-gray-100/50 w-12" onClick={() => requestSort('sno')}>#</th>
                                <th className="px-3 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:bg-gray-100/50 min-w-[180px]" onClick={() => requestSort('name')}><div className="flex items-center">Student Info <SortIndicator columnKey="name" /></div></th>
                                <th className="px-3 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center cursor-pointer hover:bg-gray-100/50 w-24" onClick={() => requestSort('year')}><div className="flex items-center justify-center">Yr/Dept <SortIndicator columnKey="year" /></div></th>
                                <th className="px-3 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center cursor-pointer hover:bg-gray-100/50 w-32" onClick={() => requestSort('status')}><div className="flex items-center justify-center">Status <SortIndicator columnKey="status" /></div></th>
                                <th className="px-3 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:bg-gray-100/50 min-w-[150px]" onClick={() => requestSort('project')}><div className="flex items-center">Project <SortIndicator columnKey="project" /></div></th>
                                <th className="px-3 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center cursor-pointer hover:bg-gray-100/50 w-28" onClick={() => requestSort('batch')}><div className="flex items-center justify-center">Batch <SortIndicator columnKey="batch" /></div></th>
                                <th className="px-3 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center cursor-pointer hover:bg-gray-100/50 w-24" onClick={() => requestSort('score')}><div className="flex items-center justify-center">Score <SortIndicator columnKey="score" /></div></th>
                                {Array.from({ length: maxPhases }, (_, i) => i + 1).map(p => (
                                    <th key={p} className="px-2 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center w-10">P{p}</th>
                                ))}
                                <th className="px-3 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center cursor-pointer hover:bg-gray-100/50 w-20" onClick={() => requestSort('role')}><div className="flex items-center justify-center">Role <SortIndicator columnKey="role" /></div></th>
                                <th className="px-3 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center w-20">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginatedStudents.map((s, index) => (
                                <tr key={s.id} className="group hover:bg-blue-50/50 transition-all cursor-pointer" onClick={() => setSelectedStudentId(s.id)}>
                                    <td className="px-3 py-4 text-center font-bold text-gray-400 text-xs">{(localPage - 1) * localLimit + index + 1}</td>
                                    <td className="px-3 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 text-sm group-hover:text-blue-600 transition-colors truncate max-w-[160px]" title={`${s.name} (${s.rollNumber})`}>{s.name} ({s.rollNumber || "?"})</span>
                                            <span className="text-[10px] text-gray-400 font-mono truncate max-w-[160px]">{s.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] font-black text-gray-600 uppercase">Y{s.year || "?"} • {s.department || "GEN"}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-4">
                                        <div className="flex justify-center">
                                            {s.isInTeam ? (
                                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${s.teamStatus === 'COMPLETED' ? 'bg-green-50 text-green-600 border-green-100' :
                                                    s.teamStatus === 'CHANGES_REQUIRED' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                        s.teamStatus === 'READY_FOR_REVIEW' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                            s.teamStatus === 'NOT_COMPLETED' ? 'bg-gray-50 text-gray-500 border-gray-100' :
                                                                'bg-indigo-50 text-indigo-600 border-indigo-100'
                                                    }`}>
                                                    <span className="text-[10px] font-bold uppercase whitespace-nowrap">{s.teamStatus === 'READY_FOR_REVIEW' ? 'REVIEW' : s.teamStatus.replace('_', ' ')}</span>
                                                </div>
                                            ) : (
                                                <div className="bg-orange-50 text-orange-600 px-2 py-1 rounded-full border border-orange-100">
                                                    <span className="text-[10px] font-bold uppercase">NO TEAM</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-4">
                                        <div className="flex items-center gap-1.5">
                                            <div className="flex flex-col min-w-0">
                                                <span className={`text-xs font-bold truncate max-w-[140px] ${s.project !== "No Project" ? "text-gray-700" : "text-gray-300 italic"}`} title={s.project}>{s.project}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-4 text-center">
                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 truncate max-w-[80px] inline-block">{s.batch}</span>
                                    </td>
                                    <td className="px-3 py-4 text-center">
                                        <span className={`text-xs font-black ${s.overallScore !== '-' ? 'text-blue-600' : 'text-gray-300'}`}>{s.overallScore}</span>
                                    </td>
                                    {Array.from({ length: maxPhases }, (_, i) => i + 1).map(phase => (
                                        <td key={phase} className="px-2 py-4 text-center">
                                            <div className="flex justify-center">
                                                {s[`phase${phase}`] === 'COMPLETED' ? (
                                                    <CheckCircle2 size={14} className="text-green-500" />
                                                ) : s[`phase${phase}`] === 'IN_PROGRESS' ? (
                                                    <Clock size={14} className="text-blue-500 animate-pulse" />
                                                ) : (
                                                    <div className="w-1.5 h-1.5 bg-gray-200 rounded-full"></div>
                                                )}
                                            </div>
                                        </td>
                                    ))}
                                    <td className="px-3 py-4 text-center">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border ${s.isLeader ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                                            {s.isLeader ? 'Lead' : 'Mem'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 text-center">
                                        <button className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors group/eye translate-y-0 active:translate-y-0.5">
                                            <Eye size={14} className="group-hover/eye:scale-110 transition-transform" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredStudents.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-4 border-2 border-dashed border-gray-100 rounded-3xl py-12">
                                            <Search className="text-gray-200" size={48} />
                                            <div>
                                                <p className="font-bold text-gray-400">No students found matching your search</p>
                                                <p className="text-sm text-gray-300">Try adjusting your filters or search term</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between items-center p-6 bg-gray-50/50 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Showing {Math.min((localPage - 1) * localLimit + 1, filteredStudents.length)} to {Math.min(localPage * localLimit, filteredStudents.length)} of {filteredStudents.length} results</span>
                        <select className="border rounded p-1 bg-white outline-none focus:ring-2 ring-blue-500" value={localLimit} onChange={(e) => { setLocalLimit(parseInt(e.target.value)); setLocalPage(1); }}>
                            <option value="25">25 / page</option>
                            <option value="50">50 / page</option>
                            <option value="100">100 / page</option>
                            <option value="500">500 / page</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button disabled={localPage <= 1} onClick={() => setLocalPage(localPage - 1)} className="px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50 text-sm font-semibold transition-all cursor-pointer shadow-sm">Previous</button>
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded text-sm font-bold border border-blue-100 shadow-sm">Page {localPage} of {totalPages || 1}</span>
                        <button disabled={localPage >= totalPages} onClick={() => setLocalPage(localPage + 1)} className="px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50 text-sm font-semibold transition-all cursor-pointer shadow-sm">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
