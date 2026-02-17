import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export default function SearchableDropdown({
    options,
    value,
    onChange,
    placeholder = "Select option...",
    searchPlaceholder = "Search...",
    className = "",
    labelKey = "name",
    valueKey = "name",
    secondaryLabelKey = "department",
    tertiaryLabelKey = "rollNumber"
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter(option => {
        const primary = String(option[labelKey] || "").toLowerCase();
        const secondary = String(option[secondaryLabelKey] || "").toLowerCase();
        const tertiary = String(option[tertiaryLabelKey] || "").toLowerCase();
        const query = searchQuery.toLowerCase();
        return primary.includes(query) || secondary.includes(query) || tertiary.includes(query);
    });

    const selectedOption = options.find(opt => opt[valueKey] === value);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200 cursor-pointer transition-all hover:border-blue-400 hover:bg-white ${isOpen ? 'ring-2 ring-blue-100 border-blue-400 bg-white' : ''}`}
            >
                <div className="flex items-center gap-2 truncate">
                    {selectedOption ? (
                        <span className="text-sm font-bold text-gray-700">
                            {selectedOption[labelKey]}
                            {selectedOption[tertiaryLabelKey] && (
                                <span className="ml-2 text-[11px] text-gray-400 font-mono">#{selectedOption[tertiaryLabelKey]}</span>
                            )}
                        </span>
                    ) : (
                        <span className="text-sm font-medium text-gray-400">{placeholder}</span>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {value && (
                        <X
                            size={14}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange("");
                                setSearchQuery("");
                            }}
                        />
                    )}
                    <ChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[110] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-3 border-b border-gray-50 flex items-center gap-3 bg-gray-50/50">
                        <Search size={16} className="text-gray-400" />
                        <input
                            autoFocus
                            type="text"
                            className="bg-transparent border-none outline-none text-sm font-medium text-gray-700 w-full"
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        onChange(option[valueKey]);
                                        setIsOpen(false);
                                        setSearchQuery("");
                                    }}
                                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all group ${value === option[valueKey] ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                >
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-baseline gap-2">
                                            <span className={`text-sm font-bold truncate ${value === option[valueKey] ? 'text-blue-600' : 'text-gray-700 group-hover:text-blue-600'}`}>
                                                {option[labelKey]}
                                            </span>
                                            {option[tertiaryLabelKey] && (
                                                <span className="text-[10px] text-gray-400 font-mono">#{option[tertiaryLabelKey]}</span>
                                            )}
                                        </div>
                                        {option[secondaryLabelKey] && (
                                            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                                                {option[secondaryLabelKey]}
                                            </span>
                                        )}
                                    </div>
                                    {value === option[valueKey] && <Check size={16} className="text-blue-600 shrink-0" />}
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                <p className="text-sm font-medium text-gray-400 italic">No matches found</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
