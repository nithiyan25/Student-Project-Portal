import React, { useState, useEffect } from 'react';
import api from '../../api';
import { Plus, Trash2, Edit2, CheckCircle, AlertCircle, LayoutList, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

export default function RubricsTab() {
    const [rubrics, setRubrics] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState('');
    const [filterPhase, setFilterPhase] = useState('');

    const { addToast } = useToast();
    const { confirm } = useConfirm();

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingRubric, setEditingRubric] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        phase: 1,
        criteria: [{ name: '', maxMarks: 0, description: '' }]
    });

    useEffect(() => {
        fetchRubrics();
        fetchCategories();
    }, [filterCategory, filterPhase]);

    const fetchRubrics = async () => {
        try {
            const params = {};
            if (filterCategory) params.category = filterCategory;
            if (filterPhase) params.phase = filterPhase;
            const res = await api.get('/rubrics', { params });
            setRubrics(res.data);
        } catch (error) {
            console.error("Failed to fetch rubrics", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get('/rubrics/categories');
            setCategories(res.data);
        } catch (error) {
            console.error("Failed to fetch categories", error);
        }
    };

    const handleOpenModal = (rubric = null) => {
        setShowImportPanel(false);
        setImportText('');
        if (rubric) {
            setEditingRubric(rubric);
            setFormData({
                name: rubric.name,
                category: rubric.category,
                phase: rubric.phase,
                criteria: JSON.parse(rubric.criteria)
            });
        } else {
            setEditingRubric(null);
            setFormData({
                name: '',
                category: categories[0] || '',
                phase: 1,
                criteria: [{ name: '', maxMarks: 0, description: '' }]
            });
        }
        setShowModal(true);
    };

    const handleCriterionChange = (index, field, value) => {
        const newCriteria = [...formData.criteria];
        newCriteria[index][field] = field === 'maxMarks' ? parseInt(value) || 0 : value;
        setFormData({ ...formData, criteria: newCriteria });
    };

    const addCriterion = () => {
        setFormData({
            ...formData,
            criteria: [...formData.criteria, { name: '', maxMarks: 0, description: '' }]
        });
    };

    const removeCriterion = (index) => {
        const newCriteria = formData.criteria.filter((_, i) => i !== index);
        setFormData({ ...formData, criteria: newCriteria });
    };

    const calculateTotal = () => {
        return formData.criteria.reduce((sum, c) => sum + (c.maxMarks || 0), 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const total = calculateTotal();
        const formDataWithTotal = { ...formData, totalMarks: total };

        try {
            if (editingRubric) {
                await api.put(`/rubrics/${editingRubric.id}`, formDataWithTotal);
                addToast('Rubric updated successfully', 'success');
            } else {
                await api.post('/rubrics', formDataWithTotal);
                addToast('Rubric created successfully', 'success');
            }
            setShowModal(false);
            fetchRubrics();
        } catch (error) {
            addToast(error.response?.data?.error || "Failed to save rubric", 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!await confirm('Are you sure you want to delete this rubric?', 'Delete Rubric', 'danger')) return;
        try {
            await api.delete(`/rubrics/${id}`);
            addToast('Rubric deleted successfully', 'success');
            fetchRubrics();
        } catch (error) {
            addToast(error.response?.data?.error || "Failed to delete rubric", 'error');
        }
    };

    const totalMarks = calculateTotal();

    // Bulk Import Logic
    const [showImportPanel, setShowImportPanel] = useState(false);
    const [importText, setImportText] = useState('');

    const handleBulkImport = () => {
        if (!importText.trim()) return;

        const lines = importText.split('\n').filter(l => l.trim());
        const newCriteria = lines.map(line => {
            // CSV parsing: Name, Marks, Description
            // Handle cases where description might have commas? Simple split for now.
            const parts = line.split(',').map(p => p.trim());
            const name = parts[0];
            const maxMarks = parseInt(parts[1]) || 0;
            const description = parts.slice(2).join(', ') || ''; // Join remaining parts as description

            return { name, maxMarks, description };
        });

        setFormData({
            ...formData,
            criteria: [...formData.criteria, ...newCriteria.filter(c => c.name)]
        });
        setImportText('');
        setShowImportPanel(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <LayoutList className="text-blue-600" size={24} /> Evaluation Rubrics
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Define grading criteria for project categories and phases</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <select
                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 ring-blue-100"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 ring-blue-100"
                        value={filterPhase}
                        onChange={(e) => setFilterPhase(e.target.value)}
                    >
                        <option value="">All Phases</option>
                        {[1, 2, 3, 4, 5, 6].map(p => <option key={p} value={p}>Phase {p}</option>)}
                    </select>
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-100"
                    >
                        <Plus size={18} /> Create Rubric
                    </button>
                </div>
            </div>

            {/* Rubrics List */}
            <div className="grid grid-cols-1 gap-4">
                {rubrics.map(rubric => {
                    const criteria = JSON.parse(rubric.criteria);
                    return (
                        <div key={rubric.id} className="bg-white p-5 rounded-2xl border border-gray-200 hover:shadow-md transition">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                        <LayoutList size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-lg">{rubric.name}</h3>
                                        <div className="flex gap-2 text-xs font-medium mt-1">
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded">{rubric.category}</span>
                                            <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded">Phase {rubric.phase}</span>
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{criteria.length} Criteria</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleOpenModal(rubric)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                                        <Edit2 size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(rubric.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Criteria Preview */}
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <div className="space-y-2">
                                    {criteria.map((c, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-sm">
                                            <span className="text-gray-700 font-medium">{c.name}</span>
                                            <span className="text-gray-500 font-mono text-xs">{c.maxMarks} marks</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between items-center font-bold text-sm">
                                    <span>Total Marks</span>
                                    <span>{rubric.totalMarks}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {!loading && rubrics.length === 0 && (
                    <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <LayoutList size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No rubrics defined yet.</p>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-800">
                                {editingRubric ? 'Edit Rubric' : 'Create New Rubric'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Rubric Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 ring-blue-100"
                                        placeholder="e.g. Web Dev Phase 1 Evaluation"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Total Marks</label>
                                    <div className="w-full px-3 py-2 border rounded-lg font-mono font-bold flex justify-between bg-blue-50 text-blue-700 border-blue-200">
                                        <span>Current Total:</span>
                                        <span>{totalMarks}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Project Category</label>
                                    {categories.length > 0 ? (
                                        <select
                                            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 ring-blue-100"
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        >
                                            <option value="">Select Category</option>
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 ring-blue-100"
                                            placeholder="Enter Category (e.g. Web Development)"
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Review Phase</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 ring-blue-100"
                                        value={formData.phase}
                                        onChange={e => setFormData({ ...formData, phase: parseInt(e.target.value) })}
                                    >
                                        {[1, 2, 3, 4, 5, 6].map(p => <option key={p} value={p}>Phase {p}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-gray-700">Evaluation Criteria</label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowImportPanel(!showImportPanel)}
                                            className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 transition flex items-center gap-1"
                                        >
                                            {showImportPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Bulk Import
                                        </button>
                                        <button
                                            type="button"
                                            onClick={addCriterion}
                                            className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition"
                                        >
                                            + Add Criterion
                                        </button>
                                    </div>
                                </div>

                                {showImportPanel && (
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4 animate-in slide-in-from-top-2">
                                        <label className="block text-xs font-bold text-blue-800 mb-2">
                                            Paste Criteria (Format: Name, Marks, Description)
                                        </label>
                                        <textarea
                                            className="w-full h-32 p-3 text-sm border border-blue-200 rounded-lg focus:ring-2 ring-blue-200 outline-none font-mono"
                                            placeholder="Code Quality, 10, Alignment and comments&#10;Presentation, 15, Slides and communication"
                                            value={importText}
                                            onChange={e => setImportText(e.target.value)}
                                        />
                                        <div className="flex justify-end mt-2">
                                            <button
                                                type="button"
                                                onClick={handleBulkImport}
                                                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition"
                                            >
                                                Parse & Add
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {formData.criteria.map((criterion, idx) => (
                                        <div key={idx} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-gray-50 p-3 rounded-lg border border-gray-100 group">
                                            <div className="flex-1 w-full">
                                                <input
                                                    placeholder="Criterion Name (e.g. Code Quality)"
                                                    className="w-full px-2 py-1 text-sm border rounded mb-1 outline-none focus:border-blue-400"
                                                    value={criterion.name}
                                                    onChange={e => handleCriterionChange(idx, 'name', e.target.value)}
                                                />
                                                <input
                                                    placeholder="Description (Optional)"
                                                    className="w-full px-2 py-1 text-xs border rounded text-gray-600 bg-white outline-none focus:border-blue-400"
                                                    value={criterion.description}
                                                    onChange={e => handleCriterionChange(idx, 'description', e.target.value)}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 w-full md:w-auto">
                                                <input
                                                    type="number"
                                                    placeholder="Marks"
                                                    className="w-20 px-2 py-1 text-sm border rounded outline-none focus:border-blue-400"
                                                    value={criterion.maxMarks}
                                                    onChange={e => handleCriterionChange(idx, 'maxMarks', e.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeCriterion(idx)}
                                                    className="p-1 text-gray-400 hover:text-red-500 transition"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="px-6 py-2 text-white font-bold rounded-lg shadow-lg transition flex items-center gap-2 bg-blue-600 hover:bg-blue-700 shadow-blue-200"
                            >
                                {editingRubric ? 'Update Rubric' : 'Create Rubric'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
