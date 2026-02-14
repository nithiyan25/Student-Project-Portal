import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { Users, CheckCircle, MessageSquare, Search, ArrowLeft, XCircle, Check, AlertCircle, Clock, MapPin, Layout, History, Timer, Calendar } from 'lucide-react';
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
        const interval = setInterval(async () => {
            try {
                const scopeRes = await api.get('/scopes/my-scopes');
                const foundScope = scopeRes.data.find(s => s.id === scopeId);
                if (foundScope) setScope(foundScope);
            } catch (err) {
                console.error("Polling error", err);
            }
        }, 60000); // Polling every 60s
        return () => clearInterval(interval);
    }, [scopeId]);

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

    if (loading) return <div className="p-10 text-center">Loading...</div>;
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

            {/* Top Persistent Deadline Banner */}
            {deadlineDate && (
                <div className={`sticky top-0 z-40 border-b transition-all duration-300 ${isPassed ? 'bg-red-600 border-red-700' : isUrgent ? 'bg-orange-500 border-orange-600 animate-pulse' : 'bg-blue-600 border-blue-700'}`}>
                    <div className="max-w-6xl mx-auto px-8 py-2 flex items-center justify-between gap-4 text-white">
                        <div className="flex items-center gap-3">
                            <Calendar size={16} className="opacity-80" />
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Phase {currentPhase} Deadline:</span>
                                <span className="text-xs font-bold">
                                    {deadlineDate.toLocaleDateString([], { dateStyle: 'medium' })} at {deadlineDate.toLocaleTimeString([], { timeStyle: 'short' })}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock size={14} className="opacity-80" />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                                {isPassed ? 'DEADLINE PASSED' : (() => {
                                    const diff = deadlineDate - now;
                                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                    return days > 0 ? `${days}d ${hours}h remaining` : `${hours}h ${mins}m remaining`;
                                })()}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-8 max-w-6xl mx-auto space-y-8">

                {/* Header / Nav */}
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/student')} className="p-2 hover:bg-gray-200 rounded-full transition">
                        <ArrowLeft size={24} className="text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">{scope.name}</h1>
                        <p className="text-gray-500">{scope.description || "Manage your project and team for this batch."}</p>
                    </div>
                </div>

                {/* Batch Timer */}
                <BatchTimer scope={scope} />

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* LEFT COLUMN: Team & Project Status */}
                    {myTeam ? (
                        <div className="lg:col-span-2 space-y-6">
                            {(() => {
                                const completedReviews = myTeam?.reviews?.filter(r => r.status === 'COMPLETED') || [];

                                // If results are not published by admin, don't show the summary
                                if (!scope?.resultsPublished) {
                                    if (completedReviews.length > 0) {
                                        return (
                                            <div className="bg-white p-6 shadow-sm rounded-2xl border border-orange-100 mb-6 bg-orange-50/20">
                                                <div className="flex items-center gap-3 text-orange-600">
                                                    <Clock className="animate-pulse" size={24} />
                                                    <div>
                                                        <p className="font-bold">Results Pending</p>
                                                        <p className="text-xs text-orange-400">Your reviews are completed. Scores will be visible once the admin publishes them.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }

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
                                    <div className="bg-white p-6 shadow-sm rounded-2xl border border-gray-100 mb-6 animate-in fade-in slide-in-from-left-4 duration-500">
                                        <div className="flex justify-between items-center mb-6">
                                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 font-outfit">
                                                <CheckCircle className="text-green-600" size={24} /> Performance Summary
                                            </h2>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                                                Results Published
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            {/* Cumulative Average Card */}
                                            <div className="p-4 bg-blue-600 rounded-xl border border-blue-700 shadow-lg shadow-blue-100 transition-all group lg:col-span-1 col-span-2">
                                                <p className="text-[9px] font-black text-blue-100 uppercase tracking-[0.15em] mb-1">Total Score</p>
                                                <p className="text-3xl font-black text-white font-outfit">
                                                    {avgPercentage}<span className="text-sm text-blue-200 ml-1 font-bold">%</span>
                                                </p>
                                            </div>

                                            {myScores.map((s, i) => (
                                                <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 transition-all group">
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1 group-hover:text-blue-400 transition-colors">Phase {s.phase}</p>
                                                    <p className="text-2xl font-black text-gray-800 font-outfit">
                                                        {s.marks}<span className="text-sm text-gray-400 ml-1 font-bold">{s.scale}</span>
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className={`bg-white p-6 shadow-sm rounded-2xl border ${isPending ? 'border-orange-200 ring-4 ring-orange-50/50' : 'border-gray-100'} relative`}>
                                <div className="absolute top-0 right-0 p-4 flex gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.1em] px-3 py-1 rounded-full border bg-blue-50 text-blue-600 border-blue-100">
                                        {myTeam.status.replace('_', ' ')}
                                    </span>
                                </div>

                                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 font-outfit">
                                    <Users className="text-blue-600" size={24} /> Team
                                </h2>

                                {/* INVITATION BANNER */}
                                {isPending && (
                                    <div className="mb-6 p-4 bg-orange-50 rounded-xl border border-orange-100 flex items-center justify-between animate-in fade-in slide-in-from-top-4">
                                        <div>
                                            <h3 className="font-bold text-orange-800">You have been invited!</h3>
                                            <p className="text-xs text-orange-600">Join this team to start working on the project.</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleRejectInvite}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-white text-red-600 border border-red-100 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors"
                                            >
                                                <XCircle size={14} /> Reject
                                            </button>
                                            <button
                                                onClick={handleAcceptInvite}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors shadow-sm shadow-orange-200"
                                            >
                                                <Check size={14} /> Accept
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className={`space-y-6 ${isPending ? 'opacity-50 pointer-events-none grayscale-[0.5]' : ''}`}>
                                    {/* Member List */}
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Members</label>
                                        <div className="flex flex-wrap gap-3">
                                            {myTeam.members.map(m => (
                                                <div key={m.id} className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${m.userId === user?.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
                                                    <div className={`w-2 h-2 rounded-full ${m.approved ? 'bg-green-500' : 'bg-yellow-400'}`}></div>
                                                    <div className="text-xs font-bold text-gray-800">{m.user?.name} {m.userId === user?.id && "(You)"}</div>
                                                    {m.isLeader && <CheckCircle size={14} className="text-blue-500" />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Invites Logic */}
                                    {scopeMe?.isLeader && !myTeam.project && (
                                        <div className="flex gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
                                            <input
                                                className="bg-transparent px-4 py-2 flex-1 outline-none text-sm"
                                                placeholder="Invite student by email..."
                                                value={inviteEmail}
                                                onChange={e => setInviteEmail(e.target.value)}
                                            />
                                            <button onClick={invite} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all">Invite</button>
                                        </div>
                                    )}

                                    {/* STEP 1: Current Project Status */}
                                    {myTeam.project ? (
                                        <>
                                            <div className="p-6 bg-gradient-to-br from-green-600 to-green-700 rounded-2xl text-white shadow-xl relative overflow-hidden">
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-black text-green-100 uppercase tracking-widest mb-1 opacity-80">Confirmed Project</p>
                                                    <h3 className="text-2xl font-bold font-outfit">{myTeam.project.title}</h3>
                                                    {myTeam.project.description && (
                                                        <p className="mt-3 text-sm text-green-50 leading-relaxed font-medium">
                                                            {myTeam.project.description}
                                                        </p>
                                                    )}
                                                    {(myTeam.project.techStack || myTeam.project.srs) && (
                                                        <div className="mt-4 flex flex-wrap gap-3">
                                                            {myTeam.project.techStack && (
                                                                <div className="bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-xl">
                                                                    <p className="text-[9px] font-black text-green-100 uppercase tracking-wider mb-0.5">Tech Stack</p>
                                                                    <p className="text-xs font-bold text-white">{myTeam.project.techStack}</p>
                                                                </div>
                                                            )}
                                                            {myTeam.project.srs && (
                                                                <a
                                                                    href={myTeam.project.srs}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-xl hover:bg-white/20 transition-all flex flex-col"
                                                                >
                                                                    <p className="text-[9px] font-black text-green-100 uppercase tracking-wider mb-0.5">Documentation</p>
                                                                    <p className="text-xs font-bold text-white flex items-center gap-1">View SRS <CheckCircle size={10} /></p>
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <CheckCircle size={100} className="absolute -bottom-6 -right-6 text-white/10 rotate-12" />
                                            </div>


                                        </>
                                    ) : scopeRequest ? (
                                        <div className={`p-6 rounded-2xl border-2 shadow-sm ${scopeRequest.status === 'PENDING' ? 'bg-orange-50 border-orange-100' : 'bg-red-50 border-red-100'}`}>
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
                                        <div className="p-6 bg-gray-50 border border-dashed border-gray-200 rounded-2xl text-center">
                                            <p className="text-sm text-gray-400 font-bold">Step 1: Select a Project from the list.</p>
                                        </div>
                                    )}

                                    {/* ── Tab Navigation ── */}
                                    {myTeam.project && (
                                        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mt-2">
                                            <button
                                                onClick={() => setActiveTab('current')}
                                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'current' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                <Layout size={14} /> Current Overview
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('history')}
                                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                <History size={14} /> Past Reviews
                                            </button>
                                        </div>
                                    )}

                                    {/* ── CURRENT TAB ── */}
                                    {activeTab === 'current' && (
                                        <>
                                            {/* Phase Deadline Banner */}
                                            {deadlineDate && (
                                                <div className={`mt-4 p-5 rounded-3xl border ${isPassed ? 'bg-red-50 border-red-100' : isUrgent ? 'bg-orange-50 border-orange-100 animate-pulse' : 'bg-blue-50 border-blue-100'} shadow-sm flex items-center justify-between gap-4`}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isPassed ? 'bg-red-100 text-red-600' : isUrgent ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                                            <Calendar size={24} />
                                                        </div>
                                                        <div>
                                                            <p className={`text-[10px] font-black uppercase tracking-widest ${isPassed ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-blue-400'}`}>
                                                                Phase {currentPhase} Deadline
                                                            </p>
                                                            <h4 className={`text-lg font-black font-outfit ${isPassed ? 'text-red-800' : isUrgent ? 'text-orange-800' : 'text-blue-800'}`}>
                                                                {deadlineDate.toLocaleDateString([], { dateStyle: 'long' })}
                                                                <span className="text-sm font-bold ml-2 opacity-60">
                                                                    at {deadlineDate.toLocaleTimeString([], { timeStyle: 'short' })}
                                                                </span>
                                                            </h4>
                                                            <p className={`text-xs font-bold ${isPassed ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-blue-600'}`}>
                                                                {isPassed ? 'Deadline has passed. Automatically moved to next phase.' : isUrgent ? 'Hurry! Deadline is approaching.' : 'Complete your review before this date.'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {!isPassed && (
                                                        <div className="text-right hidden sm:block">
                                                            <p className={`text-[10px] font-black uppercase tracking-widest ${isUrgent ? 'text-orange-400' : 'text-blue-400'}`}>Time Remaining</p>
                                                            <p className={`text-xl font-black font-outfit ${isUrgent ? 'text-orange-700' : 'text-blue-700'}`}>
                                                                {(() => {
                                                                    const diff = deadlineDate - now;
                                                                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                                                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                                                    return days > 0 ? `${days}d ${hours}h` : `${hours}h remaining`;
                                                                })()}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Upcoming Review Schedule */}
                                            {assignedFaculty.length > 0 && (() => {
                                                const upcomingAssignments = assignedFaculty.filter(a => {
                                                    if (!a.accessExpiresAt) return true;
                                                    return new Date(a.accessExpiresAt) > now;
                                                });
                                                if (upcomingAssignments.length === 0) return null;
                                                return (
                                                    <div className="mt-4 space-y-3">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Upcoming Review Schedule</p>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {upcomingAssignments.map(assignment => (
                                                                <div key={assignment.id} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center gap-4 hover:border-blue-200 transition-all">
                                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${assignment.mode === 'ONLINE' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                                                                        <Clock size={20} />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">{assignment.faculty?.name || "Reviewer Assigned"}</p>
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                                <span className="text-[8px] font-black text-gray-300 uppercase shrink-0">From:</span>
                                                                                <span className="text-[11px] font-bold text-gray-600 truncate">
                                                                                    {assignment.accessStartsAt ? new Date(assignment.accessStartsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Immediately'}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                                <span className="text-[8px] font-black text-gray-300 uppercase shrink-0">To:</span>
                                                                                <span className="text-xs font-bold text-gray-800 truncate">
                                                                                    {assignment.accessExpiresAt ? new Date(assignment.accessExpiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Flexible Timing'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex gap-2 mt-1">
                                                                            <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 font-bold uppercase tracking-wider">Phase {assignment.reviewPhase || 1}</span>
                                                                            <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${assignment.mode === 'ONLINE' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                                                                                {assignment.mode}
                                                                            </span>
                                                                            {assignment.venue && assignment.mode === 'OFFLINE' && (
                                                                                <span className="text-[9px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100 font-bold uppercase tracking-wider flex items-center gap-1">
                                                                                    <MapPin size={8} /> {assignment.venue.name}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* STEP 2 & 3: Faculty Assignment */}
                                            {myTeam.project && (scope.requireGuide || scope.requireSubjectExpert) && (
                                                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                                    {scope.requireGuide && (
                                                        <div className={`p-4 rounded-xl border ${myTeam.guide ? 'bg-white border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                                                            <div className="flex justify-between items-center mb-2">
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Guide</p>
                                                                {myTeam.guide && <CheckCircle size={12} className="text-green-500" />}
                                                            </div>

                                                            {myTeam.guide && myTeam.guideStatus !== 'REJECTED' ? (
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">{myTeam.guide.name[0]}</div>
                                                                        <div className="text-sm font-bold text-gray-800">{myTeam.guide.name}</div>
                                                                    </div>
                                                                    {myTeam.guideStatus === 'PENDING' && (
                                                                        <span className="text-[9px] bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200 font-black uppercase tracking-wider">Pending</span>
                                                                    )}
                                                                    {myTeam.guideStatus === 'APPROVED' && (
                                                                        <span className="text-[9px] bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200 font-black uppercase tracking-wider">Approved</span>
                                                                    )}
                                                                </div>
                                                            ) : scopeMe?.isLeader && (
                                                                <div className="space-y-2">
                                                                    {myTeam.guideStatus === 'REJECTED' && (
                                                                        <div className="p-2 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 mb-2 animate-in fade-in slide-in-from-top-1">
                                                                            <XCircle size={14} className="text-red-500" />
                                                                            <p className="text-[10px] text-red-700 font-bold">Request rejected by {myTeam.guide?.name}. Select another Guide.</p>
                                                                        </div>
                                                                    )}
                                                                    <select className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none" value={selectedGuideId} onChange={e => setSelectedGuideId(e.target.value)}>
                                                                        <option value="">Select Guide...</option>
                                                                        {facultyList
                                                                            .filter(f => f.isGuide && (f.batchOccupancy ?? 0) < 4)
                                                                            .map(f => <option key={f.id} value={f.id}>{f.name} (Slots: {4 - (f.batchOccupancy || 0)}/4 left)</option>)
                                                                        }
                                                                    </select>
                                                                    <button onClick={handleSelectGuide} className="w-full bg-blue-600 text-white py-1.5 rounded-lg text-xs font-bold">Assign Guide</button>
                                                                    <p className="text-[9px] text-gray-400 italic">Showing faculty with &lt; 4 teams in this batch.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Expert Selection */}
                                                    {scope.requireSubjectExpert && (
                                                        <div className={`p-4 rounded-xl border ${myTeam.subjectExpert ? 'bg-white border-green-200' : 'bg-gray-50 border-gray-100'} ${(!scope.requireGuide || myTeam.guide) ? '' : 'opacity-50 pointer-events-none'}`}>
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Expert</p>
                                                            {myTeam.subjectExpert && myTeam.expertStatus !== 'REJECTED' ? (
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xs">{myTeam.subjectExpert.name[0]}</div>
                                                                        <div className="text-sm font-bold text-gray-800">{myTeam.subjectExpert.name}</div>
                                                                    </div>
                                                                    {myTeam.expertStatus === 'PENDING' && (
                                                                        <span className="text-[9px] bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200 font-black uppercase tracking-wider">Pending</span>
                                                                    )}
                                                                    {myTeam.expertStatus === 'APPROVED' && (
                                                                        <span className="text-[9px] bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200 font-black uppercase tracking-wider">Approved</span>
                                                                    )}
                                                                </div>
                                                            ) : scopeMe?.isLeader && (
                                                                <div className="space-y-2">
                                                                    {myTeam.expertStatus === 'REJECTED' && (
                                                                        <div className="p-2 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 mb-2 animate-in fade-in slide-in-from-top-1">
                                                                            <XCircle size={14} className="text-red-500" />
                                                                            <p className="text-[10px] text-red-700 font-bold">Request rejected by {myTeam.subjectExpert?.name}. Select another Expert.</p>
                                                                        </div>
                                                                    )}
                                                                    <select className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none" value={selectedExpertId} onChange={e => setSelectedExpertId(e.target.value)}>
                                                                        <option value="">Select Expert...</option>
                                                                        {facultyList
                                                                            .filter(f => f.isSubjectExpert && (f.batchOccupancy ?? 0) < 4)
                                                                            .map(f => <option key={f.id} value={f.id}>{f.name} (Slots: {4 - (f.batchOccupancy || 0)}/4 left)</option>)
                                                                        }
                                                                    </select>
                                                                    <button
                                                                        disabled={scope.requireGuide && !myTeam.guide}
                                                                        onClick={handleSelectExpert}
                                                                        className="w-full bg-purple-600 text-white py-1.5 rounded-lg text-xs font-bold disabled:bg-gray-400"
                                                                    >
                                                                        Assign Expert
                                                                    </button>
                                                                    <p className="text-[9px] text-gray-400 italic">Showing faculty with &lt; 4 teams in this batch.</p>
                                                                </div>
                                                            )}
                                                            {scope.requireGuide && !myTeam.guide && <p className="text-[10px] text-red-500 font-bold mt-1">Select Guide first</p>}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Changes Required Countdown Timer */}
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
                                                        <div className="mt-4 p-5 bg-red-50 border-2 border-red-200 rounded-2xl">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                                                                    <Timer size={20} className="text-red-600" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-black text-red-700 uppercase tracking-wide">Resubmission Deadline Expired</p>
                                                                    <p className="text-[10px] text-red-500 font-bold">The 24-hour window to address changes has passed.</p>
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-red-600 mt-2 pl-[52px]">Feedback: <span className="italic">"{changesReview.content}"</span></p>
                                                        </div>
                                                    );
                                                }

                                                const hours = Math.floor(diff / (1000 * 60 * 60));
                                                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                                                const isUrgent = diff < 2 * 60 * 60 * 1000; // less than 2 hours

                                                return (
                                                    <div className={`mt-4 p-5 rounded-2xl border-2 ${isUrgent ? 'bg-red-50 border-red-200 animate-pulse' : 'bg-orange-50 border-orange-200'}`}>
                                                        <div className="flex items-start gap-3">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isUrgent ? 'bg-red-100' : 'bg-orange-100'}`}>
                                                                <Timer size={20} className={isUrgent ? 'text-red-600' : 'text-orange-600'} />
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className={`text-sm font-black uppercase tracking-wide ${isUrgent ? 'text-red-700' : 'text-orange-700'}`}>Changes Required — Resubmit Before</p>
                                                                <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                                                                    Deadline: {deadline.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} • By {changesReview.faculty?.name || 'Reviewer'}
                                                                    {changesReview.reviewPhase && <span className="ml-1.5 bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200 text-[9px] font-black uppercase">Phase {changesReview.reviewPhase}</span>}
                                                                </p>
                                                                <div className="flex gap-3 mt-3">
                                                                    {[{ label: 'Hours', value: String(hours).padStart(2, '0') }, { label: 'Minutes', value: String(minutes).padStart(2, '0') }, { label: 'Seconds', value: String(seconds).padStart(2, '0') }].map(t => (
                                                                        <div key={t.label} className={`flex flex-col items-center px-4 py-2 rounded-xl ${isUrgent ? 'bg-red-100' : 'bg-orange-100'}`}>
                                                                            <span className={`text-2xl font-black tabular-nums ${isUrgent ? 'text-red-700' : 'text-orange-700'}`}>{t.value}</span>
                                                                            <span className={`text-[8px] font-black uppercase tracking-widest ${isUrgent ? 'text-red-400' : 'text-orange-400'}`}>{t.label}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <p className={`text-xs mt-3 italic ${isUrgent ? 'text-red-600' : 'text-orange-600'}`}>
                                                                    "{changesReview.content}"
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Action Buttons — hidden when status is READY_FOR_REVIEW or PENDING */}
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
                                                        <div className="pt-4 border-t border-gray-100">
                                                            <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex items-center gap-3">
                                                                <CheckCircle size={20} className="text-green-500" />
                                                                <p className="text-sm text-green-700 font-bold">
                                                                    All {totalPhases} review phases completed! 🎉
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                if (hasMissedCurrentPhase) {
                                                    return (
                                                        <div className="pt-4 border-t border-gray-100">
                                                            <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3">
                                                                <XCircle size={20} className="text-red-500" />
                                                                <p className="text-sm text-red-700 font-bold">
                                                                    Phase {currentPhase} was missed (Not Completed). Please wait for admin to reassign this phase.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                if (hasCompletedCurrentPhase || hasPendingReview) {
                                                    return (
                                                        <div className="pt-4 border-t border-gray-100">
                                                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-3">
                                                                <Clock size={20} className="text-blue-500" />
                                                                <p className="text-sm text-blue-700 font-bold">
                                                                    {hasPendingReview
                                                                        ? 'Review in progress. Please wait for faculty feedback.'
                                                                        : `Phase ${highestPassedPhase} completed. Wait for the next review phase assignment.`
                                                                    }
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="pt-4 border-t border-gray-100">
                                                        {(!scope.requireGuide || (myTeam.guide && myTeam.guideStatus === 'APPROVED')) &&
                                                            (!scope.requireSubjectExpert || (myTeam.subjectExpert && myTeam.expertStatus === 'APPROVED')) ? (
                                                            <button onClick={handleSubmitForReview} className="w-full bg-black text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-sm hover:bg-gray-800">
                                                                Submit Project for Review (Phase {currentPhase})
                                                            </button>
                                                        ) : (
                                                            <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-center gap-3">
                                                                <AlertCircle size={20} className="text-orange-500" />
                                                                <p className="text-sm text-orange-700 font-bold">
                                                                    Submission Locked: Waiting for {
                                                                        (!scope.requireGuide || (myTeam.guide && myTeam.guideStatus === 'APPROVED'))
                                                                            ? 'Expert'
                                                                            : (!scope.requireSubjectExpert || (myTeam.subjectExpert && myTeam.expertStatus === 'APPROVED'))
                                                                                ? 'Guide'
                                                                                : 'Guide & Expert'
                                                                    } approval.
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Review History */}
                                            {myTeam?.project && (!scope.requireGuide || myTeam.guide) && (!scope.requireSubjectExpert || myTeam.subjectExpert) && (
                                                <div className="mt-6">
                                                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 font-outfit">
                                                        <MessageSquare className="text-blue-600" size={20} /> Review History
                                                    </h3>
                                                    <div className="space-y-4">
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
                                                                return <p className="text-gray-400 text-sm">No review history yet.</p>;
                                                            }

                                                            return fullHistory.map((item, idx) => {
                                                                if (item.type === 'MISSED') {
                                                                    return (
                                                                        <div key={item.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 shadow-sm opacity-75">
                                                                            <div className="flex justify-between items-start mb-2">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center text-gray-500 font-bold"><Clock size={16} /></div>
                                                                                    <div>
                                                                                        <p className="text-sm font-bold text-gray-600 flex items-center gap-2">
                                                                                            {item.faculty?.name || "Reviewer"}
                                                                                            {item.reviewPhase && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded border border-gray-300 uppercase font-black tracking-wide">Phase {item.reviewPhase}</span>}
                                                                                        </p>
                                                                                        <p className="text-[10px] text-gray-400 font-bold uppercase">Expired on {new Date(item.createdAt).toLocaleDateString()}</p>
                                                                                    </div>
                                                                                </div>
                                                                                <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full border bg-gray-200 text-gray-600 border-gray-300">
                                                                                    MISSED
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-xs text-gray-500 italic pl-14">Review window expired without submission or feedback.</p>
                                                                        </div>
                                                                    );
                                                                }

                                                                if (item.type === 'DEADLINE_MISSED') {
                                                                    return (
                                                                        <div key={item.id} className="bg-red-50 p-5 rounded-2xl border border-red-100 shadow-sm opacity-90">
                                                                            <div className="flex justify-between items-start mb-2">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-500 font-bold"><Calendar size={16} /></div>
                                                                                    <div>
                                                                                        <p className="text-sm font-bold text-red-800 flex items-center gap-2">
                                                                                            Batch Deadline Passed
                                                                                            {item.reviewPhase && <span className="text-[10px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded border border-red-300 uppercase font-black tracking-wide">Phase {item.reviewPhase}</span>}
                                                                                        </p>
                                                                                        <p className="text-[10px] text-red-400 font-bold uppercase">Deadline was {new Date(item.createdAt).toLocaleDateString()}</p>
                                                                                    </div>
                                                                                </div>
                                                                                <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full border bg-red-100 text-red-700 border-red-200">
                                                                                    ABSENT
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-xs text-red-600 font-medium pl-14">Review window for this phase has closed. Automatically marked as absent.</p>
                                                                        </div>
                                                                    );
                                                                }

                                                                const r = item;
                                                                return (
                                                                    <div key={r.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                                                                        <div className="flex justify-between items-start mb-4">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 font-bold">{fullHistory.length - idx}</div>
                                                                                <div>
                                                                                    <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                                                        {r.faculty?.name || "Reviewer"}
                                                                                        {myTeam.guideId === r.facultyId && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 uppercase font-black tracking-wide">Guide</span>}
                                                                                        {myTeam.subjectExpertId === r.facultyId && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 uppercase font-black tracking-wide">Expert</span>}
                                                                                        {r.reviewPhase && <span className="text-[10px] bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-100 uppercase font-black tracking-wide">Phase {r.reviewPhase}</span>}
                                                                                    </p>
                                                                                    <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(r.createdAt).toLocaleDateString()}</p>
                                                                                </div>
                                                                            </div>
                                                                            <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${r.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                                                                {r.status.replace('_', ' ')}
                                                                            </span>
                                                                        </div>
                                                                        <div className="space-y-3">
                                                                            {scope?.resultsPublished && r.reviewMarks && r.reviewMarks.length > 0 && (
                                                                                <div className="flex flex-wrap gap-2">
                                                                                    {r.reviewMarks.map((mark, i) => {
                                                                                        const isMe = mark.studentId === user?.id;
                                                                                        const name = isMe ? "You" : (myTeam.members.find(m => m.userId === mark.studentId)?.user.name.split(' ')[0] || "Student");

                                                                                        let tooltip = "";
                                                                                        let displayScore = mark.marks;

                                                                                        if (mark.criterionMarks) {
                                                                                            try {
                                                                                                const cm = JSON.parse(mark.criterionMarks);
                                                                                                if (cm._total) {
                                                                                                    displayScore = `${mark.marks} / ${cm._total}`;
                                                                                                    tooltip = Object.entries(cm)
                                                                                                        .filter(([k]) => k !== '_total')
                                                                                                        .map(([k, v]) => `${k}: ${v.score}/${v.max}`)
                                                                                                        .join('\n');
                                                                                                }
                                                                                            } catch (e) {
                                                                                                console.error("Error parsing marks", e);
                                                                                            }
                                                                                        }

                                                                                        return (
                                                                                            <span key={i} title={tooltip} className={`text-[10px] px-3 py-1 rounded-full font-black border transition-all ${isMe ? 'bg-blue-600 text-white border-blue-700 shadow-sm shadow-blue-100' : 'bg-gray-100 text-gray-700 border-gray-200'} ${tooltip ? 'cursor-help underline decoration-dotted underline-offset-2' : ''}`}>
                                                                                                {name}: <span className={isMe ? 'text-white' : 'text-blue-600'}>{displayScore}</span>
                                                                                            </span>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}
                                                                            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50/50 p-4 rounded-xl border border-gray-100">{r.content}</p>

                                                                            {r.resubmittedAt && (
                                                                                <div className="mt-2 flex flex-col pl-4 border-l-2 border-orange-100">
                                                                                    <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest mb-1">Resubmission History / Context</span>
                                                                                    <pre className="text-[10px] text-orange-800 italic whitespace-pre-wrap font-sans leading-tight bg-orange-50/30 p-2 rounded">
                                                                                        {r.resubmissionNote}
                                                                                    </pre>
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
                                                    <div className="mt-4 space-y-3">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Past Review Schedules</p>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {pastAssignments.map(assignment => (
                                                                <div key={assignment.id} className="p-4 bg-gray-50 border border-gray-100 rounded-2xl shadow-sm flex items-center gap-4 opacity-75">
                                                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-gray-100 text-gray-400">
                                                                        <Clock size={20} />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">{assignment.faculty?.name || "Reviewer"}</p>
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                                <span className="text-[8px] font-black text-gray-300 uppercase shrink-0">From:</span>
                                                                                <span className="text-[11px] font-bold text-gray-500 truncate">
                                                                                    {assignment.accessStartsAt ? new Date(assignment.accessStartsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                                <span className="text-[8px] font-black text-gray-300 uppercase shrink-0">To:</span>
                                                                                <span className="text-[11px] font-bold text-gray-500 truncate">
                                                                                    {assignment.accessExpiresAt ? new Date(assignment.accessExpiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex gap-2 mt-1">
                                                                            <span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200 font-bold uppercase tracking-wider">Phase {assignment.reviewPhase || 1}</span>
                                                                            <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${assignment.mode === 'ONLINE' ? 'bg-blue-50 text-blue-500 border-blue-100' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                                                                {assignment.mode}
                                                                            </span>
                                                                            <span className="text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider bg-red-50 text-red-500 border-red-100">Expired</span>
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

                            {/* Project Rubrics */}
                            {myTeam?.project && rubrics.length > 0 && (
                                <div className="mt-8">
                                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 font-outfit">
                                        <CheckCircle className="text-green-600" size={20} /> Evaluation Rubrics
                                    </h3>
                                    <div className="space-y-6">
                                        {rubrics.map((rubric) => {
                                            let criteria = [];
                                            try {
                                                criteria = typeof rubric.criteria === 'string' ? JSON.parse(rubric.criteria) : rubric.criteria;
                                            } catch (e) {
                                                console.error("Error parsing rubric criteria", e);
                                            }

                                            return (
                                                <div key={rubric.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                                    <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
                                                        <div>
                                                            <h4 className="font-bold text-gray-800">{rubric.name}</h4>
                                                            <p className="text-[10px] text-gray-400 font-bold uppercase">Phase {rubric.phase}</p>
                                                        </div>
                                                    </div>
                                                    <div className="divide-y divide-gray-50">
                                                        {criteria.map((c, i) => (
                                                            <div key={i} className="p-6 hover:bg-gray-50/50 transition-colors">
                                                                <div className="flex justify-between items-start gap-4 mb-2">
                                                                    <p className="font-bold text-gray-800 text-sm">{c.name}</p>
                                                                </div>
                                                                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                                                                    {c.description}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        // NO TEAM START - FULL WIDTH PROJECT GRID
                        <div className="col-span-3 space-y-6">
                            <div className="bg-blue-50 rounded-2xl p-8 text-center border border-blue-100">
                                <h2 className="text-2xl font-bold text-blue-900 mb-2">Start Your Project</h2>
                                <p className="text-blue-600 text-sm max-w-lg mx-auto">
                                    Select a project from the list below to automatically create your team and get started.
                                </p>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4 mb-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition shadow-sm"
                                        placeholder="Search by project title..."
                                        value={projectSearch}
                                        onChange={e => setProjectSearch(e.target.value)}
                                    />
                                </div>
                                <select
                                    className="px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition shadow-sm font-bold text-gray-700 min-w-[200px]"
                                    value={categoryFilter}
                                    onChange={e => setCategoryFilter(e.target.value)}
                                >
                                    {uniqueCategories.map(c => (
                                        <option key={c} value={c}>{c === 'ALL' ? 'All Domains' : c}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredProjects.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => selectProject(p.id, p.title)}
                                        className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-300 hover:-translate-y-1 transition-all group cursor-pointer h-full flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                                                    {p.category}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors mb-2">
                                                {p.title}
                                            </h3>
                                            <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed">
                                                {p.description || "No description provided."}
                                            </p>
                                        </div>
                                        <div className="pt-6 mt-4 border-t border-gray-50 flex items-center justify-between text-xs font-bold text-gray-400 group-hover:text-gray-600">
                                            <span>Max Team Size: {p.maxTeamSize}</span>
                                            <div className="flex items-center gap-1 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Select <CheckCircle size={14} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {projects.length === 0 && (
                                <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                                    <p className="text-gray-400 font-bold text-lg">No projects available right now.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* RIGHT COLUMN: Available Projects (ONLY SHOW IF TEAM EXISTS) */}
                    {myTeam && (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm sticky top-6">
                                <div className="mb-4">
                                    <h4 className="font-bold text-gray-800">Available Projects</h4>
                                    <p className="text-xs text-gray-500">Pick a project for this batch</p>
                                </div>

                                {/* Search & Filter */}
                                <div className="space-y-3 mb-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="text"
                                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-300 transition"
                                            placeholder="Search title..."
                                            value={projectSearch}
                                            onChange={e => setProjectSearch(e.target.value)}
                                        />
                                    </div>
                                    <select
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-300 transition font-bold text-gray-600"
                                        value={categoryFilter}
                                        onChange={e => setCategoryFilter(e.target.value)}
                                    >
                                        {uniqueCategories.map(c => (
                                            <option key={c} value={c}>{c === 'ALL' ? 'All Domains' : c}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className={`space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
                                    {filteredProjects.map(p => {
                                        // Check if disabled: user already has a pending/active project in this team
                                        const hasProject = myTeam?.project || myTeam?.projectRequests?.some(r => r.status === 'PENDING');

                                        return (
                                            <div key={p.id} className="p-4 rounded-xl border border-gray-100 hover:border-blue-200 transition-all hover:shadow-md bg-white group cursor-pointer"
                                                onClick={() => !hasProject && selectProject(p.id, p.title)}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{p.category}</span>
                                                    {hasProject && <span className="text-[9px] font-bold text-gray-300">Disabled</span>}
                                                </div>
                                                <h5 className="text-sm font-bold text-gray-800 leading-tight group-hover:text-blue-700 transition-colors">{p.title}</h5>
                                                <p className="text-xs text-gray-400 mt-2 line-clamp-2">{p.description}</p>
                                            </div>
                                        );
                                    })}
                                    {projects.length === 0 && (
                                        <div className="text-center py-8 text-gray-400 text-xs">No projects available for this batch.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
            {/* SUBMIT REVIEW MODAL */}
            {isSubmitModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-800">Submit for Review</h3>
                            <button onClick={() => setIsSubmitModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
                        </div>

                        <p className="text-sm text-gray-500 mb-4">
                            You are about to submit your project for <strong>Phase {currentPhase}</strong> review.
                            This will lock further changes until the review is complete.
                        </p>

                        <div className="mb-6">
                            <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Note for Reviewer (Optional)</label>
                            <textarea
                                className="w-full border-gray-200 border p-3 rounded-xl focus:ring-2 ring-blue-500 outline-none resize-none text-sm"
                                rows={3}
                                placeholder="E.g. Addressed previous feedback regarding..."
                                value={resubmissionNote}
                                onChange={e => setResubmissionNote(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsSubmitModalOpen(false)}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSubmitReview}
                                disabled={isSubmitting}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2 transition-colors"
                            >
                                {isSubmitting ? 'Submitting...' : 'Confirm Submission'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
