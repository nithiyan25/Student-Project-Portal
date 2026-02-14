import React, { useState } from 'react';
import { X, Upload, Info, RefreshCw } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function BulkImportModal({ isOpen, onClose, type, onImport }) {
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const { addToast } = useToast();

    if (!isOpen) return null;

    const getInstructions = () => {
        switch (type) {
            case 'STUDENT':
                return "Format: RollNumber, Full Name, Email, Department, Year (One per line)";
            case 'FACULTY':
                return "Format: Faculty ID, Full Name, Email, Guide (Yes/No), Expert (Yes/No) (One per line)";
            case 'GUIDE_LIST':
            case 'EXPERT_LIST':
                return "Format: Email (One per line)";
            case 'PROJECT':
                return "Format: Title, Category, Team Size, Description, Tech Stack, SRS Link (One per line)";
            default:
                return "";
        }
    };

    const getPlaceholder = () => {
        switch (type) {
            case 'STUDENT':
                return "7376232AL172, NITHIYAN K, nithiyan.al23@bitsathy.ac.in, Artificial Intelligence and Machine Learning, 3,\n...";
            case 'FACULTY':
                return "FAC001, Dr. Robert Wilson, robert@university.edu, Yes, No\nFAC002, Prof. Sarah Connor, sarah@university.edu, No, Yes";
            case 'GUIDE_LIST':
            case 'EXPERT_LIST':
                return "robert@university.edu\nsarah@university.edu";
            case 'PROJECT':
                return "AI Chatbot, Machine Learning, 4, Design a chatbot using LLMs, React Node.js Python, https://example.com/srs\nSmart Grid, IoT, 3, Monitoring electrical grids with sensors, Arduino ESP32 C++, https://example.com/docs";
            default:
                return "";
        }
    };

    const handleImport = async () => {
        const lines = input.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return addToast("Please enter some data.", 'warning');

        setIsProcessing(true);
        try {
            const parsedData = lines.map(line => {
                const parts = line.split(',').map(p => p.trim());
                if (type === 'STUDENT') {
                    return {
                        rollNumber: parts[0],
                        name: parts[1],
                        email: parts[2],
                        department: parts[3],
                        year: parts[4],
                        role: 'STUDENT'
                    };
                } else if (type === 'GUIDE_LIST' || type === 'EXPERT_LIST') {
                    // Format: Email
                    return { email: parts[0] };
                } else if (type === 'FACULTY') {
                    // Format: FacultyID, Name, Email, Guide(Y/N), Expert(Y/N)
                    const isGuide = (parts[3] || '').trim().toLowerCase().startsWith('y');
                    const isExpert = (parts[4] || '').trim().toLowerCase().startsWith('y');

                    return {
                        rollNumber: parts[0],
                        name: parts[1],
                        email: parts[2],
                        isGuide: isGuide,
                        isSubjectExpert: isExpert,
                        role: 'FACULTY'
                    };
                } else {
                    return {
                        title: parts[0],
                        category: parts[1],
                        maxTeamSize: parts[2],
                        description: parts[3],
                        techStack: parts[4],
                        srs: parts[5]
                    };
                }
            });

            await onImport(parsedData);
            setInput('');
            onClose();
        } catch (err) {
            console.error(err);
            addToast(err.message || "Errors during parsing or import. Check format.", 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Upload size={24} /> Bulk Import {type.charAt(0) + type.slice(1).toLowerCase()}s
                        </h2>
                        <p className="text-indigo-100 text-xs mt-1">Paste your data below following the template.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3">
                        <Info className="text-blue-600 shrink-0" size={20} />
                        <div className="text-sm text-blue-800">
                            <strong>Instructions:</strong> {getInstructions()}
                        </div>
                    </div>

                    <textarea
                        className="w-full h-64 border-2 border-gray-100 p-4 rounded-xl focus:ring-2 ring-indigo-500 outline-none resize-none font-mono text-sm shadow-inner"
                        placeholder={getPlaceholder()}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    ></textarea>

                    <div className="flex justify-between items-center pt-2">
                        <p className="text-xs text-gray-500">
                            {input.split('\n').filter(l => l.trim()).length} records detected
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={isProcessing || !input.trim()}
                                className="px-8 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md active:scale-95 flex items-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" /> Processing...
                                    </>
                                ) : (
                                    'Start Import'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
