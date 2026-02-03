import React, { useState } from 'react';
import { Users, Briefcase, Folder, PieChart, CheckCircle2, Clock, PlayCircle, Shield, Filter, LayoutGrid, BarChart3, ChevronRight, AlertCircle } from 'lucide-react';

const StatusCard = ({ title, value, icon: Icon, color, subValue, trend }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between group hover:shadow-md transition-all">
        <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{title}</p>
            <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-gray-800">{value}</h3>
                {trend && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${trend.color}`}>{trend.label}</span>}
            </div>
            {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color} text-white shadow-lg group-hover:scale-110 transition-transform`}>
            <Icon size={24} />
        </div>
    </div>
);

const ProgressItem = ({ label, count, total, color, icon: Icon }) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2 text-gray-600 font-medium">
                    <Icon size={16} className={color.replace('bg-', 'text-')} />
                    {label}
                </div>
                <span className="font-bold text-gray-800">{count} <span className="text-gray-400 font-normal">({Math.round(percentage)}%)</span></span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} rounded-full transition-all duration-1000`}
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};

const CheckboxToggle = ({ label, checked, onChange, icon: Icon }) => (
    <label className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border border-gray-100 cursor-pointer hover:border-blue-200 hover:bg-blue-50/30 transition-all select-none group">
        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${checked ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-200' : 'bg-transparent border-gray-200 group-hover:border-gray-300'
            }`}>
            {checked && <CheckCircle2 size={16} className="text-white" strokeWidth={3} />}
        </div>
        <div className={`p-2 rounded-xl transition-colors ${checked ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
            <Icon size={18} />
        </div>
        <span className={`font-bold transition-colors ${checked ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
        <input
            type="checkbox"
            className="hidden"
            checked={checked}
            onChange={onChange}
        />
    </label>
);

export default function OverviewDashboardTab({ users, projects, teams, stats, onNavigate, scopes, statsScopeFilter, setStatsScopeFilter }) {
    // Visibility Toggles
    const [viewSettings, setViewSettings] = useState({
        dept: true,
        year: true,
        matrix: true
    });

    const toggleView = (key) => {
        setViewSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (!stats) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-gray-100 shadow-sm animate-pulse">
                <LayoutGrid size={48} className="text-blue-200 mb-4 animate-bounce" />
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Loading Dashboard Intelligence...</p>
            </div>
        );
    }

    // Use aggregated stats from backend
    const coreStats = stats.stats;
    const deptStats = stats.deptStats;
    const yearStats = stats.yearStats;
    const matrix = stats.matrix;

    const years = [1, 2, 3, 4];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Batch Filter */}
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Folder size={20} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Viewing Stats For</p>
                        <p className="font-bold text-gray-800">{statsScopeFilter === 'ALL' ? 'All Batches' : (scopes?.find(s => s.id === statsScopeFilter)?.name || 'Selected Batch')}</p>
                    </div>
                </div>
                <select
                    value={statsScopeFilter}
                    onChange={(e) => setStatsScopeFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-xl font-bold text-gray-700 shadow-sm focus:ring-2 ring-blue-500 outline-none bg-white cursor-pointer hover:border-blue-300 transition-colors"
                >
                    <option value="ALL">All Batches</option>
                    {scopes?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {/* Top Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatusCard
                    title="Total Students"
                    value={coreStats.students}
                    icon={Users}
                    color="bg-blue-600"
                    subValue={`${coreStats.studentsWithoutTeam} not in a team`}
                    trend={coreStats.studentsWithoutTeam > 0 ? { label: 'PENDING', color: 'bg-orange-100 text-orange-600' } : null}
                />
                <StatusCard
                    title="Faculty Members"
                    value={coreStats.faculty}
                    icon={Briefcase}
                    color="bg-purple-600"
                    subValue="Active supervisors"
                />
                <StatusCard
                    title="Active Projects"
                    value={coreStats.totalProjects}
                    icon={Folder}
                    color="bg-green-600"
                    subValue={`${coreStats.availableProjects} Avail / ${coreStats.requestedProjects} Req / ${coreStats.assignedProjects} Asgn`}
                />
                <StatusCard
                    title="System Admins"
                    value={coreStats.admins}
                    icon={Shield}
                    color="bg-indigo-600"
                    subValue="Platform managers"
                />
            </div>            <div className="grid lg:grid-cols-3 gap-8 items-stretch">
                {/* Team Progress Breakdown */}
                <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                            <PieChart size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Project Delivery Status</h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-4">
                            <ProgressItem
                                label="Not Completed"
                                count={coreStats.teamsNotCompleted}
                                total={coreStats.teamsTotal}
                                color="bg-gray-400"
                                icon={Clock}
                            />
                            <ProgressItem
                                label="Ready for Review"
                                count={coreStats.teamsReadyForReview}
                                total={coreStats.teamsTotal}
                                color="bg-blue-500"
                                icon={PlayCircle}
                            />
                            <ProgressItem
                                label="Changes Required"
                                count={coreStats.teamsChangesRequired}
                                total={coreStats.teamsTotal}
                                color="bg-orange-500"
                                icon={AlertCircle}
                            />
                            <ProgressItem
                                label="Completed"
                                count={coreStats.teamsCompleted}
                                total={coreStats.teamsTotal}
                                color="bg-green-500"
                                icon={CheckCircle2}
                            />
                        </div>

                        {/* Visual Summary */}
                        <div className="bg-gray-50 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-2 border border-gray-100">
                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Global Completion</p>
                            <h4 className="text-5xl font-black text-gray-800">
                                {coreStats.teamsTotal > 0 ? Math.round((coreStats.teamsCompleted / coreStats.teamsTotal) * 100) : 0}%
                            </h4>
                            <p className="text-xs text-gray-500 max-w-[200px]">
                                Overall percentage of finalized projects across all active teams.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Team Enrollment Breakdown */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <Users size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Team Enrollment</h2>
                    </div>

                    <div className="space-y-6 flex-1 flex flex-col justify-center">
                        <ProgressItem
                            label="Students in Teams"
                            count={coreStats.students - coreStats.studentsWithoutTeam}
                            total={coreStats.students}
                            color="bg-blue-600"
                            icon={CheckCircle2}
                        />
                        <ProgressItem
                            label="Students Pending"
                            count={coreStats.studentsWithoutTeam}
                            total={coreStats.students}
                            color="bg-orange-400"
                            icon={Clock}
                        />
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 mt-4">
                            <p className="text-xs text-gray-500 leading-relaxed italic text-center">
                                <strong>{coreStats.studentsWithoutTeam}</strong> students have not joined any project team yet.
                            </p>
                        </div>
                    </div>

                    {/* Navigation Card for Individual Stats */}
                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <button
                            onClick={() => onNavigate('individual-stats')}
                            className="w-full flex items-center justify-between p-4 bg-blue-600 rounded-2xl text-white hover:bg-blue-700 transition-all group overflow-hidden relative shadow-lg shadow-blue-200"
                        >
                            <div className="relative z-10 flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <BarChart3 size={20} />
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-bold text-blue-100 uppercase tracking-widest leading-tight">Detailed Tracking</p>
                                    <p className="font-bold">Individual Statistics</p>
                                </div>
                            </div>
                            <div className="relative z-10 p-2 bg-white/20 rounded-full group-hover:translate-x-1 transition-transform">
                                <ChevronRight size={20} />
                            </div>
                            {/* Decorative background circle */}
                            <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform"></div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Phase Progress Breakdown */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                            <BarChart3 size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Phase Progress Breakdown</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black bg-gray-100 text-gray-500 px-2 py-1 rounded uppercase tracking-widest">Platform Progress</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {(coreStats.phaseStats || [1, 2, 3].map(p => ({ phase: p, attended: 0, total: 0, notAttended: 0, completed: 0 }))).map((ps) => {
                        const total = ps.total || 0;
                        const attended = ps.attended || 0;
                        const notAttended = ps.notAttended || 0;
                        const completed = ps.completed || 0;
                        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

                        return (
                            <div key={ps.phase} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4 group hover:border-purple-200 transition-all hover:shadow-md relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <BarChart3 size={64} />
                                </div>
                                <div className="flex justify-between items-start relative z-10">
                                    <div>
                                        <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest leading-none mb-1">Phase {ps.phase}</p>
                                        <h3 className="text-xl font-bold text-gray-800">Review Cycle</h3>
                                    </div>
                                    <div className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-[10px] font-black uppercase shadow-sm">
                                        {completionRate}% Done
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 relative z-10">
                                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter leading-none mb-1">Attended</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-lg font-black text-blue-600">{attended}</span>
                                            <span className="text-[10px] font-bold text-gray-300">/ {total}</span>
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter leading-none mb-1">Not Attended</p>
                                        <span className="text-lg font-black text-gray-400">{notAttended}</span>
                                    </div>
                                </div>

                                <div className="space-y-2 relative z-10">
                                    <div className="flex justify-between items-end">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Finalized</p>
                                        <p className="text-xs font-black text-gray-700">{completed} <span className="text-[10px] font-bold text-gray-400">Teams</span></p>
                                    </div>
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                                        <div
                                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-1000 ease-out rounded-full shadow-lg"
                                            style={{ width: `${completionRate}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Dashboard Control Panel - Grouped with Analytics Content at the bottom */}
            <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100/50 backdrop-blur-sm mt-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 text-blue-600">
                            <Filter size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800">Analytics Controls</h3>
                            <p className="text-xs text-gray-500 font-medium">Toggle the detailed breakdowns below</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <CheckboxToggle
                            label="Department"
                            checked={viewSettings.dept}
                            onChange={() => toggleView('dept')}
                            icon={LayoutGrid}
                        />
                        <CheckboxToggle
                            label="Yearly"
                            checked={viewSettings.year}
                            onChange={() => toggleView('year')}
                            icon={BarChart3}
                        />
                        <CheckboxToggle
                            label="Matrix"
                            checked={viewSettings.matrix}
                            onChange={() => toggleView('matrix')}
                            icon={Users}
                        />
                    </div>
                </div>
            </div>

            {/* Granular Analytics Breakdowns */}
            {(viewSettings.dept || viewSettings.year) && (
                <div className="grid lg:grid-cols-2 gap-8 animate-in fade-in zoom-in-95 duration-300">
                    {/* Departmental Breakdown */}
                    {viewSettings.dept && (
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 transition-all">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                        <Briefcase size={20} />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-800">Departmental Breakdown</h2>
                                </div>
                                <span className="text-[10px] font-black bg-purple-100 text-purple-600 px-2 py-1 rounded uppercase tracking-widest">Active</span>
                            </div>
                            <div className="space-y-4">
                                {deptStats.map(dept => (
                                    <div key={dept.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-purple-200 transition-colors">
                                        <div>
                                            <p className="font-bold text-gray-800">{dept.name}</p>
                                            <p className="text-xs text-gray-500">{dept.total} Total Students</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-black ${dept.pending > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                                {dept.pending} Pending
                                            </p>
                                            <div className="flex gap-1 mt-1 justify-end">
                                                {[...Array(5)].map((_, i) => (
                                                    <div key={i} className={`h-1 w-3 rounded-full ${i < Math.ceil((dept.total - dept.pending) / dept.total * 5) ? 'bg-purple-500' : 'bg-gray-200'}`} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Academic Year Insights */}
                    {viewSettings.year && (
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 transition-all">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                                        <Shield size={20} />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-800">Yearly Distribution</h2>
                                </div>
                                <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded uppercase tracking-widest">Active</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {yearStats.map(year => (
                                    <div key={year.name} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col items-center text-center space-y-2 group hover:border-indigo-200 transition-all">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{year.name}</p>
                                        <p className="text-3xl font-black text-gray-800">{year.total}</p>
                                        <p className={`text-[10px] font-black px-2 py-1 rounded-full ${year.pending > 0 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                                            {year.pending} VACANT
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Department + Year Cross-Matrix */}
            {viewSettings.matrix && (
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <Users size={20} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800">Student Distribution Matrix (Dept × Year)</h2>
                        </div>
                        <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-2 py-1 rounded uppercase tracking-widest">Data Matrix</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="pb-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Department</th>
                                    {years.map(y => (
                                        <th key={y} className="pb-4 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">Year {y}</th>
                                    ))}
                                    <th className="pb-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Row Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {matrix.map(row => {
                                    const rowSum = years.reduce((acc, y) => acc + (row[y] || 0), 0);
                                    return (
                                        <tr key={row.name} className="group hover:bg-gray-50 transition-colors">
                                            <td className="py-4 font-bold text-gray-700 flex items-center gap-2">
                                                <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                                                {row.name}
                                            </td>
                                            {years.map(y => (
                                                <td key={y} className="py-4 text-center">
                                                    <span className={`inline-block min-w-[2.5rem] py-1.5 px-2 rounded-xl font-bold text-sm transition-all ${row[y] > 0
                                                        ? 'bg-blue-50 text-blue-600 border border-blue-100 group-hover:scale-110'
                                                        : 'text-gray-200'
                                                        }`}>
                                                        {row[y] || 0}
                                                    </span>
                                                </td>
                                            ))}
                                            <td className="py-4 text-right font-black text-gray-800 bg-gray-50/50 group-hover:bg-gray-100/50 transition-colors pr-4 rounded-r-2xl">
                                                {rowSum}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-100 bg-gray-50/30">
                                    <td className="py-6 font-black text-gray-400 uppercase text-[10px] tracking-widest pl-4">Column Totals</td>
                                    {years.map(y => {
                                        const colTotal = matrix.reduce((acc, row) => acc + (row[y] || 0), 0);
                                        return (
                                            <td key={y} className="py-6 text-center font-black text-gray-800 text-lg">
                                                {colTotal}
                                            </td>
                                        );
                                    })}
                                    <td className="py-6 text-right font-black text-blue-600 pr-4 text-xl">
                                        {coreStats.students}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* Quick Info Box */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="max-w-xl">
                        <h3 className="text-xl font-bold mb-2">Proactive Monitoring</h3>
                        <p className="text-indigo-100 text-sm leading-relaxed">
                            The system currently manages <strong>{coreStats.teamsTotal}</strong> active teams. Students without teams should be encouraged to finalize their groups.
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-3 bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                            <Users size={20} />
                            <div>
                                <p className="text-[10px] text-indigo-200 uppercase font-bold">Platform Status</p>
                                <p className="text-sm font-bold">Healthy & Stable</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                            <Folder size={20} />
                            <div>
                                <p className="text-[10px] text-indigo-200 uppercase font-bold">Project Access</p>
                                <p className="text-sm font-bold">{coreStats.availableProjects} Available</p>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Decorative Background Element */}
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            </div>
        </div>
    );
}
