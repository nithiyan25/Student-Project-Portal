import React, { useState } from 'react';
import { Trash2, Clock, AlertTriangle, Edit2, Check, X, Search, Layers } from 'lucide-react';
import SearchInput from '../ui/SearchInput';
import BulkAssignModal from './BulkAssignModal';

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
    reviewPhase,
    setReviewPhase,
    reviewMode,
    setReviewMode,
    accessStartsAt,
    setAccessStartsAt,
    api,
    loadData,
    onOpenReleaseReviews,
    scopes
}) {
    const [editingId, setEditingId] = useState(null);
    const [tempDuration, setTempDuration] = useState(null);
    const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

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
            alert("Bulk assignment successful!");
        } catch (e) {
            alert(e.response?.data?.error || "Error during bulk assignment");
            throw e;
        }
    };

    const handleBulkRemove = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to remove ${selectedIds.length} selected assignments?`)) return;

        try {
            await api.post('/admin/bulk-unassign-faculty', { assignmentIds: selectedIds });
            setSelectedIds([]);
            loadData();
            alert("Bulk removal successful!");
        } catch (e) {
            alert(e.response?.data?.error || "Error during bulk removal");
        }
    };

    const handleBulkAccessUpdate = async (duration) => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Update access duration for ${selectedIds.length} assignments?`)) return;

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
                            <select
                                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                value={accessDurationHours || ''}
                                onChange={(e) => setAccessDurationHours(e.target.value ? parseInt(e.target.value) : null)}
                            >
                                <option value="">∞ hrs</option>
                                <option value="24">24h</option>
                                <option value="48">48h</option>
                                <option value="168">1wk</option>
                            </select>
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
                                className={`flex-1 py-1 px-2 rounded-md text-[10px] font-bold uppercase transition-all ${reviewMode === 'OFFLINE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}
                            >
                                Offline
                            </button>
                            <button
                                type="button"
                                onClick={() => setReviewMode('ONLINE')}
                                className={`flex-1 py-1 px-2 rounded-md text-[10px] font-bold uppercase transition-all ${reviewMode === 'ONLINE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold text-gray-800">Current Assignments ({facultyAssignments.length})</h2>
                        <button
                            onClick={() => setIsBulkAssignOpen(true)}
                            className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md shadow-indigo-100"
                        >
                            <Layers size={14} />
                            Bulk Assign
                        </button>
                        <button
                            onClick={onOpenReleaseReviews}
                            className="bg-purple-600 text-white px-4 py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-purple-700 transition-all flex items-center gap-2 shadow-md shadow-purple-100"
                        >
                            <Check size={14} />
                            Release Guide Reviews
                        </button>
                        {selectedIds.length > 0 && (
                            <>
                                <div className="relative group">
                                    <button className="bg-amber-500 text-white px-4 py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center gap-2 shadow-md shadow-amber-100">
                                        <Clock size={14} />
                                        Extend Access
                                    </button>
                                    <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden hidden group-hover:block z-20">
                                        <div className="py-1">
                                            <button onClick={() => handleBulkAccessUpdate(0)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium hover:text-indigo-600 transition-colors">Permanent Access</button>
                                            <button onClick={() => handleBulkAccessUpdate(24)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium hover:text-indigo-600 transition-colors">24 Hours</button>
                                            <button onClick={() => handleBulkAccessUpdate(48)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium hover:text-indigo-600 transition-colors">48 Hours</button>
                                            <button onClick={() => handleBulkAccessUpdate(168)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium hover:text-indigo-600 transition-colors">1 Week</button>
                                            <button onClick={() => handleBulkAccessUpdate(720)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium hover:text-indigo-600 transition-colors">1 Month</button>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleBulkRemove}
                                    className="bg-red-600 text-white px-4 py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-all flex items-center gap-2 shadow-md shadow-red-100 animate-in fade-in slide-in-from-left-2"
                                >
                                    <Trash2 size={14} />
                                    Bulk Remove ({selectedIds.length})
                                </button>
                            </>
                        )}
                    </div>
                    <SearchInput
                        value={assignmentSearch}
                        onChange={setAssignmentSearch}
                        placeholder="Search faculty or project..."
                        className="w-full sm:w-64"
                    />
                </div>

                <BulkAssignModal
                    isOpen={isBulkAssignOpen}
                    onClose={() => setIsBulkAssignOpen(false)}
                    teams={teams.filter(t => t.projectId)}
                    faculty={facultyUsers}
                    onAssign={handleBulkAssign}
                    scopes={scopes}
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
                                    className={`hover:bg-gray-50 text-sm transition-colors ${isExpired(a.accessExpiresAt) ? 'bg-red-50' : ''} ${selectedIds.includes(a.id) ? 'bg-indigo-50/50' : ''}`}
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
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${a.mode === 'ONLINE' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
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
                                                            <select
                                                                className="border text-[10px] p-0.5 rounded bg-white focus:ring-1 ring-blue-500 outline-none"
                                                                value={tempDuration || ''}
                                                                onChange={e => setTempDuration(e.target.value ? parseInt(e.target.value) : null)}
                                                            >
                                                                <option value="">Perm</option>
                                                                <option value="1">1h</option>
                                                                <option value="24">1d</option>
                                                                <option value="168">1w</option>
                                                            </select>
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
        </div >
    );
}
