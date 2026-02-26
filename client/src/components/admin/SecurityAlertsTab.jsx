import React, { useState, useEffect } from 'react';
import api from '../../api';
import { ShieldAlert, Trash2, CheckCircle, Info, ExternalLink, Clock, User, Globe, ShieldOff, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

export default function SecurityAlertsTab() {
    const [alerts, setAlerts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();
    const { confirm } = useConfirm();

    // Blocking state
    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [blockDuration, setBlockDuration] = useState('24h');
    const [blockReason, setBlockReason] = useState('Malpractice detected / suspicious activity');
    const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);

    const [selectedIds, setSelectedIds] = useState(new Set());

    const fetchAlerts = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/security/alerts');
            setAlerts(res.data);
            setSelectedIds(new Set()); // Clear selection on refresh
        } catch (err) {
            addToast("Failed to fetch security alerts", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    const markAsRead = async (id) => {
        try {
            await api.patch(`/security/alerts/${id}/read`);
            setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
            addToast("Alert acknowledged", 'success');
        } catch (err) {
            addToast("Failed to update alert", 'error');
        }
    };

    const toggleSelect = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === alerts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(alerts.map(a => a.id)));
        }
    };

    const deleteAlert = async (id) => {
        if (!await confirm("Delete this security alert record?", "Confirm Deletion", "danger")) return;
        try {
            await api.delete(`/security/alerts/${id}`);
            setAlerts(prev => prev.filter(a => a.id !== id));
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            addToast("Alert deleted", 'info');
        } catch (err) {
            addToast("Failed to delete alert", 'error');
        }
    };

    const handleBulkDelete = async () => {
        const count = selectedIds.size;
        if (count === 0) return;
        if (!await confirm(`Delete ${count} selected security alerts?`, "Confirm Bulk Deletion", "danger")) return;

        try {
            await api.post('/security/alerts/bulk-delete', { ids: Array.from(selectedIds) });
            setAlerts(prev => prev.filter(a => !selectedIds.has(a.id)));
            setSelectedIds(new Set());
            addToast(`${count} alerts deleted successfully`, 'success');
        } catch (err) {
            addToast("Failed to perform bulk deletion", 'error');
        }
    };

    const handleBlockUser = async () => {
        if (!selectedUser) return;
        if (!blockReason.trim()) return addToast("Reason is required", 'warning');

        setIsSubmittingBlock(true);
        try {
            await api.post(`/admin/users/${selectedUser.id}/block`, {
                duration: blockDuration,
                reason: blockReason
            });
            addToast(`User ${selectedUser.name} blocked successfully`, 'success');
            setIsBlockModalOpen(false);
            fetchAlerts(); // Refresh to show updated block status if any
        } catch (err) {
            addToast(err.response?.data?.error || "Failed to block user", 'error');
        } finally {
            setIsSubmittingBlock(false);
        }
    };

    const handleUnblockUser = async (userId, name) => {
        if (!await confirm(`Are you sure you want to unblock ${name}?`, "Confirm Unblock")) return;
        try {
            await api.post(`/admin/users/${userId}/unblock`);
            addToast(`User ${name} unblocked successfully`, 'success');
            fetchAlerts();
        } catch (err) {
            addToast("Failed to unblock user", 'error');
        }
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'HIGH': return 'text-red-600 bg-red-50 border-red-100';
            case 'MEDIUM': return 'text-amber-600 bg-amber-50 border-amber-100';
            case 'LOW': return 'text-blue-600 bg-blue-50 border-blue-100';
            default: return 'text-slate-600 bg-slate-50 border-slate-100';
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-500 font-bold">Loading security logs...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <ShieldAlert size={28} className="text-red-500" />
                        Security & Malpractice Logs
                    </h2>
                    <p className="text-slate-500 font-medium mt-1">
                        Track unauthorized access attempts and suspicious system activity.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {alerts.length > 0 && (
                        <button
                            onClick={toggleSelectAll}
                            className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${selectedIds.size === alerts.length
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            {selectedIds.size === alerts.length ? 'Deselect All' : 'Select All'}
                        </button>
                    )}
                    <button
                        onClick={fetchAlerts}
                        className="bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 transition-all"
                    >
                        Refresh Logs
                    </button>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="bg-slate-900 text-white p-4 rounded-lg shadow-lg flex justify-between items-center animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-black">
                            {selectedIds.size}
                        </div>
                        <span className="text-sm font-bold tracking-tight">Logs Selected</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="px-4 py-2 hover:bg-white/10 rounded-lg text-xs font-bold transition-all"
                        >
                            Clear Selection
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
                        >
                            <Trash2 size={16} />
                            Delete Permanent
                        </button>
                    </div>
                </div>
            )}

            {alerts.length === 0 ? (
                <div className="bg-white rounded-lg border border-dashed border-slate-200 py-20 text-center">
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">System Secure</h3>
                    <p className="text-slate-500 mt-2">No security incidents or tampering attempts recorded.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {alerts.map((alert) => (
                        <div
                            key={alert.id}
                            className={`bg-white border rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md relative group ${selectedIds.has(alert.id)
                                ? 'border-blue-500 ring-1 ring-blue-500/20 bg-blue-50/10'
                                : alert.isRead ? 'border-slate-100 opacity-80' : 'border-red-100 shadow-sm shadow-red-50'
                                }`}
                        >
                            {/* Checkbox Overlay */}
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSelect(alert.id);
                                }}
                                className={`absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center border-r transition-colors cursor-pointer ${selectedIds.has(alert.id) ? 'bg-blue-50 border-blue-100' : 'bg-slate-50/30 border-slate-50 group-hover:bg-slate-50'
                                    }`}
                            >
                                <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${selectedIds.has(alert.id)
                                    ? 'bg-blue-600 border-blue-600 scale-110'
                                    : 'border-slate-300 bg-white'
                                    }`}>
                                    {selectedIds.has(alert.id) && <CheckCircle size={14} className="text-white" />}
                                </div>
                            </div>

                            <div className="p-5 pl-16">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}>
                                            <ShieldAlert size={24} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${getSeverityColor(alert.severity)}`}>
                                                    {alert.severity} Incident
                                                </span>
                                                {!alert.isRead && (
                                                    <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                                                )}
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-800 mt-1">{alert.type}</h3>
                                            <p className="text-slate-600 mt-2 text-sm leading-relaxed whitespace-pre-wrap">
                                                {alert.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {alert.user && (
                                            alert.user.isBlocked ? (
                                                <button
                                                    onClick={() => handleUnblockUser(alert.user.id, alert.user.name)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors"
                                                    title="Unblock User"
                                                >
                                                    <ShieldOff size={14} /> Unblock
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setSelectedUser(alert.user);
                                                        setIsBlockModalOpen(true);
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold border border-rose-100 hover:bg-rose-100 transition-colors"
                                                    title="Block User"
                                                >
                                                    <ShieldAlert size={14} /> Block
                                                </button>
                                            )
                                        )}
                                        {!alert.isRead && (
                                            <button
                                                onClick={() => markAsRead(alert.id)}
                                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                                                title="Acknowledge"
                                            >
                                                <CheckCircle size={20} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deleteAlert(alert.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                            title="Delete log"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-6 pt-5 border-t border-slate-50 grid grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <User size={12} /> Target User
                                        </p>
                                        <div className="text-sm font-bold text-slate-700">
                                            {alert.user ? (
                                                <div className="flex flex-col">
                                                    <span className="flex items-center gap-1">
                                                        {alert.user.name}
                                                        {alert.user.isBlocked && (
                                                            <span className="bg-rose-100 text-rose-600 text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Suspended</span>
                                                        )}
                                                    </span>
                                                    <span className="text-slate-400 font-mono text-[10px]">
                                                        ({alert.user.role}{alert.user.rollNumber ? ` • ${alert.user.rollNumber}` : ""})
                                                    </span>
                                                </div>
                                            ) : 'Unknown/Guest'}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <ExternalLink size={12} /> Endpoint
                                        </p>
                                        <p className="text-sm font-mono font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded w-fit">
                                            <span className="text-blue-600 mr-2">{alert.method}</span>
                                            {alert.path}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <Globe size={12} /> Source IP
                                        </p>
                                        <p className="text-sm font-bold text-slate-700">{alert.ipAddress || 'Not recorded'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <Clock size={12} /> Timestamp
                                        </p>
                                        <p className="text-sm font-bold text-slate-700">
                                            {new Date(alert.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                {alert.userAgent && (
                                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="flex items-center gap-2 mb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-emerald-600">
                                            <Info size={12} /> Device Details (Fingerprint)
                                        </div>

                                        {/* Parsed Info */}
                                        {alert.metadata?.device && (
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                                <div className="bg-white p-2 rounded-lg border border-slate-100">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Browser</p>
                                                    <p className="text-xs font-bold text-slate-700">
                                                        {alert.metadata.device.browser.name} {alert.metadata.device.browser.version}
                                                    </p>
                                                </div>
                                                <div className="bg-white p-2 rounded-lg border border-slate-100">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Operating System</p>
                                                    <p className="text-xs font-bold text-slate-700">
                                                        {alert.metadata.device.os.name} {alert.metadata.device.os.version}
                                                    </p>
                                                </div>
                                                <div className="bg-white p-2 rounded-lg border border-slate-100">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Device Type</p>
                                                    <p className="text-xs font-bold text-slate-700 capitalize">
                                                        {alert.metadata.device.device.type || 'Desktop'} {alert.metadata.device.device.vendor || ''}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Raw User Agent</p>
                                        <p className="text-[10px] font-mono text-slate-400 break-all leading-relaxed bg-white p-2 rounded-lg border border-slate-100 italic">
                                            {alert.userAgent}
                                        </p>

                                        <p className="text-[9px] text-rose-500 font-medium mt-3 flex items-center gap-1 italic">
                                            <ShieldAlert size={10} /> Note: Client MAC Address is private and cannot be captured via browser protocol. Identification is based on IP and Device Fingerprint.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* BLOCK MODAL */}
            {isBlockModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-lg shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <ShieldAlert className="text-rose-500" /> Block User access
                                </h3>
                                <button onClick={() => setIsBlockModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-rose-50 rounded-lg border border-rose-100">
                                    <p className="text-xs text-rose-700 font-medium">
                                        You are about to block <strong>{selectedUser?.name}</strong>. They will be denied access to the system immediately. All their data will remain intact.
                                    </p>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Suspension Duration</label>
                                    <select
                                        value={blockDuration}
                                        onChange={(e) => setBlockDuration(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all cursor-pointer"
                                    >
                                        <option value="1h">Temporary - 1 Hour</option>
                                        <option value="24h">Temporary - 24 Hours</option>
                                        <option value="7d">Temporary - 7 Days</option>
                                        <option value="permanent">Indefinite (Manual Unblock)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Reason for Block</label>
                                    <textarea
                                        value={blockReason}
                                        onChange={(e) => setBlockReason(e.target.value)}
                                        placeholder="Explain why this action is being taken..."
                                        rows={3}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none"
                                    ></textarea>
                                    <p className="text-[10px] text-slate-400 mt-1 italic">
                                        Note: User will see this reason in their suspension message.
                                    </p>
                                </div>

                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Instruction to User:</p>
                                    <p className="text-[11px] text-slate-600 italic">
                                        "Please contact the administrator (Learning Centre IV floor) to resolve this."
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setIsBlockModalOpen(false)}
                                    className="flex-1 px-4 py-3 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all border border-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBlockUser}
                                    disabled={isSubmittingBlock}
                                    className="flex-1 px-4 py-3 rounded-lg text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmittingBlock ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : 'Apply Block'}

                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

