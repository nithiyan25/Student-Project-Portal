import React, { useState, useEffect } from 'react';
import api from '../../api';
import { CheckCircle, XCircle, Clock, Search, Filter, MessageSquare, AlertCircle } from 'lucide-react';

export default function ProjectRequestsTab({ scopes = [] }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterStatus, setFilterStatus] = useState('PENDING');
    const [selectedScope, setSelectedScope] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');

    // Pagination State
    const [pagination, setPagination] = useState({
        total: 0,
        page: 1,
        limit: 12,
        totalPages: 1
    });

    // Rejection Modal State
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [selectedRequestId, setSelectedRequestId] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Bulk action state
    const [selectedIds, setSelectedIds] = useState([]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const response = await api.get('/admin/project-requests', {
                params: {
                    status: filterStatus,
                    scopeId: selectedScope,
                    page: pagination.page,
                    limit: pagination.limit
                }
            });
            setRequests(response.data.requests);
            setPagination(response.data.pagination);
            setError(null);
        } catch (err) {
            setError('Failed to fetch project requests');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [filterStatus, selectedScope, pagination.page]);

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const handleApprove = async (requestId) => {
        if (!window.confirm('Are you sure you want to approve this project request? This will assign the project to the team and reject other pending requests for the same project.')) return;

        try {
            const res = await api.post('/admin/approve-project-request', { requestId });
            alert(res.data.message || 'Project request approved successfully!');
            fetchRequests();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to approve request');
        }
    };

    const openRejectModal = (requestId) => {
        setSelectedRequestId(requestId);
        setRejectionReason('');
        setIsRejectModalOpen(true);
    };

    const handleReject = async () => {
        if (!rejectionReason.trim()) {
            alert('Please provide a reason for rejection');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.post('/admin/reject-project-request', {
                requestId: selectedRequestId,
                rejectionReason
            });
            alert('Project request rejected');
            setIsRejectModalOpen(false);
            fetchRequests();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to reject request');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBulkApprove = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to approve ${selectedIds.length} selected requests?`)) return;

        setIsSubmitting(true);
        try {
            const res = await api.post('/admin/bulk-approve-project-requests', { requestIds: selectedIds });
            alert(res.data.message || `Successfully approved ${selectedIds.length} requests`);
            setSelectedIds([]);
            fetchRequests();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to bulk approve');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBulkReject = async () => {
        if (selectedIds.length === 0) return;
        const reason = window.prompt(`Reason for bulk rejection of ${selectedIds.length} requests:`, "Bulk rejection by Admin");
        if (reason === null) return;

        setIsSubmitting(true);
        try {
            await api.post('/admin/bulk-reject-project-requests', { requestIds: selectedIds, rejectionReason: reason });
            alert(`Successfully rejected ${selectedIds.length} requests`);
            setSelectedIds([]);
            fetchRequests();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to bulk reject');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const categories = [...new Set(requests.map(req => req.project?.category).filter(Boolean))];
    const departments = [...new Set(requests.flatMap(req => req.team?.members?.map(m => m.user?.department)).filter(Boolean))];

    const filteredRequests = requests.filter(req => {
        const matchesSearch = req.project?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.team?.members?.some(m => m.user?.name.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesCategory = !selectedCategory || req.project?.category === selectedCategory;

        const matchesDepartment = !selectedDepartment ||
            req.team?.members?.some(m => m.user?.department === selectedDepartment);

        return matchesSearch && matchesCategory && matchesDepartment;
    });

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredRequests.length && filteredRequests.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredRequests.map(r => r.id));
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <MessageSquare className="text-blue-600" size={28} />
                        Project Requests
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Review and approve team project selections</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search team or project..."
                            className="pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
                        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((status) => (
                            <button
                                key={status}
                                onClick={() => {
                                    setFilterStatus(status);
                                    setSelectedIds([]);
                                    setSelectedCategory('');
                                    setSelectedDepartment('');
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === status
                                    ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Additional Filters Row */}
            <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Filters:</span>
                </div>

                {/* Batch/Scope Filter */}
                <div className="flex items-center gap-2 min-w-[200px]">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Batch:</span>
                    <select
                        value={selectedScope}
                        onChange={(e) => {
                            setSelectedScope(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                        <option value="ALL">All Batches</option>
                        {scopes.map(scope => (
                            <option key={scope.id} value={scope.id}>{scope.name}</option>
                        ))}
                    </select>
                </div>

                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>

                <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                    <option value="">All Departments</option>
                    {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                    ))}
                </select>

                {(selectedCategory || selectedDepartment || searchQuery || selectedScope !== 'ALL') && (
                    <button
                        onClick={() => {
                            setSelectedCategory('');
                            setSelectedDepartment('');
                            setSearchQuery('');
                            setSelectedScope('ALL');
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="text-xs font-bold text-blue-600 hover:underline px-2"
                    >
                        Clear All
                    </button>
                )}

                <div className="flex-1"></div>

                {filteredRequests.length > 0 && (
                    <button
                        onClick={toggleSelectAll}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedIds.length === filteredRequests.length && filteredRequests.length > 0
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400'
                            }`}
                    >
                        <CheckCircle size={14} />
                        {selectedIds.length === filteredRequests.length ? 'Deselect All' : `Select All Visible (${filteredRequests.length})`}
                    </button>
                )}
            </div>

            {/* Bulk Actions Toolbar */}
            {selectedIds.length > 0 && (
                <div className="flex items-center justify-between bg-blue-600 text-white p-4 rounded-2xl shadow-lg sticky top-4 z-10 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleSelectAll}
                            className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors"
                        >
                            <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${selectedIds.length === filteredRequests.length ? 'bg-white border-white' : 'border-white'}`}>
                                {selectedIds.length === filteredRequests.length && <CheckCircle size={14} className="text-blue-600" />}
                            </div>
                        </button>
                        <span className="font-bold">{selectedIds.length} items selected</span>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleBulkApprove}
                            disabled={isSubmitting}
                            className="bg-green-500 hover:bg-green-600 px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-md flex items-center gap-2"
                        >
                            <CheckCircle size={18} /> Bulk Approve
                        </button>
                        <button
                            onClick={handleBulkReject}
                            disabled={isSubmitting}
                            className="bg-red-500 hover:bg-red-600 px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-md flex items-center gap-2"
                        >
                            <XCircle size={18} /> Bulk Reject
                        </button>
                    </div>
                </div>
            )}

            {/* Requests List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-500 font-medium">Loading requests...</p>
                </div>
            ) : error ? (
                <div className="bg-red-50 p-8 rounded-3xl border border-red-100 text-center">
                    <AlertCircle className="text-red-500 mx-auto mb-3" size={40} />
                    <h3 className="text-lg font-bold text-red-800">{error}</h3>
                    <button onClick={fetchRequests} className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition">Try Again</button>
                </div>
            ) : requests.length === 0 ? (
                <div className="bg-white p-20 rounded-3xl border border-gray-100 shadow-sm text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Clock className="text-gray-300" size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">No requests found</h3>
                    <p className="text-gray-500 mt-2">There are no project requests matching your filters.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredRequests.map((req) => (
                            <div key={req.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
                                {/* Card Header */}
                                <div className="p-6 pb-4">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleSelect(req.id)}
                                                className={`p-1 rounded-md border transition-all ${selectedIds.includes(req.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-50 border-gray-200 text-transparent hover:border-blue-400 font-bold'}`}
                                            >
                                                <CheckCircle size={16} className={selectedIds.includes(req.id) ? 'opacity-100' : 'opacity-0'} />
                                            </button>
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${req.status === 'PENDING' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                req.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    'bg-red-50 text-red-700 border-red-200'
                                                }`}>
                                                {req.status}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] font-mono text-gray-400">
                                                {new Date(req.requestedAt).toLocaleDateString()}
                                            </span>
                                            {req.project?.scope && (
                                                <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase">
                                                    {req.project.scope.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-gray-800 line-clamp-2 leading-tight mb-1">{req.project?.title}</h3>
                                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">{req.project?.category}</p>
                                </div>

                                {/* Team Info */}
                                <div className="px-6 py-4 bg-gray-50/50 border-y border-gray-50">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                                        {req.team?.members?.length > 1 ? 'Team Members' : 'Requested By'}
                                    </p>
                                    <div className="space-y-2">
                                        {req.team?.members?.map(m => (
                                            <div key={m.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-gray-100 shadow-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-700">
                                                        {m.user?.name[0].toUpperCase()}
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-700">{m.user?.name}</span>
                                                </div>
                                                <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                                    {m.user?.rollNumber || 'N/A'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Actions or Review Info */}
                                <div className="p-6 mt-auto">
                                    {req.status === 'PENDING' ? (
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => handleApprove(req.id)}
                                                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition active:scale-95 shadow-lg shadow-green-100"
                                            >
                                                <CheckCircle size={18} /> Approve
                                            </button>
                                            <button
                                                onClick={() => openRejectModal(req.id)}
                                                className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 py-2.5 rounded-xl font-bold text-sm hover:bg-red-100 transition active:scale-95 border border-red-100"
                                            >
                                                <XCircle size={18} /> Reject
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-[11px] font-medium text-gray-500">
                                                <span>Reviewed At:</span>
                                                <span className="font-bold text-gray-700">{req.reviewedAt ? new Date(req.reviewedAt).toLocaleString() : 'N/A'}</span>
                                            </div>
                                            {req.status === 'REJECTED' && req.rejectionReason && (
                                                <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Rejection Reason</p>
                                                    <p className="text-xs text-red-700 italic">"{req.rejectionReason}"</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination Controls */}
                    {!loading && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 py-8">
                            <button
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50 transition-all font-bold text-sm"
                            >
                                Previous
                            </button>
                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                let pageNum = i + 1;
                                if (pagination.totalPages > 5 && pagination.page > 3) {
                                    pageNum = pagination.page - 3 + i + 1;
                                }
                                if (pageNum > pagination.totalPages) return null;

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${pagination.page === pageNum
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            {pagination.totalPages > 5 && pagination.page < pagination.totalPages - 2 && (
                                <span className="px-2 text-gray-400">...</span>
                            )}
                            <button
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page === pagination.totalPages}
                                className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50 transition-all font-bold text-sm"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Rejection Modal */}
            {isRejectModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 bg-red-600 text-white">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <XCircle size={24} /> Reject Project Request
                            </h3>
                            <p className="text-red-100 text-sm mt-1">Please provide a reason for rejecting this request.</p>
                        </div>

                        <div className="p-6">
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Reason for rejection (e.g., Team size mismatch, project already reserved...)"
                                className="w-full h-32 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none transition-all"
                                autoFocus
                            ></textarea>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setIsRejectModalOpen(false)}
                                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReject}
                                    className="flex-3 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition disabled:opacity-50 shadow-lg shadow-red-100 flex items-center justify-center gap-2"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>Confirm Rejection</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
