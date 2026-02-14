import React, { createContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export const ConfirmContext = createContext();

export const ConfirmProvider = ({ children }) => {
    const [modalState, setModalState] = useState({ isOpen: false, title: '', message: '', type: 'confirm' });
    const resolveRef = useRef(null);

    const confirm = useCallback((message, title = 'Confirm Action', type = 'confirm') => {
        return new Promise((resolve) => {
            setModalState({ isOpen: true, title, message, type });
            resolveRef.current = resolve;
        });
    }, []);

    const handleClose = (result) => {
        setModalState(prev => ({ ...prev, isOpen: false }));
        if (resolveRef.current) {
            resolveRef.current(result);
            resolveRef.current = null;
        }
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {modalState.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200">
                        <div className={`p-6 border-b flex items-center gap-3 ${modalState.type === 'danger' ? 'bg-red-50' : 'bg-gray-50'}`}>
                            <div className={`p-2 rounded-full ${modalState.type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                <AlertTriangle size={24} />
                            </div>
                            <h3 className={`text-lg font-bold ${modalState.type === 'danger' ? 'text-red-900' : 'text-gray-900'}`}>
                                {modalState.title}
                            </h3>
                            <button
                                onClick={() => handleClose(false)}
                                className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                                {modalState.message}
                            </p>
                        </div>

                        <div className="p-4 bg-gray-50 flex justify-end gap-3 border-t">
                            <button
                                onClick={() => handleClose(false)}
                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-all shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleClose(true)}
                                className={`px-4 py-2 text-white rounded-lg font-bold shadow-md transition-all ${modalState.type === 'danger'
                                        ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                                        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                    }`}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => React.useContext(ConfirmContext);
