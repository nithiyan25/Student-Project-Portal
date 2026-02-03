import React from 'react';

const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200',
    success: 'bg-green-600 text-white hover:bg-green-700',
    outline: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100',
    purple: 'bg-purple-600 text-white hover:bg-purple-700',
    indigo: 'bg-indigo-600 text-white hover:bg-indigo-700',
};

export default function Button({
    children,
    variant = 'primary',
    className = '',
    disabled = false,
    type = 'button',
    onClick,
    ...props
}) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`px-4 py-2 rounded font-semibold transition text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant] || variants.primary} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}
