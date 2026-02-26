import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { Layout, Calendar, ArrowRight } from 'lucide-react';
import StudentScheduleTab from '../components/student/StudentScheduleTab';

export default function StudentDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [myScopes, setMyScopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('batches');

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
    const pollInterval = setInterval(loadData, 60000);
    return () => clearInterval(pollInterval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar variant="light" compact />

      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {user?.name.split(' ')[0]}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Your project batches and lab schedule.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('batches')}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'batches'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Layout size={14} /> Batches
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'schedule'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Calendar size={14} /> Schedule
            </button>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Batch Grid */}
        {activeTab === 'batches' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-48 bg-white rounded-lg border border-gray-200 animate-pulse" />
              ))
            ) : myScopes.length > 0 ? (
              myScopes.map(scope => (
                <div
                  key={scope.id}
                  onClick={() => navigate(`/student/batch/${scope.id}`)}
                  className="group bg-white rounded-lg border border-gray-200 p-6 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-2.5 rounded-lg ${scope.isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-red-50 text-red-500'
                        }`}>
                        <Layout size={18} />
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${scope.isActive
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-600 border border-red-200'
                        }`}>
                        {scope.isActive ? 'Active' : 'Archived'}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                      {scope.name}
                    </h3>
                    {scope.type && <p className="text-xs text-gray-400">{scope.type}</p>}
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs text-gray-400 group-hover:text-blue-500 transition-colors font-medium">
                      View
                    </span>
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-16 text-center bg-white rounded-lg border-2 border-dashed border-gray-200">
                <Layout className="text-gray-300 mx-auto mb-3" size={28} />
                <h3 className="text-base font-semibold text-gray-700 mb-1">No batches yet</h3>
                <p className="text-sm text-gray-400">
                  Contact your coordinator to get assigned to a batch.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && <StudentScheduleTab />}
      </div>
    </div>
  );
}
