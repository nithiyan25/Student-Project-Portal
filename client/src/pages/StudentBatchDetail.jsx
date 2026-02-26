import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { Users, CheckCircle, MessageSquare, Search, ArrowLeft, XCircle, Check, AlertCircle, Clock, MapPin, Layout, History, Timer, Calendar, ChevronDown, Rocket, Video, Building2, ArrowRight } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import BatchTimer from '../components/student/BatchTimer';

export default function StudentBatchDetail() {
    const { scopeId } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [scope, setScope] = useState(null);
    const [myTeam, setMyTeam] = useState(null);
    const [projects, setProjects] = useState([]);
    const [facultyList, setFacultyList] = useState([]);
    const [rubrics, setRubrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('current');
    const [, setTick] = useState(0);

    // Live countdown ticker for CHANGES_REQUIRED timer
    useEffect(() => {
        if (myTeam?.status !== 'CHANGES_REQUIRED') return;
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [myTeam?.status]);

    // Interaction State
    const [inviteEmail, setInviteEmail] = useState('');
    const [selectedGuideId, setSelectedGuideId] = useState('');
    const [selectedExpertId, setSelectedExpertId] = useState('');
    const [projectSearch, setProjectSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');

    const { addToast } = useToast();
    const { confirm } = useConfirm();

    // Modal State
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [resubmissionNote, setResubmissionNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const [teamsRes, pRes, scopeRes] = await Promise.all([
                api.get('/teams/my-teams').catch(() => ({ data: [] })),
                api.get('/projects', { params: { status: 'AVAILABLE', limit: 1000 } }),
                api.get('/scopes/my-scopes').catch(() => ({ data: [] }))
            ]);

            const foundScope = scopeRes.data.find(s => s.id === scopeId);
            if (!foundScope) {
                addToast("Batch not found or access denied.", 'error');
                navigate('/student');
                return;
            }
            setScope(foundScope);

            const foundTeam = teamsRes.data.find(t => t.scopeId === scopeId);
            setMyTeam(foundTeam || null);

            // Filter projects for this scope
            const allProjects = pRes.data.projects || pRes.data || [];
            setProjects(allProjects.filter(p => p.scopeId === scopeId));

            // If guide/expert needed, fetch faculty (with batch context for limits)
            if (foundScope.requireGuide || foundScope.requireSubjectExpert) {
                const fRes = await api.get('/users/faculty-list', { params: { scopeId } });
                setFacultyList(fRes.data.users || []);
            }

            // Fetch rubrics if project is assigned
            if (foundTeam?.project?.category) {
                const rRes = await api.get('/rubrics', { params: { category: foundTeam.project.category } });
                setRubrics(rRes.data || []);
            }
        } catch (e) {
            console.error('Error loading batch details:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // Background polling for live updates (60 seconds)
        // Pause polling if the submission modal is open to avoid UI flicker/overwriting
        const interval = setInterval(() => {
            if (!isSubmitModalOpen) {
                loadData();
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [scopeId, isSubmitModalOpen]);

    // --- ACTIONS ---



    const invite = async () => {
        if (!inviteEmail || !myTeam) return;
        try {
            await api.post('/teams/invite', { email: inviteEmail, teamId: myTeam.id });
            setInviteEmail('');
            loadData();
            addToast('Invitation sent successfully', 'success');
        } catch (e) {
            addToast(e.response?.data?.error || "Error sending invitation", 'error');
        }
    };

    const handleAcceptInvite = async () => {
        if (!myTeam) return;
        try {
            await api.post('/teams/accept', { teamId: myTeam.id });
            loadData();
            addToast('Invitation accepted successfully', 'success');
        } catch (e) {
            addToast(e.response?.data?.error || "Error accepting invitation", 'error');
        }
    };

    const handleRejectInvite = async () => {
        if (!myTeam) return;
        if (!await confirm("Are you sure you want to reject this invitation?", 'Reject Invitation', 'warning')) return;
        try {
            await api.post('/teams/reject', { teamId: myTeam.id });
            setMyTeam(null);
            loadData();
            addToast('Invitation rejected', 'info');
        } catch (e) {
            addToast(e.response?.data?.error || "Error rejecting invitation", 'error');
        }
    };

    const selectProject = async (projectId, projectTitle) => {
        if (!myTeam) {
            if (!await confirm(`Select "${projectTitle}"? A new team will be created for you.`, 'Confirm Selection')) return;
        } else {
            if (!await confirm(`Request "${projectTitle}" for your team?`, 'Confirm Selection')) return;
        }

        try {
            let teamIdToUse = myTeam?.id;
            if (!teamIdToUse) {
                const teamRes = await api.post('/teams', { scopeId });
                teamIdToUse = teamRes.data.id;
            }
            await api.post('/teams/select-project', { projectId, teamId: teamIdToUse });
            loadData();
            addToast('Project selected successfully', 'success');
        } catch (e) {
            addToast(e.response?.data?.error || "Error selecting project", 'error');
        }
    };

    const handleSelectGuide = async () => {
        if (!selectedGuideId || !myTeam) return;
        try {
            await api.post('/teams/select-guide', { guideId: selectedGuideId, teamId: myTeam.id });
            loadData();
            addToast('Guide assigned successfully', 'success');
        } catch (e) {
            addToast(e.response?.data?.error || "Error selecting guide", 'error');
        }
    };

    const handleSelectExpert = async () => {
        if (!selectedExpertId || !myTeam) return;
        try {
            await api.post('/teams/select-expert', { expertId: selectedExpertId, teamId: myTeam.id });
            loadData();
            addToast('Expert assigned successfully', 'success');
        } catch (e) {
            addToast(e.response?.data?.error || "Error selecting expert", 'error');
        }
    };

    const handleSubmitForReview = () => {
        if (!myTeam) return;
        setResubmissionNote('');
        setIsSubmitModalOpen(true);
    };

    const confirmSubmitReview = async () => {
        try {
            setIsSubmitting(true);
            await api.post('/teams/submit-for-review', { resubmissionNote, teamId: myTeam.id });
            addToast('Project submitted for review successfully', 'success');
            setIsSubmitModalOpen(false);
            loadData();
        } catch (e) {
            addToast(e.response?.data?.error || "Error submitting for review", 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMarkAsRead = async (requestId) => {
        try {
            await api.post('/teams/mark-project-request-read', { requestId });
            loadData();
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-400">Loading...</div>;
    if (!scope) return null;

    const scopeRequest = myTeam?.projectRequests?.[0];
    const scopeMe = myTeam?.members?.find(m => m.userId === user?.id);
    const isPending = scopeMe && !scopeMe.approved;

    const now = new Date();
    const assignedFaculty = myTeam?.project?.assignedFaculty || [];
    // Determine the relevant deadlines (Team Group > Scope Default Group > Scope direct deadlines)
    const effectiveDeadlines = myTeam?.scope?.deadlines || scope.deadlines || [];


    const passedPhases = new Set([
        ...(myTeam?.reviews || []).filter(r => r.status && r.status !== 'PENDING').map(r => r.reviewPhase),
        ...assignedFaculty
            .filter(a => a.accessExpiresAt && new Date(a.accessExpiresAt) < now)
            .map(a => a.reviewPhase),
        ...effectiveDeadlines
            .filter(d => new Date(d.deadline) < now)
            .map(d => d.phase)
    ]);

    const highestPassedPhase = Math.max(0, ...Array.from(passedPhases));
    const reviewedPhaseSet = new Set(
        (myTeam?.reviews || []).filter(r => r.status === 'COMPLETED' || r.status === 'NOT_COMPLETED').map(r => r.reviewPhase)
    );
    const activeAssignment = assignedFaculty.find(a => {
        if (!a.accessExpiresAt) return false;
        if (reviewedPhaseSet.has(a.reviewPhase)) return false; // Skip completed or missed phases
        return new Date(a.accessExpiresAt) > now;
    });
    const currentPhase = activeAssignment?.reviewPhase || (highestPassedPhase + 1);

    const currentPhaseDeadline = effectiveDeadlines.find(d => d.phase === currentPhase);
    const deadlineDate = currentPhaseDeadline ? new Date(currentPhaseDeadline.deadline) : null;
    const isUrgent = deadlineDate && (deadlineDate - now) < (48 * 60 * 60 * 1000); // 48 hours
    const isPassed = deadlineDate && deadlineDate < now;

    const uniqueCategories = ['ALL', ...new Set(projects.map(p => p.category).filter(Boolean))];
    const filteredProjects = projects.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(projectSearch.toLowerCase());
        const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar variant="light" compact />

            {/* Deadline Banner */}
            {deadlineDate && (
                <div className={`sticky top-0 z-40 border-b text-sm ${isPassed
                    ? 'bg-red-600 border-red-700 text-white'
                    : isUrgent
                        ? 'bg-amber-500 border-amber-600 text-white'
                        : 'bg-white border-gray-200 text-gray-700'
                    }`}>
                    <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Calendar size={14} />
                            <span className="font-medium">
                                Phase {currentPhase} — {deadlineDate.toLocaleDateString([], { dateStyle: 'medium' })} at {deadlineDate.toLocaleTimeString([], { timeStyle: 'short' })}
                            </span>
                        </div>
                        <span className="text-xs font-medium flex items-center gap-1.5">
                            <Clock size={12} />
                            {isPassed ? 'Passed' : (() => {
                                const diff = deadlineDate - now;
                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                return days > 0 ? `${days}d ${hours}h left` : `${hours}h ${mins}m left`;
                            })()}
                        </span>
                    </div>
                </div>
            )}

            <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">

                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/student')}
                            className="h-10 w-10 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors shrink-0"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">{scope.name}</h1>
                            {scope.description && <p className="text-sm text-gray-500 mt-0.5">{scope.description}</p>}
                        </div>
                    </div>

                    <BatchTimer scope={scope} />
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* LEFT COLUMN: Team & Project Status */}
                    {myTeam ? (
                        <div className="lg:col-span-2 space-y-6">
                            {(() => {
                                const completedReviews = myTeam?.reviews?.filter(r => r.status === 'COMPLETED') || [];

                                // Reviews are available — backend strips marks if not authorized


                                const myScores = completedReviews
                                    .map(r => {
                                        const mark = r.reviewMarks?.find(m => m.studentId === user?.id);
                                        if (!mark) return null;

                                        let totalScale = "";
                                        let maxMark = 0;
                                        if (mark.criterionMarks) {
                                            try {
                                                const cm = JSON.parse(mark.criterionMarks);
                                                if (cm._total) {
                                                    totalScale = ` / ${cm._total}`;
                                                    maxMark = cm._total;
                                                }
                                            } catch (e) { }
                                        }

                                        return { phase: r.reviewPhase, marks: mark.marks, scale: totalScale, max: maxMark };
                                    })
                                    .filter(Boolean)
                                    .sort((a, b) => a.phase - b.phase);

                                if (myScores.length === 0) return null;

                                // Calculate cumulative average percentage
                                const totalScored = myScores.reduce((acc, s) => acc + s.marks, 0);
                                const totalPossible = myScores.reduce((acc, s) => acc + (s.max || 100), 0); // Logic: default to 100 if no rubric
                                const avgPercentage = ((totalScored / totalPossible) * 100).toFixed(1);

                                return (
                                    <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
                                        <div className="flex justify-between items-center mb-5">
                                            <div className="flex items-center gap-2.5">
                                                <CheckCircle size={18} className="text-green-600" />
                                                <h2 className="text-base font-semibold text-gray-900">Performance Summary</h2>
                                            </div>
                                            <span className="text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                                                Published
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                            <div className="p-4 bg-gray-900 rounded-lg col-span-2 lg:col-span-1">
                                                <p className="text-xs text-gray-400 mb-1">Average</p>
                                                <p className="text-2xl font-bold text-white">
                                                    {avgPercentage}<span className="text-sm text-gray-400 ml-0.5">%</span>
                                                </p>
                                            </div>

                                            {myScores.map((s, i) => (
                                                <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors">
                                                    <p className="text-xs text-gray-500 mb-1">Phase {s.phase}</p>
                                                    <p className="text-xl font-bold text-gray-900">
                                                        {s.marks}<span className="text-sm text-gray-400 ml-0.5">{s.scale}</span>
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className={`bg-white p-6 rounded-lg border ${isPending ? 'border-amber-300' : 'border-gray-200'}`}>
                                <div className="flex justify-between items-center mb-5">
                                    <div className="flex items-center gap-2.5">
                                        <Users size={18} className="text-blue-600" />
                                        <h2 className="text-base font-semibold text-gray-900">Your Team</h2>
                                    </div>
                                    <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-blue-50 text-blue-600 border-blue-200">
                                        {myTeam.status.replace('_', ' ')}
                                    </span>
                                </div>

                                {/* INVITATION BANNER */}
                                {isPending && (
                                    <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200 flex flex-col md:flex-row items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <Check size={18} className="text-amber-600" />
                                            <div>
                                                <h3 className="font-semibold text-gray-900">You've been invited!</h3>
                                                <p className="text-sm text-gray-500">Accept to join your teammates.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <button
                                                onClick={handleRejectInvite}
                                                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                                            >
                                                <XCircle size={14} /> Reject
                                            </button>
                                            <button
                                                onClick={handleAcceptInvite}
                                                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                                            >
                                                <Check size={14} /> Accept
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className={`space-y-6 ${isPending ? 'opacity-50 pointer-events-none grayscale-[0.5]' : ''}`}>
                                    {/* Member List */}
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 mb-3">Members</p>
                                        <div className="flex flex-wrap gap-2">
                                            {myTeam.members.map(m => (
                                                <div
                                                    key={m.id}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${m.userId === user?.id
                                                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                                                        : 'bg-white border-gray-200 text-gray-700'
                                                        }`}
                                                >
                                                    <div className={`w-2 h-2 rounded-full ${m.approved ? 'bg-green-500' : 'bg-yellow-400'}`}></div>
                                                    <span className="font-medium">
                                                        {m.user?.name} {m.userId === user?.id && <span className="text-gray-400">(You)</span>}
                                                    </span>
                                                    {m.isLeader && (
                                                        <span className="text-xs text-blue-600 font-medium">Leader</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Invites Logic - Refined */}
                                    {scopeMe?.isLeader && !myTeam.project && (
                                        <div className="flex gap-2">
                                            <div className="flex items-center text-gray-400 pl-3">
                                                <Users size={15} />
                                            </div>
                                            <input
                                                className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 outline-none text-sm placeholder:text-gray-400 focus:border-blue-400 transition-colors"
                                                placeholder="Invite by email..."
                                                value={inviteEmail}
                                                onChange={e => setInviteEmail(e.target.value)}
                                            />
                                            <button
                                                onClick={invite}
                                                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                                            >
                                                Invite
                                            </button>
                                        </div>
                                    )}

                                    {/* STEP 1: Current Project Status */}
                                    {myTeam.project ? (
                                        <div className="p-5 bg-white rounded-lg border-l-4 border-l-blue-600 border border-gray-200">
                                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <span>{myTeam.project.category}</span>
                                                        <span>·</span>
                                                        <span>Phase {currentPhase}</span>
                                                    </div>
                                                    <h3 className="text-lg font-semibold text-gray-900">{myTeam.project.title}</h3>
                                                    {myTeam.project.description && (
                                                        <p className="text-sm text-gray-500 max-w-2xl">{myTeam.project.description}</p>
                                                    )}

                                                    {(myTeam.project.techStack || myTeam.project.srs) && (
                                                        <div className="flex flex-wrap gap-3 pt-1">
                                                            {myTeam.project.techStack && (
                                                                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md border border-gray-200">
                                                                    {myTeam.project.techStack}
                                                                </span>
                                                            )}
                                                            {myTeam.project.srs && (
                                                                <a
                                                                    href={myTeam.project.srs}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                                                >
                                                                    View SRS <ArrowRight size={12} />
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : scopeRequest ? (
                                        <div className={`p-6 rounded-lg border-2 shadow-sm ${scopeRequest.status === 'PENDING' ? 'bg-orange-50 border-orange-100' : 'bg-red-50 border-red-100'}`}>
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="text-lg font-bold text-gray-800">Selection Status</h3>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${scopeRequest.status === 'PENDING' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                                    {scopeRequest.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-700 font-bold mb-1">Project: {scopeRequest.project?.title}</p>
                                            <p className="text-xs text-gray-500">
                                                {scopeRequest.status === 'PENDING' ? 'Awaiting administrator approval.' : 'Rejected. Please select another.'}
                                            </p>
                                            {scopeRequest.status === 'REJECTED' && (
                                                <button onClick={() => handleMarkAsRead(scopeRequest.id)} className="mt-4 text-[10px] font-bold text-blue-600 hover:underline">Mark as read and retry</button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-6 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-center">
                                            <p className="text-sm text-gray-400 font-bold">Step 1: Select a Project from the list.</p>
                                        </div>
                                    )}

                                    {myTeam.project && (
                                        <div className="flex bg-gray-100 p-1 rounded-lg mt-4">
                                            <button
                                                onClick={() => setActiveTab('current')}
                                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'current'
                                                    ? 'bg-white text-gray-900 shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700'
                                                    }`}
                                            >
                                                <Layout size={14} /> Overview
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('history')}
                                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'history'
                                                    ? 'bg-white text-gray-900 shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700'
                                                    }`}
                                            >
                                                <Clock size={14} /> History
                                            </button>
                                        </div>
                                    )}

                                    {/* ── CURRENT TAB ── */}
                                    {activeTab === 'current' && (
                                        <>
                                            {/* Phase Deadline Banner - Modernized */}
                                            {deadlineDate && (
                                                <div className={`mt-4 p-4 rounded-lg border flex flex-col md:flex-row items-center justify-between gap-4 ${isPassed
                                                    ? 'bg-red-50 border-red-200'
                                                    : isUrgent
                                                        ? 'bg-amber-50 border-amber-200'
                                                        : 'bg-gray-50 border-gray-200'
                                                    }`}>
                                                    <div className="flex items-center gap-3">
                                                        <Calendar size={16} className={isPassed ? 'text-red-500' : isUrgent ? 'text-amber-600' : 'text-blue-600'} />
                                                        <div>
                                                            <p className={`text-sm font-medium ${isPassed ? 'text-red-800' : isUrgent ? 'text-amber-800' : 'text-gray-800'}`}>
                                                                Phase {currentPhase} — {deadlineDate.toLocaleDateString([], { dateStyle: 'long' })}
                                                                <span className="text-gray-400 ml-2 font-normal">
                                                                    {deadlineDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </p>
                                                            <p className={`text-xs mt-0.5 ${isPassed ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-gray-500'}`}>
                                                                {isPassed ? 'Deadline passed.' : isUrgent ? 'Deadline approaching.' : 'Ensure deliverables are ready.'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {!isPassed && (
                                                        <span className={`text-lg font-bold tabular-nums ${isUrgent ? 'text-amber-700' : 'text-gray-700'}`}>
                                                            {(() => {
                                                                const diff = deadlineDate - now;
                                                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                                                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                                                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                                return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                                                            })()}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Upcoming Review Schedule - Handcrafted Cards */}
                                            {assignedFaculty.length > 0 && (() => {
                                                const upcomingAssignments = assignedFaculty.filter(a => {
                                                    if (!a.accessExpiresAt) return true;
                                                    return new Date(a.accessExpiresAt) > now;
                                                });
                                                if (upcomingAssignments.length === 0) return null;
                                                return (
                                                    <div className="mt-8 space-y-4">
                                                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Upcoming Evaluations</h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {upcomingAssignments.map(assignment => (
                                                                <div key={assignment.id} className="p-4 bg-white border border-gray-200 rounded-lg flex items-center gap-4 hover:border-blue-300 transition-colors">
                                                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${assignment.mode === 'ONLINE' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-400'}`}>
                                                                        {assignment.mode === 'ONLINE' ? <Video size={20} /> : <MapPin size={20} />}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm font-semibold text-gray-900 truncate">{assignment.faculty?.name || "Reviewer Assigned"}</p>
                                                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                                                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-medium border border-blue-100">Phase {assignment.reviewPhase || 1}</span>
                                                                            <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${assignment.mode === 'ONLINE' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                                                {assignment.mode}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-xs text-gray-500 mt-1">
                                                                            {assignment.accessStartsAt ? new Date(assignment.accessStartsAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Today'}
                                                                            <span className="mx-1">·</span>
                                                                            {assignment.accessStartsAt ? new Date(assignment.accessStartsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                            {/* STEP 2 & 3: Faculty Assignment - Handcrafted Grid */}
                                            {myTeam.project && (scope.requireGuide || scope.requireSubjectExpert) && (
                                                <div className="grid md:grid-cols-2 gap-4 pt-6 border-t border-gray-100 mt-8">
                                                    {scope.requireGuide && (
                                                        <div className={`p-4 rounded-lg border ${myTeam.guide ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 border-dashed'}`}>
                                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Project Mentor</p>

                                                            {myTeam.guide && myTeam.guideStatus !== 'REJECTED' ? (
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold">{myTeam.guide.name[0]}</div>
                                                                        <div>
                                                                            <div className="text-sm font-semibold text-gray-900">{myTeam.guide.name}</div>
                                                                            <div className="text-xs text-gray-500">Mentor</div>
                                                                        </div>
                                                                    </div>
                                                                    <span className={`text-[10px] px-2 py-1 rounded font-semibold uppercase tracking-wider ${myTeam.guideStatus === 'APPROVED' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                                                        {myTeam.guideStatus}
                                                                    </span>
                                                                </div>
                                                            ) : scopeMe?.isLeader && (
                                                                <div className="space-y-3">
                                                                    {myTeam.guideStatus === 'REJECTED' && (
                                                                        <p className="text-xs text-red-600 font-medium">Mentor rejected request. Please select another.</p>
                                                                    )}
                                                                    <select className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 transition-colors" value={selectedGuideId} onChange={e => setSelectedGuideId(e.target.value)}>
                                                                        <option value="">Select Mentor...</option>
                                                                        {facultyList
                                                                            .filter(f => f.isGuide && (f.batchOccupancy ?? 0) < 4)
                                                                            .map(f => <option key={f.id} value={f.id}>{f.name} ({4 - (f.batchOccupancy || 0)} slots left)</option>)
                                                                        }
                                                                    </select>
                                                                    <button onClick={handleSelectGuide} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Assign Mentor</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {scope.requireSubjectExpert && (
                                                        <div className={`p-4 rounded-lg border ${myTeam.subjectExpert ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 border-dashed'} ${(!scope.requireGuide || myTeam.guide) ? '' : 'opacity-40 grayscale pointer-events-none'}`}>
                                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Subject Expert</p>

                                                            {myTeam.subjectExpert && myTeam.expertStatus !== 'REJECTED' ? (
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 bg-purple-100 text-purple-700 rounded-lg flex items-center justify-center font-bold">{myTeam.subjectExpert.name[0]}</div>
                                                                        <div>
                                                                            <div className="text-sm font-semibold text-gray-900">{myTeam.subjectExpert.name}</div>
                                                                            <div className="text-xs text-gray-500">Academic Expert</div>
                                                                        </div>
                                                                    </div>
                                                                    <span className={`text-[10px] px-2 py-1 rounded font-semibold uppercase tracking-wider ${myTeam.expertStatus === 'APPROVED' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                                                        {myTeam.expertStatus}
                                                                    </span>
                                                                </div>
                                                            ) : scopeMe?.isLeader && (
                                                                <div className="space-y-3">
                                                                    {myTeam.expertStatus === 'REJECTED' && (
                                                                        <p className="text-xs text-red-600 font-medium">Expert rejected request. Please select another.</p>
                                                                    )}
                                                                    <select className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 transition-colors" value={selectedExpertId} onChange={e => setSelectedExpertId(e.target.value)}>
                                                                        <option value="">Select Expert...</option>
                                                                        {facultyList
                                                                            .filter(f => f.isSubjectExpert && (f.batchOccupancy ?? 0) < 4)
                                                                            .map(f => <option key={f.id} value={f.id}>{f.name} ({4 - (f.batchOccupancy || 0)} slots left)</option>)
                                                                        }
                                                                    </select>
                                                                    <button
                                                                        disabled={scope.requireGuide && !myTeam.guide}
                                                                        onClick={handleSelectExpert}
                                                                        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400"
                                                                    >
                                                                        Assign Expert
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {scope.requireGuide && !myTeam.guide && <p className="text-[10px] text-gray-400 mt-2 text-center">Assign mentor first</p>}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Changes Required Countdown Timer - Handcrafted Aesthetic */}
                                            {(() => {
                                                const changesReview = myTeam.reviews
                                                    ?.filter(r => r.status === 'CHANGES_REQUIRED')
                                                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

                                                if (!changesReview || myTeam.status !== 'CHANGES_REQUIRED') return null;

                                                const deadline = new Date(new Date(changesReview.createdAt).getTime() + 24 * 60 * 60 * 1000);
                                                const now = new Date();
                                                const diff = deadline - now;

                                                if (diff <= 0) {
                                                    return (
                                                        <div className="mt-8 p-8 bg-gradient-to-br from-red-600 to-red-800 rounded-[32px] text-white shadow-2xl shadow-red-200 relative overflow-hidden">
                                                            <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px]" />
                                                            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                                                                <div className="w-20 h-20 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-md border border-white/20">
                                                                    <Timer size={40} className="text-white animate-pulse" />
                                                                </div>
                                                                <div className="flex-1 text-center md:text-left">
                                                                    <h4 className="text-2xl font-black font-outfit tracking-tight mb-2">Resubmission Window Closed</h4>
                                                                    <p className="text-sm text-red-100/80 font-medium leading-relaxed max-w-xl">
                                                                        The 24-hour response period has expired. Please contact your reviewer <span className="text-white font-black underline">({changesReview.faculty?.name})</span> immediately to discuss the next steps.
                                                                    </p>
                                                                    <div className="mt-6 pt-6 border-t border-white/10 flex flex-col gap-2">
                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-red-200 opacity-60">Faculty Feedback</span>
                                                                        <p className="text-sm font-bold italic">"{changesReview.content}"</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <XCircle size={120} className="absolute -bottom-8 -right-8 text-white/10 rotate-12" />
                                                        </div>
                                                    );
                                                }

                                                const hours = Math.floor(diff / (1000 * 60 * 60));
                                                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                                                const isUrgent = diff < 2 * 60 * 60 * 1000;

                                                return (
                                                    <div className={`mt-8 p-6 rounded-lg border ${isUrgent ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                                                        <div className="flex flex-col md:flex-row gap-6">
                                                            <div className="flex-1 space-y-4">
                                                                <div className="flex items-center gap-2">
                                                                    <Timer size={18} className={isUrgent ? 'text-red-600' : 'text-amber-600'} />
                                                                    <h4 className="font-semibold text-gray-900">Changes Required</h4>
                                                                </div>
                                                                <div className="bg-white border border-gray-100 p-4 rounded-lg text-sm text-gray-700 italic">
                                                                    "{changesReview.content}"
                                                                </div>
                                                                <p className="text-[11px] font-medium text-gray-500">
                                                                    Address feedback from <span className="text-gray-900 font-semibold">{changesReview.faculty?.name}</span> before the deadline.
                                                                </p>
                                                            </div>

                                                            <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col items-center justify-center min-w-[200px]">
                                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Time Remaining</p>
                                                                <div className="flex items-baseline gap-1">
                                                                    <span className={`text-3xl font-bold tabular-nums ${isUrgent ? 'text-red-600' : 'text-gray-900'}`}>
                                                                        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Action Buttons — Handcrafted Interaction Banners */}
                                            {myTeam.project && myTeam.status !== 'READY_FOR_REVIEW' && myTeam.status !== 'PENDING' && (() => {
                                                const completedReviews = myTeam.reviews?.filter(r => r.status === 'COMPLETED' || r.status === 'NOT_COMPLETED') || [];
                                                const completedPhases = new Set(completedReviews.map(r => r.reviewPhase)).size;
                                                const totalPhases = scope.numberOfPhases || 4;
                                                const allPhasesCompleted = completedPhases >= totalPhases;

                                                const hasCompletedCurrentPhase = myTeam.reviews?.some(r => r.reviewPhase === currentPhase && r.status === 'COMPLETED');
                                                const hasMissedCurrentPhase = myTeam.reviews?.some(r => r.reviewPhase === currentPhase && r.status === 'NOT_COMPLETED') && !hasCompletedCurrentPhase;
                                                const hasPendingReview = myTeam.reviews?.some(r => r.status === 'PENDING' || r.status === 'READY_FOR_REVIEW');

                                                if (allPhasesCompleted) {
                                                    return (
                                                        <div className="mt-10 pt-8 border-t border-slate-100">
                                                            <div className="bg-emerald-50/80 backdrop-blur-sm border border-emerald-100 p-6 rounded-[28px] flex items-center gap-5 shadow-xl shadow-emerald-100/20">
                                                                <div className="w-14 h-14 bg-emerald-500 text-white rounded-lg flex items-center justify-center shadow-lg shadow-emerald-200">
                                                                    <CheckCircle size={28} />
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-lg font-black font-outfit text-emerald-900 tracking-tight">Curriculum Completed! 🎉</h4>
                                                                    <p className="text-xs text-emerald-700 font-bold opacity-80 uppercase tracking-widest mt-0.5">All {totalPhases} review phases have been successfully verified.</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                if (hasMissedCurrentPhase) {
                                                    return (
                                                        <div className="mt-10 pt-8 border-t border-slate-100">
                                                            <div className="bg-red-50/80 backdrop-blur-sm border border-red-100 p-6 rounded-[28px] flex items-center gap-5 shadow-xl shadow-red-100/20">
                                                                <div className="w-14 h-14 bg-red-600 text-white rounded-lg flex items-center justify-center shadow-lg shadow-red-200">
                                                                    <XCircle size={28} />
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-lg font-black font-outfit text-red-900 tracking-tight">Phase {currentPhase} Absent</h4>
                                                                    <p className="text-xs text-red-600 font-bold opacity-80 uppercase tracking-widest mt-0.5">Evaluation window missed. Awaiting administrative reconfiguration.</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                if (hasCompletedCurrentPhase || hasPendingReview) {
                                                    return (
                                                        <div className="mt-10 pt-8 border-t border-slate-100">
                                                            <div className="bg-blue-50/80 backdrop-blur-sm border border-blue-100 p-6 rounded-[28px] flex items-center gap-5 shadow-xl shadow-blue-100/20">
                                                                <div className="w-14 h-14 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-lg shadow-blue-200">
                                                                    <Clock size={28} />
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-lg font-black font-outfit text-blue-900 tracking-tight">
                                                                        {hasPendingReview ? 'Review in progress' : `Phase ${highestPassedPhase} Verified`}
                                                                    </h4>
                                                                    <p className="text-xs text-blue-700 font-bold opacity-80 uppercase tracking-widest mt-0.5">
                                                                        {hasPendingReview
                                                                            ? 'Faculty is currently evaluating your submission. Stay tuned.'
                                                                            : 'Successfully cleared. Next phase assignment will appear shortly.'
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="mt-10 pt-8 border-t border-slate-100">
                                                        {(!scope.requireGuide || (myTeam.guide && myTeam.guideStatus === 'APPROVED')) &&
                                                            (!scope.requireSubjectExpert || (myTeam.subjectExpert && myTeam.expertStatus === 'APPROVED')) ? (
                                                            <button
                                                                onClick={handleSubmitForReview}
                                                                className="w-full bg-gray-900 text-white px-6 py-4 rounded-lg text-sm font-bold uppercase tracking-widest transition-all hover:bg-gray-800 active:scale-[0.98] shadow-lg shadow-gray-200"
                                                            >
                                                                Submit Phase {currentPhase} for Review
                                                            </button>
                                                        ) : (
                                                            <div className="bg-gray-50 border border-gray-200 p-5 rounded-lg flex items-center gap-4">
                                                                <div className="w-12 h-12 bg-white border border-gray-100 text-gray-400 rounded-lg flex items-center justify-center">
                                                                    <AlertCircle size={24} />
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-sm font-semibold text-gray-900">Submission Locked</h4>
                                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                                        Awaiting final verification from {
                                                                            (!scope.requireGuide || (myTeam.guide && myTeam.guideStatus === 'APPROVED'))
                                                                                ? 'Domain Expert'
                                                                                : (!scope.requireSubjectExpert || (myTeam.subjectExpert && myTeam.expertStatus === 'APPROVED'))
                                                                                    ? 'Project Guide'
                                                                                    : 'Guide & Expert'
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Review History — Handcrafted Timeline Content */}
                                            {myTeam?.project && (!scope.requireGuide || myTeam.guide) && (!scope.requireSubjectExpert || myTeam.subjectExpert) && (
                                                <div className="mt-12">
                                                    <div className="flex items-center gap-3 mb-6">
                                                        <MessageSquare size={20} className="text-blue-600" />
                                                        <h3 className="text-xl font-bold text-gray-900">Review Timeline</h3>
                                                    </div>

                                                    <div className="space-y-6">
                                                        {(() => {
                                                            const completedReviews = myTeam.reviews?.filter(r => r.status !== 'PENDING').map(r => ({
                                                                ...r,
                                                                type: 'REVIEW'
                                                            })) || [];

                                                            const now = new Date();
                                                            const missedAssignments = myTeam.project.assignedFaculty?.filter(a => {
                                                                if (!a.accessExpiresAt) return false;
                                                                const isExpired = new Date(a.accessExpiresAt) < now;
                                                                const hasReview = completedReviews.some(r => r.facultyId === a.facultyId && (r.reviewPhase === a.reviewPhase || !a.reviewPhase));
                                                                return isExpired && !hasReview;
                                                            }).map(a => ({
                                                                id: `missed-${a.id}`,
                                                                createdAt: a.accessExpiresAt,
                                                                faculty: a.faculty,
                                                                facultyId: a.facultyId,
                                                                reviewPhase: a.reviewPhase,
                                                                type: 'MISSED',
                                                                status: 'MISSED'
                                                            })) || [];

                                                            const missedDeadlines = (scope.deadlines || [])
                                                                .filter(d => new Date(d.deadline) < now)
                                                                .filter(d => !completedReviews.some(r => r.reviewPhase === d.phase))
                                                                .filter(d => !missedAssignments.some(a => a.reviewPhase === d.phase))
                                                                .map(d => ({
                                                                    id: `deadline-${d.id}`,
                                                                    createdAt: d.deadline,
                                                                    reviewPhase: d.phase,
                                                                    type: 'DEADLINE_MISSED',
                                                                    status: 'MISSED DEADLINE'
                                                                }));

                                                            const fullHistory = [...completedReviews, ...missedAssignments, ...missedDeadlines].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                                                            if (fullHistory.length === 0) {
                                                                return (
                                                                    <div className="py-12 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50">
                                                                        <MessageSquare size={32} className="mx-auto mb-3 text-gray-300" />
                                                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">No feedback logs recorded yet</p>
                                                                    </div>
                                                                );
                                                            }

                                                            return fullHistory.map((item, idx) => {
                                                                if (item.type === 'MISSED') {
                                                                    return (
                                                                        <div key={item.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 opacity-75">
                                                                            <div className="flex items-center gap-4">
                                                                                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-gray-400 border border-gray-100"><Clock size={18} /></div>
                                                                                <div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <p className="text-sm font-semibold text-gray-700">{item.faculty?.name || "Resource Pool"}</p>
                                                                                        {item.reviewPhase && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200 font-medium">Phase {item.reviewPhase}</span>}
                                                                                    </div>
                                                                                    <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">Expired: {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                                                </div>
                                                                            </div>
                                                                            <span className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded bg-gray-200 text-gray-600">Session missed</span>
                                                                        </div>
                                                                    );
                                                                }

                                                                if (item.type === 'DEADLINE_MISSED') {
                                                                    return (
                                                                        <div key={item.id} className="p-4 bg-red-50 rounded-lg border border-red-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                                            <div className="flex items-center gap-4">
                                                                                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-red-500 border border-red-100"><Calendar size={18} /></div>
                                                                                <div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <p className="text-sm font-semibold text-red-900">Deadline Missed</p>
                                                                                        {item.reviewPhase && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200 font-medium">Phase {item.reviewPhase}</span>}
                                                                                    </div>
                                                                                    <p className="text-[10px] text-red-500/70 mt-0.5 uppercase tracking-wider">Marked absent on {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                                                </div>
                                                                            </div>
                                                                            <span className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded bg-red-100 text-red-700">Timeline violation</span>
                                                                        </div>
                                                                    );
                                                                }

                                                                const r = item;
                                                                const isCompleted = r.status === 'COMPLETED';
                                                                return (
                                                                    <div key={r.id} className="p-6 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors shadow-sm">
                                                                        <div className="flex flex-col gap-4">
                                                                            <div className="flex flex-wrap justify-between items-start gap-4">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center font-bold text-gray-400 border border-gray-100">{fullHistory.length - idx}</div>
                                                                                    <div>
                                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                                            <p className="text-sm font-bold text-gray-900">{r.faculty?.name || "Official Evaluator"}</p>
                                                                                            <div className="flex gap-1.5">
                                                                                                {myTeam.guideId === r.facultyId && <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 font-medium">Guide</span>}
                                                                                                {myTeam.subjectExpertId === r.facultyId && <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100 font-medium">Expert</span>}
                                                                                                {r.reviewPhase && <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200 font-medium">Phase {r.reviewPhase}</span>}
                                                                                            </div>
                                                                                        </div>
                                                                                        <p className="text-[10px] text-gray-500 mt-0.5 font-medium uppercase tracking-wider">
                                                                                            {new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                                <span className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${isCompleted ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                                                                    {r.status.replace('_', ' ')}
                                                                                </span>
                                                                            </div>

                                                                            {r.reviewMarks && r.reviewMarks.length > 0 && (
                                                                                <div className="flex flex-wrap gap-2">
                                                                                    {r.reviewMarks.map((mark, i) => {
                                                                                        const isMe = mark.studentId === user?.id;
                                                                                        const name = isMe ? "My Score" : (myTeam.members.find(m => m.userId === mark.studentId)?.user.name.split(' ')[0] || "Member");
                                                                                        let tooltip = "";
                                                                                        let displayScore = mark.marks;
                                                                                        if (mark.criterionMarks) {
                                                                                            try {
                                                                                                const cm = JSON.parse(mark.criterionMarks);
                                                                                                if (cm._total) {
                                                                                                    displayScore = `${mark.marks}/${cm._total}`;
                                                                                                    tooltip = Object.entries(cm).filter(([k]) => k !== '_total').map(([k, v]) => `${k}: ${v.score}/${v.max}`).join('\n');
                                                                                                }
                                                                                            } catch (e) { }
                                                                                        }
                                                                                        return (
                                                                                            <div key={i} title={tooltip} className={`px-3 py-1 rounded-lg flex items-center gap-2 border text-[10px] font-semibold transition-colors ${isMe ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-50 text-gray-700 border-gray-100'}`}>
                                                                                                <span className={isMe ? 'text-blue-100' : 'text-gray-400'}>{name}:</span>
                                                                                                <span className="font-bold">{displayScore}</span>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}

                                                                            <div className="text-sm text-gray-700 leading-relaxed font-inter py-2 border-t border-gray-50">
                                                                                {r.content}
                                                                            </div>

                                                                            {r.resubmittedAt && (
                                                                                <div className="mt-4 p-5 bg-indigo-50/50 border border-indigo-100/50 rounded-lg relative overflow-hidden group/resub">
                                                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/20 rounded-full blur-2xl -mr-12 -mt-12 group-hover/resub:bg-white/40 transition-colors" />
                                                                                    <div className="flex items-center gap-4 mb-3 relative z-10">
                                                                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-500 shadow-sm"><RefreshCcw size={18} /></div>
                                                                                        <div>
                                                                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Resubmitted on {new Date(r.resubmittedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                                                            <p className="text-sm font-black text-indigo-800 font-outfit tracking-tight">Team's Resubmission Note</p>
                                                                                        </div>
                                                                                    </div>
                                                                                    <pre className="text-xs text-indigo-700 italic whitespace-pre-wrap font-sans leading-tight bg-white/50 p-4 rounded-lg border border-white relative z-10">{r.resubmissionNote}</pre>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* ── HISTORY TAB ── */}
                                    {activeTab === 'history' && (
                                        <>
                                            {/* Past Review Schedules */}
                                            {myTeam.project?.assignedFaculty?.length > 0 && (() => {
                                                const now = new Date();
                                                const pastAssignments = myTeam.project.assignedFaculty.filter(a => {
                                                    if (!a.accessExpiresAt) return false;
                                                    return new Date(a.accessExpiresAt) <= now;
                                                });
                                                if (pastAssignments.length === 0) return null;
                                                return (
                                                    <div className="mt-8">
                                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Past Review Schedules</h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {pastAssignments.map(assignment => (
                                                                <div key={assignment.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-4 opacity-80">
                                                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-white border border-gray-100 text-gray-400">
                                                                        <Clock size={16} />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-bold text-gray-800 truncate">{assignment.faculty?.name || "Reviewer"}</p>
                                                                        <div className="text-[10px] text-gray-500 mt-1 space-y-0.5">
                                                                            <p>Starts: {assignment.accessStartsAt ? new Date(assignment.accessStartsAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}</p>
                                                                            <p>Expires: {assignment.accessExpiresAt ? new Date(assignment.accessExpiresAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}</p>
                                                                        </div>
                                                                        <div className="flex gap-2 mt-2">
                                                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200 font-medium">Phase {assignment.reviewPhase || 1}</span>
                                                                            <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100 font-medium">Expired</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                        </>
                                    )}

                                </div>
                            </div>

                            {/* Project Rubrics — Handcrafted Criterion Cards */}
                            {myTeam?.project && rubrics.length > 0 && (
                                <div className="mt-12">
                                    <div className="flex items-center gap-3 mb-6">
                                        <CheckCircle size={20} className="text-emerald-600" />
                                        <h3 className="text-xl font-bold text-gray-900">Evaluation Rubrics</h3>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6">
                                        {rubrics.map((rubric) => {
                                            let criteria = [];
                                            try {
                                                criteria = typeof rubric.criteria === 'string' ? JSON.parse(rubric.criteria) : rubric.criteria;
                                            } catch (e) {
                                                console.error("Error parsing rubric criteria", e);
                                            }

                                            const themeColor = {
                                                1: 'blue-600',
                                                2: 'indigo-600',
                                                3: 'purple-600',
                                                4: 'emerald-600'
                                            }[rubric.phase] || 'gray-600';

                                            return (
                                                <div key={rubric.id} className={`p-5 bg-white rounded-lg border-l-4 border-l-${themeColor} border border-gray-200 mb-6 last:mb-0`}>
                                                    <div className="space-y-4">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                                                <span>Evaluation Standards</span>
                                                                <span>·</span>
                                                                <span className={`text-${themeColor}`}>Phase {rubric.phase}</span>
                                                            </div>
                                                            <h3 className="text-lg font-semibold text-gray-900">{rubric.name}</h3>
                                                        </div>

                                                        <div className="space-y-3 pt-2">
                                                            <p className="text-xs font-medium text-gray-500">Criteria</p>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                {criteria.map((c, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="flex items-start gap-3 px-4 py-3 bg-gray-50/50 rounded-lg border border-gray-100/80 group-hover:bg-white transition-colors"
                                                                    >
                                                                        <div className={`mt-1 h-1.5 w-1.5 rounded-full bg-${themeColor} shrink-0`} />
                                                                        <div>
                                                                            <p className="text-sm font-semibold text-gray-800 leading-tight mb-1">{c.name}</p>
                                                                            <p className="text-xs text-gray-500 leading-relaxed">
                                                                                {c.description || "Assessment of quality and implementation standards."}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="pt-2">
                                                            <p className="text-[10px] text-gray-400 font-medium italic">
                                                                * Ensure all deliverables for Phase {rubric.phase} are uploaded before the evaluation begins.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="col-span-3 space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700">
                            {/* NO TEAM START - FULL WIDTH PROJECT GRID — Handcrafted Onboarding */}
                            <div className="bg-gray-900 rounded-lg p-8 md:p-12 text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                                <div className="relative z-10 max-w-2xl mx-auto">
                                    <div className="w-16 h-16 bg-white/10 rounded-lg flex items-center justify-center mx-auto mb-6">
                                        <Rocket size={32} className="text-white" />
                                    </div>
                                    <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">Select Your Project</h2>
                                    <p className="text-gray-400 text-base">
                                        Choose a project to begin. Your team and workspace will be initialized once you make a selection.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-gray-700 placeholder:text-gray-400"
                                        placeholder="Search projects..."
                                        value={projectSearch}
                                        onChange={e => setProjectSearch(e.target.value)}
                                    />
                                </div>
                                <div className="relative">
                                    <select
                                        className="w-full md:w-64 px-4 py-3.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-blue-500 transition-all font-semibold text-gray-600 appearance-none pr-10"
                                        value={categoryFilter}
                                        onChange={e => setCategoryFilter(e.target.value)}
                                    >
                                        {uniqueCategories.map(c => (
                                            <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredProjects.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => selectProject(p.id, p.title)}
                                        className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded border border-blue-100">
                                                    {p.category}
                                                </span>
                                                <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                                            </div>
                                            <h3 className="font-bold text-gray-900 group-hover:text-blue-600 mb-3 leading-snug">
                                                {p.title}
                                            </h3>
                                            <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed mb-6">
                                                {p.description || "No description provided."}
                                            </p>
                                        </div>

                                        <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1.5">
                                                <Users size={12} /> {p.maxTeamSize} Members
                                            </span>
                                            <span className="text-[10px] font-bold text-blue-600 uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                                                Select Project
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {projects.length === 0 && (
                                <div className="text-center py-32 bg-slate-50 rounded-[48px] border-4 border-dashed border-slate-200">
                                    <div className="w-20 h-20 bg-white rounded-lg shadow-lg border border-slate-100 flex items-center justify-center mx-auto mb-6 text-slate-200">
                                        <Layout size={40} />
                                    </div>
                                    <p className="text-slate-400 font-black uppercase tracking-[0.25em] text-sm">Deployment queue empty</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* RIGHT COLUMN: Available Projects — Handcrafted Selector */}
                    {myTeam && (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm sticky top-10">
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Layout size={18} className="text-blue-600" />
                                        <h4 className="text-base font-bold text-gray-900">Available Projects</h4>
                                    </div>
                                    <p className="text-xs text-gray-500">Select a project for your team</p>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                        <input
                                            type="text"
                                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none focus:border-blue-300 focus:bg-white transition-all"
                                            placeholder="Search titles..."
                                            value={projectSearch}
                                            onChange={e => setProjectSearch(e.target.value)}
                                        />
                                    </div>
                                    <div className="relative">
                                        <select
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-semibold text-gray-600 outline-none focus:border-blue-300 appearance-none"
                                            value={categoryFilter}
                                            onChange={e => setCategoryFilter(e.target.value)}
                                        >
                                            {uniqueCategories.map(c => (
                                                <option key={c} value={c}>{c === 'ALL' ? 'All Domains' : c}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>

                                <div className={`space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
                                    {filteredProjects.map(p => {
                                        const hasProject = myTeam?.project || myTeam?.projectRequests?.some(r => r.status === 'PENDING');
                                        const isSelected = myTeam?.project?.id === p.id;
                                        const isPendingRequest = myTeam?.projectRequests?.some(r => r.projectId === p.id && r.status === 'PENDING');

                                        return (
                                            <div
                                                key={p.id}
                                                onClick={() => !hasProject && selectProject(p.id, p.title)}
                                                className={`p-4 rounded-lg border transition-all ${isSelected
                                                    ? 'bg-blue-600 border-blue-700'
                                                    : isPendingRequest
                                                        ? 'bg-amber-50 border-amber-200'
                                                        : hasProject
                                                            ? 'bg-gray-50 border-gray-100 opacity-40 grayscale'
                                                            : 'bg-white border-gray-100 hover:border-blue-300 cursor-pointer shadow-sm'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start gap-2 mb-1">
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                        {p.category}
                                                    </span>
                                                    {isSelected && <Check size={12} className="text-white" />}
                                                    {isPendingRequest && <Clock size={12} className="text-amber-600 pulse" />}
                                                </div>
                                                <h5 className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-800'}`}>{p.title}</h5>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                </div>
                {/* SUBMIT REVIEW MODAL — Handcrafted Focused UI */}
                {isSubmitModalOpen && (
                    <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
                        <div className="bg-white rounded-lg w-full max-w-md p-8 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                    <Rocket size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Submit Phase {currentPhase}</h3>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-5 mb-6 border border-gray-100">
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    You are finalizing your submission for the <span className="font-bold text-gray-900">Phase {currentPhase}</span> review cycle.
                                </p>
                                <div className="mt-3 flex items-center gap-2 text-amber-700 text-[11px] font-bold uppercase tracking-wider">
                                    <Clock size={14} />
                                    <span>Changes locked after submission</span>
                                </div>
                            </div>

                            <div className="mb-8">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Submission Notes (Optional)</label>
                                <textarea
                                    className="w-full bg-white border border-gray-200 p-4 rounded-lg focus:border-blue-500 outline-none resize-none text-sm font-medium text-gray-700 transition-all"
                                    rows={3}
                                    placeholder="Add any relevant notes for the evaluator..."
                                    value={resubmissionNote}
                                    onChange={e => setResubmissionNote(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsSubmitModalOpen(false)}
                                    className="flex-1 py-3.5 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all border border-gray-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmSubmitReview}
                                    disabled={isSubmitting}
                                    className="flex-[2] py-3.5 rounded-lg text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Submitting...' : 'Confirm Submission'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

