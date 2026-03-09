import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import Button from './Button';

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger'
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed -top-[200px] -bottom-[200px] left-0 right-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <AlertTriangle size={20} className={variant === 'danger' ? 'text-red-500' : 'text-blue-500'} />
                        {title}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-gray-600 font-medium leading-relaxed">
                        {message}
                    </p>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-4 bg-gray-50 border-t border-gray-100">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={variant}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className="flex-1"
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
}
