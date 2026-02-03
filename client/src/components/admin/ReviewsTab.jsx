import React, { useState } from 'react';
import { Search, MessageSquare, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import SearchInput from '../ui/SearchInput';
import StatusBadge from '../ui/StatusBadge';

export default function ReviewsTab({
    teams,
    loadData,
    api,
    faculty
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedTeamId, setExpandedTeamId] = useState(null);
    const [reviewText, setReviewText] = useState("");
    const [reviewStatus, setReviewStatus] = useState("NOT_COMPLETED");
    const [reviewPhase, setReviewPhase] = useState("1");
    const [individualMarks, setIndividualMarks] = useState({});

    // Only show teams that have a project locked
    const activeTeams = teams.filter(t => t.projectId);

    const filteredTeams = activeTeams.filter(team =>
        team.project?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.members.some(m =>
            m.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.user.rollNumber && m.user.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()))
        )
    );

    const toggleExpand = (teamId) => {
        if (expandedTeamId === teamId) {
            setExpandedTeamId(null);
            setIndividualMarks({});
            setReviewPhase("1");
        } else {
            setExpandedTeamId(teamId);
            setIndividualMarks({});
            setReviewPhase("1");
            const team = filteredTeams.find(t => t.id === teamId);
            if (team) setReviewStatus(team.status);
        }
    };

    const submitReview = async (e, teamId, projectId) => {
        if (e) e.stopPropagation();

        try {
            const marksPayload = Object.entries(individualMarks).map(([studentId, marks]) => ({
                studentId,
                marks: parseInt(marks)
            }));

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
            setReviewPhase("1");
            setExpandedTeamId(null);
            loadData();
            alert("Review submitted & Status updated!");
        } catch (e) {
            alert(e.response?.data?.error || "Error submitting review");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><MessageSquare size={24} /></div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 tracking-tight">Project Progress & Reviews</h2>
                        <p className="text-sm text-gray-500">Manage review history and submit feedback</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Search projects or lead..."
                        className="w-72"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredTeams.length === 0 && (
                    <div className="text-center py-12 bg-white rounded shadow-sm border border-dashed text-gray-400">
                        No projects found matching your criteria.
                    </div>
                )}

                {filteredTeams.map(team => {
                    const isExpanded = expandedTeamId === team.id;
                    const leader = team.members.find(m => m.isLeader)?.user || team.members[0]?.user || { name: 'Unknown', rollNumber: 'N/A' };
                    const otherMembers = team.members.filter(m => m.user.id !== leader.id);

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
                                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                                            <span className="font-semibold text-gray-700">Lead:</span> {leader.name} ({leader.rollNumber || 'N/A'})
                                        </span>
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
                                                                            <div key={r.id} className="p-4 relative">
                                                                                {phaseReviews.length > 1 && idx < phaseReviews.length - 1 && (
                                                                                    <div className="absolute left-6 top-10 bottom-0 w-0.5 bg-gray-200/50 z-0" />
                                                                                )}

                                                                                <div className="flex gap-3 relative z-10">
                                                                                    <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${r.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : r.status === 'CHANGES_REQUIRED' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                                        {idx + 1}
                                                                                    </div>

                                                                                    <div className="flex-1 min-w-0">
                                                                                        <div className="flex justify-between items-start mb-1">
                                                                                            <p className="text-xs font-bold text-gray-800 truncate flex items-center gap-1.5">
                                                                                                {r.faculty?.name || "Admin"}
                                                                                                {r.faculty?.rollNumber && <span className="opacity-40 font-mono text-[9px]">({r.faculty.rollNumber})</span>}

                                                                                                {team.guideId === r.facultyId && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 uppercase font-black tracking-wide">Guide</span>}
                                                                                                {team.subjectExpertId === r.facultyId && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 uppercase font-black tracking-wide">Expert</span>}
                                                                                            </p>
                                                                                            <span className="text-[9px] text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                                                                                        </div>

                                                                                        {/* Individual Marks Display */}
                                                                                        {r.reviewMarks && r.reviewMarks.length > 0 && (
                                                                                            <div className="mb-2 flex flex-wrap gap-1.5">
                                                                                                {r.reviewMarks.map((mark, i) => {
                                                                                                    const studentName = team.members.find(m => m.userId === mark.studentId)?.user.name.split(' ')[0] || "Student";
                                                                                                    return (
                                                                                                        <span key={i} className="text-[9px] bg-white text-green-600 px-1.5 py-0.5 rounded border border-green-100 font-bold">
                                                                                                            {studentName}: {mark.marks}
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

                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Update Project Status</label>
                                                <select
                                                    className="w-full border-gray-200 border p-2.5 text-sm rounded-lg bg-white focus:ring-2 ring-blue-500 outline-none transition-all shadow-sm"
                                                    value={reviewStatus}
                                                    onChange={e => setReviewStatus(e.target.value)}
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
                                                    onChange={e => setReviewPhase(e.target.value)}
                                                >
                                                    <option value="1">Phase 1</option>
                                                    <option value="2">Phase 2</option>
                                                    <option value="3">Phase 3</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Individual Marks (0-10)</label>
                                                <div className="space-y-2 bg-white border border-gray-100 rounded-lg p-3">
                                                    {team.members
                                                        .filter(m => m.approved)
                                                        .map(member => (
                                                            <div key={member.user.id} className="flex items-center justify-between gap-4">
                                                                <span className="text-sm font-medium text-gray-700 truncate w-1/2" title={member.user.name}>{member.user.name}</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="10"
                                                                    placeholder="-"
                                                                    value={individualMarks[member.user.id] || ""}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setIndividualMarks(prev => ({
                                                                            ...prev,
                                                                            [member.user.id]: val
                                                                        }));
                                                                    }}
                                                                    className="w-20 text-sm p-2 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                                />
                                                            </div>
                                                        ))}
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
                })}
            </div>
        </div>
    );
}
