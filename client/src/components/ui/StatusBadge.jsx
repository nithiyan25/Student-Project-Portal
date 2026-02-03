import React from 'react';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

const statusConfig = {
    COMPLETED: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-200',
        icon: CheckCircle,
        label: 'Completed'
    },
    IN_PROGRESS: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: Clock,
        label: 'In Progress'
    },
    NOT_COMPLETED: {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        border: 'border-gray-200',
        icon: AlertCircle,
        label: 'Not Completed'
    },
    AVAILABLE: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-200',
        label: 'Available'
    },
    ASSIGNED: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-200',
        label: 'Assigned'
    },
    PENDING: {
        bg: 'bg-gray-100',
        text: 'text-gray-600',
        border: 'border-gray-200',
        label: 'Pending'
    },
    APPROVED: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-200',
        label: 'Approved'
    },
    CHANGES_REQUIRED: {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        border: 'border-orange-200',
        icon: AlertCircle,
        label: 'Changes Required'
    },
    READY_FOR_REVIEW: {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        border: 'border-purple-200',
        icon: Clock,
        label: 'Ready for Review'
    }

};

export default function StatusBadge({ status, showIcon = false, size = 'sm' }) {
    const config = statusConfig[status] || {
        bg: 'bg-gray-100',
        text: 'text-gray-600',
        border: 'border-gray-200',
        label: status?.replace('_', ' ') || 'Unknown'
    };

    const Icon = config.icon;
    const sizeClasses = size === 'xs' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2 py-1';

    return (
        <span className={`flex items-center gap-1 ${config.bg} ${config.text} ${sizeClasses} rounded font-bold border ${config.border} uppercase`}>
            {showIcon && Icon && <Icon size={12} />}
            {config.label}
        </span>
    );
}
