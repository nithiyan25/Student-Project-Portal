import React, { useState } from 'react';
import { X, CheckCircle2, Briefcase, Clock } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ReleaseReviewsModal({ isOpen, onClose, scopes, onRelease }) {
    const { addToast } = useToast();
    const [selectedScopeId, setSelectedScopeId] = useState('');
    const [reviewPhase, setReviewPhase] = useState('1');
    const [duration, setDuration] = useState('0'); // 0 for permanent
    const [accessStartsAt, setAccessStartsAt] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const maxPhases = React.useMemo(() => {
        if (!selectedScopeId) return 4;
        const scope = scopes?.find(s => s.id === selectedScopeId);
        return scope?.numberOfPhases || 4;
    }, [selectedScopeId, scopes]);

    const handleSubmit = async () => {
        if (!selectedScopeId) {
            addToast("Please select a Student Batch (Scope).", 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            await onRelease({
                scopeId: selectedScopeId,
                reviewPhase: parseInt(reviewPhase),
                durationHours: parseInt(duration),
                accessStartsAt: accessStartsAt || null
            });
            onClose();
        } catch (e) {
            addToast(e.response?.data?.error || "Error releasing reviews", 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-white/20">
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-purple-600 to-indigo-700 text-white shrink-0 relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-black flex items-center gap-2 tracking-tight">
                                Release Guide Reviews
                            </h2>
                            <p className="opacity-90 mt-1 text-sm font-medium">Activate review permission for all Guides in a Batch</p>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-all"><X size={20} /></button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Scope Selection */}
                    <div>
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">1. Select Batch</label>
                        <select
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 ring-purple-500 outline-none transition-all"
                            value={selectedScopeId}
                            onChange={(e) => setSelectedScopeId(e.target.value)}
                        >
                            <option value="">-- Choose Batch --</option>
                            {scopes.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Phase Selection */}
                    <div>
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">2. Review Phase</label>
                        <select
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 ring-purple-500 outline-none transition-all"
                            value={reviewPhase}
                            onChange={(e) => setReviewPhase(e.target.value)}
                        >
                            {Array.from({ length: maxPhases }, (_, i) => i + 1).map(p => (
                                <option key={p} value={String(p)}>Phase {p}</option>
                            ))}
                        </select>
                    </div>

                    {/* Duration Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">3. Access Starts</label>
                            <input
                                type="datetime-local"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 ring-purple-500 outline-none transition-all"
                                value={accessStartsAt}
                                onChange={(e) => setAccessStartsAt(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">4. Access Duration</label>
                            <select
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 ring-purple-500 outline-none transition-all"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                            >
                                <option value="0">Permanent</option>
                                <option value="24">24 Hours</option>
                                <option value="48">48 Hours</option>
                                <option value="168">1 Week</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !selectedScopeId}
                            className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg shadow-purple-200 hover:bg-purple-700 hover:shadow-purple-300 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? "Releasing..." : (
                                <>
                                    <CheckCircle2 size={18} />
                                    Release Reviews
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
