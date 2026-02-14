import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, CheckCircle, Clock, AlertCircle, Users, Trash2 } from 'lucide-react';
import SearchInput from '../ui/SearchInput';
import StatusBadge from '../ui/StatusBadge';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

export default function ReviewsTab({
    api,
    scopes
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterPhase, setFilterPhase] = useState('ALL');
    const [filterActive, setFilterActive] = useState('true'); // Default to Active
    const [selectedScope, setSelectedScope] = useState('ALL');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [teams, setTeams] = useState([]);
    const [counts, setCounts] = useState({ TOTAL: 0, READY_FOR_REVIEW: 0, COMPLETED: 0, IN_PROGRESS: 0, CHANGES_REQUIRED: 0, NOT_COMPLETED: 0 });
    const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
    const [isLoading, setIsLoading] = useState(false);

    const { addToast } = useToast();
    const { confirm } = useConfirm();

    const [expandedTeamId, setExpandedTeamId] = useState(null);
    const [reviewText, setReviewText] = useState("");
    const [reviewStatus, setReviewStatus] = useState("NOT_COMPLETED");
    const [reviewPhase, setReviewPhase] = useState("1");
    const [individualMarks, setIndividualMarks] = useState({});
    const [isPresentState, setIsPresentState] = useState({}); // { studentId: boolean }
    const [rubric, setRubric] = useState(null);
    const [rubricMarks, setRubricMarks] = useState({}); // { studentId: { criterionName: marks } }

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPagination(prev => ({ ...prev, page: 1 }));
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchReviews = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/reviews/assignments', {
                params: {
                    search: debouncedSearch,
                    scopeId: selectedScope,
                    category: selectedCategory,
                    department: selectedDepartment,
                    status: filterStatus,
                    phase: filterPhase,
                    active: filterActive,
                    page: pagination.page,
                    limit: pagination.limit
                }
            });
            setTeams(response.data.teams);
            setCounts(response.data.counts || { TOTAL: 0, READY_FOR_REVIEW: 0, COMPLETED: 0, IN_PROGRESS: 0, CHANGES_REQUIRED: 0, NOT_COMPLETED: 0 });
            setPagination(response.data.pagination);
        } catch (err) {
            console.error("Error fetching reviews:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, [debouncedSearch, selectedScope, selectedCategory, selectedDepartment, filterStatus, filterPhase, filterActive, pagination.page, pagination.limit]);

    // Categories and Departments from teams (for dropdowns)
    const categories = [...new Set(teams?.map(t => t.project?.category).filter(Boolean))];
    const departments = [...new Set(teams?.flatMap(t => t.members?.map(m => m.user?.department)).filter(Boolean))];

    const fetchRubric = async (category, phase, teamMembers) => {
        if (!category) {
            console.warn("No category provided for rubric fetch");
            setRubric(null);
            return;
        }
        try {
            const res = await api.get('/rubrics/find', {
                params: { category, phase }
            });
            setRubric(res.data);
            const initialRubricMarks = {};
            const approvedMembers = teamMembers.filter(m => m.approved);
            approvedMembers.forEach(m => {
                initialRubricMarks[m.user.id] = {};
            });
            setRubricMarks(initialRubricMarks);
        } catch (e) {
            console.log(`No rubric found for ${category} Phase ${phase}`);
            setRubric(null);
            setRubricMarks({});
        }
    };

    const toggleExpand = async (teamId) => {
        if (expandedTeamId === teamId) {
            setExpandedTeamId(null);
            setIndividualMarks({});
            setIsPresentState({});
            setRubric(null);
            setRubricMarks({});
        } else {
            // Clear state before switching
            setIndividualMarks({});
            setIsPresentState({});
            setRubric(null);
            setRubricMarks({});

            setExpandedTeamId(teamId);
            const team = teams.find(t => t.id === teamId);
            if (team) {
                setReviewStatus(team.status);
                const phase = (team.reviews?.length || 0) + 1;
                setReviewPhase(String(phase));

                // Check for existing review (e.g. if expanding a completed review or one in progress)
                const existingReview = team.reviews?.find(r => r.reviewPhase === phase);
                if (existingReview) {
                    setReviewText(existingReview.content || "");
                    setReviewStatus(existingReview.status || team.status);

                    const marksMap = {};
                    const absMap = {};
                    const rubMarksMap = {};

                    existingReview.reviewMarks?.forEach(m => {
                        marksMap[m.studentId] = m.marks;
                        absMap[m.studentId] = m.isAbsent;
                        if (m.criterionMarks) {
                            const parsed = JSON.parse(m.criterionMarks);
                            const scores = {};
                            Object.entries(parsed).forEach(([key, val]) => {
                                if (key !== '_total') scores[key] = val.score;
                            });
                            rubMarksMap[m.studentId] = scores;
                        }
                    });

                    setIndividualMarks(marksMap);
                    setIsPresentState(Object.fromEntries(Object.entries(absMap).map(([k, v]) => [k, !v])));
                    setRubricMarks(rubMarksMap);
                }

                fetchRubric(team.project?.category, phase, team.members);
            }
        }
    };

    const handlePhaseChange = (phase, team) => {
        setReviewPhase(phase);
        fetchRubric(team.project?.category, parseInt(phase), team.members);
    };

    const submitReview = async (e, teamId, projectId) => {
        if (e) e.stopPropagation();

        try {
            const team = teams.find(t => t.id === teamId);
            const approvedMembers = team?.members.filter(m => m.approved) || [];
            const anyPresent = approvedMembers.some(m => !!isPresentState[m.user.id]);

            if (!reviewText.trim() && anyPresent) {
                addToast("Please write a review.", 'warning');
                return;
            }

            const marksPayload = approvedMembers.map(m => {
                let enrichedCriteria = null;
                if (rubric) {
                    const studentRubric = rubricMarks[m.user.id] || {};
                    const criteria = JSON.parse(rubric.criteria);
                    enrichedCriteria = {
                        _total: rubric.totalMarks,
                        ...Object.fromEntries(criteria.map(c => [
                            c.name,
                            { score: studentRubric[c.name] || 0, max: c.maxMarks }
                        ]))
                    };
                }
                return {
                    studentId: m.user.id,
                    marks: parseInt(individualMarks[m.user.id]) || 0,
                    criterionMarks: enrichedCriteria,
                    isAbsent: !isPresentState[m.user.id]
                };
            });

            await api.post('/reviews', {
                teamId,
                projectId,
                content: reviewText,
                status: reviewStatus,
                individualMarks: marksPayload,
                reviewPhase: parseInt(reviewPhase)
            });

            setReviewText("");
            setIndividualMarks({});
            setIsPresentState({});
            setRubricMarks({});
            setRubric(null);
            setReviewPhase("1");
            setExpandedTeamId(null);
            fetchReviews();
            addToast("Review submitted & Status updated!", 'success');
        } catch (e) {
            addToast(e.response?.data?.error || "Error submitting review", 'error');
        }
    };

    const handleDeleteReview = async (reviewId) => {
        if (!await confirm("Are you sure you want to delete this review? This action cannot be undone.", 'Delete Review', 'danger')) {
            return;
        }

        try {
            await api.delete(`/reviews/${reviewId}`);
            fetchReviews();
            addToast("Review deleted successfully!", 'success');
        } catch (err) {
            console.error("Error deleting review:", err);
            addToast(err.response?.data?.error || "Error deleting review", 'error');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Teams', count: counts.TOTAL, icon: Users, color: 'blue' },
                    { label: 'Ready for Review', count: counts.READY_FOR_REVIEW, icon: Clock, color: 'orange' },
                    { label: 'Completed', count: counts.COMPLETED, icon: CheckCircle, color: 'green' },
                    { label: 'Pending Steps', count: counts.CHANGES_REQUIRED + counts.IN_PROGRESS + counts.NOT_COMPLETED + (counts.PENDING || 0) + (counts.APPROVED || 0), icon: AlertCircle, color: 'indigo' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className={`p-3 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl`}>
                            <stat.icon size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{stat.label}</p>
                            <p className="text-xl font-black text-gray-800">{stat.count}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><MessageSquare size={24} /></div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 tracking-tight">Project Progress & Reviews</h2>
                            <p className="text-sm text-gray-500">Manage review history and submit feedback</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {['ALL', 'READY_FOR_REVIEW', 'COMPLETED', 'CHANGES_REQUIRED', 'IN_PROGRESS', 'PENDING', 'APPROVED'].map((status) => (
                            <button
                                key={status}
                                onClick={() => {
                                    setFilterStatus(status);
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                                className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${filterStatus === status
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                                    : 'bg-white border-gray-200 text-gray-400 hover:border-indigo-400'
                                    }`}
                            >
                                {status.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-50">
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Project, Faculty, Name, Roll No..."
                        className="w-full md:w-64"
                    />

                    <select
                        value={selectedScope}
                        onChange={(e) => {
                            setSelectedScope(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                        <option value="ALL">All Batches</option>
                        {scopes.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>

                    <select
                        value={filterPhase}
                        onChange={(e) => {
                            setFilterPhase(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                        <option value="ALL">All Phases</option>
                        <option value="1">Phase 1</option>
                        <option value="2">Phase 2</option>
                        <option value="3">Phase 3</option>
                        <option value="4">Phase 4</option>
                    </select>

                    <select
                        value={filterActive}
                        onChange={(e) => {
                            setFilterActive(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                        <option value="ALL">Any Session</option>
                        <option value="true">Active Session</option>
                        <option value="false">Inactive</option>
                    </select>

                    <select
                        value={selectedCategory}
                        onChange={(e) => {
                            setSelectedCategory(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                        <option value="">All Categories</option>
                        {categories.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>

                    <select
                        value={selectedDepartment}
                        onChange={(e) => {
                            setSelectedDepartment(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                        <option value="">All Departments</option>
                        {departments.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>

                    <div className="flex-1"></div>

                    <div className="flex items-center gap-2 px-3 border-l ml-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Limit:</span>
                        <select
                            value={pagination.limit}
                            onChange={(e) => setPagination(prev => ({ ...prev, limit: parseInt(e.target.value), page: 1 }))}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-1 text-xs font-bold text-gray-600 outline-none transition-all"
                        >
                            {[12, 24, 50, 100, 500].map(l => (
                                <option key={l} value={l}>{l}</option>
                            ))}
                        </select>
                    </div>

                    {(searchTerm || selectedScope !== 'ALL' || selectedCategory || selectedDepartment || filterStatus !== 'ALL' || filterPhase !== 'ALL' || filterActive !== 'true') && (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedScope('ALL');
                                setSelectedCategory('');
                                setSelectedDepartment('');
                                setFilterStatus('ALL');
                                setFilterPhase('ALL');
                                setFilterActive('true');
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            title="Clear Filters"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 space-y-4">
                        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Reviews...</p>
                    </div>
                ) : teams.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-3xl shadow-sm border border-dashed border-gray-200 text-gray-400">
                        No projects found matching your criteria.
                    </div>
                ) : (
                    teams.map(team => {
                        const isExpanded = expandedTeamId === team.id;
                        const members = team.members?.map(m => m.user) || [];
                        const leader = team.members?.find(m => m.isLeader)?.user || members[0] || { name: 'Unknown', rollNumber: 'N/A' };
                        const otherMembers = team.members?.filter(m => m.user?.id !== leader?.id) || [];

                        return (
                            <div
                                key={team.id}
                                className={`bg-white rounded-xl shadow-sm border transition-all duration-300 overflow-hidden ${isExpanded ? 'ring-2 ring-blue-500 border-transparent shadow-lg' : 'hover:shadow-md border-gray-100'} ${team.status === 'READY_FOR_REVIEW' ? 'ring-2 ring-green-500 animate-pulse-subtle' : ''}`}
                            >
                                {/* Collapsed View / Header */}
                                <div
                                    onClick={() => toggleExpand(team.id)}
                                    className={`p-4 cursor-pointer flex items-center justify-between gap-4 ${isExpanded ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-blue-900 truncate">{team.project?.title || "Untitled Project"}</h3>
                                        <div className="flex flex-col gap-1 mt-1 text-sm text-gray-500">
                                            {members.map(u => (
                                                <div key={u.id} className="flex items-center gap-1.5 whitespace-nowrap">
                                                    <span className={`w-2 h-2 rounded-full ${u.id === leader.id ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
                                                    <span className={`${u.id === leader.id ? 'font-bold text-gray-700' : 'text-gray-600'}`}>
                                                        {u.name} <span className="text-[10px] font-mono text-gray-400">({u.rollNumber})</span>
                                                    </span>
                                                </div>
                                            ))}
                                            {team.project?.category && (
                                                <div className="mt-1">
                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-100">
                                                        {team.project.category}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <StatusBadge status={team.status} showIcon size="xs" />
                                        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 animate-in slide-in-from-top-2 duration-300">
                                        <div className="p-6 grid md:grid-cols-2 gap-8">
                                            {/* Left Side: Details & Members */}
                                            <div className="space-y-6">
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <Search size={14} /> Team Members
                                                    </h4>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-3 p-2 bg-blue-50/50 rounded-lg border border-blue-100">
                                                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">L</div>
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-800">{leader.name} ({leader.rollNumber})</p>
                                                            </div>
                                                        </div>
                                                        {otherMembers.map(m => (
                                                            <div key={m.user.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                                                <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs font-bold">M</div>
                                                                <div>
                                                                    <p className="text-sm font-medium text-gray-700">{m.user.name} ({m.user.rollNumber})</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <MessageSquare size={14} /> Review History
                                                    </h4>
                                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                        {(() => {
                                                            if (!team.reviews || team.reviews.length === 0) {
                                                                return <div className="text-sm text-gray-400 italic text-center py-8 bg-gray-50 rounded-xl border border-dashed">No reviews added yet.</div>;
                                                            }

                                                            // Group reviews by phase
                                                            const reviewsByPhase = team.reviews.reduce((acc, r) => {
                                                                const phase = r.reviewPhase || 0;
                                                                if (!acc[phase]) acc[phase] = [];
                                                                acc[phase].push(r);
                                                                return acc;
                                                            }, {});

                                                            // Sort phases descending
                                                            const phases = Object.keys(reviewsByPhase).sort((a, b) => b - a);

                                                            return phases.map(phase => {
                                                                const phaseReviews = [...reviewsByPhase[phase]].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                                                                const latestReview = phaseReviews[phaseReviews.length - 1];
                                                                const status = latestReview.status;

                                                                return (
                                                                    <div key={phase} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                                                                        <div className="px-4 py-2 bg-white border-b border-gray-100 flex justify-between items-center">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-[10px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase">
                                                                                    {phase === "0" ? "Initial" : `Phase ${phase}`}
                                                                                </span>
                                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${status === 'COMPLETED' ? 'bg-green-100 text-green-700' : status === 'CHANGES_REQUIRED' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                                    {status?.replace('_', ' ')}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="divide-y divide-gray-100/50">
                                                                            {phaseReviews.map((r, idx) => (
                                                                                <div key={r.id} className="p-4 relative hover:bg-white transition-colors group">
                                                                                    {phaseReviews.length > 1 && idx < phaseReviews.length - 1 && (
                                                                                        <div className="absolute left-6 top-10 bottom-0 w-0.5 bg-gray-200/50 z-0" />
                                                                                    )}

                                                                                    <div className="flex gap-3 relative z-10">
                                                                                        <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${r.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : r.status === 'CHANGES_REQUIRED' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                                            {idx + 1}
                                                                                        </div>

                                                                                        <div className="flex-1 min-w-0">
                                                                                            <div className="flex justify-between items-start mb-1">
                                                                                                <div className="flex-1 min-w-0">
                                                                                                    <p className="text-xs font-bold text-gray-800 truncate flex items-center gap-1.5">
                                                                                                        {r.faculty?.name || "Admin"}
                                                                                                        {r.faculty?.rollNumber && <span className="opacity-40 font-mono text-[9px]">({r.faculty.rollNumber})</span>}

                                                                                                        {team.guideId === r.facultyId && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 uppercase font-black tracking-wide">Guide</span>}
                                                                                                        {team.subjectExpertId === r.facultyId && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 uppercase font-black tracking-wide">Expert</span>}
                                                                                                    </p>
                                                                                                    <span className="text-[9px] text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                                                                                                </div>
                                                                                                <button
                                                                                                    onClick={() => handleDeleteReview(r.id)}
                                                                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                                                    title="Delete Review"
                                                                                                >
                                                                                                    <Trash2 size={14} />
                                                                                                </button>
                                                                                            </div>

                                                                                            {/* Individual Marks Display */}
                                                                                            {r.reviewMarks && r.reviewMarks.length > 0 && (
                                                                                                <div className="mb-2 flex flex-wrap gap-1.5">
                                                                                                    {r.reviewMarks.map((mark, i) => {
                                                                                                        const studentName = team.members.find(m => m.userId === mark.studentId)?.user.name.split(' ')[0] || "Student";
                                                                                                        let tooltip = "";
                                                                                                        let totalScale = "";
                                                                                                        if (mark.criterionMarks) {
                                                                                                            try {
                                                                                                                const cm = JSON.parse(mark.criterionMarks);
                                                                                                                if (cm._total) {
                                                                                                                    totalScale = ` / ${cm._total}`;
                                                                                                                    tooltip = Object.entries(cm)
                                                                                                                        .filter(([name]) => name !== '_total')
                                                                                                                        .map(([name, data]) => `${name}: ${data.score}/${data.max}`)
                                                                                                                        .join('\n');
                                                                                                                } else {
                                                                                                                    tooltip = Object.entries(cm).map(([name, val]) => `${name}: ${val}`).join('\n');
                                                                                                                }
                                                                                                            } catch (e) { }
                                                                                                        }
                                                                                                        return (
                                                                                                            <span key={i} title={tooltip} className={`text-[9px] bg-white text-green-600 px-1.5 py-0.5 rounded border border-green-100 font-bold ${tooltip ? 'cursor-help underline decoration-dotted' : ''}`}>
                                                                                                                {studentName}: <span className="text-blue-600">{mark.marks}{totalScale}</span>
                                                                                                            </span>
                                                                                                        );
                                                                                                    })}
                                                                                                </div>
                                                                                            )}

                                                                                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap mb-2">
                                                                                                {r.content}
                                                                                            </p>

                                                                                            {(r.resubmittedAt || (r.completedAt && r.status === 'COMPLETED')) && (
                                                                                                <div className="flex flex-wrap gap-3 items-center">
                                                                                                    {r.resubmittedAt && (
                                                                                                        <div className="flex flex-col">
                                                                                                            <span className="text-[8px] font-black text-blue-400 uppercase">Resubmitted</span>
                                                                                                            <span className="text-[10px] font-bold text-blue-600 truncate border-l-2 border-blue-200 pl-1">
                                                                                                                {new Date(r.resubmittedAt).toLocaleDateString()}
                                                                                                                {r.resubmissionNote && <span className="font-normal text-gray-400 ml-1 italic" title={r.resubmissionNote}>"{r.resubmissionNote}"</span>}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                    )}
                                                                                                    {r.completedAt && r.status === 'COMPLETED' && (
                                                                                                        <div className="flex flex-col">
                                                                                                            <span className="text-[8px] font-black text-green-400 uppercase">Completed</span>
                                                                                                            <span className="text-[10px] font-bold text-green-600 border-l-2 border-green-200 pl-1">{new Date(r.completedAt).toLocaleDateString()}</span>
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right Side: Review Form */}
                                            <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 space-y-4">
                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <CheckCircle size={14} /> Submit New Review
                                                </h4>

                                                {/* Previous Feedback / Resubmission Note Callout */}
                                                {(() => {
                                                    const reviews = [...(team.reviews || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                                                    const latestWithNote = reviews.find(r => r.resubmissionNote || r.status === 'CHANGES_REQUIRED');

                                                    if (team.status === 'READY_FOR_REVIEW' && latestWithNote) {
                                                        return (
                                                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
                                                                <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                                                                    <AlertCircle size={14} /> Resubmission Feedback context
                                                                </div>

                                                                {latestWithNote.content && (
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center gap-2 text-amber-800 font-bold text-[10px] uppercase tracking-wider mb-1">
                                                                            <AlertCircle size={12} /> Faculty Instructions (Changes Required)
                                                                        </div>
                                                                        <p className="text-xs text-amber-900 bg-white/50 p-2 rounded border border-amber-100/50 italic">
                                                                            "{latestWithNote.content}"
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {latestWithNote.resubmissionNote && (
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center gap-2 text-blue-800 font-bold text-xs uppercase tracking-wider mb-2">
                                                                            <MessageSquare size={14} /> Student Resubmission Note
                                                                        </div>
                                                                        <p className="text-sm text-blue-900 bg-blue-50/50 p-3 rounded-lg border border-blue-100/50 font-bold">
                                                                            "{latestWithNote.resubmissionNote}"
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}

                                                <div>
                                                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Update Project Status</label>
                                                    <select
                                                        className="w-full border-gray-200 border p-2.5 text-sm rounded-lg bg-white focus:ring-2 ring-blue-500 outline-none transition-all shadow-sm"
                                                        value={reviewStatus}
                                                        onChange={e => setReviewStatus(e.target.value)}
                                                        disabled={!team.members?.filter(m => m.approved).some(m => isPresentState[m.user.id])}
                                                    >
                                                        <option value="NOT_COMPLETED">Not Completed</option>
                                                        <option value="IN_PROGRESS">In Progress</option>
                                                        <option value="CHANGES_REQUIRED">Changes Required</option>
                                                        <option value="READY_FOR_REVIEW">Ready for Review (Student Submited)</option>
                                                        <option value="COMPLETED">Completed</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Review Phase</label>
                                                    <select
                                                        className="w-full border-gray-200 border p-2.5 text-sm rounded-lg bg-white focus:ring-2 ring-blue-500 outline-none transition-all shadow-sm"
                                                        value={reviewPhase}
                                                        onChange={e => handlePhaseChange(e.target.value, team)}
                                                    >
                                                        <option value="1">Phase 1</option>
                                                        <option value="2">Phase 2</option>
                                                        <option value="3">Phase 3</option>
                                                        <option value="4">Phase 4</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">
                                                        Individual Marks {rubric ? <span className="text-blue-600">(Rubric: {rubric.totalMarks} Max)</span> : "(0-100)"}
                                                    </label>
                                                    <div className="space-y-4 bg-white border border-gray-100 rounded-lg p-3">
                                                        {rubric ? (
                                                            team.members.filter(m => m.approved).map(m => {
                                                                const criteria = JSON.parse(rubric.criteria);
                                                                const currentStudentMarks = rubricMarks[m.user.id] || {};
                                                                const currentTotal = Object.values(currentStudentMarks).reduce((a, b) => a + (parseInt(b) || 0), 0);

                                                                return (
                                                                    <div key={m.user.id} className={`bg-gray-50 p-3 rounded-lg border ${!isPresentState[m.user.id] ? 'border-gray-200 opacity-60' : 'border-blue-200 bg-blue-50/10'}`}>
                                                                        <div className="flex justify-between items-center mb-2 border-b border-gray-200 pb-1">
                                                                            <div className="flex items-center gap-3">
                                                                                <span className="font-bold text-sm text-gray-800">{m.user.name}</span>
                                                                                <label className="flex items-center gap-1 cursor-pointer">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={!!isPresentState[m.user.id]}
                                                                                        onChange={e => {
                                                                                            const isP = e.target.checked;
                                                                                            setIsPresentState(prev => ({ ...prev, [m.user.id]: isP }));
                                                                                            if (!isP) {
                                                                                                setIndividualMarks(prev => ({ ...prev, [m.user.id]: 0 }));
                                                                                                setRubricMarks(prev => ({ ...prev, [m.user.id]: {} }));
                                                                                            }
                                                                                        }}
                                                                                        className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                                                    />
                                                                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${isPresentState[m.user.id] ? 'text-blue-600' : 'text-gray-400'}`}>Present</span>
                                                                                </label>
                                                                            </div>
                                                                            <span className="font-mono font-bold text-blue-600">{currentTotal} / {rubric.totalMarks}</span>
                                                                        </div>
                                                                        <div className={`space-y-2 transition-opacity duration-200 ${!isPresentState[m.user.id] ? 'opacity-30 pointer-events-none' : ''}`}>
                                                                            {criteria.map((c, idx) => (
                                                                                <div key={idx} className="flex justify-between items-center text-xs">
                                                                                    <span className="text-gray-600 flex-1">{c.name} <span className="text-[10px] text-gray-400">({c.maxMarks})</span></span>
                                                                                    <input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        max={c.maxMarks}
                                                                                        placeholder="0"
                                                                                        className="w-14 p-1 border rounded text-right bg-white focus:ring-1 ring-blue-500 outline-none"
                                                                                        value={currentStudentMarks[c.name] || ''}
                                                                                        onChange={e => {
                                                                                            const val = Math.min(parseInt(e.target.value) || 0, c.maxMarks);
                                                                                            const newRubricMarks = { ...rubricMarks };
                                                                                            if (!newRubricMarks[m.user.id]) newRubricMarks[m.user.id] = {};
                                                                                            newRubricMarks[m.user.id][c.name] = val;
                                                                                            setRubricMarks(newRubricMarks);

                                                                                            // Update Total
                                                                                            const newTotal = Object.values(newRubricMarks[m.user.id]).reduce((a, b) => a + (parseInt(b) || 0), 0);
                                                                                            setIndividualMarks(prev => ({ ...prev, [m.user.id]: newTotal }));
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            <div className="space-y-3">
                                                                <div className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 mb-2 font-medium">
                                                                    No rubric found for this category & phase. Using manual marking (Max 100).
                                                                </div>
                                                                {team.members
                                                                    ?.filter(m => m.approved)
                                                                    .map(member => (
                                                                        <div key={member.user?.id} className={`flex items-center justify-between gap-4 p-2 rounded-lg transition-all ${isPresentState[member.user?.id] ? 'bg-blue-50 border border-blue-100' : ''}`}>
                                                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                                <span className="text-sm font-medium text-gray-700 truncate" title={member.user?.name}>{member.user?.name}</span>
                                                                                <label className="flex items-center gap-1 cursor-pointer shrink-0">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={!!isPresentState[member.user?.id]}
                                                                                        onChange={e => {
                                                                                            const isP = e.target.checked;
                                                                                            setIsPresentState(prev => ({ ...prev, [member.user?.id]: isP }));
                                                                                            if (!isP) setIndividualMarks(prev => ({ ...prev, [member.user?.id]: 0 }));
                                                                                        }}
                                                                                        className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                                                    />
                                                                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${isPresentState[member.user?.id] ? 'text-blue-600' : 'text-gray-400'}`}>Present</span>
                                                                                </label>
                                                                            </div>
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                max="100"
                                                                                placeholder="-"
                                                                                value={individualMarks[member.user?.id] || ""}
                                                                                disabled={!isPresentState[member.user?.id]}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value;
                                                                                    setIndividualMarks(prev => ({
                                                                                        ...prev,
                                                                                        [member.user?.id]: val
                                                                                    }));
                                                                                }}
                                                                                className={`w-20 text-sm p-2 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none ${!isPresentState[member.user?.id] ? 'opacity-30' : ''}`}
                                                                            />
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Admin Feedback (Optional)</label>
                                                    <textarea
                                                        className="w-full border-gray-200 border p-3 text-sm rounded-lg focus:ring-2 ring-blue-500 outline-none resize-none bg-white shadow-sm"
                                                        rows={5}
                                                        placeholder="Provide administrative feedback or guidance..."
                                                        value={reviewText}
                                                        onChange={e => setReviewText(e.target.value)}
                                                        disabled={!team.members?.filter(m => m.approved).some(m => isPresentState[m.user.id])}
                                                    ></textarea>
                                                </div>

                                                <div className="flex gap-3 pt-2">
                                                    <button
                                                        onClick={(e) => submitReview(e, team.id, team.projectId)}
                                                        className="flex-1 bg-blue-600 text-white text-sm py-3 rounded-lg hover:bg-blue-700 font-bold transition-all shadow-md active:scale-95"
                                                    >
                                                        Submit Review
                                                    </button>
                                                    <button
                                                        onClick={() => setExpandedTeamId(null)}
                                                        className="px-6 bg-white border border-gray-200 text-gray-600 text-sm py-3 rounded-lg hover:bg-gray-50 font-bold transition-all active:scale-95"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination UI */}
            {!isLoading && pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 pt-4">
                    <button
                        disabled={pagination.page === 1}
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        className="p-2 rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-gray-400 transition-all shadow-sm"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <div className="flex items-center gap-2">
                        {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => {
                            // Basic logic for showing only few page numbers
                            if (p === 1 || p === pagination.totalPages || (p >= pagination.page - 1 && p <= pagination.page + 1)) {
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setPagination(prev => ({ ...prev, page: p }))}
                                        className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${pagination.page === p
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                                            : 'bg-white border border-gray-200 text-gray-500 hover:border-indigo-400'
                                            }`}
                                    >
                                        {p}
                                    </button>
                                );
                            }
                            if (p === pagination.page - 2 || p === pagination.page + 2) return <span key={p} className="text-gray-300">...</span>;
                            return null;
                        })}
                    </div>
                    <button
                        disabled={pagination.page === pagination.totalPages}
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        className="p-2 rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-gray-400 transition-all shadow-sm"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                </div>
            )}
        </div>
    );
}
