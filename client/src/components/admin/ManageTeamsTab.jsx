import React, { useState, useEffect } from 'react';
import { UserPlus, Users, FolderPlus, Crown, UserX, UserCheck, Trash2, ShieldAlert } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import SearchInput from '../ui/SearchInput';

export default function ManageTeamsTab({
    teams,
    projects,
    newTeamMemberEmail,
    setNewTeamMemberEmail,
    createTeamManually,
    selectedTeamId,
    setSelectedTeamId,
    teamMemberEmail,
    setTeamMemberEmail,
    addMemberToTeam,
    selectedProjectId,
    setSelectedProjectId,
    assignProjectToTeam,
    // New props for overrides
    removeMember,
    changeLeader,
    unassignProject,
    // New props for solo assignment
    users,
    assignSoloProject,
    unassignFacultyFromTeam,
    assignFacultyToTeam,
    facultyList = [],
    scopes = [],

}) {
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [teamSearchTerm, setTeamSearchTerm] = useState('');
    const [selectedExistingBatchId, setSelectedExistingBatchId] = useState('');

    // State for Solo Assignment Form
    const [selectedSoloStudentId, setSelectedSoloStudentId] = useState('');
    const [selectedSoloProjectId, setSelectedSoloProjectId] = useState('');
    const [soloStudentSearch, setSoloStudentSearch] = useState('');
    const [soloProjectSearch, setSoloProjectSearch] = useState('');
    const [selectedSoloBatchId, setSelectedSoloBatchId] = useState('');

    // State for Manual Team Creation
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [projectAssignSearch, setProjectAssignSearch] = useState('');

    const findProjectBatch = (projId) => {
        const p = projects.find(proj => proj.id === projId);
        return p?.scopeId || null;
    };

    const targetBatchId = selectedSoloProjectId ? findProjectBatch(selectedSoloProjectId) : selectedSoloBatchId;

    // Filter teams based on search term and batch
    const filteredTeams = teams.filter(t => {
        const matchSearch = t.members.some(m =>
            m.user.name.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
            (m.user.rollNumber && m.user.rollNumber.toLowerCase().includes(teamSearchTerm.toLowerCase()))
        );
        const matchBatch = selectedExistingBatchId ? t.scopeId === selectedExistingBatchId : true;
        return matchSearch && matchBatch;
    });

    // Filter students for solo assignment
    const availableStudents = users.filter(u =>
        u.role === 'STUDENT' &&
        // If a batch is selected (directly or via project), block students already in THAT batch
        (targetBatchId ? !teams.some(t => t.scopeId === targetBatchId && t.members.some(m => m.userId === u.id)) : true) &&
        (u.name.toLowerCase().includes(soloStudentSearch.toLowerCase()) ||
            (u.rollNumber && u.rollNumber.toLowerCase().includes(soloStudentSearch.toLowerCase())) ||
            u.email.toLowerCase().includes(soloStudentSearch.toLowerCase()))
    );

    // Filter projects for solo assignment
    const availableSoloProjects = projects.filter(p =>
        p.status === 'AVAILABLE' &&
        p.maxTeamSize === 1 &&
        (selectedSoloBatchId ? p.scopeId === selectedSoloBatchId : true) &&
        p.title.toLowerCase().includes(soloProjectSearch.toLowerCase())
    );

    // Sync selectedTeam object when selectedTeamId changes or teams list updates
    useEffect(() => {
        if (selectedTeamId) {
            const team = teams.find(t => t.id === selectedTeamId);
            setSelectedTeam(team);
        } else {
            setSelectedTeam(null);
        }
    }, [selectedTeamId, teams]);

    const getFacultyBatchCount = (facId, batchId) => {
        return teams.filter(t =>
            t.scopeId === batchId &&
            (
                (t.guideId === facId && (t.guideStatus === 'APPROVED' || t.guideStatus === 'PENDING')) ||
                (t.subjectExpertId === facId && (t.expertStatus === 'APPROVED' || t.expertStatus === 'PENDING'))
            )
        ).length;
    };

    return (
        <div className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Step 1: Create or Select Team */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-800">
                        <Users size={20} /> Manage Existing Team
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Filter & Select Team</label>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <select
                                        className="border p-2 rounded bg-white text-xs focus:ring-2 ring-indigo-500 outline-none"
                                        value={selectedExistingBatchId}
                                        onChange={e => {
                                            setSelectedExistingBatchId(e.target.value);
                                            setSelectedTeamId(''); // Reset selection if batch filter changes
                                        }}
                                    >
                                        <option value="">All Batches</option>
                                        {scopes.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                    <SearchInput
                                        value={teamSearchTerm}
                                        onChange={setTeamSearchTerm}
                                        placeholder="Search members..."
                                    />
                                </div>
                                <select
                                    className="w-full border p-2 rounded bg-white focus:ring-2 ring-indigo-500 outline-none"
                                    value={selectedTeamId}
                                    onChange={e => setSelectedTeamId(e.target.value)}
                                >
                                    <option value="">-- Choose Team --</option>
                                    {filteredTeams.map((t) => {
                                        // Find original index for Labeling
                                        const originalIndex = teams.findIndex(orig => orig.id === t.id);
                                        const scopeName = scopes.find(s => s.id === t.scopeId)?.name || 'Default';
                                        return (
                                            <option key={t.id} value={t.id}>
                                                [{scopeName}] Team #{originalIndex + 1} - {t.members.map(m => m.user.name).join(', ')}
                                            </option>
                                        );
                                    })}
                                </select>
                                {teamSearchTerm && filteredTeams.length === 0 && (
                                    <p className="text-xs text-red-500 italic">No teams matching "{teamSearchTerm}"</p>
                                )}
                            </div>
                        </div>

                        {selectedTeam && (
                            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-indigo-900 leading-tight">Team Details</h3>
                                        <div className="flex flex-wrap gap-1 items-center">
                                            <p className="text-[10px] text-indigo-400 font-mono">ID: {selectedTeam.id.split('-')[0]}...</p>
                                            <span className="bg-white/50 px-1.5 py-0.5 rounded text-[10px] font-black text-indigo-500 border border-indigo-200 uppercase tracking-tighter">
                                                {scopes.find(s => s.id === selectedTeam.scopeId)?.name || 'Default Batch'}
                                            </span>
                                        </div>
                                    </div>
                                    <StatusBadge status={selectedTeam.status} size="xs" />
                                </div>



                                {(() => {
                                    const currentScope = scopes.find(s => s.id === selectedTeam.scopeId);
                                    const showGuide = currentScope?.requireGuide ?? true; // Default to true if not specified
                                    const showExpert = currentScope?.requireSubjectExpert ?? true;

                                    if (!showGuide && !showExpert) return null;

                                    return (
                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                            {showGuide && (
                                                <div className={`border p-2 rounded ${selectedTeam.guide ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100 border-dashed'}`}>
                                                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Guide</p>
                                                    {selectedTeam.guide ? (
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-gray-800">{selectedTeam.guide.name}</span>
                                                                <span className={`text-[8px] font-black uppercase tracking-wider ${selectedTeam.guideStatus === 'APPROVED' ? 'text-green-600' :
                                                                    selectedTeam.guideStatus === 'REJECTED' ? 'text-red-600' : 'text-yellow-600'
                                                                    }`}>
                                                                    {selectedTeam.guideStatus}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => unassignFacultyFromTeam(selectedTeam.id, 'GUIDE')}
                                                                className="text-red-500 hover:bg-red-100 p-1 rounded transition"
                                                                title="Unassign Guide"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <select
                                                                className="w-full text-xs border rounded p-1 outline-none focus:ring-1 ring-indigo-500"
                                                                onChange={(e) => {
                                                                    if (e.target.value) assignFacultyToTeam(selectedTeam.id, e.target.value, 'GUIDE');
                                                                }}
                                                                defaultValue=""
                                                            >
                                                                <option value="" disabled>Assign Guide</option>
                                                                {facultyList
                                                                    .filter(f => f.id !== selectedTeam.subjectExpertId)
                                                                    .filter(f => {
                                                                        // Show if they are already assigned to THIS team in THIS role (for display)
                                                                        // or if they have < 4 slots elsewhere.
                                                                        const count = getFacultyBatchCount(f.id, selectedTeam.scopeId);
                                                                        return count < 4;
                                                                    })
                                                                    .map(f => (
                                                                        <option key={f.id} value={f.id}>{f.name} ({getFacultyBatchCount(f.id, selectedTeam.scopeId)}/4)</option>
                                                                    ))}
                                                            </select>
                                                            <p className="text-[9px] text-gray-500 mt-1 italic">Only showing faculty with &lt; 4 teams in this batch.</p>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {showExpert && (
                                                <div className={`border p-2 rounded ${selectedTeam.subjectExpert ? 'bg-purple-50 border-purple-100' : 'bg-gray-50 border-gray-100 border-dashed'}`}>
                                                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Expert</p>
                                                    {selectedTeam.subjectExpert ? (
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-gray-800">{selectedTeam.subjectExpert.name}</span>
                                                                <span className={`text-[8px] font-black uppercase tracking-wider ${selectedTeam.expertStatus === 'APPROVED' ? 'text-green-600' :
                                                                    selectedTeam.expertStatus === 'REJECTED' ? 'text-red-600' : 'text-yellow-600'
                                                                    }`}>
                                                                    {selectedTeam.expertStatus}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => unassignFacultyFromTeam(selectedTeam.id, 'EXPERT')}
                                                                className="text-red-500 hover:bg-red-100 p-1 rounded transition"
                                                                title="Unassign Expert"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <select
                                                                className="w-full text-xs border rounded p-1 outline-none focus:ring-1 ring-purple-500"
                                                                onChange={(e) => {
                                                                    if (e.target.value) assignFacultyToTeam(selectedTeam.id, e.target.value, 'EXPERT');
                                                                }}
                                                                defaultValue=""
                                                            >
                                                                <option value="" disabled>Assign Expert</option>
                                                                {facultyList
                                                                    .filter(f => f.id !== selectedTeam.guideId)
                                                                    .filter(f => {
                                                                        const count = getFacultyBatchCount(f.id, selectedTeam.scopeId);
                                                                        return count < 4;
                                                                    })
                                                                    .map(f => (
                                                                        <option key={f.id} value={f.id}>{f.name} ({getFacultyBatchCount(f.id, selectedTeam.scopeId)}/4)</option>
                                                                    ))}
                                                            </select>
                                                            <p className="text-[9px] text-gray-500 mt-1 italic">Only showing faculty with &lt; 4 teams in this batch.</p>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                <div className="space-y-2 mb-4 mt-4">
                                    <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider">Members & Leadership</label>
                                    {selectedTeam.members.map(m => (
                                        <div key={m.id} className="flex items-center justify-between bg-white border border-indigo-100 p-2 rounded shadow-sm group">
                                            <div className="flex items-center gap-2">
                                                {m.isLeader ? (
                                                    <Crown size={14} className="text-yellow-500 fill-yellow-500" />
                                                ) : (
                                                    <div className="w-[14px]" />
                                                )}
                                                <span className={`text-sm ${m.isLeader ? 'font-bold text-indigo-900' : 'text-gray-700'}`}>
                                                    {m.user.name} <span className="text-xs text-indigo-400 font-mono ml-1">({m.user.rollNumber || 'No Roll #'})</span>
                                                </span>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!m.isLeader && (
                                                    <button
                                                        onClick={() => changeLeader(selectedTeam.id, m.userId, m.user.name)}
                                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                        title="Make Lead"
                                                    >
                                                        <UserCheck size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => removeMember(selectedTeam.id, m.userId, m.user.name)}
                                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                    title="Remove Member"
                                                >
                                                    <UserX size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {selectedTeam.project ? (
                                    <div className="bg-white border border-indigo-100 p-3 rounded shadow-sm">
                                        <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Assigned Project</label>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-semibold text-gray-800">{selectedTeam.project.title}</span>
                                            <button
                                                onClick={() => unassignProject(selectedTeam.id, selectedTeam.project.title)}
                                                className="flex items-center gap-1 text-[10px] bg-red-50 text-red-600 border border-red-100 px-2 py-1 rounded hover:bg-red-100 font-bold transition"
                                            >
                                                <ShieldAlert size={12} /> UNASSIGN
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-3 border border-dashed border-indigo-200 rounded text-xs text-indigo-400 italic">
                                        No project assigned yet
                                    </div>
                                )}

                            </div>
                        )}
                    </div>
                </div>

                {/* Step 2: Direct Solo Assignment (For Individual Projects) */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-orange-100 bg-orange-50/10">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-orange-800">
                        <UserPlus size={20} /> Direct Solo Assignment (Size 1)
                    </h2>
                    <div className="space-y-4">
                        <div className="bg-orange-100/50 p-3 rounded-lg border border-orange-200">
                            <label className="block text-[10px] uppercase font-black text-orange-600 mb-2 tracking-wider">Filter by Batch</label>
                            <select
                                className="w-full border-orange-200 p-2 rounded bg-white text-sm focus:ring-2 ring-orange-500 outline-none"
                                value={selectedSoloBatchId}
                                onChange={e => {
                                    setSelectedSoloBatchId(e.target.value);
                                    setSelectedSoloProjectId(''); // Reset project if batch changes
                                }}
                            >
                                <option value="">All Batches</option>
                                {scopes.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-sm font-semibold text-gray-700">Select Individual Student</label>
                            <SearchInput
                                value={soloStudentSearch}
                                onChange={setSoloStudentSearch}
                                placeholder="Search by name or roll no..."
                                className="mb-2"
                            />
                            <select
                                className="w-full border p-2 rounded bg-white focus:ring-2 ring-orange-500 outline-none"
                                value={selectedSoloStudentId}
                                onChange={e => setSelectedSoloStudentId(e.target.value)}
                            >
                                <option value="">-- Choose Student ({availableStudents.length} available) --</option>
                                {availableStudents.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.rollNumber || s.email})
                                    </option>
                                ))}
                            </select>
                            {soloStudentSearch && availableStudents.length === 0 && (
                                <p className="text-[10px] text-red-500 italic">No matching students found.</p>
                            )}
                            {!soloStudentSearch && (
                                <p className="text-[10px] text-gray-500 mt-1 italic">
                                    Only showing students not in a team {targetBatchId ? 'for this batch' : 'globally'}.
                                </p>
                            )}
                        </div>

                        <div className="space-y-3">
                            <label className="block text-sm font-semibold text-gray-700">Select Solo Project</label>
                            <SearchInput
                                value={soloProjectSearch}
                                onChange={setSoloProjectSearch}
                                placeholder="Search project title..."
                                className="mb-2"
                            />
                            <select
                                className="w-full border p-2 rounded bg-white focus:ring-2 ring-orange-500 outline-none"
                                value={selectedSoloProjectId}
                                onChange={e => setSelectedSoloProjectId(e.target.value)}
                            >
                                <option value="">-- Choose Solo Project ({availableSoloProjects.length} available) --</option>
                                {availableSoloProjects.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                            {soloProjectSearch && availableSoloProjects.length === 0 && (
                                <p className="text-[10px] text-red-500 italic">No matching projects found.</p>
                            )}
                        </div>

                        <button
                            disabled={!selectedSoloStudentId || !selectedSoloProjectId}
                            onClick={() => {
                                assignSoloProject(selectedSoloStudentId, selectedSoloProjectId);
                                setSelectedSoloStudentId('');
                                setSelectedSoloProjectId('');
                            }}
                            className="w-full bg-orange-600 text-white py-2 rounded hover:bg-orange-700 font-semibold shadow-sm transition disabled:bg-gray-300"
                        >
                            Assign Solo Project
                        </button>
                    </div>
                </div>

                {/* Create Team Manually */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-800">
                        <UserPlus size={20} /> Create New Team
                    </h2>
                    <form onSubmit={createTeamManually} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Project Batch</label>
                            <select
                                required
                                className="w-full border p-2 rounded bg-white focus:ring-2 ring-blue-500 outline-none mb-4"
                                value={selectedBatchId}
                                onChange={e => setSelectedBatchId(e.target.value)}
                            >
                                <option value="">-- Choose Batch --</option>
                                {scopes.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>

                            <label className="block text-sm font-semibold text-gray-700 mb-2">Lead Student Email</label>
                            <input
                                required
                                type="email"
                                className="w-full border p-2 rounded focus:ring-2 ring-blue-500 outline-none"
                                placeholder="student@example.com"
                                value={newTeamMemberEmail}
                                onChange={e => setNewTeamMemberEmail(e.target.value)}
                            />
                            <p className="text-[10px] text-gray-500 mt-1">First member will be set as Team Lead automatically.</p>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                createTeamManually(e, selectedBatchId);
                                setSelectedBatchId('');
                            }}
                            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-semibold shadow-sm transition"
                        >
                            Establish Team
                        </button>
                    </form>
                </div>

                {/* Add Member to Selected Team */}
                <div className={`bg-white p-6 rounded-lg shadow-sm border transition-opacity ${!selectedTeam ? 'opacity-50 grayscale select-none' : ''}`}>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-green-800">
                        <Users size={20} /> Add Member to Team
                    </h2>
                    <form onSubmit={addMemberToTeam} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Student Email</label>
                            <input
                                required
                                disabled={!selectedTeam}
                                type="email"
                                className="w-full border p-2 rounded focus:ring-2 ring-green-500 outline-none"
                                placeholder="student@example.com"
                                value={teamMemberEmail}
                                onChange={e => setTeamMemberEmail(e.target.value)}
                            />
                            {selectedTeam?.scopeId && (
                                <p className="text-[10px] text-green-600 mt-1 italic font-bold">
                                    Student must be available in the "{scopes.find(s => s.id === selectedTeam.scopeId)?.name}" batch.
                                </p>
                            )}
                        </div>
                        <button
                            disabled={!selectedTeam}
                            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 font-semibold shadow-sm transition disabled:bg-gray-400"
                        >
                            Add Member
                        </button>
                    </form>
                </div>

                {/* Assign Project to Selected Team */}
                <div className={`bg-white p-6 rounded-lg shadow-sm border transition-opacity ${(!selectedTeam || selectedTeam.projectId) ? 'opacity-50 grayscale select-none' : ''}`}>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-purple-800">
                        <FolderPlus size={20} /> Assign Project
                    </h2>
                    <form onSubmit={assignProjectToTeam} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Project</label>
                            <SearchInput
                                value={projectAssignSearch}
                                onChange={setProjectAssignSearch}
                                placeholder="Search projects..."
                                className="mb-2"
                                disabled={!selectedTeam || selectedTeam.projectId}
                            />
                            <select
                                required
                                disabled={!selectedTeam || selectedTeam.projectId}
                                className="w-full border p-2 rounded bg-white focus:ring-2 ring-purple-500 outline-none"
                                value={selectedProjectId}
                                onChange={e => setSelectedProjectId(e.target.value)}
                            >
                                <option value="">-- Choose Project --</option>
                                {projects
                                    .filter(p => p.status === 'AVAILABLE')
                                    .filter(p => selectedTeam?.scopeId ? p.scopeId === selectedTeam.scopeId : true)
                                    .filter(p => p.title.toLowerCase().includes(projectAssignSearch.toLowerCase()))
                                    .map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.title} (Max: {p.maxTeamSize})
                                        </option>
                                    ))
                                }
                            </select>
                            {selectedTeam?.scopeId && (
                                <p className="text-[10px] text-purple-600 mt-1 font-bold italic">
                                    Only showing projects for: {scopes.find(s => s.id === selectedTeam.scopeId)?.name}
                                </p>
                            )}
                            {selectedTeam?.projectId && (
                                <p className="text-[10px] text-red-500 mt-1 font-bold italic">Unassign current project first to reassign.</p>
                            )}
                        </div>
                        <button
                            disabled={!selectedTeam || selectedTeam.projectId}
                            className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 font-semibold shadow-sm transition disabled:bg-gray-400"
                        >
                            Assign Project
                        </button>
                    </form>
                </div>
            </div>
        </div >
    );
}
