import React, { createContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = Date.now().toString() + Math.random().toString();
        setToasts(prev => [...prev, { id, message, type, duration }]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const ToastItem = ({ toast, onRemove }) => {
    useEffect(() => {
        if (toast.duration) {
            const timer = setTimeout(() => {
                onRemove(toast.id);
            }, toast.duration);
            return () => clearTimeout(timer);
        }
    }, [toast, onRemove]);

    const styles = {
        success: 'bg-white border-green-500 text-green-700',
        error: 'bg-white border-red-500 text-red-700',
        info: 'bg-white border-blue-500 text-blue-700',
        warning: 'bg-white border-yellow-500 text-yellow-700'
    };

    const icons = {
        success: <CheckCircle size={20} className="text-green-500" />,
        error: <AlertCircle size={20} className="text-red-500" />,
        info: <Info size={20} className="text-blue-500" />,
        warning: <AlertTriangle size={20} className="text-yellow-500" />
    };

    return (
        <div className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border-l-4 min-w-[300px] max-w-md animate-in slide-in-from-right duration-300 ${styles[toast.type] || styles.info}`}>
            {icons[toast.type] || icons.info}
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button onClick={() => onRemove(toast.id)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
            </button>
        </div>
    );
};

export const useToast = () => React.useContext(ToastContext);
