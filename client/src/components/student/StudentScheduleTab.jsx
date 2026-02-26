import React, { useState, useEffect, useContext } from 'react';
import api from '../../api';
import { Calendar, Clock, MapPin } from 'lucide-react';
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
        const pollInterval = setInterval(fetchMySchedule, 30000);
        return () => clearInterval(pollInterval);
    }, [activeTab]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('today')}
                    className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 ${activeTab === 'today' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Today's Sessions
                </button>
                <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 ${activeTab === 'upcoming' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Upcoming
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    History
                </button>
            </div>

            {/* List */}
            <div className="grid gap-6">
                {sessions.length === 0 && !loading && (
                    <div className="py-16 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        <Calendar size={32} className="mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500 font-medium">No lab sessions found for this period.</p>
                    </div>
                )}

                {sessions.map(session => (
                    <div key={session.id} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between gap-6 group">
                        <div className="flex gap-5 items-start">
                            <div className="p-3 rounded-lg bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                <Calendar size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900">{new Date(session.startTime).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</h4>
                                <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                                    <Clock size={14} />
                                    <span>
                                        {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm mt-3">
                                    <MapPin size={14} />
                                    {session.venue.name}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 md:border-l md:pl-8 border-gray-100 flex flex-col justify-center">
                            <div className="mb-4">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Session Title</p>
                                <p className="text-sm font-semibold text-gray-800">{session.title || "Regular Lab Session"}</p>
                            </div>

                            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center font-bold text-gray-400 border border-gray-100 text-xs">
                                    {session.faculty.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-900 leading-none">{session.faculty.name}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">{session.faculty.email}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
