import React from 'react';
import { Users, Trash2, Crown, ChevronLeft, ChevronRight } from 'lucide-react';
import SearchInput from '../ui/SearchInput';
import { useConfirm } from '../../context/ConfirmContext';

export default function TeamsTab({
    teams,
    deleteTeam,
    teamSearch,
    setTeamSearch,
    teamFilter,
    setTeamFilter,
    pagination,
    setPagination,
    updateTeamStatus,
    selectedIds = [],
    setSelectedIds,
    updateTeamStatusBulk
}) {
    const { confirm } = useConfirm();

    const getStatusColor = (status) => {
        switch (status) {
            case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-200';
            case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'APPROVED': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
            case 'NOT_COMPLETED': return 'bg-red-100 text-red-800 border-red-200';
            case 'CHANGES_REQUIRED': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'READY_FOR_REVIEW': return 'bg-purple-100 text-purple-800 border-purple-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(teams.map(t => t.id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelection = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-800">
                    <Users size={20} /> Teams Overview ({pagination?.total || teams.length})
                </h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <SearchInput
                        value={teamSearch}
                        onChange={setTeamSearch}
                        placeholder="Search project or members..."
                        className="w-full sm:w-64"
                    />
                    <select
                        className="border p-2 rounded text-sm bg-white focus:ring-2 ring-indigo-500 outline-none"
                        value={teamFilter}
                        onChange={e => {
                            setTeamFilter(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="NOT_COMPLETED">Not Completed</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="READY_FOR_REVIEW">Ready For Review</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="PENDING">Pending</option>
                    </select>
                </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded-full">
                            {selectedIds.length} SELECTED
                        </span>
                        <p className="text-sm font-bold text-indigo-900">Bulk Actions</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            className="border p-2 rounded text-xs bg-white focus:ring-2 ring-indigo-500 outline-none font-bold"
                            onChange={async (e) => {
                                const newStatus = e.target.value;
                                if (newStatus && await confirm(`Update ${selectedIds.length} teams to ${newStatus}?`, 'Bulk Status Update')) {
                                    updateTeamStatusBulk(selectedIds, newStatus);
                                }
                            }}
                            defaultValue=""
                        >
                            <option value="" disabled>Change Status to...</option>
                            <option value="PENDING">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="NOT_COMPLETED">Not Completed</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="CHANGES_REQUIRED">Changes Required</option>
                            <option value="READY_FOR_REVIEW">Ready For Review</option>
                            <option value="COMPLETED">Completed</option>
                        </select>
                        <button
                            onClick={() => setSelectedIds([])}
                            className="text-xs font-bold text-gray-500 hover:text-indigo-600 px-3 py-2"
                        >
                            Clear Selection
                        </button>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                            <th className="p-3 w-10 text-center">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                    checked={teams.length > 0 && selectedIds.length === teams.length}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            <th className="p-3">Project</th>
                            <th className="p-3">Team Members</th>
                            <th className="p-3">Size</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {teams.length > 0 ? (
                            teams.map(t => (
                                <tr key={t.id} className={`hover:bg-gray-50 text-sm transition-colors ${selectedIds.includes(t.id) ? 'bg-indigo-50/30' : ''}`}>
                                    <td className="p-3 text-center">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                            checked={selectedIds.includes(t.id)}
                                            onChange={() => toggleSelection(t.id)}
                                        />
                                    </td>
                                    <td className="p-3 font-medium text-gray-800">
                                        {t.project ? t.project.title : <span className="text-gray-400 italic">None</span>}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex gap-2 flex-wrap">
                                            {t.members.map(m => (
                                                <div key={m.id} className="flex items-center gap-1 bg-gray-100 border px-2 py-1 rounded text-xs">
                                                    {m.isLeader && <Crown size={12} className="text-yellow-600 fill-yellow-600" />}
                                                    <span className={m.isLeader ? 'font-bold' : ''}>{m.user.name}</span>
                                                    {m.user.rollNumber && <span className="text-gray-500 ml-1">({m.user.rollNumber})</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-3 font-semibold">{t.members.length}</td>
                                    <td className="p-3">
                                        <select
                                            className={`px-2 py-1 rounded text-[10px] font-bold border uppercase outline-none cursor-pointer ${getStatusColor(t.status)}`}
                                            value={t.status}
                                            onChange={async (e) => {
                                                const newStatus = e.target.value;
                                                if (await confirm(`Change status to ${newStatus}? This may affect project and review assignments.`, 'Confirm Status Change')) {
                                                    updateTeamStatus(t.id, newStatus);
                                                }
                                            }}
                                        >
                                            <option value="PENDING">Pending</option>
                                            <option value="APPROVED">Approved</option>
                                            <option value="NOT_COMPLETED">Not Completed</option>
                                            <option value="IN_PROGRESS">In Progress</option>
                                            <option value="CHANGES_REQUIRED">Changes Required</option>
                                            <option value="READY_FOR_REVIEW">Ready For Review</option>
                                            <option value="COMPLETED">Completed</option>
                                            <option value="REJECTED">Rejected</option>
                                        </select>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={() => deleteTeam(t.id, t.members.find(m => m.isLeader)?.user.name || 'Team')}
                                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-200 text-xs font-semibold transition"
                                            title="Delete entirety team"
                                        >
                                            <Trash2 size={14} />
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="6" className="p-8 text-center text-gray-400">No teams found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 border-t pt-4">
                    <span className="text-xs text-gray-500">
                        Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                            disabled={pagination.page === 1}
                            className="p-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                            disabled={pagination.page === pagination.totalPages}
                            className="p-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
