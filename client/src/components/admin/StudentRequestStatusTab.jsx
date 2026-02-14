import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Users, CheckCircle2, Clock, XCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import SearchInput from '../ui/SearchInput';
import api from '../../api';
import { useToast } from '../../context/ToastContext';

const StatusCard = ({ title, count, icon: Icon, colorClass, onClick, active }) => (
    <div
        onClick={onClick}
        className={`p-6 rounded-2xl border transition-all cursor-pointer ${active
            ? `${colorClass} border-current shadow-lg scale-105`
            : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-md'
            }`}
    >
        <div className="flex justify-between items-start">
            <div>
                <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${active ? 'opacity-80' : 'text-gray-400'}`}>{title}</p>
                <h3 className={`text-3xl font-black ${active ? 'text-white' : 'text-gray-800'}`}>{count}</h3>
            </div>
            <div className={`p-3 rounded-xl ${active ? 'bg-white/20 text-white' : 'bg-gray-50 text-gray-400'}`}>
                <Icon size={24} />
            </div>
        </div>
    </div>
);

export default function StudentRequestStatusTab({ scopes }) {
    const { addToast } = useToast();
    const [data, setData] = useState({ accepted: [], requested: [], notRequested: [] });
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('accepted');
    const [search, setSearch] = useState('');
    const [batchFilter, setBatchFilter] = useState('ALL');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    useEffect(() => {
        fetchStatusData();
    }, [batchFilter]);

    const fetchStatusData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/student-project-status', {
                params: { scopeId: batchFilter }
            });
            setData(res.data);
        } catch (err) {
            console.error("Error fetching status data:", err);
            addToast("Failed to load status data", 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const getSortedData = (category) => {
        const list = [...(data[category] || [])];
        const searchLower = search.toLowerCase();

        const filtered = list.filter(s =>
            s.name.toLowerCase().includes(searchLower) ||
            s.email.toLowerCase().includes(searchLower) ||
            (s.rollNumber && s.rollNumber.toLowerCase().includes(searchLower)) ||
            (s.department && s.department.toLowerCase().includes(searchLower))
        );

        return filtered.sort((a, b) => {
            let aVal = a[sortConfig.key] || '';
            let bVal = b[sortConfig.key] || '';

            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const exportToCSV = () => {
        const list = getSortedData(activeCategory);
        const headers = ["Name", "Roll Number", "Email", "Department", "Year", "Project"];
        const rows = list.map(s => [
            s.name,
            s.rollNumber || 'N/A',
            s.email,
            s.department || 'N/A',
            s.year || 'N/A',
            activeCategory === 'requested' ? s.requestedProject : (s.projectTitle || 'N/A')
        ]);

        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `student_${activeCategory}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const SortIndicator = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="text-gray-300 ml-1" />;
        return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-500 ml-1" /> : <ArrowDown size={12} className="text-blue-500 ml-1" />;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const categories = [
        { id: 'accepted', title: 'Accepted', icon: CheckCircle2, color: 'bg-green-600 text-white', count: data.accepted.length },
        { id: 'requested', title: 'Requested', icon: Clock, color: 'bg-blue-600 text-white', count: data.requested.length },
        { id: 'notRequested', title: 'Not Requested', icon: XCircle, color: 'bg-orange-600 text-white', count: data.notRequested.length },
    ];

    const currentList = getSortedData(activeCategory);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {categories.map(cat => (
                    <StatusCard
                        key={cat.id}
                        title={cat.title}
                        count={cat.count}
                        icon={cat.icon}
                        colorClass={cat.color}
                        onClick={() => setActiveCategory(cat.id)}
                        active={activeCategory === cat.id}
                    />
                ))}
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        {categories.find(c => c.id === activeCategory).title} Students
                        <span className="text-xs font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200">
                            {currentList.length}
                        </span>
                    </h2>

                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                            <Filter size={16} className="text-gray-400" />
                            <select
                                className="bg-transparent text-sm font-bold text-gray-600 outline-none cursor-pointer"
                                value={batchFilter}
                                onChange={(e) => setBatchFilter(e.target.value)}
                            >
                                <option value="ALL">All Batches</option>
                                {scopes?.map(scope => (
                                    <option key={scope.id} value={scope.id}>{scope.name}</option>
                                ))}
                            </select>
                        </div>
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder="Search students..."
                            className="w-full md:w-64"
                        />
                        <button
                            onClick={exportToCSV}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-md active:scale-95"
                        >
                            <Download size={16} /> Export
                        </button>
                    </div>
                </div>

                <div className="overflow-hidden border border-gray-50 rounded-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:bg-gray-100/50" onClick={() => handleSort('name')}>
                                        <div className="flex items-center">Name <SortIndicator columnKey="name" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:bg-gray-100/50" onClick={() => handleSort('rollNumber')}>
                                        <div className="flex items-center">Roll Number <SortIndicator columnKey="rollNumber" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Department</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Year</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest min-w-[150px]">
                                        {activeCategory === 'requested' ? 'Requested Project' : 'Assigned Project'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {currentList.map(s => (
                                    <tr key={s.id} className="hover:bg-blue-50/30 transition-all">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800 text-sm whitespace-nowrap">{s.name}</span>
                                                <span className="text-[10px] text-gray-400 font-mono">{s.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">{s.rollNumber || '—'}</td>
                                        <td className="px-6 py-4 text-xs font-medium text-gray-500">{s.department || '—'}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-black text-gray-600">Y{s.year || '?'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-bold ${activeCategory === 'notRequested' ? 'text-gray-300 italic' : 'text-blue-600'}`}>
                                                {activeCategory === 'requested' ? s.requestedProject : (s.projectTitle || 'No Project')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {currentList.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="p-10 text-center text-gray-400 italic">
                                            No students found in this category.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
