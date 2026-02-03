import React from 'react';
import { FolderPlus, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Edit2, X, Save, ExternalLink, Users, Code, Info } from 'lucide-react';
import SearchInput from '../ui/SearchInput';

const EditProjectModal = ({ project, isOpen, onClose, onSave, scopes }) => {
    const [formData, setFormData] = React.useState({
        title: project?.title || '',
        category: project?.category || '',
        maxTeamSize: project?.maxTeamSize || 3,
        description: project?.description || '',
        status: project?.status || 'AVAILABLE',
        scopeId: project?.scopeId || '',
        techStack: project?.techStack || '',
        srs: project?.srs || ''
    });

    React.useEffect(() => {
        if (project) {
            setFormData({
                title: project.title,
                category: project.category,
                maxTeamSize: project.maxTeamSize,
                description: project.description || '',
                status: project.status,
                scopeId: project.scopeId || '',
                techStack: project.techStack || '',
                srs: project.srs || ''
            });
        }
    }, [project]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-6 border-b">
                    <h3 className="text-xl font-bold text-gray-800">Edit Project</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSave(project.id, formData); }} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Project Title</label>
                        <input
                            required
                            className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                            <input
                                required
                                className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Max Team Size</label>
                            <input
                                required
                                type="number"
                                className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                value={formData.maxTeamSize}
                                onChange={e => setFormData({ ...formData, maxTeamSize: parseInt(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Project Scope (Batch)</label>
                        <select
                            className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                            value={formData.scopeId}
                            onChange={e => setFormData({ ...formData, scopeId: e.target.value })}
                        >
                            <option value="">No Scope (General)</option>
                            {scopes?.map(scope => (
                                <option key={scope.id} value={scope.id}>{scope.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                        <select
                            className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                        >
                            <option value="AVAILABLE">Available</option>
                            <option value="REQUESTED">Requested</option>
                            <option value="ASSIGNED">Assigned</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tech Stack</label>
                        <input
                            className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                            placeholder="e.g. React, Node.js, MongoDB"
                            value={formData.techStack}
                            onChange={e => setFormData({ ...formData, techStack: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">SRS / Document Link</label>
                        <input
                            className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                            placeholder="Link to project documentation"
                            value={formData.srs}
                            onChange={e => setFormData({ ...formData, srs: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                        <textarea
                            className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                            rows={3}
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
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
                            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                        >
                            <Save size={18} /> Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ProjectDetailModal = ({ project, isOpen, onClose }) => {
    if (!isOpen || !project) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="relative bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 p-8 text-white">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white"
                    >
                        <X size={20} />
                    </button>
                    <div className="flex flex-col gap-2">
                        <span className="bg-white/20 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full w-fit">
                            Project Details
                        </span>
                        <h3 className="text-3xl font-extrabold leading-tight">{project.title}</h3>
                        <div className="flex flex-wrap gap-4 mt-2">
                            <span className="flex items-center gap-1.5 text-blue-50 bg-blue-500/30 px-3 py-1 rounded-full text-xs font-bold border border-white/10">
                                <Info size={14} /> {project.category}
                            </span>
                            <span className="flex items-center gap-1.5 text-blue-50 bg-blue-500/30 px-3 py-1 rounded-full text-xs font-bold border border-white/10">
                                <Users size={14} /> Max {project.maxTeamSize} Members
                            </span>
                            {project.scope && (
                                <span className="flex items-center gap-1.5 text-purple-100 bg-purple-500/30 px-3 py-1 rounded-full text-xs font-bold border border-white/10">
                                    Batch: {project.scope.name}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {/* Status Section */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wider text-[10px]">Current Status</span>
                        <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase border shadow-sm ${project.status === 'AVAILABLE'
                                ? 'bg-green-100 border-green-200 text-green-700'
                                : project.status === 'REQUESTED'
                                    ? 'bg-orange-100 border-orange-200 text-orange-700'
                                    : 'bg-red-100 border-red-200 text-red-700'
                            }`}>
                            {project.status}
                        </span>
                    </div>

                    {/* Description */}
                    <div>
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Info size={14} className="text-indigo-500" /> Description
                        </h4>
                        <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 leading-relaxed text-gray-700 whitespace-pre-wrap italic">
                            {project.description || "No description provided."}
                        </div>
                    </div>

                    {/* Tech Stack & SRS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Code size={14} className="text-blue-500" /> Tech Stack
                            </h4>
                            <div className="p-4 bg-blue-50/30 border border-blue-100 rounded-2xl min-h-[60px] flex items-center">
                                <p className="text-sm font-bold text-blue-800">{project.techStack || 'Not specified'}</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <ExternalLink size={14} className="text-purple-500" /> Documentation
                            </h4>
                            <div className="p-4 bg-purple-50/30 border border-purple-100 rounded-2xl min-h-[60px] flex items-center">
                                {project.srs ? (
                                    <a
                                        href={project.srs}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm font-bold text-purple-700 hover:underline flex items-center gap-2"
                                    >
                                        View SRS Document <ExternalLink size={14} />
                                    </a>
                                ) : (
                                    <p className="text-sm font-bold text-gray-400">No link provided</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Assigned Teams */}
                    <div>
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Users size={14} className="text-indigo-500" /> Assigned Teams
                        </h4>
                        {project.teams && project.teams.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3">
                                {project.teams.map((team) => (
                                    <div key={team.id} className="p-4 bg-indigo-50/30 border border-indigo-100 rounded-2xl">
                                        <div className="flex flex-wrap gap-2">
                                            {team.members?.map((m) => (
                                                <div key={m.id} className="flex flex-col bg-white border border-indigo-100 px-3 py-1.5 rounded-xl shadow-sm">
                                                    <span className="text-xs font-bold text-indigo-900">{m.user.name}</span>
                                                    <span className="text-[10px] font-mono text-indigo-400">{m.user.rollNumber}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm font-medium">
                                No teams assigned yet
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 border-t flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg active:scale-95"
                    >
                        Close Details
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function ProjectsTab({
    filteredProjects,
    deleteProject,
    projectSearch,
    setProjectSearch,
    projectFilter,
    setProjectFilter,
    selectedIds,
    setSelectedIds,
    bulkDelete,
    pagination,
    setPagination,
    sortConfig,
    onSort,
    updateProject,
    scopes,
    scopeFilter,
    setScopeFilter
}) {
    const [editingProject, setEditingProject] = React.useState(null);
    const [detailProject, setDetailProject] = React.useState(null);

    const handleSave = async (id, data) => {
        await updateProject(id, data);
        setEditingProject(null);
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
            const allIds = filteredProjects.map(p => p.id);
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
        <div className="w-full">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold">Projects ({pagination.total})</h2>
                        {selectedIds.length > 0 && (
                            <button
                                onClick={() => bulkDelete(selectedIds)}
                                className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded text-sm font-bold animate-in fade-in slide-in-from-left-2 transition-all hover:bg-red-700 shadow-md"
                            >
                                <Trash2 size={14} /> Delete Selected ({selectedIds.length})
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <select
                            className="border p-2 rounded text-sm bg-white outline-none focus:ring-2 ring-blue-500"
                            value={projectFilter}
                            onChange={e => setProjectFilter(e.target.value)}
                        >
                            <option value="ALL">All Status</option>
                            <option value="AVAILABLE">Available</option>
                            <option value="REQUESTED">Requested</option>
                            <option value="ASSIGNED">Assigned</option>
                        </select>
                        <select
                            className="border p-2 rounded text-sm bg-white outline-none focus:ring-2 ring-blue-500 max-w-[150px]"
                            value={scopeFilter}
                            onChange={e => setScopeFilter(e.target.value)}
                        >
                            <option value="ALL">All Batches</option>
                            {scopes?.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <SearchInput
                            value={projectSearch}
                            onChange={setProjectSearch}
                            placeholder="Search projects..."
                            className="w-48"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="p-3 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                        checked={filteredProjects.length > 0 && selectedIds.length === filteredProjects.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="p-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('title')}>
                                    <div className="flex items-center">Title <SortIndicator field="title" /></div>
                                </th>
                                <th className="p-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('category')}>
                                    <div className="flex items-center">Category <SortIndicator field="category" /></div>
                                </th>
                                <th className="p-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('maxTeamSize')}>
                                    <div className="flex items-center">Size <SortIndicator field="maxTeamSize" /></div>
                                </th>
                                <th className="p-3">Scope</th>
                                <th className="p-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('status')}>
                                    <div className="flex items-center">Status <SortIndicator field="status" /></div>
                                </th>
                                <th className="p-3">Assigned To</th>
                                <th className="p-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredProjects.map(p => (
                                <tr key={p.id} className={`hover:bg-gray-50 text-sm transition-colors ${selectedIds.includes(p.id) ? 'bg-blue-50/50' : ''}`}>
                                    <td className="p-3">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                            checked={selectedIds.includes(p.id)}
                                            onChange={() => handleSelectOne(p.id)}
                                        />
                                    </td>
                                    <td className="p-3">
                                        <button
                                            onClick={() => setDetailProject(p)}
                                            className="font-bold text-blue-600 hover:text-blue-800 hover:underline transition-all text-left block w-full"
                                        >
                                            {p.title}
                                        </button>
                                    </td>
                                    <td className="p-3 text-gray-500">{p.category}</td>
                                    <td className="p-3 font-mono">{p.maxTeamSize}</td>
                                    <td className="p-3">
                                        {p.scope ? (
                                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold border border-purple-200 uppercase">
                                                {p.scope.name}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${p.status === 'AVAILABLE'
                                            ? 'bg-green-100 border-green-200 text-green-700'
                                            : p.status === 'REQUESTED'
                                                ? 'bg-orange-100 border-orange-200 text-orange-700'
                                                : 'bg-red-100 border-red-200 text-red-700'
                                            }`}>
                                            {p.status}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        {p.teams && p.teams.length > 0 ? (
                                            <div className="space-y-1">
                                                {p.teams.map((team, idx) => (
                                                    <div key={team.id} className="text-xs">
                                                        {team.members && team.members.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {team.members.map((member, mIdx) => (
                                                                    <span key={member.id} className="inline-flex items-center bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                                                                        {member.user.name}
                                                                        {member.user.rollNumber && (
                                                                            <span className="ml-1 font-mono text-[9px] opacity-70">({member.user.rollNumber})</span>
                                                                        )}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 italic">No members</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 text-xs italic">Unassigned</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => setEditingProject(p)}
                                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition"
                                                title="Edit project"
                                            >
                                                <Edit2 size={14} />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => deleteProject(p.id, p.title)}
                                                className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-200 text-xs font-semibold transition"
                                                title="Delete project"
                                            >
                                                <Trash2 size={14} />
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredProjects.length === 0 && (
                                <tr><td colSpan="7" className="p-8 text-center text-gray-400">No projects found.</td></tr>
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
                        <span className="px-3 py-1 bg-green-50 text-green-600 rounded text-sm font-bold border border-green-100">
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

            <EditProjectModal
                project={editingProject}
                isOpen={!!editingProject}
                onClose={() => setEditingProject(null)}
                onSave={handleSave}
                scopes={scopes}
            />

            <ProjectDetailModal
                project={detailProject}
                isOpen={!!detailProject}
                onClose={() => setDetailProject(null)}
            />
        </div>
    );
}

