import React from 'react';

export default function Card({ children, className = '', title, icon: Icon, headerColor = 'text-gray-800' }) {
    return (
        <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
            {title && (
                <div className="px-6 py-4 border-b">
                    <h2 className={`text-lg font-bold flex items-center gap-2 ${headerColor}`}>
                        {Icon && <Icon size={20} />}
                        {title}
                    </h2>
                </div>
            )}
            <div className="p-6">
                {children}
            </div>
        </div>
    );
}

export function CardHeader({ children, className = '' }) {
    return (
        <div className={`px-6 py-4 border-b ${className}`}>
            {children}
        </div>
    );
}

export function CardBody({ children, className = '' }) {
    return (
        <div className={`p-6 ${className}`}>
            {children}
        </div>
    );
}
