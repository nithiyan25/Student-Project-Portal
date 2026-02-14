import React, { useState, useEffect } from 'react';
import api from '../../api';
import BulkImportModal from '../ui/BulkImportModal';
import { Save, UserCheck, Shield, Search } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function SettingsTab() {
    const { addToast } = useToast();
    const [settings, setSettings] = useState({
        requireGuide: 'false',
        requireSubjectExpert: 'false'
    });
    const [faculty, setFaculty] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    // Load initial data
    useEffect(() => {
        fetchSettings();
        fetchFaculty();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/settings');
            // Ensure defaults
            setSettings({
                requireGuide: res.data.requireGuide || 'false',
                requireSubjectExpert: res.data.requireSubjectExpert || 'false'
            });
        } catch (e) {
            console.error("Error fetching settings", e);
        }
    };

    const fetchFaculty = async () => {
        setLoading(true);
        try {
            // Fetch all faculty (limit 1000 for now)
            const res = await api.get('/users', { params: { role: 'FACULTY', limit: 1000 } });
            setFaculty(res.data.users || []);
        } catch (e) {
            console.error("Error fetching faculty", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const saveSettings = async () => {
        try {
            await api.put('/settings', { settings });
            addToast("Settings saved successfully!", 'success');
        } catch (e) {
            addToast("Failed to save settings", 'error');
        }
    };

    const toggleFacultyRole = async (userId, roleType, currentValue) => {
        try {
            // Optimistic update
            setFaculty(prev => prev.map(f => {
                if (f.id === userId) {
                    return { ...f, [roleType]: !currentValue };
                }
                return f;
            }));

            await api.post('/admin/update-faculty-roles', {
                userId,
                [roleType]: !currentValue // Toggle
            });
        } catch (e) {
            addToast("Error updating faculty role", 'error');
            fetchFaculty(); // Revert on error
        }
    };

    const filteredFaculty = faculty.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.email.toLowerCase().includes(search.toLowerCase())
    );

    // State for Bulk Import
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState('FACULTY');

    const handleBulkRoleImport = async (data) => {
        try {
            const roleType = modalType === 'GUIDE_LIST' ? 'GUIDE' : 'EXPERT';
            // Extract emails from data (format: [{email: '...'}, ...])
            const emails = data.map(d => d.email).filter(e => e);

            addToast(`Success! ${res.data.message}`, 'success');
            fetchFaculty(); // Refresh list to see updates
        } catch (e) {
            console.error(e);
            throw e; // Let modal handle error toast
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* 2. Faculty Role Eligibility */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <UserCheck className="text-purple-600" size={24} /> Faculty Eligibility
                        </h2>
                        <p className="text-gray-500 text-sm mt-1">Designate which faculty members can serve as Guides or Subject Experts.</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search faculty..."
                                className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 w-48"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        {/* Bulk Upload Buttons */}
                        <button
                            onClick={() => { setModalType('GUIDE_LIST'); setModalOpen(true); }}
                            className="bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-green-700 transition shadow-sm"
                        >
                            Upload Guides
                        </button>
                        <button
                            onClick={() => { setModalType('EXPERT_LIST'); setModalOpen(true); }}
                            className="bg-purple-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-purple-700 transition shadow-sm"
                        >
                            Upload Experts
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold">
                            <tr>
                                <th className="px-6 py-4">Faculty Name</th>
                                <th className="px-6 py-4 text-center">Eligible Guide</th>
                                <th className="px-6 py-4 text-center">Eligible Subject Expert</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredFaculty.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="px-6 py-8 text-center text-gray-400">
                                        No faculty found.
                                    </td>
                                </tr>
                            ) : (
                                filteredFaculty.map(f => (
                                    <tr key={f.id} className="hover:bg-gray-50/50 transition">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-gray-800">{f.name}</p>
                                            <p className="text-xs text-gray-500">{f.email}</p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => toggleFacultyRole(f.id, 'isGuide', f.isGuide)}
                                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${f.isGuide
                                                    ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                                                    : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {f.isGuide ? 'Eligible' : 'Not Eligible'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => toggleFacultyRole(f.id, 'isSubjectExpert', f.isSubjectExpert)}
                                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${f.isSubjectExpert
                                                    ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200'
                                                    : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {f.isSubjectExpert ? 'Eligible' : 'Not Eligible'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <BulkImportModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                type={modalType}
                onImport={handleBulkRoleImport}
            />
        </div>
    );
}
