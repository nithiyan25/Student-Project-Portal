import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { Search, MessageSquare, CheckCircle, Clock, AlertCircle, Copy, Users, UserCheck, UserX, FileText, Layout, ArrowRight, ShieldCheck } from 'lucide-react';

export default function FacultyDashboard() {
  const { user: currentUser } = useContext(AuthContext);
  const [assignments, setAssignments] = useState([]); // Reviews assigned by Admin
  const [mentoredTeams, setMentoredTeams] = useState([]); // Teams where I am Guide/Expert
  const [requests, setRequests] = useState([]); // Pending requests

  const [filteredItems, setFilteredItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PENDING, COMPLETED
  const [activeDashboardTab, setActiveDashboardTab] = useState('OVERVIEW'); // OVERVIEW, REQUESTS, ASSIGNMENTS, MENTORED, STUDENTS
  const [scopes, setScopes] = useState([]);
  const [selectedScopeId, setSelectedScopeId] = useState(null);

  // Review Form States (for Assignments)
  const [expandedId, setExpandedId] = useState(null);
  const [reviewText, setReviewText] = useState("");
  const [reviewStatus, setReviewStatus] = useState("NOT_COMPLETED");
  const [individualMarks, setIndividualMarks] = useState({});
  const [rubric, setRubric] = useState(null); // Active rubric for current expanded assignment
  const [rubricMarks, setRubricMarks] = useState({}); // { studentId: { criterionName: marks } }

  const loadData = () => {
    Promise.all([
      api.get('/reviews/assignments').catch(e => ({ data: { teams: [] } })),
      api.get('/faculty/requests').catch(e => ({ data: [] })),
      api.get('/faculty/my-teams').catch(e => ({ data: [] })),
      api.get('/scopes').catch(e => ({ data: [] }))
    ]).then(([resAssign, resReq, resTeams, resScopes]) => {
      const assignData = Array.isArray(resAssign.data?.teams) ? resAssign.data.teams : (Array.isArray(resAssign.data) ? resAssign.data : []);
      const reqData = Array.isArray(resReq.data) ? resReq.data : [];
      const teamData = Array.isArray(resTeams.data) ? resTeams.data : [];
      const scopeData = Array.isArray(resScopes.data) ? resScopes.data : [];

      setAssignments(assignData);
      setRequests(reqData);
      setMentoredTeams(teamData);
      setScopes(scopeData);
    }).catch(err => console.error("Failed to load dashboard data", err));
  };

  useEffect(() => { loadData(); }, []);

  // Filter Logic based on Active Tab
  useEffect(() => {
    const lowerTerm = searchTerm.toLowerCase();
    let sourceData = [];

    if (activeDashboardTab === 'ASSIGNMENTS') sourceData = assignments;
    else if (activeDashboardTab === 'MENTORED') sourceData = mentoredTeams;
    else if (activeDashboardTab === 'REQUESTS') sourceData = requests;

    const filtered = sourceData.filter(item => {
      const title = item.project?.title || "Untitled";
      const members = item.members || [];
      const itemStatus = item.status || 'PENDING';
      const scopeId = item.project?.scopeId || item.scopeId;

      const matchesSearch = !searchTerm ||
        title.toLowerCase().includes(lowerTerm) ||
        members.some(m => m.user.name.toLowerCase().includes(lowerTerm) || (m.user.rollNumber && m.user.rollNumber.toLowerCase().includes(lowerTerm)));

      const matchesStatus = statusFilter === 'ALL' ||
        (statusFilter === 'COMPLETED' ? itemStatus === 'COMPLETED' : itemStatus !== 'COMPLETED');

      const matchesScope = !selectedScopeId || scopeId === selectedScopeId;

      return matchesSearch && matchesStatus && matchesScope;
    });

    setFilteredItems(filtered);
  }, [searchTerm, statusFilter, activeDashboardTab, assignments, mentoredTeams, requests, selectedScopeId]);

  const handleRespondRequest = async (teamId, requestType, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;
    try {
      await api.post('/faculty/respond', { teamId, requestType, action });
      alert(`Request ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`);
      loadData();
    } catch (e) {
      alert(e.response?.data?.error || "Error processing request");
    }
  };

  const toggleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setReviewText("");
      setIndividualMarks({});
      setRubric(null);
      setRubricMarks({});
    } else {
      setExpandedId(id);
      const item = assignments.find(a => a.id === id);
      if (item) {
        setReviewStatus(item.status || "NOT_COMPLETED");
        // Fetch Rubric
        if (item.project?.category && item.assignedPhase) {
          try {
            const res = await api.get('/rubrics/find', {
              params: { category: item.project.category, phase: item.assignedPhase }
            });
            setRubric(res.data);
            // Initialize rubric marks structure
            const initialRubricMarks = {};
            const initialTotalMarks = {};
            item.members.forEach(m => {
              if (m.approved) {
                initialRubricMarks[m.user.id] = {};
                // If previous review exists, maybe load it? (Not implemented for fresh review creation usually)
              }
            });
            setRubricMarks(initialRubricMarks);
          } catch (e) {
            setRubric(null);
            console.log("No rubric found, falling back to manual marks");
          }
        } else {
          setRubric(null);
        }
      }
    }
  };

  const submitReview = async (e, teamId, projectId, phase) => {
    if (e) e.stopPropagation();
    if (!reviewText.trim()) return alert("Please write a review.");

    try {
      const marksPayload = Object.entries(individualMarks).map(([studentId, marks]) => ({
        studentId,
        marks: parseInt(marks),
        criterionMarks: rubric ? (rubricMarks[studentId] || {}) : null
      }));

      await api.post('/reviews', {
        teamId,
        projectId,
        content: reviewText,
        status: reviewStatus,
        individualMarks: marksPayload,
        reviewPhase: phase || 1
      });

      setReviewText("");
      setIndividualMarks({});
      setRubricMarks({});
      setRubric(null);
      setExpandedId(null);
      loadData();
      alert("Review submitted!");
    } catch (e) {
      alert(e.response?.data?.error || "Error submitting review");
    }
  };

  const getStatusBadge = (status) => {
    const s = status || 'PENDING';
    const styles = {
      COMPLETED: "bg-green-100 text-green-700 border-green-200",
      IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
      NOT_COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
      CHANGES_REQUIRED: "bg-orange-100 text-orange-700 border-orange-200",
      READY_FOR_REVIEW: "bg-purple-100 text-purple-700 border-purple-200",
      PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200"
    };
    return (
      <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${styles[s] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
        {s.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar variant="light" compact />
      <div className="p-6 md:p-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Faculty Dashboard</h2>
            <p className="text-gray-500 text-sm">Manage reviews, requests, and mentored teams.</p>
          </div>

          {currentUser?.isTemporaryAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-700 transition-all hover:-translate-y-0.5"
            >
              <ShieldCheck size={18} /> Enter Admin Mode
            </Link>
          )}

          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            {(activeDashboardTab === 'ASSIGNMENTS' || activeDashboardTab === 'MENTORED') && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 ring-blue-500 outline-none shadow-sm bg-white text-sm font-bold text-gray-600"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="COMPLETED">Completed</option>
              </select>
            )}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 ring-blue-500 outline-none shadow-sm bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-8 border-b border-gray-200 pb-1">
          <button
            onClick={() => { setActiveDashboardTab('OVERVIEW'); setStatusFilter('ALL'); setSelectedScopeId(null); }}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeDashboardTab === 'OVERVIEW' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Layout size={16} /> Overview
          </button>
          {requests.length > 0 && (
            <button
              onClick={() => { setActiveDashboardTab('REQUESTS'); setStatusFilter('ALL'); }}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeDashboardTab === 'REQUESTS' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <AlertCircle size={16} /> Pending Requests ({requests.length})
            </button>
          )}
          <button
            onClick={() => { setActiveDashboardTab('ASSIGNMENTS'); setStatusFilter('ALL'); }}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeDashboardTab === 'ASSIGNMENTS' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <FileText size={16} /> Review Assignments
          </button>
          <button
            onClick={() => { setActiveDashboardTab('MENTORED'); setStatusFilter('ALL'); }}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeDashboardTab === 'MENTORED' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Users size={16} /> Mentored Teams
          </button>
          <button
            onClick={() => { setActiveDashboardTab('STUDENTS'); setStatusFilter('ALL'); }}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeDashboardTab === 'STUDENTS' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Copy size={16} /> Student Directory
          </button>

          {selectedScopeId && (
            <div className="ml-auto flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 mb-1">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">
                Batch: {scopes.find(s => s.id === selectedScopeId)?.name}
              </span>
              <button
                onClick={() => setSelectedScopeId(null)}
                className="text-indigo-400 hover:text-indigo-600"
              >
                <UserX size={14} />
              </button>
            </div>
          )}
        </div>

        {/* CONTENT AREA */}
        <div className="space-y-4">

          {/* OVERVIEW (Batch Cards) */}
          {activeDashboardTab === 'OVERVIEW' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {scopes.map(scope => {
                const scopeAssignments = assignments.filter(a => a.project?.scopeId === scope.id || a.scopeId === scope.id);
                const scopeMentored = mentoredTeams.filter(t => t.project?.scopeId === scope.id || t.scopeId === scope.id);
                const totalWork = scopeAssignments.length + scopeMentored.length;

                return (
                  <div
                    key={scope.id}
                    onClick={() => {
                      setSelectedScopeId(scope.id);
                      setActiveDashboardTab('ASSIGNMENTS');
                    }}
                    className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 group-hover:bg-indigo-100 transition-colors" />

                    <div className="relative z-10">
                      <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
                        <Layout size={24} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 mb-2 truncate">{scope.name}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-6 h-10">{scope.description || "No description provided."}</p>

                      <div className="flex gap-4">
                        <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Reviews</p>
                          <p className="text-lg font-bold text-gray-800">{scopeAssignments.length}</p>
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Mentored</p>
                          <p className="text-lg font-bold text-gray-800">{scopeMentored.length}</p>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-between">
                        <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${totalWork > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                          {totalWork > 0 ? 'Active' : 'Empty'}
                        </span>
                        <div className="flex items-center gap-1 text-indigo-600 font-bold text-sm transform transition-transform group-hover:translate-x-1">
                          View Details <ArrowRight size={14} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {scopes.length === 0 && (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <Layout size={48} className="mb-4 opacity-50" />
                  <p className="font-bold">No active batches found.</p>
                </div>
              )}
            </div>
          )}

          {/* PENDING REQUESTS */}
          {activeDashboardTab === 'REQUESTS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map(req => (
                <div key={req.id} className="bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden hover:shadow-md transition-all">
                  <div className="bg-orange-50/50 p-4 border-b border-orange-100 flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 bg-white px-2 py-1 rounded shadow-sm border border-orange-100 mb-2 inline-block">
                        Requesting: {req.requestType}
                      </span>
                      <h3 className="font-bold text-gray-800 line-clamp-1" title={req.project?.title}>{req.project?.title || "Untitled Project"}</h3>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-gray-500 uppercase">Team Members</p>
                      {req.members.map(m => (
                        <div key={m.user.id} className="flex justify-between text-sm">
                          <span className="text-gray-700 font-medium">{m.user.name}</span>
                          <span className="text-gray-400 font-mono text-xs">{m.user.rollNumber}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 flex gap-2">
                      <button
                        onClick={() => handleRespondRequest(req.id, req.requestType, 'APPROVE')}
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-green-700 flex items-center justify-center gap-2"
                      >
                        <UserCheck size={14} /> Approve
                      </button>
                      <button
                        onClick={() => handleRespondRequest(req.id, req.requestType, 'REJECT')}
                        className="flex-1 bg-white border border-red-200 text-red-600 py-2 rounded-lg text-sm font-bold hover:bg-red-50 flex items-center justify-center gap-2"
                      >
                        <UserX size={14} /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredItems.length === 0 && <p className="text-gray-400">No pending requests.</p>}
            </div>
          )}

          {/* ASSIGNMENTS (Existing UI adapted) */}
          {activeDashboardTab === 'ASSIGNMENTS' && (
            <div className="grid gap-4">
              {filteredItems.map(team => {
                const isExpanded = expandedId === team.id;
                return (
                  <div key={team.id} className={`bg-white rounded-xl shadow-sm border transition-all ${isExpanded ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}`}>
                    <div onClick={() => toggleExpand(team.id)} className="p-4 cursor-pointer flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded uppercase">Phase {team.assignedPhase || 1}</span>
                          <span className={`${team.reviewMode === 'ONLINE' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'} text-[10px] font-black px-2 py-0.5 rounded uppercase`}>
                            {team.reviewMode || 'OFFLINE'}
                          </span>
                          <div className="flex flex-col gap-1">
                            <h3 className="font-bold text-blue-900">{team.project?.title}</h3>
                            <div className="flex gap-4">
                              {team.project?.techStack && (
                                <span className="text-[10px] text-blue-600 font-bold border border-blue-100 bg-blue-50 px-2 py-0.5 rounded">
                                  {team.project.techStack}
                                </span>
                              )}
                              {team.project?.srs && (
                                <a href={team.project.srs} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-1">
                                  View SRS <CheckCircle size={10} />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500">Representative: {team.members.find(m => m.isLeader)?.user.name || "Unknown"}</p>
                      </div>
                      {getStatusBadge(team.status)}
                    </div>

                    {isExpanded && (
                      <div className="p-6 border-t border-gray-100 bg-gray-50 grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h4 className="font-bold text-gray-400 text-xs uppercase">Recent Feedback</h4>
                          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {team.reviews?.map(r => (
                              <div key={r.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-bold text-gray-800 text-sm flex flex-col gap-0.5">
                                    <span className="flex items-center gap-2">
                                      {r.faculty?.name}
                                      {team.guideId === r.facultyId && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 uppercase font-black tracking-wide">Guide</span>}
                                      {team.subjectExpertId === r.facultyId && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 uppercase font-black tracking-wide">Expert</span>}
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">{new Date(r.createdAt).toLocaleDateString()}</span>
                                  </span>
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${r.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                    {r.status?.replace('_', ' ')}
                                  </span>
                                </div>

                                {/* Marks */}
                                {r.reviewMarks && r.reviewMarks.length > 0 && (
                                  <div className="mb-3 flex flex-wrap gap-1.5">
                                    {r.reviewMarks.map((mark, i) => {
                                      const studentName = team.members.find(m => m.userId === mark.studentId)?.user.name.split(' ')[0] || "Student";
                                      return (
                                        <span key={i} className="text-[9px] bg-gray-50 text-gray-700 px-2 py-0.5 rounded border border-gray-200 font-bold">
                                          {studentName}: <span className="text-blue-600">{mark.marks}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}

                                <p className="text-gray-600 text-xs leading-relaxed bg-gray-50/50 p-3 rounded-lg border border-gray-100">{r.content}</p>
                              </div>
                            ))}
                            {(!team.reviews || team.reviews.length === 0) && <p className="text-sm italic text-gray-400">No previous reviews.</p>}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-bold text-gray-400 text-xs uppercase">Submit Review</h4>
                          <select
                            className="w-full p-2 border rounded"
                            value={reviewStatus}
                            onChange={e => setReviewStatus(e.target.value)}
                          >
                            <option value="NOT_COMPLETED">Not Completed</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="CHANGES_REQUIRED">Changes Required</option>
                            <option value="COMPLETED">Completed</option>
                          </select>
                          <textarea
                            className="w-full p-2 border rounded h-24"
                            placeholder="Feedback..."
                            value={reviewText}
                            onChange={e => setReviewText(e.target.value)}
                          />
                          <div className="bg-white p-3 rounded border">
                            <p className="text-xs font-bold mb-2">Individual Marks {rubric && <span className="text-blue-600">(Rubric Active)</span>}</p>

                            {rubric ? (
                              <div className="space-y-4">
                                {team.members.filter(m => m.approved).map(m => {
                                  const criteria = JSON.parse(rubric.criteria);
                                  const currentStudentMarks = rubricMarks[m.user.id] || {};
                                  const currentTotal = Object.values(currentStudentMarks).reduce((a, b) => a + (parseInt(b) || 0), 0);

                                  return (
                                    <div key={m.user.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                      <div className="flex justify-between items-center mb-2 border-b border-gray-200 pb-1">
                                        <span className="font-bold text-sm text-gray-800">{m.user.name}</span>
                                        <span className="font-mono font-bold text-blue-600">{currentTotal} / {rubric.totalMarks}</span>
                                      </div>
                                      <div className="space-y-2">
                                        {criteria.map((c, idx) => (
                                          <div key={idx} className="flex justify-between items-center text-xs">
                                            <span className="text-gray-600 flex-1">{c.name} <span className="text-[10px] text-gray-400">({c.maxMarks})</span></span>
                                            <input
                                              type="number"
                                              min="0"
                                              max={c.maxMarks}
                                              placeholder="0"
                                              className="w-14 p-1 border rounded text-right bg-white"
                                              value={currentStudentMarks[c.name] || ''}
                                              onChange={e => {
                                                const val = Math.min(parseInt(e.target.value) || 0, c.maxMarks);
                                                const newRubricMarks = { ...rubricMarks };
                                                if (!newRubricMarks[m.user.id]) newRubricMarks[m.user.id] = {};
                                                newRubricMarks[m.user.id][c.name] = val;
                                                setRubricMarks(newRubricMarks);

                                                // Update Total
                                                const newTotal = Object.values(newRubricMarks[m.user.id]).reduce((a, b) => a + (parseInt(b) || 0), 0);
                                                setIndividualMarks(prev => ({ ...prev, [m.user.id]: newTotal }));
                                              }}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              // Manual Marks Fallback
                              team.members.filter(m => m.approved).map(m => (
                                <div key={m.user.id} className="flex justify-between items-center mb-2">
                                  <span className="text-sm">{m.user.name}</span>
                                  <input
                                    type="number" max="10"
                                    className="w-16 border p-1 rounded text-center"
                                    value={individualMarks[m.user.id] || ''}
                                    onChange={e => setIndividualMarks({ ...individualMarks, [m.user.id]: e.target.value })}
                                  />
                                </div>
                              ))
                            )}
                          </div>
                          <button
                            onClick={(e) => submitReview(e, team.id, team.projectId, team.assignedPhase)}
                            className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700"
                          >
                            Submit Review
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredItems.length === 0 && <p className="text-gray-400 text-center py-8">No assignments found.</p>}
            </div>
          )
          }

          {/* MENTORED TEAMS */}
          {activeDashboardTab === 'MENTORED' && (
            <div className="grid gap-4">
              {filteredItems.map(team => (
                <div key={team.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${team.myRole === 'GUIDE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {team.myRole}
                        </span>
                        <div className="flex flex-col gap-1">
                          <h3 className="font-bold text-xl text-gray-800">{team.project?.title}</h3>
                          <div className="flex gap-4 items-center">
                            {team.project?.techStack && (
                              <span className="text-[10px] text-blue-600 font-bold border border-blue-100 bg-blue-50 px-2 py-0.5 rounded">
                                {team.project.techStack}
                              </span>
                            )}
                            {team.project?.srs && (
                              <a href={team.project.srs} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-1">
                                View SRS <CheckCircle size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-500">
                        <p>Category: {team.project?.category || "N/A"}</p>
                        <p>Batch: <span className="font-bold text-gray-700">{team.project?.scope?.name || "N/A"}</span></p>
                      </div>
                    </div>
                    {/* Team Average Mark */}
                    {(() => {
                      const phaseAverages = {};
                      let totalSum = 0;
                      let totalCount = 0;

                      // Calculate avg for each phase
                      const reviewsByPhase = team.reviews?.reduce((acc, r) => {
                        const phase = r.reviewPhase || 1;
                        if (!acc[phase]) acc[phase] = [];
                        acc[phase].push(r);
                        return acc;
                      }, {}) || {};

                      Object.entries(reviewsByPhase).forEach(([phase, reviews]) => {
                        // Get latest marks for each student in this phase
                        const latestMarksInPhase = team.members.map(m => {
                          const marks = reviews
                            .flatMap(r => r.reviewMarks?.filter(rm => rm.studentId === m.user.id).map(rm => ({ ...rm, date: r.createdAt })))
                            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                          return marks?.marks ? parseFloat(marks.marks) : null;
                        }).filter(m => m !== null);

                        if (latestMarksInPhase.length > 0) {
                          const avg = latestMarksInPhase.reduce((a, b) => a + b, 0) / latestMarksInPhase.length;
                          phaseAverages[phase] = avg.toFixed(1);
                          totalSum += avg; // Simplified total: average across phases
                          totalCount++;
                        }
                      });

                      const totalAvg = totalCount > 0 ? (totalSum / totalCount).toFixed(1) : null;

                      if (totalCount > 0) {
                        return (
                          <div className="flex gap-3">
                            {Object.entries(phaseAverages).map(([phase, avg]) => (
                              <div key={phase} className="bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 flex flex-col items-center">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Phase {phase}</span>
                                <span className="text-sm font-black text-gray-700">{avg}</span>
                              </div>
                            ))}
                            <div className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 flex flex-col items-center">
                              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Total Avg</span>
                              <span className="text-lg font-black text-blue-700">{totalAvg}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {getStatusBadge(team.status)}
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Team Members</h4>
                      <ul className="space-y-2">
                        {team.members.filter(m => m.approved).map(m => (
                          <li key={m.id} className="flex items-center justify-between gap-3 text-sm text-gray-700 bg-gray-50 p-2 rounded">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-xs text-gray-500">
                                {m.user.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold">{m.user.name}</p>
                                <p className="text-xs text-gray-400">{m.user.rollNumber}</p>
                              </div>
                            </div>
                            {/* Latest Marks Display */}
                            {(() => {
                              const studentMarks = team.reviews
                                ?.flatMap(r => r.reviewMarks?.filter(rm => rm.studentId === m.user.id).map(rm => ({ ...rm, phase: r.reviewPhase, date: r.createdAt })))
                                .sort((a, b) => new Date(b.date) - new Date(a.date));

                              const latestMark = studentMarks?.[0];

                              if (latestMark) {
                                return (
                                  <div className="text-right">
                                    <span className="block font-bold text-blue-600">{latestMark.marks}/10</span>
                                    <span className="text-[9px] text-gray-400 uppercase">Phase {latestMark.phase || 1}</span>
                                  </div>
                                );
                              }
                              return <span className="text-xs text-gray-400 italic">No marks</span>;
                            })()}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Review History</h4>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {(!team.reviews || team.reviews.length === 0) ? (
                          <p className="text-sm italic text-gray-400">No reviews yet.</p>
                        ) : (
                          team.reviews.map(r => (
                            <div key={r.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-gray-800 text-sm flex flex-col gap-0.5">
                                  <span className="flex items-center gap-2">
                                    {r.faculty?.name || "Reviewer"}
                                    {team.guideId === r.facultyId && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 uppercase font-black tracking-wide">Guide</span>}
                                    {team.subjectExpertId === r.facultyId && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 uppercase font-black tracking-wide">Expert</span>}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-bold uppercase">{new Date(r.createdAt).toLocaleDateString()}</span>
                                </span>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${r.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                  {r.status?.replace('_', ' ')}
                                </span>
                              </div>

                              {/* Marks */}
                              {r.reviewMarks && r.reviewMarks.length > 0 && (
                                <div className="mb-3 flex flex-wrap gap-1.5">
                                  {r.reviewMarks.map((mark, i) => {
                                    const studentName = team.members.find(m => m.userId === mark.studentId)?.user.name.split(' ')[0] || "Student";
                                    return (
                                      <span key={i} className="text-[9px] bg-gray-50 text-gray-700 px-2 py-0.5 rounded border border-gray-200 font-bold">
                                        {studentName}: <span className="text-blue-600">{mark.marks}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}

                              <p className="text-gray-600 text-xs leading-relaxed bg-gray-50/50 p-3 rounded-lg border border-gray-100">{r.content}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              ))}
              {filteredItems.length === 0 && <p className="text-gray-400 text-center py-8">You are not mentoring any teams yet.</p>}
            </div>
          )}

          {/* DIRECTORY */}
          {activeDashboardTab === 'STUDENTS' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Student</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Batch</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Role</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Project</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(() => {
                    const studentMap = new Map();
                    // Combine from assignments and mentored
                    const process = (list, source) => {
                      list.forEach(t => {
                        const scopeId = t.project?.scopeId || t.scopeId;
                        const scopeName = t.project?.scope?.name || t.scope?.name || "N/A";

                        // Filter by selectedScopeId if set
                        if (selectedScopeId && scopeId !== selectedScopeId) return;

                        t.members.forEach(m => {
                          if (m.approved) {
                            const key = `${m.user.id}-${scopeId}`;
                            const existing = studentMap.get(key);
                            if (existing) {
                              if (!existing.source.includes(source)) {
                                existing.source += ` & ${source}`;
                              }
                            } else {
                              studentMap.set(key, {
                                ...m.user,
                                project: t.project?.title,
                                batch: scopeName,
                                source
                              });
                            }
                          }
                        });
                      });
                    };
                    process(assignments, 'Reviewee');
                    process(mentoredTeams, 'Mentee');

                    const allStudents = Array.from(studentMap.values());

                    return allStudents.sort((a, b) => a.name.localeCompare(b.name)).map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-4 text-sm font-bold text-gray-800">{s.name}</td>
                        <td className="p-4 text-sm">
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-black uppercase border border-indigo-100">{s.batch}</span>
                        </td>
                        <td className="p-4 text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.source === 'Mentee' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{s.source}</span>
                        </td>
                        <td className="p-4 text-sm text-gray-600 truncate max-w-xs">{s.project}</td>
                        <td className="p-4 text-sm text-blue-600 cursor-pointer" onClick={() => navigator.clipboard.writeText(s.email)}>{s.email}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}