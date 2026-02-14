import React, { useState, useEffect } from 'react';
import api from '../../api';
import { X, FileText, Users, MessageSquare, Save, ExternalLink, Shield, AlertCircle, CheckCircle } from 'lucide-react';

export default function ProjectDetailsModal({ team, onClose, onUpdate, readOnly = false }) {
    const [project, setProject] = useState(team?.project || null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editData, setEditData] = useState({
        techStack: project?.techStack || '',
        srs: project?.srs || ''
    });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // If only team object with nested project was passed, we might want to fetch fresh details
    // or just use what we have. For history, we definitely need to fetch if not present.
    const [fullTeam, setFullTeam] = useState(team);

    useEffect(() => {
        if (team?.id) {
            // Fetch latest team/project details including full review history
            setLoading(true);
            api.get(`/admin/teams/${team.id}`)
                .then(res => {
                    setFullTeam(res.data);
                    setProject(res.data.project);
                    setEditData({
                        techStack: res.data.project?.techStack || '',
                        srs: res.data.project?.srs || ''
                    });
                })
                .catch(err => setError("Failed to load project details"))
                .finally(() => setLoading(false));
        }
    }, [team?.id]);

    const handleSave = async () => {
        if (!project?.id) return;
        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            await api.patch(`/projects/${project.id}`, editData);
            setSuccess(true);
            if (onUpdate) onUpdate();
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to update project");
        } finally {
            setSaving(false);
        }
    };

    if (!team) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-slate-800 line-clamp-1">{project?.title || "Project Details"}</h2>
                            <p className="text-xs text-slate-500 font-medium">
                                {project?.category} • {fullTeam?.scope?.name}

                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="font-medium">Loading project information...</p>
                        </div>
                    ) : (
                        <>
                            {/* Top Section: Overview & Edit */}
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Shield size={14} /> Project Overview
                                    </h3>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 italic text-slate-600 text-sm leading-relaxed">
                                        {project?.description || "No description provided."}
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500">Tech Stack</label>
                                            <input
                                                type="text"
                                                value={editData.techStack}
                                                onChange={e => setEditData({ ...editData, techStack: e.target.value })}
                                                placeholder="e.g. MERN, Python, TensorFlow"
                                                disabled={readOnly}
                                                className={`w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 ring-blue-500 outline-none text-sm transition-all shadow-sm ${readOnly ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500">SRS Document Link</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="url"
                                                    value={editData.srs}
                                                    onChange={e => setEditData({ ...editData, srs: e.target.value })}
                                                    placeholder="https://docs.google.com/..."
                                                    disabled={readOnly}
                                                    className={`flex-1 px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 ring-blue-500 outline-none text-sm transition-all shadow-sm ${readOnly ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}
                                                />
                                                {editData.srs && (
                                                    <a href={editData.srs} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                                                        <ExternalLink size={18} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        {!readOnly && (
                                            <button
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                {saving ? "Saving..." : <><Save size={18} /> Update Technical Details</>}
                                            </button>
                                        )}

                                        {error && (
                                            <div className="flex items-center gap-2 text-red-600 text-xs font-bold bg-red-50 p-2 rounded-lg border border-red-100">
                                                <AlertCircle size={14} /> {error}
                                            </div>
                                        )}
                                        {success && (
                                            <div className="flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 p-2 rounded-lg border border-green-100">
                                                <CheckCircle size={14} /> Updated successfully!
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Users size={14} /> Team Members
                                    </h3>
                                    <div className="grid gap-2">
                                        {fullTeam?.members?.filter(m => m.approved).map(m => (
                                            <div key={m.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                                                        {m.user?.name?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-700 text-sm">
                                                            {m.user?.name} {m.isLeader && <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase font-black">Leader</span>}
                                                        </p>
                                                        <p className="text-xs text-slate-400">{m.user?.rollNumber} • {m.user?.department}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Review History Section */}
                            <div className="space-y-4 border-t pt-8">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <MessageSquare size={14} /> Review History
                                </h3>

                                <div className="space-y-4">
                                    {(!fullTeam?.reviews || fullTeam.reviews.length === 0) ? (
                                        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm italic">
                                            No reviews recorded for this team yet.
                                        </div>
                                    ) : (
                                        fullTeam.reviews.map(review => (
                                            <div key={review.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600">
                                                            {review.faculty?.name?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-800 text-sm">{review.faculty?.name}</span>
                                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Phase {review.reviewPhase}</span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(review.createdAt).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${review.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                                                        {review.status?.replace('_', ' ')}
                                                    </span>
                                                </div>

                                                {review.reviewMarks && review.reviewMarks.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 py-1 border-y border-slate-50">
                                                        {review.reviewMarks.map((m, i) => {
                                                            const studentName = fullTeam.members.find(tm => tm.user.id === m.studentId)?.user.name.split(' ')[0] || "Student";
                                                            let tooltip = "";
                                                            let totalScale = "";
                                                            if (m.criterionMarks) {
                                                                try {
                                                                    const cm = JSON.parse(m.criterionMarks);
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
                                                                <div key={i} title={tooltip} className={`text-xs font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 ${tooltip ? 'cursor-help underline decoration-dotted' : ''}`}>
                                                                    {studentName}: <span className="font-black text-blue-600">{m.marks}{totalScale}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-50 italic">
                                                    "{review.content}"
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-slate-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-colors shadow-sm"
                    >
                        Close Details
                    </button>
                </div>
            </div>
        </div>
    );
}
