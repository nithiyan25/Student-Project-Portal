import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { Filter, Users, Calendar, Layout } from 'lucide-react';
import StudentScheduleTab from '../components/student/StudentScheduleTab';

export default function StudentDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [myScopes, setMyScopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('batches'); // batches | schedule

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/scopes/my-scopes').catch(() => ({ data: [] }));
      setMyScopes(res.data || []);
    } catch (e) {
      console.error('Error loading scopes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Background polling for live updates (60 seconds)
    const pollInterval = setInterval(loadData, 60000);
    return () => clearInterval(pollInterval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar variant="light" compact />

      <div className="p-8 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-800">Welcome, {user?.name.split(' ')[0]}!</h1>
          <p className="text-gray-500">Manage your project batches and view your lab schedule.</p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-white p-1 rounded-xl w-fit border border-gray-100 shadow-sm">
          <button
            onClick={() => setActiveTab('batches')}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'batches' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Layout size={16} /> My Batches
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'schedule' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Calendar size={16} /> Lab Schedule
          </button>
        </div>

        {/* Batch Grid */}
        {activeTab === 'batches' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom duration-500">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse"></div>)
            ) : myScopes.length > 0 ? (
              myScopes.map(scope => (
                <div
                  key={scope.id}
                  onClick={() => navigate(`/student/batch/${scope.id}`)}
                  className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-48 cursor-pointer hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className={`p-2 rounded-lg transition-colors ${scope.isActive ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white' : 'bg-red-50 text-red-500'}`}>
                        <Filter size={20} />
                      </span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${scope.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {scope.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-700 transition-colors">{scope.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">{scope.type}</p>
                  </div>

                  <div className="pt-4 border-t border-gray-50 flex justify-between items-center text-xs font-bold text-gray-400 group-hover:text-gray-600">
                    <span>Open Dashboard</span>
                    <Users size={16} />
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border-2 border-dashed border-gray-200">
                <p className="text-gray-400 font-bold text-lg">No batches assigned yet.</p>
                <p className="text-gray-400 text-sm mt-1">Please contact your administrator.</p>
              </div>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <StudentScheduleTab />
        )}

      </div>
    </div>
  );
}
