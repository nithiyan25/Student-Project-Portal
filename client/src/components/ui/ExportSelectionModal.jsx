import React, { useState } from 'react';
import { X, Download, CheckSquare, Square } from 'lucide-react';

export default function ExportSelectionModal({ isOpen, onClose, onExport }) {
    const [selectedSheets, setSelectedSheets] = useState({
        students: true,
        faculty: true,
        admins: true,
        projects: true,
        teams: true,
        facultyAssignments: true,
        reviewHistory: true,
        studentScores: true
    });

    const sheets = [
        { key: 'students', label: 'Students', description: 'All student information' },
        { key: 'faculty', label: 'Faculty', description: 'All faculty members' },
        { key: 'admins', label: 'Admins', description: 'All administrators' },
        { key: 'projects', label: 'Projects', description: 'All projects and assignments' },
        { key: 'teams', label: 'Teams', description: 'All team information' },
        { key: 'facultyAssignments', label: 'Faculty Assignments', description: 'Faculty-project assignments' },
        { key: 'reviewHistory', label: 'Review History', description: 'All review records' },
        { key: 'studentScores', label: 'Student Scores', description: 'Individual student marks' }
    ];

    const handleToggle = (key) => {
        setSelectedSheets(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSelectAll = () => {
        const allSelected = {};
        sheets.forEach(sheet => { allSelected[sheet.key] = true; });
        setSelectedSheets(allSelected);
    };

    const handleDeselectAll = () => {
        const noneSelected = {};
        sheets.forEach(sheet => { noneSelected[sheet.key] = false; });
        setSelectedSheets(noneSelected);
    };

    const handleExport = () => {
        const selected = Object.keys(selectedSheets).filter(key => selectedSheets[key]);
        onExport(selected);
        onClose();
    };

    const selectedCount = Object.values(selectedSheets).filter(Boolean).length;
    const isAnySelected = selectedCount > 0;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold">Select Data to Export</h2>
                        <p className="text-sm opacity-90 mt-1">Choose which sheets to include in the Excel file</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {/* Quick Actions */}
                    <div className="flex gap-3 mb-6">
                        <button
                            onClick={handleSelectAll}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-semibold text-sm hover:bg-blue-100 transition-colors border border-blue-100"
                        >
                            <CheckSquare size={16} />
                            Select All
                        </button>
                        <button
                            onClick={handleDeselectAll}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-100 transition-colors border border-gray-100"
                        >
                            <Square size={16} />
                            Deselect All
                        </button>
                        <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-bold border border-green-100">
                            {selectedCount} of {sheets.length} selected
                        </div>
                    </div>

                    {/* Checkbox List */}
                    <div className="space-y-3">
                        {sheets.map(sheet => (
                            <label
                                key={sheet.key}
                                className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedSheets[sheet.key]
                                        ? 'bg-green-50 border-green-200 shadow-sm'
                                        : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedSheets[sheet.key]}
                                    onChange={() => handleToggle(sheet.key)}
                                    className="mt-1 w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-2 focus:ring-green-500 cursor-pointer"
                                />
                                <div className="flex-1">
                                    <div className="font-bold text-gray-800">{sheet.label}</div>
                                    <div className="text-sm text-gray-500 mt-0.5">{sheet.description}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={!isAnySelected}
                        className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600"
                    >
                        <Download size={18} />
                        Export {selectedCount > 0 && `(${selectedCount})`}
                    </button>
                </div>
            </div>
        </div>
    );
}
