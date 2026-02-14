import React, { useState, useEffect } from 'react';
import { X, Calendar, Save, AlertCircle, Clock } from 'lucide-react';
import api from '../../api';

export default function PhaseDeadlinesModal({ isOpen, onClose, scope }) {
    const [deadlines, setDeadlines] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && scope) {
            loadDeadlines();
        }
    }, [isOpen, scope]);

    const loadDeadlines = async () => {
        try {
            setLoading(true);
            const url = `/scopes/${scope.id}/deadlines`;
            const res = await api.get(url);

            // Initialize with empty deadlines for all phases
            const numPhases = scope.numberOfPhases || 4;
            const existing = res.data || [];
            const initial = Array.from({ length: numPhases }, (_, i) => {
                const phase = i + 1;
                const match = existing.find(d => d.phase === phase);
                return {
                    phase,
                    deadline: match ? new Date(match.deadline).toISOString().split('T')[0] : ''
                };
            });
            setDeadlines(initial);
        } catch (err) {
            setError("Failed to load deadlines");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);

            // Only send deadlines that have been set
            const toSave = deadlines.filter(d => d.deadline !== '').map(d => ({
                phase: d.phase,
                deadline: new Date(d.deadline).toISOString()
            }));

            const url = `/scopes/${scope.id}/deadlines`;

            await api.post(url, { deadlines: toSave });
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || "Failed to save deadlines");
        } finally {
            setSaving(false);
        }
    };

    const updateDeadline = (phase, value) => {
        setDeadlines(prev => prev.map(d => d.phase === phase ? { ...d, deadline: value } : d));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Calendar size={20} /> Phase Deadlines
                        </h2>
                        <p className="text-blue-100 text-xs mt-1">{scope.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {loading ? (
                        <div className="py-10 text-center text-gray-400 flex flex-col items-center gap-3">
                            <Clock className="animate-spin text-blue-500" size={24} />
                            <p className="text-sm font-medium">Loading deadlines...</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {deadlines.map((d) => (
                                    <div key={d.phase} className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between gap-4">
                                        <div className="shrink-0 flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center font-black text-blue-600 text-sm shadow-sm">
                                                P{d.phase}
                                            </div>
                                            <span className="text-sm font-bold text-gray-700">Phase {d.phase}</span>
                                        </div>
                                        <input
                                            type="date"
                                            value={d.deadline}
                                            onChange={(e) => updateDeadline(d.phase, e.target.value)}
                                            className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium text-gray-600 shadow-sm"
                                        />
                                    </div>
                                ))}
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                                    <AlertCircle size={18} />
                                    <p className="text-xs font-bold">{error}</p>
                                </div>
                            )}

                            <div className="pt-2 flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-6 py-3 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-all border border-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 px-6 py-3 rounded-2xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                                >
                                    {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                                    Save Deadlines
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
