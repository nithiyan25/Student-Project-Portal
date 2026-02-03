import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { Users, CheckCircle, MessageSquare, Search, ArrowLeft, XCircle, Check, AlertCircle, Clock } from 'lucide-react';

export default function StudentBatchDetail() {
    const { scopeId } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [scope, setScope] = useState(null);
    const [myTeam, setMyTeam] = useState(null);
    const [projects, setProjects] = useState([]);
    const [facultyList, setFacultyList] = useState([]);
    const [loading, setLoading] = useState(true);

    // Interaction State
    const [inviteEmail, setInviteEmail] = useState('');
    const [selectedGuideId, setSelectedGuideId] = useState('');
    const [selectedExpertId, setSelectedExpertId] = useState('');
    const [projectSearch, setProjectSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');

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
                alert("Batch not found or access denied.");
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
        } catch (e) {
            console.error('Error loading batch details:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [scopeId]);

    // --- ACTIONS ---



    const invite = async () => {
        if (!inviteEmail || !myTeam) return;
        try {
            await api.post('/teams/invite', { email: inviteEmail, teamId: myTeam.id });
            setInviteEmail('');
            loadData();
        } catch (e) {
            alert(e.response?.data?.error || "Error sending invitation");
        }
    };

    const handleAcceptInvite = async () => {
        if (!myTeam) return;
        try {
            await api.post('/teams/accept', { teamId: myTeam.id });
            loadData();
        } catch (e) {
            alert(e.response?.data?.error || "Error accepting invitation");
        }
    };

    const handleRejectInvite = async () => {
        if (!myTeam) return;
        if (!window.confirm("Are you sure you want to reject this invitation?")) return;
        try {
            await api.post('/teams/reject', { teamId: myTeam.id });
            setMyTeam(null);
            loadData();
        } catch (e) {
            alert(e.response?.data?.error || "Error rejecting invitation");
        }
    };

    const selectProject = async (projectId, projectTitle) => {
        if (!myTeam) {
            if (!window.confirm(`Select "${projectTitle}"? A new team will be created for you.`)) return;
        } else {
            if (!window.confirm(`Request "${projectTitle}" for your team?`)) return;
        }

        try {
            let teamIdToUse = myTeam?.id;
            if (!teamIdToUse) {
                const teamRes = await api.post('/teams', { scopeId });
                teamIdToUse = teamRes.data.id;
            }
            await api.post('/teams/select-project', { projectId, teamId: teamIdToUse });
            loadData();
        } catch (e) {
            alert(e.response?.data?.error || "Error selecting project");
        }
    };

    const handleSelectGuide = async () => {
        if (!selectedGuideId || !myTeam) return;
        try {
            await api.post('/teams/select-guide', { guideId: selectedGuideId, teamId: myTeam.id });
            loadData();
        } catch (e) {
            alert(e.response?.data?.error || "Error selecting guide");
        }
    };

    const handleSelectExpert = async () => {
        if (!selectedExpertId || !myTeam) return;
        try {
            await api.post('/teams/select-expert', { expertId: selectedExpertId, teamId: myTeam.id });
            loadData();
        } catch (e) {
            alert(e.response?.data?.error || "Error selecting expert");
        }
    };

    const handleSubmitForReview = async () => {
        if (!myTeam) return;
        const note = window.prompt("Add an optional note for the reviewer:");
        try {
            await api.post('/teams/submit-for-review', { resubmissionNote: note, teamId: myTeam.id });
            loadData();
        } catch (e) {
            alert(e.response?.data?.error || "Error submitting for review");
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

    const uniqueCategories = ['ALL', ...new Set(projects.map(p => p.category).filter(Boolean))];

    const filteredProjects = projects.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(projectSearch.toLowerCase());
        const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar variant="light" compact />
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

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* LEFT COLUMN: Team & Project Status */}
                    {myTeam ? (
                        <div className="lg:col-span-2 space-y-6">
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

                                            {/* Review Schedule / Assignments */}
                                            {myTeam.project.assignedFaculty?.length > 0 && (
                                                <div className="mt-4 space-y-3">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Review Schedule</p>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {myTeam.project.assignedFaculty.map(assignment => (
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
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
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

                                    {/* Action Buttons */}
                                    {myTeam.project && (
                                        <div className="pt-4 border-t border-gray-100">
                                            {(!scope.requireGuide || (myTeam.guide && myTeam.guideStatus === 'APPROVED')) &&
                                                (!scope.requireSubjectExpert || (myTeam.subjectExpert && myTeam.expertStatus === 'APPROVED')) ? (
                                                <button onClick={handleSubmitForReview} className="w-full bg-black text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-sm hover:bg-gray-800">
                                                    Submit Project for Review
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
                                    )}
                                </div>
                            </div>

                            {/* Review History */}
                            {myTeam?.project && (!scope.requireGuide || myTeam.guide) && (!scope.requireSubjectExpert || myTeam.subjectExpert) && myTeam?.reviews?.length > 0 && (
                                <div className="mt-8">
                                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 font-outfit">
                                        <MessageSquare className="text-blue-600" size={20} /> Review History
                                    </h3>
                                    <div className="space-y-4">
                                        {myTeam.reviews.map((r, idx) => (
                                            <div key={r.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 font-bold">{idx + 1}</div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                                {r.faculty?.name || "Reviewer"}
                                                                {myTeam.guideId === r.facultyId && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 uppercase font-black tracking-wide">Guide</span>}
                                                                {myTeam.subjectExpertId === r.facultyId && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 uppercase font-black tracking-wide">Expert</span>}
                                                            </p>
                                                            <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(r.createdAt).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${r.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                                        {r.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <div className="space-y-3">
                                                    {/* Individual Marks */}
                                                    {r.reviewMarks && r.reviewMarks.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {r.reviewMarks.map((mark, i) => {
                                                                const isMe = mark.studentId === user?.id;
                                                                const name = isMe ? "You" : (myTeam.members.find(m => m.userId === mark.studentId)?.user.name.split(' ')[0] || "Student");
                                                                return (
                                                                    <span key={i} className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${isMe ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                                                                        {name}: {mark.marks}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    <p className="text-sm text-gray-600 leading-relaxed bg-gray-50/50 p-4 rounded-xl border border-gray-100">{r.content}</p>
                                                </div>
                                            </div>
                                        ))}
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
        </div>
    );
}
