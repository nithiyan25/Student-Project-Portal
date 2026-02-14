import React, { useState, useEffect } from 'react';
import api from '../../api';
import { Plus, Folder, Calendar, ToggleLeft, ToggleRight, Loader, Trash2, Upload, Search, CheckCircle2, Copy, Check, Mail, Play, Pause, RotateCcw, Clock } from 'lucide-react';
import BulkImportModal from '../ui/BulkImportModal';
import PhaseDeadlinesModal from './PhaseDeadlinesModal';

import { getCollegeSecondsBetween, isCollegeWorkingHour } from '../../utils/timerUtils';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

function LiveTimer({ scope }) {
    const [displayTime, setDisplayTime] = React.useState('');

    React.useEffect(() => {
        // Calculate clock offset between server and client
        const serverNow = scope.serverTime ? new Date(scope.serverTime) : new Date();
        const clientNowAtReceive = new Date();
        const clockOffset = serverNow - clientNowAtReceive;

        const calculateRemaining = () => {
            const now = new Date(Date.now() + clockOffset);
            const working = isCollegeWorkingHour(now);

            let remainingSeconds = scope.currentRemainingSeconds || 0;

            if (scope.isTimerRunning && scope.timerLastUpdated && working) {
                const lastUpdate = new Date(scope.timerLastUpdated);
                const elapsedSinceUpdate = getCollegeSecondsBetween(lastUpdate, now);
                remainingSeconds = Math.max(0, (scope.currentRemainingSeconds || 0) - elapsedSinceUpdate);
            }

            const h = Math.floor(remainingSeconds / 3600);
            const m = Math.floor((remainingSeconds % 3600) / 60);
            const s = Math.floor(remainingSeconds % 60);
            setDisplayTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };

        calculateRemaining();
        const interval = setInterval(calculateRemaining, 1000);
        return () => clearInterval(interval);
    }, [scope]);

    return <span>{displayTime}</span>;
}

export default function ProjectScopesTab() {
    const [scopes, setScopes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newScope, setNewScope] = useState({ name: '', description: '', type: 'MAIN', numberOfPhases: 4, requireGuide: false, requireSubjectExpert: false, resultsPublished: false });

    const [showDeadlinesModal, setShowDeadlinesModal] = useState(false);
    const [deadlineTargetScope, setDeadlineTargetScope] = useState(null);



    const { addToast } = useToast();
    const { confirm } = useConfirm();

    useEffect(() => {
        fetchScopes();
        const interval = setInterval(fetchScopes, 60000); // Sync every 60 seconds
        return () => clearInterval(interval);
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
            setNewScope({ name: '', description: '', type: 'MAIN', numberOfPhases: 4, requireGuide: false, requireSubjectExpert: false, resultsPublished: false });
            addToast('Scope created successfully', 'success');
            fetchScopes();
        } catch (error) {
            addToast('Failed to create scope: ' + (error.response?.data?.error || error.message), 'error');
        }
    };

    const handleDeleteScope = async (id, name) => {
        if (!await confirm(`Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`, 'Delete Scope', 'danger')) {
            return;
        }
        try {
            await api.delete(`/scopes/${id}`);
            addToast('Scope deleted successfully', 'success');
            fetchScopes();
        } catch (error) {
            addToast('Failed to delete scope: ' + (error.response?.data?.error || error.message), 'error');
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

    const handleTimerAction = async (id, action, hours) => {
        try {
            const data = { timerAction: action };
            if (hours !== undefined) data.timerTotalHours = parseFloat(hours);
            await api.patch(`/scopes/${id}`, data);
            fetchScopes();
        } catch (error) {
            addToast(error.response?.data?.error || "Timer action failed", 'error');
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
            addToast('Project created successfully in ' + targetScope.name, 'success');
            fetchScopes(); // Refresh to update counts
        } catch (error) {
            addToast('Failed to create project: ' + (error.response?.data?.error || error.message), 'error');
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
            addToast(`Successfully added ${res.data.count} projects to ${bulkTargetScope.name}`, 'success');
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

    const handleCopyAll = async (students, type, format = 'roll') => {
        try {
            const data = students
                .map(s => format === 'email' ? s.email : (s.rollNumber || s.email))
                .filter(Boolean)
                .join(format === 'email' ? ', ' : '\n');
            await navigator.clipboard.writeText(data);
            setAllCopiedType(`${type}-${format}`);
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
            addToast("Failed to load data", 'error');
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
            addToast(`Added ${ids.length} students to scope`, 'success');
        } catch (error) {
            addToast('Failed to add students: ' + (error.response?.data?.error || error.message), 'error');
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
                msg += ` Not found (${res.data.notFound.length}): ${res.data.notFound.join(', ')}`;
            }
            addToast(msg, res.data.notFound && res.data.notFound.length > 0 ? 'warning' : 'success');

            setBulkStudentIdentifiers('');
            openManageStudents(managingScope);
        } catch (error) {
            addToast('Bulk add failed: ' + (error.response?.data?.error || error.message), 'error');
        } finally {
            setIsBulkProcessingStudents(false);
        }
    };

    const handleBulkIdentifierRemove = async () => {
        if (!bulkStudentIdentifiers.trim()) return;

        if (!await confirm("Are you sure you want to remove these students from this batch?", 'Confirm Bulk Remove', 'danger')) return;

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
                msg += ` Not found/Not in batch (${res.data.notFound.length}): ${res.data.notFound.join(', ')}`;
            }
            addToast(msg, res.data.notFound && res.data.notFound.length > 0 ? 'warning' : 'success');

            setBulkStudentIdentifiers('');
            openManageStudents(managingScope);
        } catch (error) {
            addToast('Bulk removal failed: ' + (error.response?.data?.error || error.message), 'error');
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {scopes.map(scope => (
                    <div key={scope.id} className={`bg-white rounded-2xl border transition-all hover:shadow-md ${scope.isActive ? 'border-gray-100' : 'border-gray-200 bg-gray-50 opacity-75'}`}>
                        {/* Card Header */}
                        <div className="p-6 pb-0">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                    <Folder size={24} />
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => openBulkAddProject(scope)} className="text-gray-400 hover:text-blue-600 transition p-1.5 rounded-lg hover:bg-blue-50" title="Bulk Add Projects">
                                        <Upload size={18} />
                                    </button>
                                    <button onClick={() => handleDeleteScope(scope.id, scope.name)} className="text-gray-400 hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50" title="Delete Scope">
                                        <Trash2 size={18} />
                                    </button>
                                    <button onClick={() => toggleScope(scope.id)} className="text-gray-400 hover:text-blue-600 transition p-1.5 rounded-lg hover:bg-blue-50" title="Toggle Active Status">
                                        {scope.isActive ? <ToggleRight size={28} className="text-green-500" /> : <ToggleLeft size={28} />}
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-gray-800 mb-1">{scope.name}</h3>
                            <p className="text-sm text-gray-500 line-clamp-2 min-h-[2.5rem] mb-4">{scope.description || "No description provided."}</p>

                            <div className="flex items-center gap-4 text-xs font-medium text-gray-400 border-t border-gray-100 pt-4 mb-4">
                                <span className="flex items-center gap-1">
                                    <Calendar size={14} /> Created {new Date(scope.createdAt).toLocaleDateString()}
                                </span>
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-500 uppercase">{scope.type}</span>
                            </div>

                            {/* Stats Row */}
                            <div className="flex items-center gap-2 mb-3">
                                <div className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-100">
                                    {scope._count?.projects || 0} Projects
                                </div>
                                <div className="px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-lg border border-green-100">
                                    {scope._count?.students || 0} Students
                                </div>
                                {scope.completedTeamsCount > 0 && (
                                    <div className={`px-2 py-1 text-[10px] font-bold rounded-lg border animate-pulse ${scope.resultsPublished ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                        {scope.completedTeamsCount} Reviews Done
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons Row */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                <button
                                    onClick={() => openAddProject(scope)}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
                                >
                                    <Plus size={14} /> Add Project
                                </button>
                                <button
                                    onClick={() => openManageStudents(scope)}
                                    className="text-xs font-bold text-gray-600 hover:text-blue-600 flex items-center gap-1 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition"
                                >
                                    Manage Students
                                </button>
                                <button
                                    onClick={() => {
                                        setDeadlineTargetScope(scope);
                                        setShowDeadlinesModal(true);
                                    }}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
                                >
                                    <Calendar size={14} /> Deadlines
                                </button>

                            </div>
                        </div>

                        {/* Settings Toggles */}
                        <div className="px-6 pt-4 border-t border-gray-100 space-y-2">
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
                            <div className="flex justify-between items-center text-xs mt-2 border-t border-gray-50 pt-2">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-600 font-bold">Results Published</span>
                                    {scope.completedTeamsCount > 0 && !scope.resultsPublished && (
                                        <span className="text-[9px] text-orange-600 font-black uppercase tracking-tighter">Unpublished Results Alert</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => toggleScopeSetting(scope.id, 'resultsPublished', scope.resultsPublished)}
                                    className="transition"
                                >
                                    {scope.resultsPublished ? <ToggleRight size={22} className="text-blue-600" /> : <ToggleLeft size={22} className="text-gray-300" />}
                                </button>
                            </div>
                            <div className="flex justify-between items-center text-xs mt-2 border-t border-gray-50 pt-2">
                                <span className="text-gray-600">Review Phases</span>
                                <select
                                    className="bg-gray-50 border border-gray-200 rounded px-1 py-0.5 outline-none text-gray-700 font-bold"
                                    value={scope.numberOfPhases || 4}
                                    onChange={(e) => updateScopeSetting(scope.id, 'numberOfPhases', parseInt(e.target.value))}
                                >
                                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Timer Configuration */}
                        <div className="mx-6 mt-4 mb-6 pt-4 px-4 pb-3 border-t-2 border-dashed border-gray-100 bg-slate-50/60 rounded-xl">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Clock size={16} className="text-blue-600" />
                                    <span className="text-xs font-black text-gray-700 uppercase tracking-wider">Batch Timer</span>
                                </div>
                                <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${scope.isTimerRunning ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-gray-200 text-gray-600'}`}>
                                    {scope.isTimerRunning ? 'Running' : 'Paused'}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Duration (Hours)</p>
                                        <input
                                            type="number"
                                            step="0.5"
                                            placeholder="e.g. 2"
                                            className="w-full text-xs font-bold p-1.5 border rounded-lg bg-white outline-none focus:border-blue-500"
                                            defaultValue={scope.timerTotalHours || ''}
                                            onBlur={(e) => {
                                                if (e.target.value && parseFloat(e.target.value) !== scope.timerTotalHours) {
                                                    updateScopeSetting(scope.id, 'timerTotalHours', e.target.value);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Remaining</p>
                                        <div className="text-sm font-black text-gray-800 font-mono bg-white border rounded-lg p-1.5 text-center">
                                            <LiveTimer scope={scope} />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    {!scope.isTimerRunning ? (
                                        <button
                                            onClick={() => handleTimerAction(scope.id, 'START')}
                                            className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-blue-700 transition shadow-sm"
                                        >
                                            <Play size={10} fill="currentColor" /> Resume
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleTimerAction(scope.id, 'PAUSE')}
                                            className="flex-1 py-1.5 bg-orange-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-orange-600 transition shadow-sm"
                                        >
                                            <Pause size={10} fill="currentColor" /> Pause
                                        </button>
                                    )}
                                    <button
                                        onClick={async () => {
                                            if (await confirm("Reset timer to its total duration?", "Reset Timer")) {
                                                handleTimerAction(scope.id, 'RESET');
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-white border border-gray-200 text-gray-400 rounded-lg hover:text-red-500 hover:border-red-100 transition"
                                        title="Reset Timer"
                                    >
                                        <RotateCcw size={14} />
                                    </button>
                                </div>
                                <p className="text-[8px] text-gray-400 italic text-center">
                                    Timer runs only 08:45-16:20 (Mon-Sat).
                                </p>
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 overflow-y-auto">
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
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm font-bold text-gray-700">Publish Results Immediately</span>
                                <button
                                    type="button"
                                    onClick={() => setNewScope({ ...newScope, resultsPublished: !newScope.resultsPublished })}
                                >
                                    {newScope.resultsPublished ? <ToggleRight size={28} className="text-blue-600" /> : <ToggleLeft size={28} className="text-gray-300" />}
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 overflow-y-auto">
                    <div className={`bg-white rounded-2xl w-full ${manageMode === 'STATUS' ? 'max-w-6xl' : 'max-w-4xl'} h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 transition-all duration-300`}>
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
                                    <div className="p-4 bg-indigo-50/50 border-b border-gray-100 flex items-center justify-between gap-4 overflow-x-auto">
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Students</p>
                                                <p className="text-lg font-black text-gray-800">{scopeStats.counts.total}</p>
                                            </div>
                                            <div className="h-8 w-px bg-gray-200 mx-2"></div>
                                            <div className="flex flex-col">
                                                <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Selected</p>
                                                <p className="text-lg font-black text-green-700">{scopeStats.counts.selected}</p>
                                            </div>
                                            <div className="flex flex-col ml-4">
                                                <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Pending</p>
                                                <p className="text-lg font-black text-orange-700">{scopeStats.counts.pending}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
                                                <span className="w-2 h-2 rounded-full bg-green-500"></span> Selected
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
                                                <span className="w-2 h-2 rounded-full bg-orange-500"></span> Pending
                                            </div>
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
                                    <div className="flex-1 flex flex-col min-h-0">
                                        <div className="p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                <input
                                                    type="text"
                                                    placeholder="Search name or roll number across status lists..."
                                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:ring-2 ring-indigo-500 outline-none transition-all shadow-sm"
                                                    value={studentSearch}
                                                    onChange={(e) => setStudentSearch(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                                {/* Selected List */}
                                                {(() => {
                                                    const filtered = scopeStats?.selected.filter(s =>
                                                        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                                                        (s.rollNumber && s.rollNumber.toLowerCase().includes(studentSearch.toLowerCase()))
                                                    ) || [];
                                                    return (
                                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                                                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-50">
                                                                <h5 className="text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center gap-2">
                                                                    Selected Students <span className="bg-green-100 px-2 py-0.5 rounded-full">{filtered.length}</span>
                                                                </h5>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => handleCopyAll(filtered, 'selected', 'email')}
                                                                        className={`text-[10px] font-bold px-2 py-1 rounded transition-all flex items-center gap-1.5 ${allCopiedType === 'selected-email' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                                                        title="Copy all emails"
                                                                    >
                                                                        {allCopiedType === 'selected-email' ? <Check size={10} /> : <Mail size={10} />}
                                                                        {allCopiedType === 'selected-email' ? 'Emails Copied!' : 'Emails'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleCopyAll(filtered, 'selected', 'roll')}
                                                                        className={`text-[10px] font-bold px-2 py-1 rounded transition-all flex items-center gap-1.5 ${allCopiedType === 'selected-roll' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                                                        title="Copy all roll numbers"
                                                                    >
                                                                        {allCopiedType === 'selected-roll' ? <Check size={10} /> : <Copy size={10} />}
                                                                        {allCopiedType === 'selected-roll' ? 'Roll Nos Copied!' : 'Roll Nos'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {filtered.map(s => (
                                                                    <div key={s.id} className="p-2.5 bg-green-50/50 border border-green-100 rounded-lg flex justify-between items-center group hover:bg-white hover:border-green-300 transition-all">
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="text-xs font-bold text-gray-800 truncate">{s.name}</p>
                                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                                <p className="text-[10px] text-gray-500 font-mono truncate">{s.rollNumber || s.email} • {s.department}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                                                            {s.email && (
                                                                                <button
                                                                                    onClick={() => handleCopyIndividual(s.email, `${s.id}-email`)}
                                                                                    className={`p-1 rounded hover:bg-blue-100 transition-colors ${copiedId === `${s.id}-email` ? 'text-blue-600' : 'text-gray-400 group-hover:opacity-100 opacity-0'}`}
                                                                                    title="Copy Email"
                                                                                >
                                                                                    {copiedId === `${s.id}-email` ? <Check size={10} /> : <Mail size={10} />}
                                                                                </button>
                                                                            )}
                                                                            {s.rollNumber && (
                                                                                <button
                                                                                    onClick={() => handleCopyIndividual(s.rollNumber, s.id)}
                                                                                    className={`p-1 rounded hover:bg-green-100 transition-colors ${copiedId === s.id ? 'text-green-600' : 'text-gray-400 group-hover:opacity-100 opacity-0'}`}
                                                                                    title="Copy Roll Number"
                                                                                >
                                                                                    {copiedId === s.id ? <Check size={10} /> : <Copy size={10} />}
                                                                                </button>
                                                                            )}
                                                                            <CheckCircle2 size={12} className="text-green-500 ml-1" />
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {filtered.length === 0 && <p className="text-[10px] text-gray-400 italic p-2 text-center">No students match your search.</p>}
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
                                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                                                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-50">
                                                                <h5 className="text-[10px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-2">
                                                                    Pending Students <span className="bg-orange-100 px-2 py-0.5 rounded-full">{filtered.length}</span>
                                                                </h5>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => handleCopyAll(filtered, 'pending', 'email')}
                                                                        className={`text-[10px] font-bold px-2 py-1 rounded transition-all flex items-center gap-1.5 ${allCopiedType === 'pending-email' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                                                        title="Copy all emails"
                                                                    >
                                                                        {allCopiedType === 'pending-email' ? <Check size={10} /> : <Mail size={10} />}
                                                                        {allCopiedType === 'pending-email' ? 'Emails Copied!' : 'Emails'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleCopyAll(filtered, 'pending', 'roll')}
                                                                        className={`text-[10px] font-bold px-2 py-1 rounded transition-all flex items-center gap-1.5 ${allCopiedType === 'pending-roll' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                                                                        title="Copy all roll numbers"
                                                                    >
                                                                        {allCopiedType === 'pending-roll' ? <Check size={10} /> : <Copy size={10} />}
                                                                        {allCopiedType === 'pending-roll' ? 'Roll Nos Copied!' : 'Roll Nos'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {filtered.map(s => (
                                                                    <div key={s.id} className="p-2.5 bg-orange-50/50 border border-orange-100 rounded-lg flex justify-between items-center group hover:bg-white hover:border-orange-300 transition-all">
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="text-xs font-bold text-gray-800 truncate">{s.name}</p>
                                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                                <p className="text-[10px] text-gray-500 font-mono truncate">{s.rollNumber || s.email} • {s.department}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                                                            {s.email && (
                                                                                <button
                                                                                    onClick={() => handleCopyIndividual(s.email, `${s.id}-email`)}
                                                                                    className={`p-1 rounded hover:bg-blue-100 transition-colors ${copiedId === `${s.id}-email` ? 'text-blue-600' : 'text-gray-400 group-hover:opacity-100 opacity-0'}`}
                                                                                    title="Copy Email"
                                                                                >
                                                                                    {copiedId === `${s.id}-email` ? <Check size={10} /> : <Mail size={10} />}
                                                                                </button>
                                                                            )}
                                                                            {s.rollNumber && (
                                                                                <button
                                                                                    onClick={() => handleCopyIndividual(s.rollNumber, s.id)}
                                                                                    className={`p-1 rounded hover:bg-orange-100 transition-colors ${copiedId === s.id ? 'text-orange-600' : 'text-gray-400 group-hover:opacity-100 opacity-0'}`}
                                                                                    title="Copy Roll Number"
                                                                                >
                                                                                    {copiedId === s.id ? <Check size={10} /> : <Copy size={10} />}
                                                                                </button>
                                                                            )}
                                                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-orange-200 ml-1"></div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {filtered.length === 0 && <p className="text-[10px] text-gray-400 italic p-2 text-center">No students match your search.</p>}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
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
                            {manageMode !== 'STATUS' && (
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
                            )}
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 overflow-y-auto">
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
            {showDeadlinesModal && (
                <PhaseDeadlinesModal
                    isOpen={showDeadlinesModal}
                    onClose={() => setShowDeadlinesModal(false)}
                    scope={deadlineTargetScope}
                />
            )}


        </div>
    );
}
