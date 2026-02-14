import React, { useState } from 'react';
import { Trash2, Clock, AlertTriangle, Edit2, Check, X, Search, Layers, ChevronLeft, ChevronRight, User } from 'lucide-react';
import SearchInput from '../ui/SearchInput';
import BulkAssignModal from './BulkAssignModal';
import ManualPhaseAssignModal from './ManualPhaseAssignModal';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

export default function FacultyAssignmentsTab({
    projects,
    teams,
    selectedProjectForFaculty,
    setSelectedProjectForFaculty,
    selectedFacultyId,
    setSelectedFacultyId,
    accessDurationHours,
    setAccessDurationHours,
    assignFacultyToProject,
    facultyAssignments,
    unassignFaculty,
    updateFacultyAccess,
    bulkUpdateFacultyAccess,
    users,
    assignmentSearch,
    setAssignmentSearch,
    pagination,
    setPagination,
    reviewPhase,
    setReviewPhase,
    reviewMode,
    setReviewMode,
    accessStartsAt,
    setAccessStartsAt,
    api,
    loadData,
    onOpenReleaseReviews,
    scopes,
    expiredFilter,
    setExpiredFilter
}) {
    const { addToast } = useToast();
    const { confirm } = useConfirm();
    const [editingId, setEditingId] = useState(null);
    const [tempDuration, setTempDuration] = useState(null);
    const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
    const [isManualPhaseOpen, setIsManualPhaseOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkDuration, setBulkDuration] = useState(24);
    const [rollNumbersInput, setRollNumbersInput] = useState('');
    const [isBulkSelectVisible, setIsBulkSelectVisible] = useState(false);

    const facultyUsers = users.filter(u => u.role === 'FACULTY');
    const assignedProjects = projects.filter(p => p.status === 'ASSIGNED');

    // Calculate how many assignments each faculty has
    const getAssignmentCount = (facultyId) => {
        return facultyAssignments.filter(a => a.facultyId === facultyId).length;
    };

    const handleBulkAssign = async (payload) => {
        try {
            await api.post('/admin/bulk-assign-faculty', payload);
            loadData();
            addToast("Bulk assignment successful!", 'success');
        } catch (e) {
            addToast(e.response?.data?.error || "Error during bulk assignment", 'error');
            throw e;
        }
    };

    const handleBulkRemove = async () => {
        if (selectedIds.length === 0) return;
        if (!await confirm(`Are you sure you want to remove ${selectedIds.length} selected assignments?`)) return;

        try {
            await api.post('/admin/bulk-unassign-faculty', { assignmentIds: selectedIds });
            setSelectedIds([]);
            loadData();
            addToast("Bulk removal successful!", 'success');
        } catch (e) {
            addToast(e.response?.data?.error || "Error during bulk removal", 'error');
        }
    };

    const handleBulkAccessUpdate = async (duration) => {
        if (selectedIds.length === 0) return;
        if (!await confirm(`Update access duration for ${selectedIds.length} assignments?`)) return;

        await bulkUpdateFacultyAccess(selectedIds, parseInt(duration));
        setSelectedIds([]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === facultyAssignments.length && facultyAssignments.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(facultyAssignments.map(a => a.id));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleRollNumberSelect = async () => {
        if (!rollNumbersInput.trim()) {
            addToast("Please enter roll numbers", 'warning');
            return;
        }

        const inputRolls = rollNumbersInput
            .split(/[\s,]+/) // Split by space, comma, or newline
            .map(r => r.trim())
            .filter(Boolean);

        if (inputRolls.length === 0) return;

        try {
            const res = await api.post('/admin/faculty-assignments/select-by-roll', {
                rollNumbers: inputRolls,
                expired: expiredFilter || false
            });

            const matchedIds = res.data.ids || [];
            if (matchedIds.length === 0) {
                addToast(`No assignments found for the given roll numbers.`, 'warning');
                return;
            }

            setSelectedIds(prev => {
                const merged = new Set([...prev, ...matchedIds]);
                return Array.from(merged);
            });
            addToast(`Matched and selected ${matchedIds.length} assignments across all pages.`, 'success');
            setRollNumbersInput('');
            setIsBulkSelectVisible(false);
        } catch (e) {
            addToast(e.response?.data?.error || "Error selecting by roll numbers", 'error');
        }
    };

    // Helper to check if access is expired
    const isExpired = (expiresAt) => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    };

    // Helper to format expiration status
    const getExpirationStatus = (expiresAt) => {
        if (!expiresAt) {
            return <span className="text-green-600 text-xs font-semibold">Permanent</span>;
        }

        const expDate = new Date(expiresAt);
        const now = new Date();
        const hoursRemaining = Math.round((expDate - now) / (1000 * 60 * 60));

        if (expDate < now) {
            return (
                <span className="flex items-center gap-1 text-red-600 text-xs font-bold">
                    <AlertTriangle size={12} />
                    Expired
                </span>
            );
        }

        if (hoursRemaining <= 2) {
            return (
                <span className="flex items-center gap-1 text-orange-600 text-xs font-semibold">
                    <Clock size={12} />
                    {hoursRemaining}h left
                </span>
            );
        }

        if (hoursRemaining < 24) {
            return <span className="text-blue-600 text-xs font-semibold">{hoursRemaining}h left</span>;
        }

        const daysRemaining = Math.round(hoursRemaining / 24);
        return <span className="text-blue-600 text-xs font-semibold">{daysRemaining}d left</span>;
    };

    return (
        <div className="space-y-6">
            {/* Quick Assign Form */}
            <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Assign New Reviewer</h2>
                <form onSubmit={assignFacultyToProject} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Project</label>
                        <select
                            required
                            className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={selectedProjectForFaculty}
                            onChange={(e) => setSelectedProjectForFaculty(e.target.value)}
                        >
                            <option value="">Select Project</option>
                            {assignedProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Faculty</label>
                        <select
                            required
                            className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={selectedFacultyId}
                            onChange={(e) => setSelectedFacultyId(e.target.value)}
                        >
                            <option value="">Select Faculty</option>
                            {facultyUsers.map(f => (
                                <option key={f.id} value={f.id}>
                                    {f.name} {f.rollNumber ? `(${f.rollNumber})` : ''} — {getAssignmentCount(f.id)}/10 assigned
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="lg:col-span-1 grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Phase</label>
                            <select
                                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                value={reviewPhase}
                                onChange={(e) => setReviewPhase(e.target.value)}
                            >
                                {Array.from({ length: assignedProjects.find(p => p.id === selectedProjectForFaculty)?.scope?.numberOfPhases || assignedProjects.find(p => p.id === selectedProjectForFaculty)?.numberOfPhases || 4 }, (_, i) => i + 1).map(p => (
                                    <option key={p} value={String(p)}>P{p}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Hours</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="∞ hrs"
                                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                value={accessDurationHours === null ? '' : accessDurationHours}
                                onChange={(e) => setAccessDurationHours(e.target.value === '' ? null : parseInt(e.target.value))}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Start From</label>
                        <input
                            type="datetime-local"
                            className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={accessStartsAt || ''}
                            onChange={(e) => setAccessStartsAt(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Review Mode</label>
                        <div className="flex bg-gray-50 p-1 rounded-lg gap-1 border">
                            <button
                                type="button"
                                onClick={() => setReviewMode('OFFLINE')}
                                className={`flex - 1 py - 1 px - 2 rounded - md text - [10px] font - bold uppercase transition - all ${reviewMode === 'OFFLINE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'} `}
                            >
                                Offline
                            </button>
                            <button
                                type="button"
                                onClick={() => setReviewMode('ONLINE')}
                                className={`flex - 1 py - 1 px - 2 rounded - md text - [10px] font - bold uppercase transition - all ${reviewMode === 'ONLINE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'} `}
                            >
                                Online
                            </button>
                        </div>
                    </div>
                    <div>
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                        >
                            <Layers size={16} /> Assign
                        </button>
                    </div>
                </form>
            </div>

            {/* Current Assignments */}
            < div className="bg-white p-6 rounded-lg shadow-sm border" >
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h2 className="text-lg font-bold text-gray-800">
                            Current Assignments
                            <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{facultyAssignments.length} total</span>
                        </h2>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border mr-2">
                                <button
                                    onClick={() => setExpiredFilter(!expiredFilter)}
                                    className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 ${expiredFilter ? 'bg-red-600 text-white shadow-sm' : 'hover:bg-gray-200 text-gray-500'}`}
                                >
                                    <Clock size={12} />
                                    {expiredFilter ? 'Filter: Expired' : 'All Assignments'}
                                </button>
                                <button
                                    onClick={() => setIsBulkSelectVisible(!isBulkSelectVisible)}
                                    className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 ${isBulkSelectVisible ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-200 text-gray-500'}`}
                                >
                                    <User size={12} />
                                    Bulk Select Roll#
                                </button>
                            </div>

                            <SearchInput
                                value={assignmentSearch}
                                onChange={setAssignmentSearch}
                                placeholder="Search faculty or project..."
                                className="w-full sm:w-64"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                        <div className="flex flex-wrap items-center gap-2 flex-1">
                            <button
                                onClick={() => setIsBulkAssignOpen(true)}
                                className="bg-white border border-gray-200 text-gray-700 px-4 py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2"
                            >
                                <Layers size={14} className="text-indigo-600" />
                                Bulk Assign
                            </button>
                            <button
                                onClick={onOpenReleaseReviews}
                                className="bg-white border border-gray-200 text-gray-700 px-4 py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2"
                            >
                                <Check size={14} className="text-purple-600" />
                                Release Guide Reviews
                            </button>
                            <button
                                onClick={() => setIsManualPhaseOpen(true)}
                                className="bg-white border border-gray-200 text-gray-700 px-4 py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2"
                            >
                                <AlertTriangle size={14} className="text-orange-600" />
                                Lagging Teams
                            </button>
                        </div>

                        {selectedIds.length > 0 && (
                            <div className="flex items-center gap-3 bg-amber-50 px-4 py-1.5 rounded-full border border-amber-200 shadow-sm animate-in fade-in slide-in-from-right-2">
                                <span className="text-[10px] font-black text-amber-700 uppercase">{selectedIds.length} Selected</span>
                                <div className="h-4 w-px bg-amber-200" />
                                <div className="flex items-center gap-2">
                                    <Clock size={14} className="text-amber-600" />
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-16 border border-amber-200 rounded px-2 py-0.5 text-xs font-bold focus:ring-1 ring-amber-500 outline-none bg-white"
                                        value={bulkDuration}
                                        onChange={(e) => setBulkDuration(e.target.value === '' ? '' : parseInt(e.target.value))}
                                        placeholder="Hrs"
                                    />
                                    <button
                                        onClick={() => handleBulkAccessUpdate(bulkDuration)}
                                        className="bg-amber-600 text-white px-3 py-1 rounded-md text-[10px] font-bold uppercase hover:bg-amber-700 transition shadow-sm"
                                    >
                                        Update
                                    </button>
                                </div>
                                <div className="h-4 w-px bg-amber-200" />
                                <button
                                    onClick={() => handleBulkRemove()}
                                    className="text-red-600 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                                    title="Unassign Selected"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <button
                                    onClick={() => setSelectedIds([])}
                                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                                    title="Clear Selection"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bulk Select Input Panel */}
                {isBulkSelectVisible && (
                    <div className="mb-6 bg-blue-50/50 p-5 rounded-xl border border-blue-100 shadow-sm animate-in slide-in-from-top-4 duration-300">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                                        <User size={16} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-800">Select Students per Roll Number</h3>
                                        <p className="text-[11px] text-gray-500">Paste roll numbers separated by comma, space or new line to batch select their project assignments.</p>
                                    </div>
                                </div>
                                <textarea
                                    className="w-full border-2 border-blue-100 rounded-xl p-3 text-sm font-mono focus:ring-2 ring-blue-500/20 focus:border-blue-500 outline-none h-24 transition-all bg-white"
                                    placeholder="e.g. 21CS001, 21CS042, 21CS099..."
                                    value={rollNumbersInput}
                                    onChange={(e) => setRollNumbersInput(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-2 pt-8">
                                <button
                                    onClick={handleRollNumberSelect}
                                    className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-xs font-bold uppercase hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center gap-2"
                                >
                                    <Check size={14} />
                                    Select Matches
                                </button>
                                <button
                                    onClick={() => {
                                        setIsBulkSelectVisible(false);
                                        setRollNumbersInput('');
                                    }}
                                    className="bg-white text-gray-500 border border-gray-200 px-6 py-2.5 rounded-lg text-xs font-bold uppercase hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <BulkAssignModal
                    isOpen={isBulkAssignOpen}
                    onClose={() => setIsBulkAssignOpen(false)}
                    teams={teams.filter(t => t.projectId)}
                    faculty={facultyUsers}
                    onAssign={handleBulkAssign}
                    scopes={scopes}
                />

                <ManualPhaseAssignModal
                    isOpen={isManualPhaseOpen}
                    onClose={() => setIsManualPhaseOpen(false)}
                    faculty={facultyUsers}
                    scopes={scopes}
                    api={api}
                    onAssign={handleBulkAssign}
                />
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="p-3 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={facultyAssignments.length > 0 && selectedIds.length === facultyAssignments.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="p-3">Project</th>
                                <th className="p-3">Faculty</th>
                                <th className="p-3">Phase</th>
                                <th className="p-3">Mode</th>
                                <th className="p-3">Team</th>
                                <th className="p-3">Schedule</th>
                                <th className="p-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {facultyAssignments.map(a => (
                                <tr
                                    key={a.id}
                                    className={`hover: bg - gray - 50 text - sm transition - colors ${isExpired(a.accessExpiresAt) ? 'bg-red-50' : ''} ${selectedIds.includes(a.id) ? 'bg-indigo-50/50' : ''} `}
                                >
                                    <td className="p-3">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={selectedIds.includes(a.id)}
                                            onChange={() => toggleSelectOne(a.id)}
                                        />
                                    </td>
                                    <td className="p-3">
                                        <div className="font-medium mb-1">{a.project?.title || 'N/A'}</div>
                                        {a.project?.teams && a.project.teams.length > 0 ? (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {a.project.teams.flatMap(team =>
                                                    team.members?.map(m => (
                                                        <span key={m.id} className="inline-flex items-center bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] border border-blue-200">
                                                            {m.user.name}
                                                            {m.user.rollNumber && (
                                                                <span className="ml-1 font-mono opacity-70">({m.user.rollNumber})</span>
                                                            )}
                                                        </span>
                                                    )) || []
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-gray-400 italic">No students assigned yet</div>
                                        )}
                                    </td>
                                    <td className="p-3 text-purple-700 font-semibold">
                                        {a.faculty?.name || 'N/A'}
                                        {a.faculty?.rollNumber && <span className="ml-1 text-[10px] font-mono text-purple-400 font-normal">({a.faculty.rollNumber})</span>}
                                    </td>
                                    <td className="p-3">
                                        <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase">
                                            Phase {a.reviewPhase || 1}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <span className={`text - [10px] px - 2 py - 0.5 rounded - full font - bold uppercase ${a.mode === 'ONLINE' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'} `}>
                                            {a.mode || 'OFFLINE'}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        {a.project?.teams?.length > 0
                                            ? <span className="text-xs text-gray-600">{a.project.teams.length} team{a.project.teams.length > 1 ? 's' : ''}</span>
                                            : <span className="text-gray-400 italic text-xs">No teams</span>
                                        }
                                    </td>
                                    <td className="p-3">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">From:</span>
                                                <span className="text-xs font-bold text-gray-700">
                                                    {a.accessStartsAt ? new Date(a.accessStartsAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Immediate'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">To:</span>
                                                <span className="text-xs font-bold text-gray-700">
                                                    {a.accessExpiresAt ? new Date(a.accessExpiresAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Permanent'}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex items-center justify-between group">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase">Status: </span>
                                                    {editingId === a.id ? (
                                                        <div className="flex items-center gap-1 animate-in fade-in duration-200">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                placeholder="Hrs"
                                                                className="w-14 border text-[10px] p-0.5 rounded bg-white focus:ring-1 ring-blue-500 outline-none font-bold"
                                                                value={tempDuration === null ? '' : tempDuration}
                                                                onChange={e => setTempDuration(e.target.value === '' ? null : parseInt(e.target.value))}
                                                            />
                                                            <button onClick={() => { updateFacultyAccess(a.id, tempDuration); setEditingId(null); }} className="p-0.5 text-green-600 hover:bg-green-50 rounded"><Check size={12} /></button>
                                                            <button onClick={() => setEditingId(null)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded"><X size={12} /></button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {getExpirationStatus(a.accessExpiresAt)}
                                                            <button
                                                                onClick={() => { setEditingId(a.id); setTempDuration(null); }}
                                                                className="opacity-0 group-hover:opacity-100 p-0.5 text-blue-600 hover:bg-blue-50 rounded transition-opacity"
                                                                title="Edit Duration"
                                                            >
                                                                <Edit2 size={10} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={() => unassignFaculty(a.id, a.faculty?.name, a.project?.title)}
                                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-200 text-xs font-semibold transition"
                                            title="Remove assignment"
                                        >
                                            <Trash2 size={14} />
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {facultyAssignments.length === 0 && (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-400">No faculty assignments yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div >

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 bg-white p-4 rounded-lg shadow-sm border">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                        Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }));
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            disabled={pagination.page === 1}
                            className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-600"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={() => {
                                setPagination(prev => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }));
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            disabled={pagination.page === pagination.totalPages}
                            className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-600"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div >
    );
}
