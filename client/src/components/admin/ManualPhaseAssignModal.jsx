import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Filter, CheckCircle2, Users, Briefcase, Clock, AlertCircle, Check, Layout } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ManualPhaseAssignModal({ isOpen, onClose, faculty, scopes, api, onAssign }) {
    const { addToast } = useToast();
    const [selectedScope, setSelectedScope] = useState('');
    const [selectedPhase, setSelectedPhase] = useState('1');
    const [eligibleTeams, setEligibleTeams] = useState([]);
    const [isLoadingTeams, setIsLoadingTeams] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [facultySearchTerm, setFacultySearchTerm] = useState('');
    const [selectedTeamIds, setSelectedTeamIds] = useState([]);
    const [selectedFacultyIds, setSelectedFacultyIds] = useState([]);

    const [duration, setDuration] = useState('48');
    const [reviewMode, setReviewMode] = useState('OFFLINE');
    const [distributeEvenly, setDistributeEvenly] = useState(false);
    const [useVenueFaculty, setUseVenueFaculty] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initial load: pick first scope if available
    useEffect(() => {
        if (isOpen && scopes.length > 0 && !selectedScope) {
            setSelectedScope(scopes[0].id);
        }
    }, [isOpen, scopes]);

    // Fetch eligible teams when Scope or Phase changes
    const fetchEligibleTeams = async () => {
        if (!selectedScope || !selectedPhase) return;
        setIsLoadingTeams(true);
        try {
            const res = await api.get('/admin/eligible-review-teams', {
                params: { scopeId: selectedScope, phase: selectedPhase }
            });
            setEligibleTeams(res.data);
            setSelectedTeamIds([]); // Reset selection when list changes
        } catch (err) {
            console.error("Error fetching eligible teams:", err);
        } finally {
            setIsLoadingTeams(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchEligibleTeams();
    }, [isOpen, selectedScope, selectedPhase]);

    const filteredTeams = useMemo(() => {
        return eligibleTeams.filter(t => {
            const term = searchTerm.toLowerCase();
            return t.project?.title?.toLowerCase().includes(term) ||
                t.members?.some(m =>
                    m.user.name.toLowerCase().includes(term) ||
                    (m.user.rollNumber && m.user.rollNumber.toLowerCase().includes(term))
                );
        });
    }, [eligibleTeams, searchTerm]);

    const filteredFaculty = useMemo(() => {
        return faculty.filter(f => {
            const term = facultySearchTerm.toLowerCase();
            return f.name.toLowerCase().includes(term) ||
                (f.rollNumber && f.rollNumber.toLowerCase().includes(term));
        });
    }, [faculty, facultySearchTerm]);

    const maxPhases = useMemo(() => {
        const currentScope = scopes.find(s => s.id === selectedScope);
        return currentScope ? currentScope.numberOfPhases : 4;
    }, [selectedScope, scopes]);

    const toggleTeam = (id) => {
        setSelectedTeamIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleFaculty = (id) => {
        setSelectedFacultyIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSubmit = async () => {
        if (selectedTeamIds.length === 0) {
            addToast("Please select at least one team.", 'warning');
            return;
        }

        if (!useVenueFaculty && selectedFacultyIds.length === 0) {
            addToast("Please select faculty members or enable Venue-based assignment.", 'warning');
            return;
        }

        const projectIds = eligibleTeams
            .filter(t => selectedTeamIds.includes(t.id))
            .map(t => {
                // Return explicitly assigned project ID OR project ID from first pending request
                if (t.projectId) return t.projectId;
                if (t.projectRequests && t.projectRequests.length > 0) return t.projectRequests[0].projectId;
                return null;
            })
            .filter(id => id); // Ensure no nulls

        if (projectIds.length === 0) {
            addToast("None of the selected teams have an assigned project or a pending project request. A project is required for review assignment.", 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            await onAssign({
                projectIds: projectIds,
                facultyIds: useVenueFaculty ? [] : selectedFacultyIds,
                useVenueFaculty: useVenueFaculty,
                scopeId: selectedScope,
                reviewPhase: parseInt(selectedPhase),
                accessDurationHours: parseInt(duration),
                distributeEvenly: distributeEvenly,
                mode: reviewMode
            });
            onClose();
        } catch (e) {
            addToast(e.response?.data?.error || "Error during assignment", 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white/20">
                {/* Header */}
                <div className="p-8 bg-gradient-to-r from-purple-600 to-indigo-700 text-white shrink-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-black flex items-center gap-3 tracking-tight">
                                Manual Phase Assignment
                                <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/10 font-bold">Lagging Students</span>
                            </h2>
                            <p className="opacity-90 mt-2 text-sm font-medium">Assign reviews for teams that haven't completed a specific phase</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all hover:scale-110 active:scale-90"><X size={28} /></button>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="px-8 py-4 bg-gray-50 border-b flex gap-4 items-center">
                    <div className="flex-1 max-w-xs">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1 ml-1">Project Batch</label>
                        <select
                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none"
                            value={selectedScope}
                            onChange={e => setSelectedScope(e.target.value)}
                        >
                            {scopes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="w-32">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1 ml-1">Phase</label>
                        <select
                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none"
                            value={selectedPhase}
                            onChange={e => setSelectedPhase(e.target.value)}
                        >
                            {Array.from({ length: maxPhases }, (_, i) => i + 1).map(p => (
                                <option key={p} value={String(p)}>Phase {p}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1"></div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-gray-500 uppercase">Eligible Teams</p>
                        <p className="text-2xl font-black text-indigo-600">
                            {isLoadingTeams ? "..." : eligibleTeams.length}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-x divide-gray-100">
                    {/* Left: Team Selection */}
                    <div className="flex-1 flex flex-col p-8 overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Users size={14} className="text-blue-500" />
                                1. Select Teams ({selectedTeamIds.length})
                            </h3>
                            <button
                                onClick={() => setSelectedTeamIds(selectedTeamIds.length === filteredTeams.length ? [] : filteredTeams.map(t => t.id))}
                                className="text-xs font-bold text-blue-600 uppercase tracking-tight"
                            >
                                {selectedTeamIds.length === filteredTeams.length ? "Deselect All" : "Select All Filtered"}
                            </button>
                        </div>
                        <div className="mb-6 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search teams or students..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                            {isLoadingTeams ? (
                                <div className="text-center py-12 text-gray-400">Loading eligible teams...</div>
                            ) : filteredTeams.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 italic">No teams matching criteria that need review for Phase {selectedPhase}.</div>
                            ) : (
                                filteredTeams.map((team, idx) => {
                                    const originalIndex = eligibleTeams.findIndex(t => t.id === team.id);
                                    const hasProject = !!team.project;
                                    const hasRequest = !hasProject && team.projectRequests && team.projectRequests.length > 0;
                                    const projectTitle = hasProject ? team.project.title : (hasRequest ? team.projectRequests[0].project.title : null);

                                    return (
                                        <div
                                            key={team.id}
                                            onClick={() => toggleTeam(team.id)}
                                            className={`p-4 rounded-xl border transition-all cursor-pointer group ${selectedTeamIds.includes(team.id)
                                                ? 'bg-blue-50 border-blue-200'
                                                : 'bg-white border-gray-100 hover:border-gray-200'
                                                }`}
                                        >
                                            <div className="flex gap-4 items-start">
                                                <div className={`mt-1 h-5 w-5 rounded border flex items-center justify-center transition-colors ${selectedTeamIds.includes(team.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                                                    {selectedTeamIds.includes(team.id) && <Check size={12} className="text-white" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <p className="text-sm font-black text-gray-800">Team #{originalIndex + 1}</p>
                                                        <div className="flex gap-1">
                                                            {hasProject ? (
                                                                <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">Assigned</span>
                                                            ) : hasRequest ? (
                                                                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">Requested</span>
                                                            ) : (
                                                                <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter italic">No Project</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-gray-500 font-medium mb-2 truncate">
                                                        {team.members.map(m => m.user.name).join(', ')}
                                                    </p>
                                                    {projectTitle ? (
                                                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold bg-gray-50 px-2 py-1 rounded-lg">
                                                            <Layout size={10} className="text-blue-400" />
                                                            <span className="truncate">{projectTitle}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 text-[10px] text-red-400 font-bold bg-red-50/50 px-2 py-1 rounded-lg">
                                                            <AlertCircle size={10} />
                                                            <span>Needs project selection to be eligible</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right: Faculty & Settings */}
                    <div className="w-full md:w-80 bg-gray-50/50 flex flex-col p-8 overflow-hidden">
                        <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">2. Assign Faculty</h3>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                className="sr-only"
                                                checked={useVenueFaculty}
                                                onChange={(e) => setUseVenueFaculty(e.target.checked)}
                                            />
                                            <div className={`w-6 h-3 rounded-full transition-colors ${useVenueFaculty ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                                            <div className={`absolute top-0.5 left-0.5 bg-white w-2 h-2 rounded-full transition-transform ${useVenueFaculty ? 'translate-x-3' : ''}`}></div>
                                        </div>
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest group-hover:text-blue-600 transition-colors">By Venue</span>
                                    </label>
                                </div>

                                {!useVenueFaculty ? (
                                    <>
                                        <div className="mb-4 relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                            <input
                                                type="text"
                                                placeholder="Search faculty..."
                                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs outline-none"
                                                value={facultySearchTerm}
                                                onChange={e => setFacultySearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            {filteredFaculty.map(f => (
                                                <div
                                                    key={f.id}
                                                    onClick={() => toggleFaculty(f.id)}
                                                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${selectedFacultyIds.includes(f.id) ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white border-gray-200 text-gray-700'}`}
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold truncate">{f.name}</p>
                                                        <p className={`text-[9px] uppercase ${selectedFacultyIds.includes(f.id) ? 'text-indigo-100' : 'text-gray-400'}`}>{f.rollNumber}</p>
                                                    </div>
                                                    {selectedFacultyIds.includes(f.id) && <CheckCircle2 size={14} />}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-center">
                                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 mb-2">
                                            <Layout size={16} />
                                        </div>
                                        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-tight mb-1">Venue Detection Active</p>
                                        <p className="text-[9px] text-blue-500 leading-tight">Faculty will be automatically assigned based on the lab sessions scheduled for each team.</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 pt-4 border-t">
                                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">3. Assignment Settings</h3>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Access Duration</label>
                                    <select className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold" value={duration} onChange={e => setDuration(e.target.value)}>
                                        <option value="24">24 Hours</option>
                                        <option value="48">48 Hours</option>
                                        <option value="168">1 Week</option>
                                        <option value="0">Permanent</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Mode</label>
                                    <div className="flex bg-gray-100 p-1 rounded-xl">
                                        <button onClick={() => setReviewMode('OFFLINE')} className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition-all ${reviewMode === 'OFFLINE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>Offline</button>
                                        <button onClick={() => setReviewMode('ONLINE')} className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition-all ${reviewMode === 'ONLINE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>Online</button>
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                className="sr-only p-2"
                                                checked={distributeEvenly}
                                                onChange={(e) => setDistributeEvenly(e.target.checked)}
                                            />
                                            <div className={`w-8 h-5 rounded-full transition-colors ${distributeEvenly ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
                                            <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${distributeEvenly ? 'translate-x-3' : ''}`}></div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">Distribute Projects Evenly</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || selectedTeamIds.length === 0 || (!useVenueFaculty && selectedFacultyIds.length === 0)}
                                className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg hover:shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSubmitting ? "Processing..." : "Assign Reviewers"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
