import React from 'react';
import { Search } from 'lucide-react';

export default function SearchInput({
    value,
    onChange,
    placeholder = 'Search...',
    className = ''
}) {
    return (
        <div className={`relative ${className}`}>
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
                type="text"
                className="pl-10 border p-2 rounded w-full text-sm focus:ring-2 ring-blue-500 outline-none"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}
