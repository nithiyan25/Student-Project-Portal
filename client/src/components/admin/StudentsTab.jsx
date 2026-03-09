import React, { useContext, useState } from 'react';
import { UserPlus, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Edit2, X, Save, ShieldAlert, ShieldOff } from 'lucide-react';
import SearchInput from '../ui/SearchInput';

const EditStudentModal = ({ student, isOpen, onClose, onSave }) => {
    const [formData, setFormData] = React.useState({
        name: student?.name || '',
        email: student?.email || '',
        rollNumber: student?.rollNumber || '',
        department: student?.department || '',
        year: student?.year || ''
    });

    React.useEffect(() => {
        if (student) {
            setFormData({
                name: student.name,
                email: student.email,
                rollNumber: student.rollNumber || '',
                department: student.department || '',
                year: student.year || ''
            });
        }
    }, [student]);

    if (!isOpen) return null;

    return (
        <div className="fixed -top-[200px] -bottom-[200px] left-0 right-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-6 border-b">
                    <h3 className="text-xl font-bold text-gray-800">Edit Student</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSave(student.id, formData); }} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                        <input
                            required
                            className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                        <input
                            required
                            type="email"
                            className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Roll Number</label>
                        <input
                            required
                            className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={formData.rollNumber}
                            onChange={e => setFormData({ ...formData, rollNumber: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Department</label>
                            <input
                                className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                value={formData.department}
                                onChange={e => setFormData({ ...formData, department: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Year</label>
                            <select
                                className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                value={formData.year}
                                onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })}
                            >
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                            </select>
                        </div>
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
                            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                        >
                            <Save size={18} /> Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function StudentsTab({
    filteredStudents,
    newStudent,
    setNewStudent,
    addStudent,
    deleteUser,
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
    updateUser,
    studentScopeFilter,
    setStudentScopeFilter,
    scopes,
    blockUser,
    unblockUser
}) {
    const [editingStudent, setEditingStudent] = React.useState(null);

    // Blocking State
    const [isBlockModalOpen, setIsBlockModalOpen] = React.useState(false);
    const [selectedStudentForBlock, setSelectedStudentForBlock] = React.useState(null);
    const [blockDuration, setBlockDuration] = React.useState('24h');
    const [blockReason, setBlockReason] = React.useState('Malpractice detected');
    const [isSubmittingBlock, setIsSubmittingBlock] = React.useState(false);

    const handleBlockSubmit = async () => {
        if (!selectedStudentForBlock) return;
        setIsSubmittingBlock(true);
        try {
            await blockUser(selectedStudentForBlock.id, blockDuration, blockReason);
            setIsBlockModalOpen(false);
        } finally {
            setIsSubmittingBlock(false);
        }
    };

    const handleSave = async (id, data) => {
        await updateUser(id, data);
        setEditingStudent(null);
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
            const allIds = filteredStudents.map(u => u.id);
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
                    <h2 className="text-lg font-bold flex items-center gap-2 text-blue-800">
                        <UserPlus size={20} /> Add Student
                    </h2>
                    <button
                        onClick={openBulk}
                        className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 hover:bg-blue-600 hover:text-white transition-all font-sans"
                    >
                        Bulk Import
                    </button>
                </div>
                <form onSubmit={addStudent} className="space-y-4">
                    <input
                        required
                        className="w-full border p-2 rounded"
                        placeholder="Roll Number (Unique)"
                        value={newStudent.rollNumber}
                        onChange={e => setNewStudent({ ...newStudent, rollNumber: e.target.value })}
                    />
                    <input
                        required
                        className="w-full border p-2 rounded"
                        placeholder="Full Name"
                        value={newStudent.name}
                        onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                    />
                    <input
                        required
                        className="w-full border p-2 rounded"
                        placeholder="Email"
                        value={newStudent.email}
                        onChange={e => setNewStudent({ ...newStudent, email: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            required
                            className="w-full border p-2 rounded"
                            placeholder="Department"
                            value={newStudent.department || ''}
                            onChange={e => setNewStudent({ ...newStudent, department: e.target.value })}
                        />
                        <select
                            required
                            className="w-full border p-2 rounded"
                            value={newStudent.year || ''}
                            onChange={e => setNewStudent({ ...newStudent, year: e.target.value })}
                        >
                            <option value="">Year</option>
                            <option value="1">1st Year</option>
                            <option value="2">2nd Year</option>
                            <option value="3">3rd Year</option>
                            <option value="4">4th Year</option>
                        </select>
                    </div>
                    <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-bold transition-all">
                        Add Student
                    </button>
                </form>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold">Students ({pagination.total})</h2>
                        {selectedIds.length > 0 && (
                            <button
                                onClick={() => bulkDelete(selectedIds, 'students')}
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
                    <select
                        className="border rounded-md p-2 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={studentScopeFilter}
                        onChange={(e) => setStudentScopeFilter(e.target.value)}
                    >
                        <option value="ALL">All Batches</option>
                        {scopes?.map(scope => (
                            <option key={scope.id} value={scope.id}>{scope.name}</option>
                        ))}
                    </select>
                </div>
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="p-3 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        checked={filteredStudents.length > 0 && selectedIds.length === filteredStudents.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="p-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('rollNumber')}>
                                    <div className="flex items-center">Roll No <SortIndicator field="rollNumber" /></div>
                                </th>
                                <th className="p-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('name')}>
                                    <div className="flex items-center">Name <SortIndicator field="name" /></div>
                                </th>
                                <th className="p-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('email')}>
                                    <div className="flex items-center">Email <SortIndicator field="email" /></div>
                                </th>
                                <th className="p-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('department')}>
                                    <div className="flex items-center">Department <SortIndicator field="department" /></div>
                                </th>
                                <th className="p-3 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('year')}>
                                    <div className="flex items-center justify-center">Year <SortIndicator field="year" /></div>
                                </th>
                                <th className="p-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredStudents.map(u => (
                                <tr key={u.id} className={`hover:bg-gray-50 text-sm transition-colors ${selectedIds.includes(u.id) ? 'bg-blue-50/50' : ''}`}>
                                    <td className="p-3">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={selectedIds.includes(u.id)}
                                            onChange={() => handleSelectOne(u.id)}
                                        />
                                    </td>
                                    <td className="p-3 font-mono text-blue-600">{u.rollNumber || "—"}</td>
                                    <td className="p-3 font-medium">
                                        <div className="flex flex-col">
                                            <span className="flex items-center gap-2">
                                                {u.name}
                                                {u.isBlocked && (
                                                    <span className="bg-rose-100 text-rose-600 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Suspended</span>
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-gray-500">{u.email}</td>
                                    <td className="p-3 text-gray-400 font-medium">{u.department || "—"}</td>
                                    <td className="p-3 text-center">
                                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-bold text-gray-600">
                                            Yr {u.year || "—"}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {u.isBlocked ? (
                                                <button
                                                    onClick={() => unblockUser(u.id)}
                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition"
                                                    title="Unblock student"
                                                >
                                                    <ShieldOff size={14} />
                                                    Unblock
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setSelectedStudentForBlock(u);
                                                        setIsBlockModalOpen(true);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 border border-rose-200 text-xs font-semibold transition"
                                                    title="Block student"
                                                >
                                                    <ShieldAlert size={14} />
                                                    Block
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setEditingStudent(u)}
                                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition"
                                                title="Edit student"
                                            >
                                                <Edit2 size={14} />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => deleteUser(u.id, u.name, u.role)}
                                                className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-200 text-xs font-semibold transition"
                                                title="Delete student"
                                            >
                                                <Trash2 size={14} />
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredStudents.length === 0 && (
                                <tr><td colSpan="7" className="p-8 text-center text-gray-400">No students found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>
                            Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                        </span>
                        <select
                            className="border rounded p-1"
                            value={pagination.limit}
                            onChange={(e) => setPagination({ ...pagination, limit: parseInt(e.target.value), page: 1 })}
                        >
                            <option value="10">10 / page</option>
                            <option value="25">25 / page</option>
                            <option value="50">50 / page</option>
                            <option value="100">100 / page</option>
                            <option value="500">500 / page</option>
                            <option value="10000">All</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={pagination.page <= 1}
                            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 text-sm font-semibold transition-all"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded text-sm font-bold border border-blue-100">
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <button
                            disabled={pagination.page >= pagination.totalPages}
                            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 text-sm font-semibold transition-all"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            <EditStudentModal
                student={editingStudent}
                isOpen={!!editingStudent}
                onClose={() => setEditingStudent(null)}
                onSave={handleSave}
            />

            {/* BLOCK MODAL */}
            {isBlockModalOpen && (
                <div className="fixed -top-[200px] -bottom-[200px] left-0 right-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-lg shadow-2xl border overflow-hidden">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <ShieldAlert className="text-rose-500" /> Block Access
                                </h3>
                                <button onClick={() => setIsBlockModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full">
                                    <X size={24} className="text-slate-400" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-rose-50 rounded-lg border border-rose-100">
                                    <p className="text-sm text-rose-700 font-medium">
                                        Block <strong>{selectedStudentForBlock?.name}</strong>? They will be denied access immediately. Data is preserved.
                                    </p>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Duration</label>
                                    <select
                                        value={blockDuration}
                                        onChange={(e) => setBlockDuration(e.target.value)}
                                        className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-bold"
                                    >
                                        <option value="1h">1 Hour</option>
                                        <option value="24h">24 Hours</option>
                                        <option value="7d">7 Days</option>
                                        <option value="permanent">Indefinite</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Reason</label>
                                    <textarea
                                        value={blockReason}
                                        onChange={(e) => setBlockReason(e.target.value)}
                                        rows={3}
                                        className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm resize-none"
                                    ></textarea>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Note to Student:</p>
                                    <p className="text-[10px] text-slate-600 italic">
                                        "Please contact the administrator (Learning Centre IV floor) to resolve this."
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setIsBlockModalOpen(false)} className="flex-1 px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 border">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBlockSubmit}
                                    disabled={isSubmittingBlock}
                                    className="flex-1 px-4 py-2 rounded-lg text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-200"
                                >
                                    {isSubmittingBlock ? "..." : "Apply Block"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


