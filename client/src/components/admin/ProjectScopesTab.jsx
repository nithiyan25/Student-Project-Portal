import React, { useState, useEffect } from 'react';
import api from '../../api';
import { Plus, Folder, Calendar, ToggleLeft, ToggleRight, Loader, Trash2, Upload, Search, CheckCircle2, Copy, Check } from 'lucide-react';
import BulkImportModal from '../ui/BulkImportModal';

export default function ProjectScopesTab() {
    const [scopes, setScopes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newScope, setNewScope] = useState({ name: '', description: '', type: 'MAIN', numberOfPhases: 4, requireGuide: false, requireSubjectExpert: false });

    useEffect(() => {
        fetchScopes();
    }, []);

    const fetchScopes = async () => {
        try {
            const res = await api.get('/scopes');
            setScopes(res.data);
        } catch (error) {
            console.error("Failed to fetch scopes", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateScope = async (e) => {
        e.preventDefault();
        try {
            await api.post('/scopes', newScope);
            setShowCreateModal(false);
            setNewScope({ name: '', description: '', type: 'MAIN', numberOfPhases: 4, requireGuide: false, requireSubjectExpert: false });
            fetchScopes();
        } catch (error) {
            alert('Failed to create scope: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleDeleteScope = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`)) {
            return;
        }
        try {
            await api.delete(`/scopes/${id}`);
            alert('Scope deleted successfully');
            fetchScopes();
        } catch (error) {
            alert('Failed to delete scope: ' + (error.response?.data?.error || error.message));
        }
    };

    const toggleScope = async (id) => {
        try {
            await api.put(`/scopes/${id}/toggle`);
            fetchScopes();
        } catch (error) {
            console.error("Failed to toggle scope", error);
        }
    };

    const toggleScopeSetting = async (id, field, currentValue) => {
        try {
            await api.patch(`/scopes/${id}`, { [field]: !currentValue });
            fetchScopes();
        } catch (error) {
            console.error(`Failed to toggle ${field}`, error);
        }
    };

    const updateScopeSetting = async (id, field, value) => {
        try {
            await api.patch(`/scopes/${id}`, { [field]: value });
            fetchScopes();
        } catch (error) {
            console.error(`Failed to update ${field}`, error);
        }
    };

    // Add Project Logic
    const [showAddProjectModal, setShowAddProjectModal] = useState(false);
    const [targetScope, setTargetScope] = useState(null);
    const [newProject, setNewProject] = useState({ title: '', category: '', maxTeamSize: 3, description: '', techStack: '', srs: '' });

    const openAddProject = (scope) => {
        setTargetScope(scope);
        setNewProject({ title: '', category: '', maxTeamSize: 3, description: '', techStack: '', srs: '' });
        setShowAddProjectModal(true);
    };

    const handleCreateProject = async (e) => {
        e.preventDefault();
        try {
            await api.post('/projects', { ...newProject, scopeId: targetScope.id });
            setShowAddProjectModal(false);
            alert('Project created successfully in ' + targetScope.name);
            fetchScopes(); // Refresh to update counts
        } catch (error) {
            alert('Failed to create project: ' + (error.response?.data?.error || error.message));
        }
    };

    // Bulk Import Logic
    const [showBulkImportModal, setShowBulkImportModal] = useState(false);
    const [bulkTargetScope, setBulkTargetScope] = useState(null);

    const openBulkAddProject = (scope) => {
        setBulkTargetScope(scope);
        // Clean up previous state if any
        setShowBulkImportModal(true);
    };

    const handleBulkCreateProjects = async (parsedData) => {
        try {
            // Attach scopeId to each project
            const projectsWithScope = parsedData.map(p => ({
                ...p,
                scopeId: bulkTargetScope.id,
                // Ensure defaults if missing from CSV
                maxTeamSize: p.maxTeamSize ? parseInt(p.maxTeamSize) : 3,
                category: p.category || 'General',
                description: p.description || ''
            }));

            const res = await api.post('/projects/bulk', { projects: projectsWithScope });
            // Alert and close handled by modal? No, modal calls this, expects async completion.
            // But BulkImportModal closes itself on successful await, we should alert success.
            alert(`Successfully added ${res.data.count} projects to ${bulkTargetScope.name}`);
            fetchScopes();
        } catch (error) {
            console.error(error);
            // Re-throw so modal stays open or shows error? 
            // Looking at BulkImportModal: "catch (err) { alert... }"
            // So we should throw error to let Modal handle UI feedback if needed, 
            // BUT Modal has its own try/catch that calls onImport.
            throw new Error(error.response?.data?.error || error.message);
        }
    };

    // Manage Students Logic
    const [managingScope, setManagingScope] = useState(null);
    const [scopeStudents, setScopeStudents] = useState([]);
    const [allStudents, setAllStudents] = useState([]);
    const [studentSearch, setStudentSearch] = useState('');
    const [manageLoading, setManageLoading] = useState(false);

    // Filters & Selection
    const [manageYearFilter, setManageYearFilter] = useState('ALL');
    const [manageDeptFilter, setManageDeptFilter] = useState('ALL');
    const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
    const [manageMode, setManageMode] = useState('SELECT'); // 'SELECT', 'BULK', 'BULK_REMOVE', or 'STATUS'
    const [bulkStudentIdentifiers, setBulkStudentIdentifiers] = useState('');
    const [isBulkProcessingStudents, setIsBulkProcessingStudents] = useState(false);
    const [scopeStats, setScopeStats] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const [allCopiedType, setAllCopiedType] = useState(null);

    // Copy handlers for Status tab
    const handleCopyIndividual = async (text, id) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleCopyAll = async (students, type) => {
        try {
            const rollNumbers = students
                .map(s => s.rollNumber || s.email)
                .filter(Boolean)
                .join('\n');
            await navigator.clipboard.writeText(rollNumbers);
            setAllCopiedType(type);
            setTimeout(() => setAllCopiedType(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const openManageStudents = async (scope) => {
        setManagingScope(scope);
        setManageLoading(true);
        setSelectedStudentIds(new Set()); // Reset selection
        setScopeStats(null); // Reset stats
        try {
            const [assignedRes, allRes, statsRes] = await Promise.all([
                api.get(`/scopes/${scope.id}/students`),
                api.get('/users', { params: { role: 'STUDENT', limit: 5000 } }),
                api.get(`/scopes/${scope.id}/stats`)
            ]);
            setScopeStudents(assignedRes.data);
            setAllStudents(allRes.data.users || allRes.data);
            setScopeStats(statsRes.data);
        } catch (error) {
            console.error("Failed to load student data", error);
            alert("Failed to load data");
        } finally {
            setManageLoading(false);
        }
    };

    const handleAddStudent = async (studentId) => {
        try {
            await api.post(`/scopes/${managingScope.id}/students`, { studentIds: [studentId] });
            const studentToAdd = allStudents.find(s => s.id === studentId);
            if (studentToAdd) setScopeStudents([...scopeStudents, studentToAdd]);
        } catch (error) {
            console.error(error);
        }
    };

    const handleBulkAddStudents = async () => {
        if (selectedStudentIds.size === 0) return;
        try {
            const ids = Array.from(selectedStudentIds);
            await api.post(`/scopes/${managingScope.id}/students`, { studentIds: ids });

            const studentsToAdd = allStudents.filter(s => ids.includes(s.id));
            setScopeStudents([...scopeStudents, ...studentsToAdd]);
            setSelectedStudentIds(new Set());
            alert(`Added ${ids.length} students to scope`);
        } catch (error) {
            alert('Failed to add students: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleRemoveStudent = async (studentId) => {
        try {
            await api.delete(`/scopes/${managingScope.id}/students`, { data: { studentIds: [studentId] } });
            setScopeStudents(scopeStudents.filter(s => s.id !== studentId));
        } catch (error) {
            console.error(error);
        }
    };

    const handleBulkIdentifierAdd = async () => {
        if (!bulkStudentIdentifiers.trim()) return;

        setIsBulkProcessingStudents(true);
        try {
            const identifiers = bulkStudentIdentifiers
                .split(/[\n,\r,\t, ]+/)
                .map(id => id.trim())
                .filter(id => id.length > 0);

            if (identifiers.length === 0) return;

            const res = await api.post(`/scopes/${managingScope.id}/students-bulk`, { identifiers });

            let msg = `Successfully added ${res.data.addedCount} students.`;
            if (res.data.notFound && res.data.notFound.length > 0) {
                msg += `\n\nNot found (${res.data.notFound.length}): ${res.data.notFound.join(', ')}`;
            }
            alert(msg);

            setBulkStudentIdentifiers('');
            openManageStudents(managingScope);
        } catch (error) {
            alert('Bulk add failed: ' + (error.response?.data?.error || error.message));
        } finally {
            setIsBulkProcessingStudents(false);
        }
    };

    const handleBulkIdentifierRemove = async () => {
        if (!bulkStudentIdentifiers.trim()) return;

        if (!window.confirm("Are you sure you want to remove these students from this batch?")) return;

        setIsBulkProcessingStudents(true);
        try {
            const identifiers = bulkStudentIdentifiers
                .split(/[\n,\r,\t, ]+/)
                .map(id => id.trim())
                .filter(id => id.length > 0);

            if (identifiers.length === 0) return;

            const res = await api.post(`/scopes/${managingScope.id}/students-remove-bulk`, { identifiers });

            let msg = `Successfully removed ${res.data.removedCount} students.`;
            if (res.data.notFound && res.data.notFound.length > 0) {
                msg += `\n\nNot found/Not in batch (${res.data.notFound.length}): ${res.data.notFound.join(', ')}`;
            }
            alert(msg);

            setBulkStudentIdentifiers('');
            openManageStudents(managingScope);
        } catch (error) {
            alert('Bulk removal failed: ' + (error.response?.data?.error || error.message));
        } finally {
            setIsBulkProcessingStudents(false);
        }
    };

    // Derived states for filtering
    const availableStudents = allStudents.filter(s => !scopeStudents.find(ss => ss.id === s.id));

    const filteredAvailableStudents = availableStudents.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) || (s.rollNumber && s.rollNumber.toLowerCase().includes(studentSearch.toLowerCase()));
        const matchesYear = manageYearFilter === 'ALL' || String(s.year) === manageYearFilter;
        const matchesDept = manageDeptFilter === 'ALL' || (s.department || "Unassigned") === manageDeptFilter;
        return matchesSearch && matchesYear && matchesDept;
    });

    const toggleSelection = (id) => {
        const newSet = new Set(selectedStudentIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedStudentIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedStudentIds.size === filteredAvailableStudents.length && filteredAvailableStudents.length > 0) {
            setSelectedStudentIds(new Set());
        } else {
            setSelectedStudentIds(new Set(filteredAvailableStudents.map(s => s.id)));
        }
    };

    const uniqueDepts = [...new Set(allStudents.map(s => s.department || "Unassigned"))].sort();

    if (loading) return <div className="flex justify-center p-12"><Loader className="animate-spin text-blue-600" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Folder className="text-blue-600" size={24} /> Project Scopes (Batches)
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Manage project cycles (e.g., Mini Project, Final Year)</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-100"
                >
                    <Plus size={18} /> Create Scope
                </button>
            </div>

            {/* Scope List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {scopes.map(scope => (
                    <div key={scope.id} className={`bg-white p-6 rounded-2xl border transition-all hover:shadow-md ${scope.isActive ? 'border-gray-100' : 'border-gray-200 bg-gray-50 opacity-75'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                <Folder size={24} />
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => openBulkAddProject(scope)} className="text-gray-400 hover:text-blue-600 transition p-1" title="Bulk Add Projects">
                                    <Upload size={18} />
                                </button>
                                <button onClick={() => handleDeleteScope(scope.id, scope.name)} className="text-gray-400 hover:text-red-500 transition p-1" title="Delete Scope">
                                    <Trash2 size={18} />
                                </button>
                                <button onClick={() => toggleScope(scope.id)} className="text-gray-400 hover:text-blue-600 transition p-1" title="Toggle Active Status">
                                    {scope.isActive ? <ToggleRight size={28} className="text-green-500" /> : <ToggleLeft size={28} />}
                                </button>
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-gray-800 mb-1">{scope.name}</h3>
                        <p className="text-sm text-gray-500 line-clamp-2 h-10 mb-4">{scope.description || "No description provided."}</p>

                        <div className="flex items-center gap-4 text-xs font-medium text-gray-400 border-t border-gray-100 pt-4 mb-4">
                            <span className="flex items-center gap-1">
                                <Calendar size={14} /> Created {new Date(scope.createdAt).toLocaleDateString()}
                            </span>
                            <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-500 uppercase">{scope.type}</span>
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg inline-block">
                                {scope._count?.projects || 0} Projects Active
                            </div>
                            <div className="px-3 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded-lg inline-block">
                                {scope._count?.students || 0} Students
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openAddProject(scope)}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"
                                >
                                    <Plus size={14} /> Add Project
                                </button>
                                <button
                                    onClick={() => openManageStudents(scope)}
                                    className="text-xs font-bold text-gray-600 hover:text-blue-600 flex items-center gap-1 bg-gray-50 px-2 py-1 rounded"
                                >
                                    Manage Students
                                </button>
                            </div>

                        </div>

                        {/* Settings Toggles */}
                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-600">Require Guide</span>
                                <button
                                    onClick={() => toggleScopeSetting(scope.id, 'requireGuide', scope.requireGuide)}
                                    className="transition"
                                >
                                    {scope.requireGuide ? <ToggleRight size={22} className="text-green-500" /> : <ToggleLeft size={22} className="text-gray-300" />}
                                </button>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-600">Require Subject Expert</span>
                                <button
                                    onClick={() => toggleScopeSetting(scope.id, 'requireSubjectExpert', scope.requireSubjectExpert)}
                                    className="transition"
                                >
                                    {scope.requireSubjectExpert ? <ToggleRight size={22} className="text-green-500" /> : <ToggleLeft size={22} className="text-gray-300" />}
                                </button>
                            </div>
                            <div className="flex justify-between items-center text-xs mt-2">
                                <span className="text-gray-600">Review Phases</span>
                                <select
                                    className="bg-gray-50 border border-gray-200 rounded px-1 py-0.5 outline-none text-gray-700"
                                    value={scope.numberOfPhases || 4}
                                    onChange={(e) => updateScopeSetting(scope.id, 'numberOfPhases', parseInt(e.target.value))}
                                >
                                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                ))}

                {scopes.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <Folder size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No project scopes found. Create one to get started.</p>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-xl font-bold text-gray-800 mb-6">Create New Scope</h3>
                        <form onSubmit={handleCreateScope} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Scope Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Mini Project 2026"
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                    value={newScope.name}
                                    onChange={e => setNewScope({ ...newScope, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                                <textarea
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                    rows="3"
                                    value={newScope.description}
                                    onChange={e => setNewScope({ ...newScope, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
                                <select
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                    value={newScope.type}
                                    onChange={e => setNewScope({ ...newScope, type: e.target.value })}
                                >
                                    <option value="MINI">Mini Project</option>
                                    <option value="MAIN">Main Project</option>
                                    <option value="INTERNSHIP">Internship</option>
                                    <option value="TRAINING">Training</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Review Phases</label>
                                <select
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                    value={newScope.numberOfPhases}
                                    onChange={e => setNewScope({ ...newScope, numberOfPhases: parseInt(e.target.value) })}
                                >
                                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} Phases</option>)}
                                </select>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm font-bold text-gray-700">Require Project Guide</span>
                                <button
                                    type="button"
                                    onClick={() => setNewScope({ ...newScope, requireGuide: !newScope.requireGuide })}
                                >
                                    {newScope.requireGuide ? <ToggleRight size={28} className="text-green-500" /> : <ToggleLeft size={28} className="text-gray-300" />}
                                </button>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm font-bold text-gray-700">Require Subject Expert</span>
                                <button
                                    type="button"
                                    onClick={() => setNewScope({ ...newScope, requireSubjectExpert: !newScope.requireSubjectExpert })}
                                >
                                    {newScope.requireSubjectExpert ? <ToggleRight size={28} className="text-green-500" /> : <ToggleLeft size={28} className="text-gray-300" />}
                                </button>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-2 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                                >
                                    Create Scope
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manage Students Modal */}
            {managingScope && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Manage Students</h3>
                                <p className="text-sm text-gray-500">for {managingScope.name}</p>
                            </div>
                            <button onClick={() => setManagingScope(null)} className="text-gray-400 hover:text-gray-600">
                                <span className="sr-only">Close</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden p-6 gap-6 flex flex-col md:flex-row">
                            {/* Left: Available Students */}
                            <div className="flex-1 flex flex-col bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                                <div className="flex border-b border-gray-100 bg-white">
                                    <button
                                        onClick={() => setManageMode('SELECT')}
                                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all ${manageMode === 'SELECT' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        Selection
                                    </button>
                                    <button
                                        onClick={() => setManageMode('BULK')}
                                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all ${manageMode === 'BULK' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        Bulk Add
                                    </button>
                                    <button
                                        onClick={() => setManageMode('BULK_REMOVE')}
                                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all ${manageMode === 'BULK_REMOVE' ? 'text-red-600 border-b-2 border-red-600 bg-red-50/30' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        Bulk Remove
                                    </button>
                                    <button
                                        onClick={() => setManageMode('STATUS')}
                                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all ${manageMode === 'STATUS' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        Status
                                    </button>
                                </div>

                                {manageMode === 'STATUS' && scopeStats && (
                                    <div className="p-4 bg-white border-b border-gray-100 flex gap-4 overflow-x-auto">
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 min-w-[120px]">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total</p>
                                            <p className="text-xl font-black text-gray-800">{scopeStats.counts.total}</p>
                                        </div>
                                        <div className="bg-green-50 p-3 rounded-xl border border-green-100 min-w-[120px]">
                                            <p className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">Selected</p>
                                            <p className="text-xl font-black text-green-700">{scopeStats.counts.selected}</p>
                                        </div>
                                        <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 min-w-[120px]">
                                            <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Pending</p>
                                            <p className="text-xl font-black text-orange-700">{scopeStats.counts.pending}</p>
                                        </div>
                                    </div>
                                )}

                                {manageMode === 'SELECT' ? (
                                    <>
                                        <div className="p-3 border-b border-gray-100 bg-white space-y-2">
                                            <div className="flex justify-between items-center">
                                                <h4 className="font-bold text-gray-700 text-sm">Available Students</h4>
                                                {selectedStudentIds.size > 0 && (
                                                    <button
                                                        onClick={handleBulkAddStudents}
                                                        className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition"
                                                    >
                                                        Add Selected ({selectedStudentIds.size})
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <select
                                                    value={manageYearFilter}
                                                    onChange={e => setManageYearFilter(e.target.value)}
                                                    className="text-xs p-1 border rounded bg-gray-50 focus:bg-white outline-none"
                                                >
                                                    <option value="ALL">All Years</option>
                                                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                                                </select>
                                                <select
                                                    value={manageDeptFilter}
                                                    onChange={e => setManageDeptFilter(e.target.value)}
                                                    className="text-xs p-1 border rounded bg-gray-50 focus:bg-white outline-none flex-1"
                                                >
                                                    <option value="ALL">All Depts</option>
                                                    {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    className="flex-1 text-sm p-2 border rounded-lg bg-gray-50 focus:bg-white outline-none focus:ring-2 ring-blue-100 transition"
                                                    placeholder="Search name or roll..."
                                                    value={studentSearch}
                                                    onChange={e => setStudentSearch(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 px-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedStudentIds.size === filteredAvailableStudents.length && filteredAvailableStudents.length > 0}
                                                    onChange={toggleSelectAll}
                                                    className="cursor-pointer"
                                                />
                                                <span className="text-xs text-gray-500 font-bold">Select All</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                            {manageLoading ? <div className="text-center p-4 text-gray-400">Loading...</div> :
                                                filteredAvailableStudents.map(student => (
                                                    <div key={student.id} className="flex justify-between items-center p-2 hover:bg-white hover:shadow-sm rounded-lg group transition cursor-pointer" onClick={() => toggleSelection(student.id)}>
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedStudentIds.has(student.id)}
                                                                onChange={() => toggleSelection(student.id)}
                                                                onClick={e => e.stopPropagation()}
                                                                className="cursor-pointer"
                                                            />
                                                            <div className="truncate">
                                                                <p className="text-sm font-bold text-gray-800 truncate">{student.name}</p>
                                                                <p className="text-xs text-gray-400 font-mono">{student.rollNumber || student.email} • {student.department} • Y{student.year}</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleAddStudent(student.id); }}
                                                            className="px-2 py-1 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition ml-2 shrink-0"
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                ))
                                            }
                                            {filteredAvailableStudents.length === 0 && (
                                                <div className="text-center p-8 text-gray-400 text-xs italic">
                                                    No matching students found per filters.
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : manageMode === 'STATUS' ? (
                                    <div className="flex-1 flex flex-col min-h-0 bg-white">
                                        <div className="p-4 border-b border-gray-100 flex flex-col gap-4 sticky top-0 bg-white z-10">
                                            <div className="flex justify-between items-center">
                                                <h4 className="font-bold text-gray-700 text-sm">Detailed Status List</h4>
                                                <div className="flex gap-2">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                                        <span className="w-2 h-2 rounded-full bg-green-500"></span> Selected
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                                        <span className="w-2 h-2 rounded-full bg-orange-500"></span> Pending
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                <input
                                                    type="text"
                                                    placeholder="Filter selected or pending students..."
                                                    className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:ring-2 ring-indigo-500 outline-none transition-all shadow-sm"
                                                    value={studentSearch}
                                                    onChange={(e) => setStudentSearch(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                            {/* Selected List */}
                                            {(() => {
                                                const filtered = scopeStats?.selected.filter(s =>
                                                    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                                                    (s.rollNumber && s.rollNumber.toLowerCase().includes(studentSearch.toLowerCase()))
                                                ) || [];
                                                return (
                                                    <div>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <h5 className="text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center gap-2">
                                                                Selected Students <span>{filtered.length}</span>
                                                            </h5>
                                                            {filtered.length > 0 && (
                                                                <button
                                                                    onClick={() => handleCopyAll(filtered, 'selected')}
                                                                    className={`text-[10px] font-bold px-2 py-1 rounded transition-all flex items-center gap-1.5 ${allCopiedType === 'selected' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                                                >
                                                                    {allCopiedType === 'selected' ? <Check size={10} /> : <Copy size={10} />}
                                                                    {allCopiedType === 'selected' ? 'Roll Numbers Copied!' : 'Copy All Roll Nos'}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="space-y-1">
                                                            {filtered.map(s => (
                                                                <div key={s.id} className="p-2 bg-green-50/50 border border-green-100 rounded-lg flex justify-between items-center group">
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-bold text-gray-800 truncate">{s.name}</p>
                                                                        <div className="flex items-center gap-2">
                                                                            <p className="text-[10px] text-gray-500 font-mono truncate">{s.rollNumber || s.email} • {s.department}</p>
                                                                            {(s.rollNumber || s.email) && (
                                                                                <button
                                                                                    onClick={() => handleCopyIndividual(s.rollNumber || s.email, s.id)}
                                                                                    className={`p-1 rounded hover:bg-green-100 transition-colors ${copiedId === s.id ? 'text-green-600' : 'text-gray-400 group-hover:opacity-100 opacity-0'}`}
                                                                                    title="Copy Roll Number"
                                                                                >
                                                                                    {copiedId === s.id ? <Check size={10} /> : <Copy size={10} />}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <CheckCircle2 size={14} className="text-green-500 shrink-0 ml-2" />
                                                                </div>
                                                            ))}
                                                            {filtered.length === 0 && <p className="text-[10px] text-gray-400 italic p-2">None found.</p>}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Pending List */}
                                            {(() => {
                                                const filtered = scopeStats?.pending.filter(s =>
                                                    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                                                    (s.rollNumber && s.rollNumber.toLowerCase().includes(studentSearch.toLowerCase()))
                                                ) || [];
                                                return (
                                                    <div>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <h5 className="text-[10px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-2">
                                                                Pending Students <span>{filtered.length}</span>
                                                            </h5>
                                                            {filtered.length > 0 && (
                                                                <button
                                                                    onClick={() => handleCopyAll(filtered, 'pending')}
                                                                    className={`text-[10px] font-bold px-2 py-1 rounded transition-all flex items-center gap-1.5 ${allCopiedType === 'pending' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                                                                >
                                                                    {allCopiedType === 'pending' ? <Check size={10} /> : <Copy size={10} />}
                                                                    {allCopiedType === 'pending' ? 'Roll Numbers Copied!' : 'Copy All Roll Nos'}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="space-y-1">
                                                            {filtered.map(s => (
                                                                <div key={s.id} className="p-2 bg-orange-50/50 border border-orange-100 rounded-lg flex justify-between items-center group">
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-bold text-gray-800 truncate">{s.name}</p>
                                                                        <div className="flex items-center gap-2">
                                                                            <p className="text-[10px] text-gray-500 font-mono truncate">{s.rollNumber || s.email} • {s.department}</p>
                                                                            {(s.rollNumber || s.email) && (
                                                                                <button
                                                                                    onClick={() => handleCopyIndividual(s.rollNumber || s.email, s.id)}
                                                                                    className={`p-1 rounded hover:bg-orange-100 transition-colors ${copiedId === s.id ? 'text-orange-600' : 'text-gray-400 group-hover:opacity-100 opacity-0'}`}
                                                                                    title="Copy Roll Number"
                                                                                >
                                                                                    {copiedId === s.id ? <Check size={10} /> : <Copy size={10} />}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="w-3.5 h-3.5 rounded-full border border-orange-200 shrink-0 ml-2"></div>
                                                                </div>
                                                            ))}
                                                            {filtered.length === 0 && <p className="text-[10px] text-gray-400 italic p-2">None found.</p>}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-6 flex flex-col h-full bg-white">
                                        <label className={`text-xs font-bold uppercase tracking-widest mb-2 ${manageMode === 'BULK_REMOVE' ? 'text-red-500' : 'text-gray-500'}`}>
                                            {manageMode === 'BULK_REMOVE' ? 'Paste Roll Numbers or Emails to Remove' : 'Paste Roll Numbers or Emails to Add'}
                                        </label>
                                        <p className="text-[10px] text-gray-400 mb-4">You can paste a list separated by commas, spaces, or newlines.</p>
                                        <textarea
                                            className={`flex-1 p-4 border rounded-2xl bg-gray-50 focus:bg-white outline-none focus:ring-2 transition text-sm font-mono ${manageMode === 'BULK_REMOVE' ? 'focus:ring-red-100 border-red-50' : 'focus:ring-blue-100'}`}
                                            placeholder="e.g. 21CS001, student@example.com, 21IT055..."
                                            value={bulkStudentIdentifiers}
                                            onChange={e => setBulkStudentIdentifiers(e.target.value)}
                                        />
                                        {manageMode === 'BULK' ? (
                                            <button
                                                onClick={handleBulkIdentifierAdd}
                                                disabled={isBulkProcessingStudents || !bulkStudentIdentifiers.trim()}
                                                className="mt-4 w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:opacity-50"
                                            >
                                                {isBulkProcessingStudents ? "Adding Students..." : "Add Students (Bulk)"}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleBulkIdentifierRemove}
                                                disabled={isBulkProcessingStudents || !bulkStudentIdentifiers.trim()}
                                                className="mt-4 w-full py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition shadow-lg shadow-red-100 disabled:opacity-50"
                                            >
                                                {isBulkProcessingStudents ? "Removing Students..." : "Remove Students (Bulk)"}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Right: Assigned Students */}
                            <div className="flex-1 flex flex-col bg-blue-50/30 rounded-xl border border-blue-100 overflow-hidden">
                                <div className="p-3 border-b border-blue-100 bg-white">
                                    <h4 className="font-bold text-blue-800 text-sm">Assigned Students ({scopeStudents.length})</h4>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {manageLoading ? <div className="text-center p-4 text-gray-400">Loading...</div> :
                                        scopeStudents.map(student => (
                                            <div key={student.id} className="flex justify-between items-center p-2 bg-white border border-blue-100/50 shadow-sm rounded-lg group transition">
                                                <div className="truncate">
                                                    <p className="text-sm font-bold text-gray-800 truncate">{student.name}</p>
                                                    <p className="text-xs text-gray-400 font-mono">{student.rollNumber || student.email}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveStudent(student.id)}
                                                    className="px-2 py-1 bg-red-50 text-red-500 text-xs font-bold rounded hover:bg-red-100 transition"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))
                                    }
                                    {scopeStudents.length === 0 && (
                                        <div className="text-center p-8 text-gray-400 text-xs italic">
                                            No students assigned yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <BulkImportModal
                isOpen={showBulkImportModal}
                onClose={() => setShowBulkImportModal(false)}
                type="PROJECT"
                onImport={handleBulkCreateProjects}
            />

            {showAddProjectModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-xl font-bold text-gray-800 mb-6">Add Project to Batch</h3>
                        <p className="text-sm text-gray-500 mb-4 -mt-4">Adding to: <span className="font-bold text-blue-600">{targetScope?.name}</span></p>
                        <form onSubmit={handleCreateProject} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Project Title</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Smart Attendance System"
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                    value={newProject.title}
                                    onChange={e => setNewProject({ ...newProject, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Category / Domain</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Web Development"
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                    value={newProject.category}
                                    onChange={e => setNewProject({ ...newProject, category: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Max Team Size</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    required
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                    value={newProject.maxTeamSize}
                                    onChange={e => setNewProject({ ...newProject, maxTeamSize: parseInt(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                                <textarea
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                    rows="3"
                                    value={newProject.description}
                                    onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Tech Stack</label>
                                <input
                                    type="text"
                                    placeholder="e.g. React, Node.js, MongoDB"
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                    value={newProject.techStack || ''}
                                    onChange={e => setNewProject({ ...newProject, techStack: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">SRS / Document Link</label>
                                <input
                                    type="text"
                                    placeholder="https://example.com/srs"
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                    value={newProject.srs || ''}
                                    onChange={e => setNewProject({ ...newProject, srs: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddProjectModal(false)}
                                    className="flex-1 px-4 py-2 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                                >
                                    Create Project
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
