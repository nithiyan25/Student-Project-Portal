import React, { useState, useMemo } from 'react';
import { X, Search, Filter, CheckCircle2, Users, Briefcase, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import { useToast } from '../../context/ToastContext';

export default function BulkAssignModal({ isOpen, onClose, teams, faculty, onAssign, scopes }) {
    const { addToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [facultySearchTerm, setFacultySearchTerm] = useState('');
    const [deptFilter, setDeptFilter] = useState('ALL');
    const [scopeFilter, setScopeFilter] = useState('ALL');
    const [selectedProjectIds, setSelectedProjectIds] = useState([]);
    const [selectedFacultyIds, setSelectedFacultyIds] = useState([]);
    const [reviewPhase, setReviewPhase] = useState('1');
    const [duration, setDuration] = useState('0'); // 0 for permanent
    const [distributeEvenly, setDistributeEvenly] = useState(false);
    const [reviewMode, setReviewMode] = useState('OFFLINE');
    const [accessStartsAt, setAccessStartsAt] = useState('');
    const [useVenueFaculty, setUseVenueFaculty] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [inputMode, setInputMode] = useState('SELECT'); // 'SELECT' or 'PASTE'
    const [pastedRollNumbers, setPastedRollNumbers] = useState('');

    const departments = useMemo(() => {
        return [...new Set(teams.map(t => t.project?.category || 'General'))].sort();
    }, [teams]);

    const filteredProjects = useMemo(() => {
        return teams.filter(t => {
            const matchesSearch = t.project?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.members?.some(m =>
                    m.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (m.user.rollNumber && m.user.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()))
                );
            const matchesDept = deptFilter === 'ALL' || t.project?.category === deptFilter;
            const matchesScope = scopeFilter === 'ALL' || t.project?.scopeId === scopeFilter || t.scopeId === scopeFilter;
            return matchesSearch && matchesDept && matchesScope;
        });
    }, [teams, searchTerm, deptFilter, scopeFilter]);

    const filteredFaculty = useMemo(() => {
        return faculty.filter(f => {
            const term = facultySearchTerm.toLowerCase();
            return f.name.toLowerCase().includes(term) ||
                (f.rollNumber && f.rollNumber.toLowerCase().includes(term));
        });
    }, [faculty, facultySearchTerm]);

    const maxPhases = useMemo(() => {
        let highest = 4;

        // 1. Check master scopes list
        scopes?.forEach(s => {
            const p = parseInt(s.numberOfPhases);
            if (!isNaN(p) && p > highest) highest = p;
        });

        // 2. If filtering for a specific batch, use its phases exactly
        if (scopeFilter !== 'ALL') {
            const currentScope = scopes?.find(s => s.id === scopeFilter);
            if (currentScope?.numberOfPhases) {
                console.log(`Setting phases for scope ${currentScope.name}: ${currentScope.numberOfPhases}`);
                return parseInt(currentScope.numberOfPhases);
            }
        }

        console.log(`Global max phases detected: ${highest}`);
        return highest;
    }, [scopeFilter, scopes]);

    const toggleProject = (id) => {
        setSelectedProjectIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleFaculty = (id) => {
        setSelectedFacultyIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAllProjects = () => {
        if (selectedProjectIds.length === filteredProjects.length && filteredProjects.length > 0) {
            setSelectedProjectIds([]);
        } else {
            setSelectedProjectIds(filteredProjects.map(t => t.projectId));
        }
    };

    const handleSelectAllFaculty = () => {
        if (selectedFacultyIds.length === filteredFaculty.length && filteredFaculty.length > 0) {
            setSelectedFacultyIds([]);
        } else {
            setSelectedFacultyIds(filteredFaculty.map(f => f.id));
        }
    };

    const handleSubmit = async () => {
        if (inputMode === 'SELECT' && selectedProjectIds.length === 0) {
            addToast("Please select projects.", 'warning');
            return;
        }

        if (inputMode === 'PASTE' && !pastedRollNumbers.trim()) {
            addToast("Please enter student roll numbers.", 'warning');
            return;
        }

        if (!useVenueFaculty && selectedFacultyIds.length === 0) {
            addToast("Please select both projects and faculty members.", 'warning');
            return;
        }

        if (useVenueFaculty && scopeFilter === 'ALL') {
            addToast("Please select a specific batch to use venue mapping.", 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            const rollNumbers = inputMode === 'PASTE'
                ? pastedRollNumbers.split(/[\n,]+/).map(r => r.trim()).filter(Boolean)
                : [];

            await onAssign({
                projectIds: inputMode === 'SELECT' ? selectedProjectIds : [],
                studentRollNumbers: rollNumbers,
                facultyIds: useVenueFaculty ? [] : selectedFacultyIds,
                reviewPhase: parseInt(reviewPhase),
                accessDurationHours: parseInt(duration),
                distributeEvenly: distributeEvenly,
                mode: reviewMode,
                accessStartsAt: accessStartsAt || null,
                useVenueFaculty: useVenueFaculty,
                scopeId: scopeFilter !== 'ALL' ? scopeFilter : null
            });
            onClose();
        } catch (e) {
            addToast(e.response?.data?.error || "Error during bulk assignment", 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white/20">
                {/* Header */}
                <div className="p-8 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10"><Briefcase size={120} /></div>
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-black flex items-center gap-3 tracking-tight">
                                Bulk Faculty Assignment
                                <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/10 font-bold">Admin Tool</span>
                            </h2>
                            <p className="opacity-90 mt-2 text-sm font-medium">Assign multiple reviewers to projects in one go</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all hover:scale-110 active:scale-90"><X size={28} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-x divide-gray-100">
                    {/* Left Side: Project Selection */}
                    <div className="flex-1 flex flex-col p-8 overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Briefcase size={14} className="text-blue-500" />
                                {inputMode === 'SELECT' ? `1. Select Projects (${selectedProjectIds.length})` : '1. Enter Roll Numbers'}
                            </h3>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setInputMode('SELECT')}
                                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${inputMode === 'SELECT' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    List
                                </button>
                                <button
                                    onClick={() => setInputMode('PASTE')}
                                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${inputMode === 'PASTE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Paste
                                </button>
                            </div>
                        </div>

                        {inputMode === 'SELECT' ? (
                            <>
                                <div className="flex justify-end mb-2">
                                    <button onClick={handleSelectAllProjects} className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-tight">
                                        {selectedProjectIds.length === filteredProjects.length ? "Deselect All" : "Select All Filtered"}
                                    </button>
                                </div>
                                <div className="flex gap-4 mb-6">
                                    <div className="flex-1 relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search projects..."
                                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 ring-blue-500 outline-none transition-all"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <select
                                        className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 ring-blue-500 outline-none transition-all font-bold text-gray-600"
                                        value={deptFilter}
                                        onChange={(e) => setDeptFilter(e.target.value)}
                                    >
                                        <option value="ALL">All Categories</option>
                                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <select
                                        className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 ring-blue-500 outline-none transition-all font-bold text-gray-600"
                                        value={scopeFilter}
                                        onChange={(e) => setScopeFilter(e.target.value)}
                                    >
                                        <option value="ALL">All Batches</option>
                                        {scopes?.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                                    {filteredProjects.map(team => (
                                        <div
                                            key={team.id}
                                            onClick={() => toggleProject(team.projectId)}
                                            className={`p-4 rounded-2xl border transition-all cursor-pointer group ${selectedProjectIds.includes(team.projectId)
                                                ? 'bg-blue-50 border-blue-200 shadow-sm'
                                                : 'bg-white border-gray-100 hover:border-blue-100 hover:bg-gray-50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-bold truncate ${selectedProjectIds.includes(team.projectId) ? 'text-blue-900' : 'text-gray-800'}`}>
                                                        {team.project?.title}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{team.project?.category}</p>
                                                    {team.members && team.members.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {team.members.map(m => (
                                                                <span key={m.id} className="inline-flex items-center bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-[9px] border border-green-200">
                                                                    {m.user.name}
                                                                    {m.user.rollNumber && (
                                                                        <span className="ml-1 font-mono opacity-70">({m.user.rollNumber})</span>
                                                                    )}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedProjectIds.includes(team.projectId)
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'border-gray-200 group-hover:border-blue-300'
                                                    }`}>
                                                    {selectedProjectIds.includes(team.projectId) && <CheckCircle2 size={12} />}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col">
                                <p className="text-xs text-gray-500 mb-4 font-medium leading-relaxed">
                                    Paste student roll numbers below (one per line). These students' active projects will be assigned to the selected faculty.
                                </p>
                                <textarea
                                    className="flex-1 w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 ring-blue-500 outline-none transition-all resize-none"
                                    placeholder={`7376232AL172\n...`}
                                    value={pastedRollNumbers}
                                    onChange={(e) => setPastedRollNumbers(e.target.value)}
                                />
                                <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider text-right">
                                    {pastedRollNumbers.split(/[\n,]+/).filter(Boolean).length} Numbers entered
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Side: Faculty & Settings */}
                    <div className="w-full md:w-80 bg-gray-50/50 flex flex-col p-8 overflow-hidden">
                        <div className="space-y-8 flex-1 overflow-y-auto custom-scrollbar pr-2">
                            {/* Faculty Select */}
                            <div className={useVenueFaculty ? 'opacity-40 pointer-events-none transition-all' : 'transition-all'}>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Users size={14} className="text-indigo-500" />
                                        2. Assign Faculty ({selectedFacultyIds.length})
                                    </h3>
                                    <button
                                        onClick={handleSelectAllFaculty}
                                        disabled={useVenueFaculty}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-tight disabled:text-gray-300"
                                    >
                                        {selectedFacultyIds.length === filteredFaculty.length && filteredFaculty.length > 0 ? "Deselect" : "All"}
                                    </button>
                                </div>

                                <div className="mb-4 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search faculty..."
                                        disabled={useVenueFaculty}
                                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 ring-indigo-500 outline-none transition-all shadow-sm disabled:bg-gray-50 disabled:text-gray-400"
                                        value={facultySearchTerm}
                                        onChange={(e) => setFacultySearchTerm(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    {filteredFaculty.map(f => (
                                        <div
                                            key={f.id}
                                            onClick={() => !useVenueFaculty && toggleFaculty(f.id)}
                                            className={`p-3 rounded-2xl border transition-all ${!useVenueFaculty ? 'cursor-pointer' : 'cursor-not-allowed'} ${selectedFacultyIds.includes(f.id)
                                                ? 'bg-indigo-600 border-indigo-700 text-white shadow-md'
                                                : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/30'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedFacultyIds.includes(f.id) ? 'bg-white/20' : 'bg-indigo-100 text-indigo-600'}`}>
                                                    {f.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold truncate">
                                                        {f.name}
                                                    </p>
                                                    <p className={`text-[9px] uppercase tracking-tighter ${selectedFacultyIds.includes(f.id) ? 'text-indigo-100' : 'text-gray-400'}`}>
                                                        {f.rollNumber || 'ID N/A'} {f.department ? `• ${f.department}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            {selectedFacultyIds.includes(f.id) && <CheckCircle2 size={14} />}
                                        </div>
                                    ))}
                                    {filteredFaculty.length === 0 && (
                                        <div className="py-8 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No faculty found</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Phase Settings */}
                            <div>
                                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                    <Clock size={14} className="text-purple-500" />
                                    3. Phase & Access
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">
                                            Review Phase
                                            <span className="ml-2 text-blue-500 lowercase">({maxPhases} phases available)</span>
                                        </label>
                                        <select
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 ring-purple-500 outline-none"
                                            value={reviewPhase}
                                            onChange={(e) => setReviewPhase(e.target.value)}
                                        >
                                            {Array.from({ length: maxPhases }, (_, i) => i + 1).map(p => (
                                                <option key={p} value={String(p)}>Phase {p}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Start From</label>
                                            <input
                                                type="datetime-local"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 ring-purple-500 outline-none"
                                                value={accessStartsAt}
                                                onChange={(e) => setAccessStartsAt(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Access Duration</label>
                                            <select
                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 ring-purple-500 outline-none"
                                                value={duration}
                                                onChange={(e) => setDuration(e.target.value)}
                                            >
                                                <option value="0">Permanent Access</option>
                                                <option value="24">24 Hours</option>
                                                <option value="48">48 Hours</option>
                                                <option value="168">1 Week</option>
                                                <option value="720">1 Month</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Review Mode</label>
                                        <div className="flex bg-gray-50 p-1.5 rounded-2xl gap-1.5">
                                            <button
                                                onClick={() => setReviewMode('OFFLINE')}
                                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${reviewMode === 'OFFLINE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                Offline
                                            </button>
                                            <button
                                                onClick={() => setReviewMode('ONLINE')}
                                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${reviewMode === 'ONLINE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                Online
                                            </button>
                                        </div>
                                    </div>

                                    {/* Smart Distribution Toggle */}
                                    <div className="pt-2 space-y-4">
                                        <label className={`flex items-center gap-3 cursor-pointer group ${useVenueFaculty ? 'opacity-40 pointer-events-none' : ''}`}>
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only p-2"
                                                    checked={distributeEvenly}
                                                    disabled={useVenueFaculty}
                                                    onChange={(e) => setDistributeEvenly(e.target.checked)}
                                                />
                                                <div className={`w-10 h-6 rounded-full transition-colors ${distributeEvenly ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
                                                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${distributeEvenly ? 'translate-x-4' : ''}`}></div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">Distribute Projects Evenly</span>
                                                <span className="text-[9px] text-gray-400 font-medium">Split projects among faculty auto-robin style</span>
                                            </div>
                                        </label>

                                        <div className="h-px bg-gray-100 my-2"></div>

                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only p-2"
                                                    checked={useVenueFaculty}
                                                    onChange={(e) => setUseVenueFaculty(e.target.checked)}
                                                />
                                                <div className={`w-10 h-6 rounded-full transition-colors ${useVenueFaculty ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                                                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${useVenueFaculty ? 'translate-x-4' : ''}`}></div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-700 group-hover:text-blue-600 transition-colors">Map Faculty using Venues</span>
                                                <span className="text-[9px] text-gray-400 font-medium whitespace-nowrap">Auto-pick faculty from team's lab sessions</span>
                                            </div>
                                        </label>

                                        {useVenueFaculty && (
                                            <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl animate-in slide-in-from-top-1 duration-300">
                                                <p className="text-[9px] font-bold text-blue-600 leading-relaxed uppercase tracking-widest flex items-start gap-2">
                                                    <AlertCircle size={10} className="shrink-0 mt-0.5" />
                                                    Faculty will be automatically assigned based on the lab sessions scheduled for each team in the selected batch.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary & Submit */}
                        <div className="pt-8 shrink-0">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || (inputMode === 'SELECT' && selectedProjectIds.length === 0) || (inputMode === 'PASTE' && !pastedRollNumbers.trim()) || (!useVenueFaculty && selectedFacultyIds.length === 0)}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none cursor-pointer"
                            >
                                {isSubmitting ? "Processing..." : "Confirm & Assign"}
                            </button>
                            <p className="text-[10px] text-center text-gray-400 font-bold mt-4 uppercase tracking-tighter italic">
                                {distributeEvenly
                                    ? `${inputMode === 'SELECT' ? selectedProjectIds.length : 'Multiple'} Assignments (Each project assigned to 1 reviewer)`
                                    : `Total Assignment Batch Ready`
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
