import React, { useState } from 'react';
import { Briefcase, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Edit2, X, Save, Info, Users, CheckCircle, FileText, ShieldCheck } from 'lucide-react';
import SearchInput from '../ui/SearchInput';

const EditFacultyModal = ({ faculty, isOpen, onClose, onSave }) => {
    const [formData, setFormData] = React.useState({
        name: faculty?.name || '',
        email: faculty?.email || '',
        rollNumber: faculty?.rollNumber || ''
    });

    React.useEffect(() => {
        if (faculty) {
            setFormData({
                name: faculty.name,
                email: faculty.email,
                rollNumber: faculty.rollNumber || ''
            });
        }
    }, [faculty]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-6 border-b">
                    <h3 className="text-xl font-bold text-gray-800">Edit Faculty</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSave(faculty.id, formData); }} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                        <input
                            required
                            className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                        <input
                            required
                            type="email"
                            className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Faculty ID</label>
                        <input
                            className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                            value={formData.rollNumber}
                            onChange={e => setFormData({ ...formData, rollNumber: e.target.value })}
                            placeholder="e.g. FAC001"
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold transition-all shadow-lg shadow-purple-200 flex items-center justify-center gap-2"
                        >
                            <Save size={18} /> Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const FacultyDetailsModal = ({ faculty, isOpen, onClose }) => {
    if (!isOpen || !faculty) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b bg-gray-50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">{faculty.name}</h3>
                        <p className="text-sm text-gray-500">{faculty.email} • {faculty.department || 'N/A'}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-8">
                    {/* Workload Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                            <h4 className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Quota Used</h4>
                            <p className="text-2xl font-black text-blue-900">{faculty.quotaStatus}</p>
                            <p className="text-xs text-blue-400">Teams (Guide + Expert)</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-center">
                            <h4 className="text-xs font-bold text-purple-500 uppercase tracking-widest mb-1">Students</h4>
                            <p className="text-2xl font-black text-purple-900">{faculty.studentsCount}</p>
                            <p className="text-xs text-purple-400">Total Mentored</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                            <h4 className="text-xs font-bold text-green-500 uppercase tracking-widest mb-1">Reviews</h4>
                            <p className="text-2xl font-black text-green-900">{faculty.reviewsCount}</p>
                            <p className="text-xs text-green-400">Reviews Submitted</p>
                        </div>
                    </div>

                    {/* Admin Access Permissions */}
                    {faculty.isTemporaryAdmin && (
                        <div>
                            <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <ShieldCheck size={16} className="text-orange-500" /> Admin Permissions
                            </h4>
                            <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 mb-6">
                                <p className="text-xs text-orange-700 font-bold mb-2 uppercase tracking-wider">Allowed Tabs:</p>
                                <div className="flex flex-wrap gap-2">
                                    {faculty.tempAdminTabs ? (() => {
                                        try {
                                            const tabs = JSON.parse(faculty.tempAdminTabs);
                                            return tabs.length > 0 ? tabs.map(tabId => (
                                                <span key={tabId} className="bg-white px-2 py-1 rounded border border-orange-200 text-[10px] font-black text-orange-600 uppercase">
                                                    {tabId.replace('-', ' ')}
                                                </span>
                                            )) : <span className="text-xs text-red-500 font-bold">Restricted Access (No Tabs)</span>;
                                        } catch (e) {
                                            return <span className="text-xs text-red-500">Error parsing permissions</span>;
                                        }
                                    })() : <span className="text-xs text-orange-400 italic">Full Admin Access (Legacy)</span>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mentored Students List */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <Users size={16} className="text-gray-400" /> Mentored Students
                        </h4>
                        <div className="bg-white border rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold border-b">
                                    <tr>
                                        <th className="px-4 py-2">Student</th>
                                        <th className="px-4 py-2">Role</th>
                                        <th className="px-4 py-2">Project</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {faculty.studentsDetails && faculty.studentsDetails.length > 0 ? (
                                        faculty.studentsDetails.map((s, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 font-medium text-gray-700">{s.name}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${s.role === 'GUIDE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                        {s.role}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-gray-500 truncate max-w-xs">{s.project}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="3" className="px-4 py-4 text-center text-gray-400 italic">No students assigned yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Last 5 Reviews */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <FileText size={16} className="text-gray-400" /> Recent Reviews
                        </h4>
                        <div className="space-y-3">
                            {faculty.latestReviews && faculty.latestReviews.length > 0 ? (
                                faculty.latestReviews.map(r => (
                                    <div key={r.id} className="bg-gray-50 p-3 rounded border border-gray-100 text-sm">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-gray-700">{r.team?.project?.title || "Untitled Project"}</span>
                                            <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-gray-600 line-clamp-2">{r.content}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-400 italic text-sm border-2 border-dashed border-gray-100 rounded p-4 text-center">No reviews submitted.</p>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

// Available admin tabs that can be granted
const ADMIN_TABS = [
    { id: 'overview', label: 'Overview Dashboard', group: 'General' },
    { id: 'settings', label: 'System Settings', group: 'General' },
    { id: 'students', label: 'Students', group: 'User Management' },
    { id: 'faculty', label: 'Faculty', group: 'User Management' },
    { id: 'admins', label: 'Admins', group: 'User Management' },
    { id: 'scopes', label: 'Project Batches', group: 'Projects & Teams' },
    { id: 'projects', label: 'Projects', group: 'Projects & Teams' },
    { id: 'project-requests', label: 'Project Requests', group: 'Projects & Teams' },
    { id: 'student-request-status', label: 'Request Status List', group: 'Projects & Teams' },
    { id: 'teams', label: 'Teams', group: 'Projects & Teams' },
    { id: 'manage-teams', label: 'Manage Teams', group: 'Projects & Teams' },
    { id: 'faculty-assignments', label: 'Faculty Assignments', group: 'Projects & Teams' },
    { id: 'rubrics', label: 'Rubrics', group: 'Evaluation' },
    { id: 'reviews', label: 'Reviews', group: 'Evaluation' },
    { id: 'review-assignments', label: 'Review Assignments', group: 'Evaluation' },
    { id: 'individual-stats', label: 'Student Stats', group: 'Evaluation' },
    { id: 'venue-scheduler', label: 'Venue Scheduler', group: 'Scheduling' },
];

const TempAdminModal = ({ faculty, isOpen, onClose, onSave }) => {
    const [selectedTabs, setSelectedTabs] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        if (faculty && isOpen) {
            // Parse existing tabs or default to empty
            const existingTabs = faculty.tempAdminTabs
                ? (typeof faculty.tempAdminTabs === 'string'
                    ? JSON.parse(faculty.tempAdminTabs)
                    : faculty.tempAdminTabs)
                : [];
            setSelectedTabs(existingTabs);
        }
    }, [faculty, isOpen]);

    if (!isOpen || !faculty) return null;

    const toggleTab = (tabId) => {
        setSelectedTabs(prev =>
            prev.includes(tabId)
                ? prev.filter(t => t !== tabId)
                : [...prev, tabId]
        );
    };

    const selectAll = () => setSelectedTabs(ADMIN_TABS.map(t => t.id));
    const selectNone = () => setSelectedTabs([]);

    const handleGrant = async () => {
        setIsLoading(true);
        try {
            await onSave(faculty.id, true, selectedTabs);
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    const handleRevoke = async () => {
        setIsLoading(true);
        try {
            await onSave(faculty.id, false, []);
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    // Group tabs by category
    const groupedTabs = ADMIN_TABS.reduce((acc, tab) => {
        if (!acc[tab.group]) acc[tab.group] = [];
        acc[tab.group].push(tab);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b bg-gradient-to-r from-orange-50 to-amber-50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Admin Access Settings</h3>
                        <p className="text-sm text-gray-500">{faculty.name}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-gray-600">Select tabs this faculty can access:</p>
                        <div className="flex gap-2">
                            <button
                                onClick={selectAll}
                                className="text-xs text-blue-600 hover:underline font-semibold"
                            >
                                Select All
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                                onClick={selectNone}
                                className="text-xs text-gray-500 hover:underline font-semibold"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>

                    {Object.entries(groupedTabs).map(([group, tabs]) => (
                        <div key={group} className="border rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2 border-b">
                                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">{group}</h4>
                            </div>
                            <div className="p-3 grid grid-cols-2 gap-2">
                                {tabs.map(tab => (
                                    <label
                                        key={tab.id}
                                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${selectedTabs.includes(tab.id)
                                            ? 'bg-orange-50 border-orange-200 text-orange-700'
                                            : 'bg-white border-gray-100 hover:border-gray-200 text-gray-600'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedTabs.includes(tab.id)}
                                            onChange={() => toggleTab(tab.id)}
                                            className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                        />
                                        <span className="text-sm font-medium">{tab.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}

                    {faculty.isTemporaryAdmin && (
                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-sm text-orange-700">
                            <strong>Note:</strong> This faculty currently has admin access. You can update the allowed tabs or revoke access entirely.
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50 flex gap-3">
                    {faculty.isTemporaryAdmin && (
                        <button
                            onClick={handleRevoke}
                            disabled={isLoading}
                            className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-all disabled:opacity-50"
                        >
                            Revoke Access
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleGrant}
                        disabled={isLoading || selectedTabs.length === 0}
                        className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold transition-all shadow-lg shadow-orange-200 disabled:opacity-50"
                    >
                        {faculty.isTemporaryAdmin ? 'Update Access' : 'Grant Access'} ({selectedTabs.length})
                    </button>
                </div>
            </div>
        </div>
    );
};
export default function FacultyTab({
    filteredFaculty,
    newFaculty,
    setNewFaculty,
    addFaculty,
    deleteUser,
    toggleTempAdmin,
    isRealAdmin,
    userSearch,
    setUserSearch,
    openBulk,
    selectedIds,
    setSelectedIds,
    bulkDelete,
    pagination,
    setPagination,
    sortConfig,
    onSort,
    updateUser
}) {
    const [editingFaculty, setEditingFaculty] = React.useState(null);
    const [viewingFaculty, setViewingFaculty] = React.useState(null);
    const [tempAdminFaculty, setTempAdminFaculty] = React.useState(null);

    const handleSave = async (id, data) => {
        await updateUser(id, data);
        setEditingFaculty(null);
    };
    const handleSort = (field) => {
        let order = 'asc';
        if (sortConfig.sortBy === field && sortConfig.order === 'asc') {
            order = 'desc';
        }
        onSort({ sortBy: field, order });
    };

    const SortIndicator = ({ field }) => {
        if (sortConfig.sortBy !== field) return <ArrowUpDown size={12} className="text-gray-300 ml-1 inline-block" />;
        return sortConfig.order === 'asc'
            ? <ArrowUp size={12} className="text-blue-500 ml-1 inline-block" />
            : <ArrowDown size={12} className="text-blue-500 ml-1 inline-block" />;
    };
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allIds = filteredFaculty.map(u => u.id);
            setSelectedIds(allIds);
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    return (
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border h-fit">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-purple-800">
                        <Briefcase size={20} /> Add Faculty
                    </h2>
                    <button
                        onClick={openBulk}
                        className="text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-600 px-2 py-1 rounded border border-purple-100 hover:bg-purple-600 hover:text-white transition-all font-sans"
                    >
                        Bulk Import
                    </button>
                </div>
                <form onSubmit={addFaculty} className="space-y-4">
                    <input
                        required
                        className="w-full border p-2 rounded"
                        placeholder="Full Name"
                        value={newFaculty.name}
                        onChange={e => setNewFaculty({ ...newFaculty, name: e.target.value })}
                    />
                    <input
                        required
                        className="w-full border p-2 rounded"
                        placeholder="Email"
                        value={newFaculty.email}
                        onChange={e => setNewFaculty({ ...newFaculty, email: e.target.value })}
                    />
                    <input
                        className="w-full border p-2 rounded"
                        placeholder="Faculty ID (e.g. FAC001)"
                        value={newFaculty.rollNumber}
                        onChange={e => setNewFaculty({ ...newFaculty, rollNumber: e.target.value })}
                    />
                    <button className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 font-bold transition-all">
                        Add Faculty
                    </button>
                </form>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold">Faculty ({pagination.total})</h2>
                        {selectedIds.length > 0 && (
                            <button
                                onClick={() => bulkDelete(selectedIds, 'faculty')}
                                className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded text-sm font-bold animate-in fade-in slide-in-from-left-2 transition-all hover:bg-red-700 shadow-md"
                            >
                                <Trash2 size={14} /> Delete Selected ({selectedIds.length})
                            </button>
                        )}
                    </div>
                    <SearchInput
                        value={userSearch}
                        onChange={setUserSearch}
                        placeholder="Search..."
                        className="w-64"
                    />
                </div>
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="p-3 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        checked={filteredFaculty.length > 0 && selectedIds.length === filteredFaculty.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="p-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('name')}>
                                    <div className="flex items-center">Name <SortIndicator field="name" /></div>
                                </th>
                                <th className="p-3">Workload</th>
                                <th className="p-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('quotaStatus')}>
                                    <div className="flex items-center">Quota <SortIndicator field="quotaStatus" /></div>
                                </th>
                                <th className="p-3 text-center">Admin Access</th>
                                <th className="p-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredFaculty.map(u => (
                                <tr key={u.id} className={`hover:bg-gray-50 text-sm transition-colors ${selectedIds.includes(u.id) ? 'bg-blue-50/50' : ''}`}>
                                    <td className="p-3">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={selectedIds.includes(u.id)}
                                            onChange={() => handleSelectOne(u.id)}
                                        />
                                    </td>
                                    <td className="p-3">
                                        <div className="font-bold text-gray-800">{u.name}</div>
                                        <div className="text-xs text-gray-500">{u.email}</div>
                                        {u.rollNumber && <div className="text-[10px] font-mono text-gray-400">{u.rollNumber}</div>}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex gap-2">
                                            <div title="Students Mentored" className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">
                                                <Users size={12} /> {u.studentsCount || 0}
                                            </div>
                                            <div title="Reviews Submitted" className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">
                                                <CheckCircle size={12} /> {u.reviewsCount || 0}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <span className={`text-xs font-black px-2 py-1 rounded ${(parseInt(u.quotaStatus?.split('/')[0]) || 0) >= 4
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {u.quotaStatus || "0/4"}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        {isRealAdmin ? (
                                            <button
                                                onClick={() => setTempAdminFaculty(u)}
                                                className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition border ${u.isTemporaryAdmin
                                                    ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
                                                    : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                                                    }`}
                                                title={u.isTemporaryAdmin ? "Manage admin access" : "Grant admin access"}
                                            >
                                                {u.isTemporaryAdmin ? '⚙️ Manage' : '🔒 Grant'}
                                            </button>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">Admin Only</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => setViewingFaculty(u)}
                                                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition"
                                                title="View Details"
                                            >
                                                <Info size={16} />
                                            </button>
                                            <button
                                                onClick={() => setEditingFaculty(u)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                                                title="Edit faculty"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => deleteUser(u.id, u.name, u.role)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                                                title="Delete faculty"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredFaculty.length === 0 && (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-400">No faculty found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
                    {/* Simplified footer since we might be doing client-side pagination on stats */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>
                            Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={pagination.page <= 1}
                            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 text-sm font-semibold transition-all"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded text-sm font-bold border border-purple-100">
                            Page {pagination.page}
                        </span>
                        <button
                            disabled={pagination.page * pagination.limit >= pagination.total}
                            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 text-sm font-semibold transition-all"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            <EditFacultyModal
                faculty={editingFaculty}
                isOpen={!!editingFaculty}
                onClose={() => setEditingFaculty(null)}
                onSave={handleSave}
            />

            <FacultyDetailsModal
                faculty={viewingFaculty}
                isOpen={!!viewingFaculty}
                onClose={() => setViewingFaculty(null)}
            />

            <TempAdminModal
                faculty={tempAdminFaculty}
                isOpen={!!tempAdminFaculty}
                onClose={() => setTempAdminFaculty(null)}
                onSave={toggleTempAdmin}
            />
        </div>
    );
}
