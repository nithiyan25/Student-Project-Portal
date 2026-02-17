import React, { useState, useEffect, useContext } from 'react';
import api from '../../api';
import { Calendar, Clock, MapPin, Search } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';

export default function StudentScheduleTab() {
    const { user } = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState('today'); // today | upcoming | history
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchMySchedule = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

            let start, end;
            if (activeTab === 'today') {
                start = startOfDay.toISOString();
                end = endOfDay.toISOString();
            } else if (activeTab === 'upcoming') {
                const tomorrow = new Date(startOfDay);
                tomorrow.setDate(tomorrow.getDate() + 1);
                start = tomorrow.toISOString();
                end = new Date(now.getFullYear() + 1, 0, 1).toISOString();
            } else {
                const yesterdayEnd = new Date(startOfDay);
                yesterdayEnd.setMilliseconds(-1);
                start = new Date(now.getFullYear() - 1, 0, 1).toISOString();
                end = yesterdayEnd.toISOString();
            }

            const res = await api.get('/venues/sessions', { params: { start, end } });

            // Filter where current user is in session.students
            const mySessions = res.data.filter(s => s.students?.some(student => student.id === user?.id));

            // Sort sessions: Newest first for History, Chronological for others
            const sortedSessions = mySessions.sort((a, b) => {
                const dateA = new Date(a.startTime);
                const dateB = new Date(b.startTime);
                return activeTab === 'history' ? dateB - dateA : dateA - dateB;
            });

            setSessions(sortedSessions);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMySchedule();
        // Background polling for live updates (30 seconds)
        const pollInterval = setInterval(fetchMySchedule, 30000);
        return () => clearInterval(pollInterval);
    }, [activeTab]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Tabs */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('today')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'today' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Today
                </button>
                <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'upcoming' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Upcoming
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    History
                </button>
            </div>



            {/* List */}
            <div className="grid gap-4">
                {sessions.length === 0 && !loading && (
                    <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                        No {activeTab} lab sessions found.
                    </div>
                )}

                {sessions.map(session => (
                    <div key={session.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col md:flex-row justify-between gap-6">

                            {/* Time & Venue */}
                            <div className="flex gap-4 items-start min-w-[200px]">
                                <div className="p-3 rounded-lg bg-green-50 text-green-600">
                                    <Calendar size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-slate-800">{new Date(session.startTime).toDateString()}</h4>
                                    <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                                        <Clock size={14} />
                                        <span>
                                            {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                            {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-600 font-bold text-sm mt-2">
                                        <MapPin size={14} />
                                        {session.venue.name}
                                    </div>
                                </div>
                            </div>

                            {/* Faculty Info */}
                            <div className="flex-1 border-l pl-6 border-slate-100">
                                <h5 className="text-xs font-bold text-slate-400 uppercase mb-2">Faculty In-Charge</h5>
                                <div className="text-sm font-bold text-slate-800">{session.faculty.name}</div>
                                <div className="text-xs text-slate-500">{session.faculty.email}</div>

                                <div className="mt-4">
                                    <h5 className="text-xs font-bold text-slate-400 uppercase mb-1">Session Title</h5>
                                    <div className="text-sm text-slate-700">{session.title || "Regular Lab Session"}</div>
                                </div>
                            </div>

                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
