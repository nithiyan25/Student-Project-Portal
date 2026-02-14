import React, { useState, useEffect } from 'react';
import api from '../../api';
import { Calendar, MapPin, Plus, Trash2, Users, X, User, Edit, GraduationCap, Copy, ClipboardCheck, ArrowLeftRight, Search, Info, CloudOff, CalendarCheck, AlertCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

export default function VenueSchedulerTab({ scopes }) {
    const [venues, setVenues] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);

    const { addToast } = useToast();
    const { confirm } = useConfirm();

    // Filters
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedScopeId, setSelectedScopeId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [clipboard, setClipboard] = useState(null);
    const [swapSource, setSwapSource] = useState(null);

    // UI State
    const [showVenueManager, setShowVenueManager] = useState(false);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [selectedVenue, setSelectedVenue] = useState(null);
    const [editingSession, setEditingSession] = useState(null); // For edit mode
    const [viewingSession, setViewingSession] = useState(null); // For details view
    const [showUnscheduledModal, setShowUnscheduledModal] = useState(false);
    const [showScheduledModal, setShowScheduledModal] = useState(false);

    // Clipboard Logic
    const handleCopy = () => {
        setClipboard({
            date: selectedDate,
            dateFormatted: new Date(selectedDate).toLocaleDateString()
        });
        addToast(`Copied schedule from ${new Date(selectedDate).toLocaleDateString()}`, 'info');
    };

    const handlePaste = async () => {
        if (!clipboard) return;

        const targetDateStr = new Date(selectedDate).toLocaleDateString();

        if (!await confirm(`REPLICATE ALL assignments from ${clipboard.dateFormatted} to ${targetDateStr}? This will copy schedules across all batches.`, 'Confirm Paste', 'warning')) return;

        try {
            const res = await api.post('/venues/sessions/copy', {
                fromDate: clipboard.date,
                toDate: selectedDate
                // Omitting scopeId copies the entire day's assignments
            });
            addToast(res.data.message, 'success');
            loadSessions();
        } catch (e) {
            addToast(e.response?.data?.error || "Failed to paste assignments", 'error');
        }
    };

    // Swap Logic
    const handleSwap = async (venue) => {
        if (!swapSource) {
            setSwapSource(venue);
            return;
        }

        if (swapSource.id === venue.id) {
            setSwapSource(null);
            return;
        }

        if (!await confirm(`Swap all assignments for ${new Date(selectedDate).toLocaleDateString()} between ${swapSource.name} and ${venue.name}?`, 'Confirm Swap', 'warning')) {
            setSwapSource(null);
            return;
        }

        try {
            await api.post('/venues/swap', {
                venueAId: swapSource.id,
                venueBId: venue.id,
                date: selectedDate
            });
            setSwapSource(null);
            addToast("Venues swapped successfully!", 'success');
            loadSessions();
        } catch (e) {
            addToast(e.response?.data?.error || "Failed to swap venues", 'error');
            setSwapSource(null);
        }
    };

    // College Period Timings (for reference display)
    const periods = [
        { label: 'Period 1', time: '8:45 - 10:25' },
        { label: 'Period 2', time: '10:40 - 12:25' },
        { label: 'Period 3', time: '1:30 - 3:10' },
        { label: 'Period 4', time: '3:25 - 4:20' },
    ];

    // Data Loading
    const loadVenues = async () => {
        try {
            const res = await api.get('/venues');
            setVenues(res.data);
        } catch (e) { console.error(e); }
    };

    const loadSessions = async () => {
        if (!selectedScopeId) return;
        setLoading(true);
        try {
            const res = await api.get('/venues/sessions', {
                params: {
                    scopeId: selectedScopeId,
                    start: new Date(selectedDate).toISOString(),
                    end: new Date(new Date(selectedDate).setHours(23, 59, 59)).toISOString(),
                    search: searchQuery // Add search parameter
                }
            });
            setSessions(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadVenues(); }, []);
    useEffect(() => {
        if (scopes?.length > 0 && !selectedScopeId) setSelectedScopeId(scopes[0].id);
    }, [scopes]);
    useEffect(() => { loadSessions(); }, [selectedDate, selectedScopeId, searchQuery]);

    // Get sessions for a venue on selected date (can be multiple)
    const getVenueSessions = (venueId) => {
        return sessions.filter(s => s.venueId === venueId);
    };

    const deleteSession = async (id) => {
        if (!await confirm("Remove this assignment?", 'Confirm Delete', 'danger')) return;
        try {
            await api.delete(`/venues/sessions/${id}`);
            addToast("Assignment removed successfully", 'success');
            loadSessions();
        } catch (e) { addToast("Failed to delete", 'error'); }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex gap-4 items-center">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Project Batch</label>
                        <select
                            className="block w-48 p-2 text-sm border rounded-lg font-bold"
                            value={selectedScopeId}
                            onChange={e => setSelectedScopeId(e.target.value)}
                        >
                            {scopes?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                        <input
                            type="date"
                            className="block w-40 p-2 text-sm border rounded-lg font-bold"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Search Details</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Venue, Faculty, Student..."
                                className="block w-64 pl-10 p-2 text-sm border rounded-lg font-bold"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-4">
                        <button
                            onClick={handleCopy}
                            className={`px-3 py-2 rounded-lg border transition-all flex items-center gap-2 text-xs font-bold ${clipboard?.date === selectedDate && clipboard?.scopeId === selectedScopeId ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}
                            title="Copy this day's assignments"
                        >
                            <Copy size={14} />
                            {clipboard?.date === selectedDate && clipboard?.scopeId === selectedScopeId ? 'Copied' : 'Copy Day'}
                        </button>

                        {clipboard && (
                            <button
                                onClick={handlePaste}
                                disabled={clipboard.date === selectedDate && clipboard.scopeId === selectedScopeId}
                                className="px-3 py-2 bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-600 hover:text-white transition-all flex items-center gap-2 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                title={`Paste from ${new Date(clipboard.date).toLocaleDateString()}`}
                            >
                                <ClipboardCheck size={14} />
                                Paste
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex gap-1.5">
                    <button
                        onClick={() => setShowScheduledModal(true)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-600 font-bold rounded-md hover:bg-green-100 border border-green-100"
                        title="View students assigned to venues today"
                    >
                        <CalendarCheck size={12} /> Scheduled
                    </button>
                    <button
                        onClick={() => setShowUnscheduledModal(true)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-pink-50 text-pink-600 font-bold rounded-md hover:bg-pink-100 border border-pink-100"
                        title="View students not in any venue today"
                    >
                        <CloudOff size={12} /> Unscheduled
                    </button>
                    <button
                        onClick={() => setShowVenueManager(true)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 text-slate-700 font-bold rounded-md hover:bg-slate-200"
                    >
                        <MapPin size={12} /> Manage Venues
                    </button>
                </div>
            </div>

            {/* Period Reference */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="text-xs font-bold text-blue-600 uppercase mb-2">College Periods (Reference)</div>
                <div className="flex flex-wrap gap-3">
                    {periods.map((p, i) => (
                        <span key={i} className="bg-white px-3 py-1.5 rounded-lg border border-blue-100 text-sm">
                            <span className="font-bold text-blue-800">{p.label}</span>
                            <span className="text-blue-500 ml-2">{p.time}</span>
                        </span>
                    ))}
                </div>
            </div>

            {/* Swap Mode Indicator */}
            {swapSource && (
                <div className="bg-orange-600 text-white p-3 rounded-xl shadow-xl flex justify-between items-center animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <ArrowLeftRight size={20} />
                        </div>
                        <p className="font-bold text-sm">
                            Swap Mode Active: Select another venue to swap with <span className="underline">{swapSource.name}</span>
                        </p>
                    </div>
                    <button onClick={() => setSwapSource(null)} className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold uppercase tracking-wider">
                        Cancel Swap
                    </button>
                </div>
            )}

            {/* Venues Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {venues.map(venue => {
                    const venueSessions = getVenueSessions(venue.id);
                    const isSelectedForSwap = swapSource?.id === venue.id;
                    return (
                        <div
                            key={venue.id}
                            className={`bg-white rounded-xl border-2 p-5 transition-all ${isSelectedForSwap ? 'border-orange-400 bg-orange-50/20 ring-4 ring-orange-100 shadow-lg scale-[1.02]' : venueSessions.length > 0 ? 'border-blue-200 shadow-md' : 'border-slate-100 hover:border-blue-100'}`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">{venue.name}</h3>
                                    <p className="text-xs text-slate-400">{venue.location} • Cap: {venue.capacity || 'N/A'}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleSwap(venue)}
                                        className={`p-1.5 rounded-lg transition-all ${isSelectedForSwap ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                                        title={isSelectedForSwap ? "Cancel Swap" : swapSource ? `Swap with ${swapSource.name}` : "Pick Venue to Swap"}
                                    >
                                        <ArrowLeftRight size={18} />
                                    </button>
                                    <button
                                        onClick={() => { setSelectedVenue(venue); setEditingSession(null); setShowBookingModal(true); }}
                                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                                        title="Add New Assignment"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>

                            {venueSessions.length > 0 ? (
                                <div className="space-y-4">
                                    {venueSessions.map((session, idx) => (
                                        <div key={session.id} className={`p-4 rounded-xl border ${idx > 0 ? 'border-dashed border-slate-200 pt-4' : 'bg-blue-50/50 border-blue-100'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <User size={16} className="text-blue-600" />
                                                    <span className="font-bold text-sm text-blue-800 truncate max-w-[150px]">{session.faculty?.name}</span>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => setViewingSession(session)}
                                                        className="text-slate-400 hover:text-blue-600 p-1"
                                                        title="View Details"
                                                    >
                                                        <Info size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => { setSelectedVenue(venue); setEditingSession(session); setShowBookingModal(true); }}
                                                        className="text-blue-400 hover:text-blue-600 p-1"
                                                        title="Edit Assignment"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteSession(session.id)}
                                                        className="text-red-400 hover:text-red-600 p-1"
                                                        title="Remove Assignment"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                <div className="flex justify-between items-center w-full mb-1">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                        Students ({session.students?.length || 0})
                                                    </span>
                                                    {(() => {
                                                        const completedCount = session.students?.filter(s => {
                                                            const team = s.teamMemberships?.[0]?.team;
                                                            const currentPhase = team?.submissionPhase || 1;
                                                            const latestReview = team?.reviews?.find(r => (r.reviewPhase || 0) === currentPhase);
                                                            const studentMark = latestReview?.reviewMarks?.find(m => m.studentId === s.id || m.userId === s.id);
                                                            return !!latestReview && studentMark && !studentMark.isAbsent;
                                                        }).length || 0;
                                                        return (
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${completedCount === session.students?.length ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                Reviews: {completedCount}/{session.students?.length || 0}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                {session.students?.slice(0, 4).map(s => (
                                                    <span key={s.id} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-medium truncate max-w-[100px]">
                                                        {s.name}
                                                    </span>
                                                ))}
                                                {session.students?.length > 4 && (
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">
                                                        +{session.students.length - 4}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center text-slate-300 italic text-sm">
                                    No staff assigned today
                                </div>
                            )}
                        </div>
                    );
                })}
                {venues.length === 0 && (
                    <div className="col-span-full p-8 text-center text-slate-400 bg-white rounded-xl border-2 border-dashed">
                        No venues found. Click "Manage Venues" to add one.
                    </div>
                )}
            </div>

            {/* Modals */}
            {showVenueManager && (
                <VenueManagerModal
                    onClose={() => { setShowVenueManager(false); loadVenues(); }}
                    venues={venues}
                />
            )}

            {showBookingModal && selectedVenue && (
                <BookingModal
                    venue={selectedVenue}
                    date={selectedDate}
                    scopeId={selectedScopeId}
                    periods={periods}
                    editingSession={editingSession}
                    onClose={() => { setShowBookingModal(false); setEditingSession(null); }}
                    onSuccess={() => { setShowBookingModal(false); setEditingSession(null); loadSessions(); }}
                />
            )}

            {viewingSession && (
                <SessionDetailsModal
                    session={viewingSession}
                    onClose={() => setViewingSession(null)}
                />
            )}

            {showUnscheduledModal && (
                <UnscheduledStudentsModal
                    date={selectedDate}
                    scopeId={selectedScopeId}
                    onClose={() => setShowUnscheduledModal(false)}
                />
            )}

            {showScheduledModal && (
                <ScheduledStudentsModal
                    sessions={sessions}
                    date={selectedDate}
                    onClose={() => setShowScheduledModal(false)}
                />
            )}
        </div>
    );
}

// Sub-components

function VenueManagerModal({ onClose, venues }) {
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [capacity, setCapacity] = useState('');
    const [localVenues, setLocalVenues] = useState(venues);

    const { addToast } = useToast();
    const { confirm } = useConfirm();

    const create = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/venues', { name, location, capacity: parseInt(capacity) || null });
            setLocalVenues([...localVenues, res.data]);
            setName(''); setLocation(''); setCapacity('');
            addToast("Venue created successfully!", 'success');
        } catch (err) {
            addToast(err.response?.data?.error || 'Failed to create venue', 'error');
        }
    };

    const remove = async (id) => {
        if (!await confirm("Delete venue?", 'Delete Venue', 'danger')) return;
        try {
            await api.delete(`/venues/${id}`);
            setLocalVenues(localVenues.filter(v => v.id !== id));
            addToast("Venue deleted successfully", 'success');
        } catch (err) {
            addToast(err.response?.data?.error || 'Failed to delete venue', 'error');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Manage Venues</h3>
                    <button onClick={onClose}><X size={20} /></button>
                </div>

                <form onSubmit={create} className="flex gap-2 mb-6">
                    <input required placeholder="Name (e.g. Lab 1)" className="border p-2 rounded flex-1" value={name} onChange={e => setName(e.target.value)} />
                    <input placeholder="Location" className="border p-2 rounded w-28" value={location} onChange={e => setLocation(e.target.value)} />
                    <input type="number" placeholder="Cap." className="border p-2 rounded w-16" value={capacity} onChange={e => setCapacity(e.target.value)} />
                    <button className="bg-slate-900 text-white p-2 rounded hover:bg-slate-800"><Plus size={20} /></button>
                </form>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {localVenues.map(v => (
                        <div key={v.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div>
                                <div className="font-bold text-sm">{v.name}</div>
                                <div className="text-xs text-slate-500">{v.location} • Cap: {v.capacity || 'N/A'}</div>
                            </div>
                            <button onClick={() => remove(v.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function BookingModal({ venue, date, scopeId, periods, editingSession, onClose, onSuccess }) {
    const [facultyList, setFacultyList] = useState([]);
    const [studentList, setStudentList] = useState([]);
    const [projectCategories, setProjectCategories] = useState([]);
    const [selectedFaculty, setSelectedFaculty] = useState(editingSession?.facultyId || '');
    const [selectedStudents, setSelectedStudents] = useState(editingSession?.students?.map(s => s.id) || []);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [showBulkAdd, setShowBulkAdd] = useState(false);
    const [bulkInput, setBulkInput] = useState('');

    const { addToast } = useToast();

    // Filters
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    const isEditMode = !!editingSession;

    useEffect(() => {
        api.get('/users', { params: { role: 'FACULTY', limit: 10000 } }).then(r => setFacultyList(r.data.users || r.data || []));
        // Fetch project categories
        api.get('/projects/categories').then(r => setProjectCategories(r.data || [])).catch(() => { });

        // Fetch students and teams in scope to show all students and their project info
        const fetchStudentsByScope = async () => {
            setLoading(true);
            try {
                // Parallel fetch students in this batch and teams in this batch
                const [usersRes, teamsRes] = await Promise.all([
                    api.get('/users', { params: { role: 'STUDENT', scopeId, limit: 10000 } }),
                    api.get('/admin/teams', { params: { scopeId, limit: 10000 } })
                ]);

                const students = usersRes.data.users || usersRes.data || [];
                const teams = teamsRes.data.teams || [];

                // Create a map of student ID to project category from teams
                const categoryMap = new Map();
                teams.forEach(team => {
                    const category = team.project?.category || '';
                    if (category) {
                        team.members?.forEach(member => {
                            if (member.user?.id) {
                                categoryMap.set(member.user.id, category);
                            }
                        });
                    }
                });

                // Attach category to student objects
                const mergedStudents = students.map(s => ({
                    ...s,
                    projectCategory: categoryMap.get(s.id) || ''
                }));

                setStudentList(mergedStudents);
            } catch (e) {
                console.error('Error fetching students:', e);
                setStudentList([]);
            } finally {
                setLoading(false);
            }
        };

        if (scopeId) {
            fetchStudentsByScope();
        } else {
            setStudentList([]);
            setLoading(false);
        }
    }, [scopeId]);

    // Get unique departments and categories from students
    const departments = [...new Set(studentList.map(s => s.department).filter(Boolean))].sort();
    const categoriesFromStudents = [...new Set(studentList.map(s => s.projectCategory).filter(Boolean))].sort();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Full day session: 8:45 AM to 4:20 PM
            const start = new Date(date);
            start.setHours(8, 45, 0, 0);
            const end = new Date(date);
            end.setHours(16, 20, 0, 0);

            if (isEditMode) {
                // Update existing session
                await api.put(`/venues/sessions/${editingSession.id}`, {
                    facultyId: selectedFaculty,
                    studentIds: selectedStudents
                });
                addToast("Assignment updated successfully!", 'success');
            } else {
                // Create new session
                await api.post('/venues/sessions', {
                    venueId: venue.id,
                    facultyId: selectedFaculty,
                    scopeId,
                    startTime: start.toISOString(),
                    endTime: end.toISOString(),
                    studentIds: selectedStudents
                });
                addToast("Assignment created successfully!", 'success');
            }
            onSuccess();
        } catch (err) {
            addToast(err.response?.data?.error || "Operation failed", 'error');
        }
    };

    const toggleStudent = (id) => {
        if (selectedStudents.includes(id)) setSelectedStudents(selectedStudents.filter(s => s !== id));
        else setSelectedStudents([...selectedStudents, id]);
    };

    // Apply all filters
    const filteredStudents = studentList.filter(s => {
        const matchesSearch = !searchTerm ||
            s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.rollNumber?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = !selectedDepartment || s.department === selectedDepartment;
        const matchesCategory = !selectedCategory || s.projectCategory === selectedCategory;
        return matchesSearch && matchesDept && matchesCategory;
    });

    // Select all filtered students
    const selectAllFiltered = () => {
        const filteredIds = filteredStudents.map(s => s.id);
        const newSelected = [...new Set([...selectedStudents, ...filteredIds])];
        setSelectedStudents(newSelected);
    };

    // Deselect all filtered students
    const deselectAllFiltered = () => {
        const filteredIds = new Set(filteredStudents.map(s => s.id));
        setSelectedStudents(selectedStudents.filter(id => !filteredIds.has(id)));
    };

    const handleBulkProcess = () => {
        const lines = bulkInput.split(/[\n,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
        if (lines.length === 0) {
            setShowBulkAdd(false);
            return;
        }

        const newSelected = [...selectedStudents];
        let foundCount = 0;
        let missed = [];

        lines.forEach(line => {
            const student = studentList.find(s =>
                s.rollNumber?.toLowerCase() === line ||
                s.email?.toLowerCase() === line
            );
            if (student) {
                if (!newSelected.includes(student.id)) {
                    newSelected.push(student.id);
                }
                foundCount++;
            } else {
                missed.push(line);
            }
        });

        setSelectedStudents(newSelected);
        setBulkInput('');
        setShowBulkAdd(false);

        let report = `Matched ${foundCount} students.`;
        if (missed.length > 0) report += ` Could not find: ${missed.join(', ')}`; // Changed newline to space for toast
        addToast(report, missed.length > 0 ? 'warning' : 'success');
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold">Assign {venue.name}</h3>
                        <p className="text-sm text-slate-500">{new Date(date).toDateString()} • Full Day (8:45 AM - 4:20 PM)</p>
                    </div>
                    <button onClick={onClose}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Faculty In-Charge</label>
                        <select required className="w-full border p-2.5 rounded-lg font-medium" value={selectedFaculty} onChange={e => setSelectedFaculty(e.target.value)}>
                            <option value="">-- Select Faculty --</option>
                            {facultyList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>

                    {/* Filters Section */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="text-xs font-bold text-slate-500 uppercase mb-3">Filter Students</div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Department</label>
                                <select
                                    className="w-full border p-2 rounded-lg text-sm"
                                    value={selectedDepartment}
                                    onChange={e => setSelectedDepartment(e.target.value)}
                                >
                                    <option value="">All Departments</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Project Category</label>
                                <select
                                    className="w-full border p-2 rounded-lg text-sm"
                                    value={selectedCategory}
                                    onChange={e => setSelectedCategory(e.target.value)}
                                >
                                    <option value="">All Categories</option>
                                    {categoriesFromStudents.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Search</label>
                                <input
                                    type="text"
                                    placeholder="Name or roll..."
                                    className="w-full border p-2 rounded-lg text-sm"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Students Selection */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase">
                                Select Students ({selectedStudents.length} selected)
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowBulkAdd(!showBulkAdd)}
                                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${showBulkAdd ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                                >
                                    {showBulkAdd ? 'Cancel Bulk' : 'Bulk Add'}
                                </button>
                                <button
                                    type="button"
                                    onClick={selectAllFiltered}
                                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium"
                                >
                                    Select All ({filteredStudents.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={deselectAllFiltered}
                                    className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-medium"
                                >
                                    Deselect All
                                </button>
                            </div>
                        </div>

                        {showBulkAdd && (
                            <div className="mb-4 p-4 bg-orange-50 border border-orange-100 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="text-xs font-bold text-orange-700 uppercase">Paste Roll Numbers or Emails</div>
                                <textarea
                                    className="w-full h-32 p-3 text-sm border-2 border-orange-200 rounded-lg focus:ring-0 focus:border-orange-500 font-mono"
                                    placeholder="Enter roll numbers or emails (comma, space or newline separated)..."
                                    value={bulkInput}
                                    onChange={e => setBulkInput(e.target.value)}
                                />
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleBulkProcess}
                                        disabled={!bulkInput.trim()}
                                        className="px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700 disabled:opacity-50"
                                    >
                                        Process & Select
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="border rounded-lg h-64 overflow-y-auto p-2 bg-slate-50 grid grid-cols-2 gap-2 relative">
                            {loading ? (
                                <div className="col-span-2 flex items-center justify-center p-8">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-sm text-slate-500 font-medium">Loading students...</p>
                                    </div>
                                </div>
                            ) : filteredStudents.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => toggleStudent(s.id)}
                                    className={`p-3 rounded border cursor-pointer transition-all flex items-center gap-2 ${selectedStudents.includes(s.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                                >
                                    <input type="checkbox" checked={selectedStudents.includes(s.id)} readOnly className="pointer-events-none" />
                                    <div className="truncate flex-1">
                                        <div className="text-sm font-medium truncate">{s.name}</div>
                                        <div className={`text-xs truncate ${selectedStudents.includes(s.id) ? 'text-blue-100' : 'text-slate-400'}`}>
                                            {s.rollNumber} {s.department && `• ${s.department}`}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {!loading && filteredStudents.length === 0 && <p className="col-span-2 text-center text-slate-400 py-4">No students found matching filters</p>}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" disabled={!selectedFaculty || selectedStudents.length === 0} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed">
                            Assign Faculty & Students
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function SessionDetailsModal({ session, onClose }) {
    const [projectFilter, setProjectFilter] = useState('ALL'); // 'ALL', 'WITH_PROJECT', 'NO_PROJECT'
    const [reviewFilter, setReviewFilter] = useState('ALL'); // 'ALL', 'COMPLETED', 'PENDING'
    const { addToast } = useToast();

    if (!session) return null;

    const copyToClipboard = (text, label) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        addToast(`Copied ${label} to clipboard!`, 'info');
    };

    // Filter students based on filters
    const filteredStudents = session.students?.filter(s => {
        const team = s.teamMemberships?.[0]?.team;
        const hasProject = !!team?.project;

        // Updated phase-aware logic
        const currentPhase = team?.submissionPhase || 1;
        const latestReview = team?.reviews?.find(r => (r.reviewPhase || 0) === currentPhase);
        const studentMark = latestReview?.reviewMarks?.find(m => m.studentId === s.id || m.userId === s.id);

        const isCompleted = !!latestReview && studentMark && !studentMark.isAbsent;
        const isAbsent = !!latestReview && studentMark?.isAbsent === true;
        const isMissed = (isAbsent || !latestReview) && new Date(session.endTime) < new Date();

        // Project Filter
        if (projectFilter === 'WITH_PROJECT' && !hasProject) return false;
        if (projectFilter === 'NO_PROJECT' && hasProject) return false;

        // Review Filter
        if (reviewFilter === 'COMPLETED' && !isCompleted) return false;
        if (reviewFilter === 'PENDING' && isCompleted) return false; // Pending = NOT completed (includes missed)
        if (reviewFilter === 'MISSED' && !isMissed) return false;

        return true;
    }) || [];

    const copyAllEmails = () => {
        const emails = filteredStudents.map(s => s.email).filter(Boolean).join(', ');
        copyToClipboard(emails, `${filteredStudents.length} student emails`);
    };

    const copyAllRollNumbers = () => {
        const rolls = filteredStudents.map(s => s.rollNumber).filter(Boolean).join(', ');
        copyToClipboard(rolls, `${filteredStudents.length} student roll numbers`);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-6 border-b pb-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">{session.venue?.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            {new Date(session.startTime).toDateString()} • {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                </div>

                <div className="space-y-6">
                    {/* Faculty Details */}
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <div className="flex items-start gap-4">
                            <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                                <User size={24} />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-lg text-slate-800">{session.faculty?.name}</h4>
                                <div className="flex flex-col gap-1 mt-1">
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <span className="font-semibold w-16">Email:</span>
                                        <span>{session.faculty?.email}</span>
                                        <button
                                            onClick={() => copyToClipboard(session.faculty?.email, "faculty email")}
                                            className="ml-auto text-blue-500 hover:text-blue-700 text-xs font-bold uppercase flex items-center gap-1"
                                        >
                                            <Copy size={12} /> Copy
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <span className="font-semibold w-16">ID:</span>
                                        <span>{session.faculty?.rollNumber || session.faculty?.id?.split('-')[0]}</span> {/* Showing Roll No if available, else partial ID */}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Students Details */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                <Users size={18} />
                                Assigned Students
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                                    {filteredStudents.length}{projectFilter !== 'ALL' && ` / ${session.students?.length || 0}`}
                                </span>
                            </h4>
                            <div className="flex gap-2">
                                <button
                                    onClick={copyAllEmails}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                                    title="Copy all emails comma-separated"
                                >
                                    <Copy size={12} /> Emails
                                </button>
                                <button
                                    onClick={copyAllRollNumbers}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                                    title="Copy all roll numbers comma-separated"
                                >
                                    <Copy size={12} /> Roll Nos
                                </button>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-col gap-3 mb-4">
                            {/* Project Filter */}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider w-20">Project:</span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setProjectFilter('ALL')}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${projectFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => setProjectFilter('WITH_PROJECT')}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${projectFilter === 'WITH_PROJECT' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                                    >
                                        With Project
                                    </button>
                                    <button
                                        onClick={() => setProjectFilter('NO_PROJECT')}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${projectFilter === 'NO_PROJECT' ? 'bg-pink-600 text-white' : 'bg-pink-50 text-pink-600 hover:bg-pink-100'}`}
                                    >
                                        No Project
                                    </button>
                                </div>
                            </div>

                            {/* Review Filter */}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider w-20">Review:</span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setReviewFilter('ALL')}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${reviewFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => setReviewFilter('COMPLETED')}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${reviewFilter === 'COMPLETED' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                    >
                                        Completed
                                    </button>
                                    <button
                                        onClick={() => setReviewFilter('PENDING')}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${reviewFilter === 'PENDING' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                                    >
                                        Pending
                                    </button>
                                    <button
                                        onClick={() => setReviewFilter('MISSED')}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${reviewFilter === 'MISSED' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                                    >
                                        Missed
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="border rounded-xl overflow-hidden">
                            <div className="max-h-60 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">Roll No</th>
                                            <th className="px-4 py-3">Name</th>
                                            <th className="px-4 py-3">Project</th>
                                            <th className="px-4 py-3">Review</th>
                                            <th className="px-4 py-3">Email</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredStudents.map((student, idx) => {
                                            const team = student.teamMemberships?.[0]?.team;
                                            const project = team?.project;
                                            // Find latest review and matching marks for this student
                                            // Updated phase-aware logic
                                            const currentPhase = team?.submissionPhase || 1;
                                            const latestReview = team?.reviews?.find(r => (r.reviewPhase || 0) === currentPhase);
                                            const studentMark = latestReview?.reviewMarks?.find(m => m.studentId === student.id || m.userId === student.id);

                                            const isCompleted = !!latestReview && studentMark && !studentMark.isAbsent;
                                            const isAbsent = !!latestReview && studentMark?.isAbsent === true;
                                            const isMissed = (isAbsent || !latestReview) && new Date(session.endTime) < new Date();

                                            return (
                                                <tr key={student.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{student.rollNumber || '-'}</td>
                                                    <td className="px-4 py-3 font-medium text-slate-700">{student.name}</td>
                                                    <td className="px-4 py-3">
                                                        {project ? (
                                                            <div>
                                                                <div className="font-medium text-slate-700 truncate max-w-[180px]" title={project.title}>{project.title}</div>
                                                                <div className="text-[10px] text-slate-400 uppercase">{project.category}</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 italic">No Project</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {isCompleted ? (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold w-fit">
                                                                    <ClipboardCheck size={10} /> Completed
                                                                </span>
                                                                {studentMark?.marks !== undefined && (
                                                                    <span className="text-[10px] font-mono font-bold text-slate-500 ml-1">
                                                                        Marks: {studentMark.marks} (Phase {latestReview.reviewPhase || '?'})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : isMissed ? (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold w-fit">
                                                                    <AlertCircle size={10} /> Missed Slot
                                                                </span>
                                                                {isAbsent && (
                                                                    <span className="text-[9px] text-red-500 font-bold ml-1 uppercase">Marked Absent</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold">
                                                                <Info size={10} /> Pending
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500">{student.email}</td>
                                                </tr>
                                            );
                                        })}
                                        {filteredStudents.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="px-4 py-8 text-center text-slate-400 italic">
                                                    {projectFilter === 'ALL' ? 'No students assigned' : 'No students match filter'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function UnscheduledStudentsModal({ date, scopeId, onClose }) {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { addToast } = useToast();

    useEffect(() => {
        const fetchUnscheduled = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await api.get('/venues/sessions/unassigned', {
                    params: { date, scopeId }
                });
                setStudents(res.data);
            } catch (err) {
                console.error(err);
                setError('Failed to load unscheduled students');
            } finally {
                setLoading(false);
            }
        };

        if (date && scopeId) {
            fetchUnscheduled();
        }
    }, [date, scopeId]);

    const copyToClipboard = (text, label) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        addToast(`Copied ${label} to clipboard!`, 'info');
    };

    const copyEmails = () => {
        const emails = students.map(s => s.email).filter(Boolean).join(', ');
        copyToClipboard(emails, `${students.length} emails`);
    };

    const copyRollNumbers = () => {
        const rolls = students.map(s => s.rollNumber).filter(Boolean).join(', ');
        copyToClipboard(rolls, `${students.length} roll numbers`);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                            <CloudOff className="text-pink-500" />
                            Unscheduled Students
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Students in this batch NOT assigned to any venue on {new Date(date).toDateString()}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                </div>

                {/* Toolbar */}
                <div className="flex gap-3 mb-4">
                    <button
                        onClick={copyEmails}
                        disabled={students.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 font-bold rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                    >
                        <Copy size={16} /> Copy Emails
                    </button>
                    <button
                        onClick={copyRollNumbers}
                        disabled={students.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
                    >
                        <Copy size={16} /> Copy Roll Numbers
                    </button>
                    <div className="ml-auto px-4 py-2 bg-slate-50 rounded-lg text-sm font-bold text-slate-500">
                        Total: {students.length}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto border rounded-xl bg-slate-50 relative">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-slate-500 font-bold text-sm">Finding students...</span>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center text-red-500 font-bold">{error}</div>
                    ) : students.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 font-bold flex flex-col items-center gap-2">
                            <ClipboardCheck size={48} className="text-green-400 mb-2" />
                            All students are scheduled!
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200">
                            {students.map((student, idx) => (
                                <div key={student.id} className="p-3 bg-white hover:bg-slate-50 flex items-center gap-4 transition-colors">
                                    <div className="font-mono text-xs text-slate-400 w-8">{idx + 1}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-800 text-sm truncate">{student.name}</div>
                                        <div className="text-xs text-slate-500 truncate">{student.email}</div>
                                    </div>
                                    <div className="w-32 hidden sm:block">
                                        <div className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded w-fit">
                                            {student.rollNumber || 'N/A'}
                                        </div>
                                    </div>
                                    <div className="w-48 hidden md:block text-right">
                                        <div className="text-xs font-bold text-slate-700 truncate" title={student.projectTitle}>{student.projectTitle || 'No Project'}</div>
                                        <div className="text-[10px] text-slate-400 uppercase font-bold">{student.projectCategory}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ScheduledStudentsModal({ sessions, date, onClose }) {
    const [reviewFilter, setReviewFilter] = useState('ALL'); // 'ALL', 'COMPLETED', 'PENDING'
    const { addToast } = useToast();

    // Aggregate all students from all sessions
    const aggregatedStudentsRaw = [];
    const seenIds = new Set();

    sessions.forEach(session => {
        session.students?.forEach(student => {
            if (!seenIds.has(student.id)) {
                seenIds.add(student.id);
                aggregatedStudentsRaw.push({
                    ...student,
                    venueName: session.venue?.name || 'N/A',
                    facultyName: session.faculty?.name || 'N/A',
                    endTimeOriginal: session.endTime, // Store for "Missed" calculation
                    time: `${new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                });
            }
        });
    });

    // Apply Filter
    const aggregatedStudents = aggregatedStudentsRaw.filter(student => {
        const team = student.teamMemberships?.[0]?.team;

        // Find if this specific student has a completed review and if they were present
        // Updated phase-aware logic
        const currentPhase = team?.submissionPhase || 1;
        const latestReview = team?.reviews?.find(r => (r.reviewPhase || 0) === currentPhase);
        const studentMark = latestReview?.reviewMarks?.find(m => m.studentId === student.id || m.userId === student.id);

        const isCompleted = !!latestReview && studentMark && !studentMark.isAbsent;
        const isAbsent = !!latestReview && studentMark?.isAbsent === true;
        const isMissed = (isAbsent || !latestReview) && new Date(student.endTimeOriginal) < new Date();

        if (reviewFilter === 'COMPLETED' && !isCompleted) return false;
        if (reviewFilter === 'PENDING' && isCompleted) return false; // Pending = NOT completed (includes missed)
        if (reviewFilter === 'MISSED' && !isMissed) return false;
        return true;
    });

    // Sort by roll number
    aggregatedStudents.sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''));

    const copyToClipboard = (text, label) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        addToast(`Copied ${label} to clipboard!`, 'info');
    };

    const copyEmails = () => {
        const emails = aggregatedStudents.map(s => s.email).filter(Boolean).join(', ');
        copyToClipboard(emails, `${aggregatedStudents.length} emails`);
    };

    const copyRollNumbers = () => {
        const rolls = aggregatedStudents.map(s => s.rollNumber).filter(Boolean).join(', ');
        copyToClipboard(rolls, `${aggregatedStudents.length} roll numbers`);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                            <CalendarCheck className="text-green-500" />
                            Scheduled Students
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Students assigned to venues on {new Date(date).toDateString()}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                </div>

                {/* Toolbar */}
                <div className="flex flex-col gap-3 mb-4">
                    <div className="flex gap-3">
                        <button
                            onClick={copyEmails}
                            disabled={aggregatedStudents.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 font-bold rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors text-xs"
                        >
                            <Copy size={16} /> Copy Emails
                        </button>
                        <button
                            onClick={copyRollNumbers}
                            disabled={aggregatedStudents.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors text-xs"
                        >
                            <Copy size={16} /> Copy Roll Numbers
                        </button>
                        <div className="ml-auto px-4 py-2 bg-slate-50 rounded-lg text-sm font-bold text-slate-500">
                            Showing: {aggregatedStudents.length} / {aggregatedStudentsRaw.length}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Filter Review:</span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setReviewFilter('ALL')}
                                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${reviewFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setReviewFilter('COMPLETED')}
                                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${reviewFilter === 'COMPLETED' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                            >
                                Completed
                            </button>
                            <button
                                onClick={() => setReviewFilter('PENDING')}
                                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${reviewFilter === 'PENDING' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                            >
                                Pending
                            </button>
                            <button
                                onClick={() => setReviewFilter('MISSED')}
                                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${reviewFilter === 'MISSED' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                            >
                                Missed
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto border rounded-xl bg-slate-50 p-4">
                    <div className="space-y-2">
                        {aggregatedStudents.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 font-bold flex flex-col items-center gap-2">
                                <CloudOff size={48} className="text-pink-400 mb-2" />
                                No students match the selected filters.
                            </div>
                        ) : (
                            aggregatedStudents.map((student, idx) => (
                                <div key={student.id} className="flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-xl hover:shadow-md transition-shadow">
                                    <div className="w-8 text-xs font-bold text-slate-300">#{idx + 1}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-800 text-sm truncate">{student.name}</div>
                                        <div className="text-xs text-slate-500 truncate">{student.email}</div>
                                    </div>
                                    <div className="w-32 hidden sm:block">
                                        <div className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded w-fit">
                                            {student.rollNumber || 'N/A'}
                                        </div>
                                    </div>
                                    <div className="w-32 hidden sm:block">
                                        {(() => {
                                            const team = student.teamMemberships?.[0]?.team;

                                            // Updated phase-aware logic
                                            const currentPhase = team?.submissionPhase || 1;
                                            const latestReview = team?.reviews?.find(r => (r.reviewPhase || 0) === currentPhase);
                                            const studentMark = latestReview?.reviewMarks?.find(m => m.studentId === student.id || m.userId === student.id);

                                            const isCompleted = !!latestReview && studentMark && !studentMark.isAbsent;
                                            const isAbsent = !!latestReview && studentMark?.isAbsent === true;
                                            const isMissed = (isAbsent || !latestReview) && new Date(student.endTimeOriginal) < new Date();

                                            if (isCompleted) {
                                                return (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[9px] font-black uppercase tracking-tighter w-fit">
                                                            <ClipboardCheck size={10} /> Completed
                                                        </span>
                                                        {studentMark?.marks !== undefined && (
                                                            <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap">
                                                                {studentMark.marks} Marks • P{latestReview.reviewPhase}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            if (isMissed) {
                                                return (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-tighter w-fit">
                                                            <AlertCircle size={10} /> Missed Slot
                                                        </span>
                                                        {isAbsent && (
                                                            <span className="text-[8px] text-red-500 font-bold ml-1 uppercase">Marked Absent</span>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            return (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[9px] font-black uppercase tracking-tighter">
                                                    <Info size={10} /> Pending
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <div className="w-36 hidden md:block">
                                        <div className="text-xs font-bold text-green-700 truncate">{student.venueName}</div>
                                        <div className="text-[10px] text-slate-400 font-medium">{student.time}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
