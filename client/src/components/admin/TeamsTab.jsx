import React from 'react';
import { Users, Trash2, Crown } from 'lucide-react';
import SearchInput from '../ui/SearchInput';

export default function TeamsTab({
    teams,
    deleteTeam,
    teamSearch,
    setTeamSearch,
    teamFilter,
    setTeamFilter
}) {
    const getStatusColor = (status) => {
        if (status === 'COMPLETED') return 'bg-green-100 text-green-800';
        if (status === 'IN_PROGRESS') return 'bg-blue-100 text-blue-800';
        return 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-800">
                    <Users size={20} /> Teams Overview ({teams.length})
                </h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <SearchInput
                        value={teamSearch}
                        onChange={setTeamSearch}
                        placeholder="Search project or members..."
                        className="w-full sm:w-64"
                    />
                    <select
                        className="border p-2 rounded text-sm bg-white focus:ring-2 ring-indigo-500 outline-none"
                        value={teamFilter}
                        onChange={e => setTeamFilter(e.target.value)}
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="NOT_COMPLETED">Not Completed</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                            <th className="p-3">Project</th>
                            <th className="p-3">Team Members</th>
                            <th className="p-3">Size</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {teams.map(t => (
                            <tr key={t.id} className="hover:bg-gray-50 text-sm">
                                <td className="p-3 font-medium text-gray-800">
                                    {t.project ? t.project.title : <span className="text-gray-400 italic">None</span>}
                                </td>
                                <td className="p-3">
                                    <div className="flex gap-2 flex-wrap">
                                        {t.members.map(m => (
                                            <div key={m.id} className="flex items-center gap-1 bg-gray-100 border px-2 py-1 rounded text-xs">
                                                {m.isLeader && <Crown size={12} className="text-yellow-600 fill-yellow-600" />}
                                                <span className={m.isLeader ? 'font-bold' : ''}>{m.user.name}</span>
                                                {m.user.rollNumber && <span className="text-gray-500 ml-1">({m.user.rollNumber})</span>}
                                            </div>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-3 font-semibold">{t.members.length}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase ${getStatusColor(t.status)}`}>
                                        {t.status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="p-3 text-center">
                                    <button
                                        onClick={() => deleteTeam(t.id, t.members.find(m => m.isLeader)?.user.name || 'Team')}
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-200 text-xs font-semibold transition"
                                        title="Delete entirety team"
                                    >
                                        <Trash2 size={14} />
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {teams.length === 0 && (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-400">No teams formed yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
