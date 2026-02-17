import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { Search, MessageSquare, CheckCircle, Clock, AlertCircle, Copy, Users, UserCheck, UserX, FileText, Layout, ArrowRight, ShieldCheck, Calendar, MapPin } from 'lucide-react';
import FacultyScheduleTab from '../components/faculty/FacultyScheduleTab';
import ProjectDetailsModal from '../components/faculty/ProjectDetailsModal';

export default function FacultyDashboard() {
  const { user: currentUser } = useContext(AuthContext);
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const [assignments, setAssignments] = useState([]); // Reviews assigned by Admin
  const [mentoredTeams, setMentoredTeams] = useState([]); // Teams where I am Guide/Expert
  const [requests, setRequests] = useState([]); // Pending requests

  const [filteredItems, setFilteredItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PENDING, COMPLETED, REVIEW_COMPLETED
  const [phaseFilter, setPhaseFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [activeDashboardTab, setActiveDashboardTab] = useState('OVERVIEW'); // OVERVIEW, REQUESTS, ASSIGNMENTS, MENTORED, STUDENTS
  const [scopes, setScopes] = useState([]);
  const [selectedScopeId, setSelectedScopeId] = useState(null);
  const [sortBy, setSortBy] = useState('newest'); // newest, timeLeft

  const [selectedTeamForDetails, setSelectedTeamForDetails] = useState(null); // For View Project Details Modal

  // Pagination State for Review Assignments
  const [assignmentsPagination, setAssignmentsPagination] = useState({ page: 1, limit: 1000, total: 0, totalPages: 1 });

  // Review Form States (for Assignments)
  const [expandedId, setExpandedId] = useState(null);
  const [reviewText, setReviewText] = useState("");
  const [reviewStatus, setReviewStatus] = useState("COMPLETED");
  const [individualMarks, setIndividualMarks] = useState({});
  const [isPresentState, setIsPresentState] = useState({}); // { studentId: boolean }
  const [rubric, setRubric] = useState(null); // Active rubric for current expanded assignment
  const [rubricMarks, setRubricMarks] = useState({}); // { studentId: { criterionName: marks } }

  const loadData = () => {
    Promise.all([
      api.get('/reviews/assignments', {
        params: {
          page: assignmentsPagination.page,
          limit: assignmentsPagination.limit,
          search: searchTerm || undefined,
          status: statusFilter !== 'ALL' && !['COMPLETED', 'PENDING'].includes(statusFilter) ? statusFilter : undefined,
          phase: phaseFilter !== 'ALL' ? phaseFilter : undefined,
          category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          scopeId: selectedScopeId || undefined,
          sortBy: sortBy === 'timeLeft' ? 'timeLeft' : undefined
        }
      }).catch(e => ({ data: { teams: [] } })),
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

      if (resAssign.data?.pagination) {
        setAssignmentsPagination(prev => ({
          ...prev,
          total: resAssign.data.pagination.total,
          totalPages: resAssign.data.pagination.totalPages
        }));
      }
    }).catch(err => console.error("Failed to load dashboard data", err));
  };

  useEffect(() => {
    loadData();
    // Background polling for live updates (60 seconds)
    // Only fetch if no review form is currently expanded to prevent overwriting unsaved work
    const pollInterval = setInterval(() => {
      if (!expandedId) {
        loadData();
      }
    }, 60000);
    return () => clearInterval(pollInterval);
  }, [
    expandedId, // Re-run effect when expandedId changes to reset/start interval
    assignmentsPagination.page,
    assignmentsPagination.limit,
    searchTerm,
    statusFilter,
    phaseFilter,
    categoryFilter,
    selectedScopeId,
    sortBy
  ]);

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
        (statusFilter === 'COMPLETED' ? (activeDashboardTab === 'ASSIGNMENTS' ? item.isPhaseCompletedByFaculty : itemStatus === 'COMPLETED') :
          (statusFilter === 'PENDING' ? (activeDashboardTab === 'ASSIGNMENTS' ? !item.isPhaseCompletedByFaculty : itemStatus !== 'COMPLETED') :
            itemStatus === statusFilter));

      const matchesScope = !selectedScopeId || scopeId === selectedScopeId;

      const matchesPhase = phaseFilter === 'ALL' || (item.assignedPhase && item.assignedPhase.toString() === phaseFilter);

      const matchesCategory = categoryFilter === 'ALL' || (item.project?.category === categoryFilter);

      return matchesSearch && matchesStatus && matchesScope && matchesPhase && matchesCategory;
    });


    setFilteredItems(filtered);
  }, [searchTerm, statusFilter, phaseFilter, categoryFilter, activeDashboardTab, assignments, mentoredTeams, requests, selectedScopeId]);

  const getTimeLeftStr = (endTime) => {
    if (!endTime) return null;
    const diff = new Date(endTime) - new Date();
    if (diff <= 0) return "Session Ended";
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}h ${mins % 60}m left`;
    return `${mins}m left`;
  };

  const getGroupTimeLeftStr = (members) => {
    const ends = members
      .map(m => m.user.labSessions?.[0]?.endTime)
      .filter(Boolean)
      .map(d => new Date(d));
    if (ends.length === 0) return null;
    const earliestEnd = new Date(Math.min(...ends));
    return getTimeLeftStr(earliestEnd);
  };

  const getGroupSessionInfo = (members) => {
    // Find the member with the earliest upcoming session
    const sessions = members
      .map(m => m.user.labSessions?.[0])
      .filter(Boolean)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    if (sessions.length === 0) return null;
    return sessions[0];
  };

  const formatSessionRange = (start, end) => {
    if (!start || !end) return "";
    const s = new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const e = new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const diff = new Date(end) - new Date(start);
    const mins = Math.floor(diff / 60000);
    const duration = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    return `${s} - ${e} (${duration})`;
  };

  const getReviewDeadlineStr = (deadline) => {
    if (!deadline) return null;
    const diff = new Date(deadline) - new Date();
    if (diff <= 0) return "Review Access Expired";
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    if (hours > 0) return `${hours}h ${mins % 60}m remaining`;
    return `${mins}m remaining`;
  };

  const handleRespondRequest = async (teamId, requestType, action) => {
    if (!await confirm(`Are you sure you want to ${action} this request?`, 'Confirm Action')) return;
    try {
      await api.post('/faculty/respond', { teamId, requestType, action });
      addToast(`Request ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`, 'success');
      loadData();
    } catch (e) {
      addToast(e.response?.data?.error || "Error processing request", 'error');
    }
  };

  const toggleExpand = async (id, type = 'ASSIGNMENT') => {
    if (expandedId === id) {
      setExpandedId(null);
      setReviewText("");
      setIndividualMarks({});
      setIsPresentState({});
      setRubric(null);
      setRubricMarks({});
    } else {
      // Clear state before switching
      setReviewText("");
      setIndividualMarks({});
      setIsPresentState({});
      setRubric(null);
      setRubricMarks({});

      setExpandedId(id);
      const source = type === 'ASSIGNMENT' ? assignments : mentoredTeams;
      // Use assignmentId for assignments if available, otherwise fallback to id
      const item = source.find(a => (a.assignmentId || a.id) === id);
      if (item) {
        // Check Deadline
        if (type === 'ASSIGNMENT') {
          const isGuide = item.guideId === currentUser.id && item.guideStatus === 'APPROVED';
          const isExpert = item.subjectExpertId === currentUser.id && item.expertStatus === 'APPROVED';

          if (item.reviewDeadline && !isGuide && !isExpert) {
            const deadline = new Date(item.reviewDeadline);
            if (deadline < new Date()) {
              setExpandedId(null);
              return addToast(`Access Denied: The review deadline (${deadline.toLocaleString()}) has passed.`, 'error');
            }
          }
        }

        const currentStatus = item.status || "COMPLETED";
        setReviewStatus(['COMPLETED', 'CHANGES_REQUIRED'].includes(currentStatus) ? currentStatus : 'COMPLETED');
        // Fetch Rubric
        const phase = type === 'ASSIGNMENT' ? item.assignedPhase : ((item.reviews?.length || 0) + 1);
        const category = item.project?.category;

        // Check for existing review by this faculty for this phase
        const existingReview = item.reviews?.find(r => r.facultyId === currentUser.id && r.reviewPhase === phase);
        if (existingReview) {
          setReviewText(existingReview.content || "");
          const currentStatus = existingReview.status || item.status;
          setReviewStatus(['COMPLETED', 'CHANGES_REQUIRED'].includes(currentStatus) ? currentStatus : 'COMPLETED');

          const marksMap = {};
          const absMap = {};
          const rubMarksMap = {};

          existingReview.reviewMarks?.forEach(m => {
            marksMap[m.studentId] = m.marks;
            absMap[m.studentId] = m.isAbsent;
            if (m.criterionMarks) {
              const parsed = JSON.parse(m.criterionMarks);
              const scores = {};
              Object.entries(parsed).forEach(([key, val]) => {
                if (key !== '_total') scores[key] = val.score;
              });
              rubMarksMap[m.studentId] = scores;
            }
          });

          setIndividualMarks(marksMap);
          setIsPresentState(Object.fromEntries(Object.entries(absMap).map(([k, v]) => [k, !v])));
          setRubricMarks(rubMarksMap);
        }

        if (category && phase) {
          try {
            const res = await api.get('/rubrics/find', {
              params: { category, phase }
            });
            setRubric(res.data);
            // Initialize rubric marks structure only if NOT loading an existing review
            if (!existingReview) {
              const initialRubricMarks = {};
              item.members.forEach(m => {
                if (m.approved) {
                  initialRubricMarks[m.user.id] = {};
                }
              });
              setRubricMarks(initialRubricMarks);
            }
          } catch (e) {
            setRubric(null);
          }
        } else {
          setRubric(null);
        }
      }
    }
  };

  const submitReview = async (e, teamId, projectId, phase) => {
    if (e) e.stopPropagation();
    try {
      const allTeams = [...assignments, ...mentoredTeams];
      const team = allTeams.find(t => t.id === teamId);
      const approvedMembers = team?.members.filter(m => m.approved) || [];
      const anyPresent = approvedMembers.some(m => !!isPresentState[m.user.id]);

      if (!reviewText.trim() && anyPresent) {
        return addToast("Please write a review.", 'warning');
      }

      const marksPayload = approvedMembers.map(m => {
        let enrichedCriteria = null;
        if (rubric) {
          const studentRubric = rubricMarks[m.user.id] || {};
          const criteria = JSON.parse(rubric.criteria);
          enrichedCriteria = {
            _total: rubric.totalMarks,
            ...Object.fromEntries(criteria.map(c => [
              c.name,
              { score: studentRubric[c.name] || 0, max: c.maxMarks }
            ]))
          };
        }
        return {
          studentId: m.user.id,
          marks: parseInt(individualMarks[m.user.id]) || 0,
          criterionMarks: enrichedCriteria,
          isAbsent: !isPresentState[m.user.id]
        };
      });

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
      setIsPresentState({});
      setRubricMarks({});
      setRubric(null);
      setExpandedId(null);
      loadData();
      addToast("Review submitted!", 'success');
    } catch (e) {
      addToast(e.response?.data?.error || "Error submitting review", 'error');
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
              <>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setAssignmentsPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="px-4 py-2 border rounded-lg focus:ring-2 ring-blue-500 outline-none shadow-sm bg-white text-sm font-bold text-gray-600"
                >
                  <option value="ALL">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="COMPLETED">Completed</option>
                </select>

                <select
                  value={phaseFilter}
                  onChange={(e) => {
                    setPhaseFilter(e.target.value);
                    setAssignmentsPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="px-4 py-2 border rounded-lg focus:ring-2 ring-blue-500 outline-none shadow-sm bg-white text-sm font-bold text-gray-600"
                >
                  <option value="ALL">All Phases</option>
                  <option value="1">Phase 1</option>
                  <option value="2">Phase 2</option>
                  <option value="3">Phase 3</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setAssignmentsPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="px-4 py-2 border rounded-lg focus:ring-2 ring-blue-500 outline-none shadow-sm bg-white text-sm font-bold text-gray-600 w-32 md:w-auto"
                >
                  <option value="ALL">All Categories</option>
                  {[...new Set(assignments.map(a => a.project?.category).filter(Boolean))].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </>
            )}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 ring-blue-500 outline-none shadow-sm bg-white"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setAssignmentsPagination(prev => ({ ...prev, page: 1 }));
                }}
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
          <button
            onClick={() => { setActiveDashboardTab('SCHEDULE'); setStatusFilter('ALL'); }}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeDashboardTab === 'SCHEDULE' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Calendar size={16} /> My Schedule
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
          {(activeDashboardTab === 'ASSIGNMENTS' || activeDashboardTab === 'MENTORED') && (
            <div className="flex justify-between items-center text-sm text-gray-500 font-bold px-1 mb-2">
              <span>Showing {filteredItems.length} {activeDashboardTab === 'ASSIGNMENTS' ? 'Assignment(s)' : 'Team(s)'}</span>
              {activeDashboardTab === 'ASSIGNMENTS' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase text-gray-400">Sort By:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-transparent border-none text-blue-600 focus:ring-0 cursor-pointer hover:underline p-0 m-0 text-sm font-bold"
                  >
                    <option value="newest">Newest First</option>
                    <option value="timeLeft">Time Left (Imminent First)</option>
                  </select>
                </div>
              )}
            </div>
          )}

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
                        <div key={m.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-700">{m.user.name}</span>
                              {m.user.labSessions?.[0] && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-50 border border-orange-100">
                                  <Clock size={10} className="text-orange-600" />
                                  <span className="text-[9px] font-black text-orange-700 uppercase">
                                    {getTimeLeftStr(m.user.labSessions[0].endTime)}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] text-gray-400 font-mono shrink-0">{m.user.rollNumber}</span>
                              {m.user.labSessions?.[0] && (
                                <>
                                  <span className="text-[10px] text-gray-300">•</span>
                                  <div className="flex items-center gap-1 text-[10px] text-indigo-500 font-bold shrink-0">
                                    <MapPin size={10} />
                                    {m.user.labSessions[0].venue.name}
                                  </div>
                                  <span className="text-[10px] text-gray-300">•</span>
                                  <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                    {m.user.labSessions[0].title && <span className="text-indigo-600 mr-1">{m.user.labSessions[0].title}:</span>}
                                    {formatSessionRange(m.user.labSessions[0].startTime, m.user.labSessions[0].endTime)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {m.isLeader && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Leader</span>}
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
                // Use unique assignmentId if available (for faculty assignments), else team.id
                const uniqueId = team.assignmentId || team.id;
                const isExpanded = expandedId === uniqueId;
                return (
                  <div key={uniqueId} className={`bg-white rounded-xl shadow-sm border transition-all ${isExpanded ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}`}>
                    <div onClick={() => toggleExpand(uniqueId)} className="p-4 cursor-pointer flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded uppercase">Phase {team.assignedPhase || 1}</span>
                          <span className={`${team.reviewMode === 'ONLINE' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'} text-[10px] font-black px-2 py-0.5 rounded uppercase`}>
                            {team.reviewMode || 'OFFLINE'}
                          </span>
                          {(() => {
                            const session = getGroupSessionInfo(team.members);
                            const reviewDeadline = team.reviewDeadline;

                            if (session || reviewDeadline) {
                              const timeLeftSession = session ? getTimeLeftStr(session.endTime) : null;
                              const timeLeftReview = getReviewDeadlineStr(reviewDeadline);

                              return (
                                <div className="flex flex-wrap items-center gap-2">
                                  {session && (
                                    <>
                                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-orange-100 border border-orange-200">
                                        <Clock size={10} className="text-orange-600" />
                                        <span className="text-[10px] font-black text-orange-700 uppercase">{timeLeftSession}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-600">
                                        <MapPin size={10} />
                                        <span className="text-[10px] font-bold uppercase">{session.venue?.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-500 font-medium text-[10px]">
                                        {formatSessionRange(session.startTime, session.endTime)}
                                      </div>
                                    </>
                                  )}
                                  {reviewDeadline && (
                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${new Date(reviewDeadline) - new Date() < 3600000 * 2 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                      <AlertCircle size={10} />
                                      <span className="text-[10px] font-black uppercase">Review Due: {timeLeftReview}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                          <div className="flex flex-col gap-1">
                            <h3 className="font-bold text-blue-900 leading-tight">{team.project?.title}</h3>
                            {team.project?.category && (
                              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">{team.project.category}</span>
                            )}
                          </div>
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
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedTeamForDetails(team); }}
                              className="text-[10px] text-blue-600 font-bold hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-100"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">Representative: {team.members.find(m => m.isLeader)?.user.name || "Unknown"}</p>
                    </div>

                    {/* Status Badge - Show Phase Status if available */}
                    <div className="px-4 pb-4">
                      {team.isPhaseCompletedByFaculty ? (
                        <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border bg-green-100 text-green-700 border-green-200 w-fit">
                          <CheckCircle size={12} /> Review Completed
                        </span>
                      ) : (
                        getStatusBadge(team.status)
                      )}
                    </div>

                    {isExpanded && (
                      <div className="p-6 border-t border-gray-100 bg-gray-50 grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h4 className="font-bold text-gray-400 text-xs uppercase">Recent Feedback</h4>
                          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {team.reviews?.filter((r, _, arr) => {
                              // Hide PENDING reviews if a COMPLETED review exists for the same phase
                              if (r.status === 'PENDING') {
                                const hasCompleted = arr.some(or => or.reviewPhase === r.reviewPhase && or.status === 'COMPLETED');
                                return !hasCompleted;
                              }
                              return true;
                            }).map(r => (
                              <div key={r.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-bold text-gray-800 text-sm flex flex-col gap-0.5">
                                    <span className="flex items-center gap-2">
                                      {r.faculty?.name}
                                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold uppercase">Phase {r.reviewPhase}</span>
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
                                      const rollNo = team.members.find(m => m.userId === mark.studentId)?.user.rollNumber || "";
                                      let tooltip = "";
                                      let totalScale = "";
                                      if (mark.criterionMarks) {
                                        try {
                                          const cm = JSON.parse(mark.criterionMarks);
                                          if (cm._total) {
                                            totalScale = ` / ${cm._total}`;
                                            tooltip = Object.entries(cm)
                                              .filter(([name]) => name !== '_total')
                                              .map(([name, data]) => `${name}: ${data.score}/${data.max}`)
                                              .join('\n');
                                          } else {
                                            tooltip = Object.entries(cm).map(([name, val]) => `${name}: ${val}`).join('\n');
                                          }
                                        } catch (e) { }
                                      }
                                      return (
                                        <span key={i} title={tooltip} className={`text-[9px] bg-gray-50 text-gray-700 px-2 py-0.5 rounded border border-gray-200 font-bold ${tooltip ? 'cursor-help underline decoration-dotted' : ''}`}>
                                          {studentName} <span className="text-gray-400 font-normal">({rollNo})</span>: <span className="text-blue-600">{mark.marks}{totalScale}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}

                                <p className="text-gray-600 text-xs leading-relaxed bg-gray-50/50 p-3 rounded-lg border border-gray-100">{r.content}</p>
                                {r.resubmittedAt && (
                                  <div className="mt-2 flex flex-col">
                                    <span className="text-[8px] font-black text-blue-400 uppercase tracking-wider mb-1">Resubmission context</span>
                                    <pre className="text-[10px] text-blue-600 border-l-2 border-blue-200 pl-2 italic whitespace-pre-wrap font-sans leading-tight">
                                      {r.resubmissionNote}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            ))}
                            {(!team.reviews || team.reviews.length === 0) && <p className="text-sm italic text-gray-400">No previous reviews.</p>}
                          </div>
                        </div>

                        {team.isPhaseCompletedByFaculty ? (
                          <div className="flex flex-col items-center justify-center p-8 bg-green-50 border border-green-100 rounded-xl text-center">
                            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                              <CheckCircle size={24} />
                            </div>
                            <h4 className="text-lg font-bold text-green-800">Review Completed</h4>
                            <p className="text-sm text-green-600 mt-1">
                              You have successfully submitted your review for <strong>Phase {team.assignedPhase}</strong>.
                            </p>
                            <p className="text-xs text-green-500 mt-2">
                              You can view your feedback in the "Recent Feedback" section.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <h4 className="font-bold text-gray-400 text-xs uppercase text-nowrap">Submit Review</h4>
                              {team.reviewDeadline && (
                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-bold ${new Date(team.reviewDeadline) - new Date() < 3600000 * 2 ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                  <AlertCircle size={12} />
                                  <span>DEADLINE: {getReviewDeadlineStr(team.reviewDeadline)}</span>
                                </div>
                              )}
                            </div>

                            {/* Previous Feedback / Resubmission Note Callout */}
                            {(() => {
                              const reviews = [...(team.reviews || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                              const latestWithNote = reviews.find(r => r.resubmissionNote || r.status === 'CHANGES_REQUIRED');

                              if (team.status === 'READY_FOR_REVIEW' && latestWithNote) {
                                return (
                                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                                      <AlertCircle size={14} /> Resubmission Feedback context
                                    </div>

                                    {latestWithNote.content && (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-amber-800 font-bold text-[10px] uppercase tracking-wider mb-1">
                                          <AlertCircle size={12} /> Faculty Instructions (Changes Required)
                                        </div>
                                        <p className="text-xs text-amber-900 bg-white/50 p-2 rounded border border-amber-100/50 italic">
                                          "{latestWithNote.content}"
                                        </p>
                                      </div>
                                    )}

                                    {latestWithNote.resubmissionNote && (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-blue-800 font-bold text-xs uppercase tracking-wider mb-2">
                                          <MessageSquare size={14} /> Student Resubmission Note
                                        </div>
                                        <p className="text-sm text-blue-900 bg-blue-50/50 p-3 rounded-lg border border-blue-100/50 font-bold">
                                          "{latestWithNote.resubmissionNote}"
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            <select
                              className={`w-full p-2 border rounded ${Object.values(individualMarks).some(m => (parseInt(m) || 0) > 0) && reviewStatus !== 'COMPLETED' ? 'border-orange-500 bg-orange-50' : ''}`}
                              value={reviewStatus}
                              onChange={e => setReviewStatus(e.target.value)} disabled={!team.members?.filter(m => m.approved).some(m => isPresentState[m.user.id])}
                            >
                              <option value="CHANGES_REQUIRED">Changes Required</option>
                              <option value="COMPLETED">Completed</option>
                            </select>
                            <textarea
                              className="w-full p-2 border rounded h-24"
                              placeholder="Feedback..."
                              value={reviewText}
                              onChange={e => setReviewText(e.target.value)} disabled={!team.members?.filter(m => m.approved).some(m => isPresentState[m.user.id])}
                            />
                            <div className="bg-white p-3 rounded border">
                              <p className="text-xs font-bold mb-2">Individual Marks {rubric && <span className="text-blue-600">(Rubric Active)</span>}</p>
                              <div className="mb-4 bg-blue-50 p-2 rounded border border-blue-100 text-[10px] text-blue-800 font-bold uppercase">
                                ℹ️ Mark attendance to enable feedback and marks
                              </div>

                              {rubric ? (
                                <div className="space-y-4">
                                  {team.members.filter(m => m.approved).map(m => {
                                    const criteria = JSON.parse(rubric.criteria);
                                    const currentStudentMarks = rubricMarks[m.user.id] || {};
                                    const currentTotal = Object.values(currentStudentMarks).reduce((a, b) => a + (parseInt(b) || 0), 0);

                                    return (
                                      <div key={m.user.id} className={`bg-gray-50 p-3 rounded-lg border ${!isPresentState[m.user.id] ? 'border-gray-200 opacity-60' : 'border-blue-200 bg-blue-50/10'}`}>
                                        <div className="flex justify-between items-center mb-2 border-b border-gray-200 pb-1">
                                          <div className="flex items-center gap-3">
                                            <div className="flex flex-col">
                                              <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-gray-800">{m.user.name}</span>
                                                {m.user.labSessions?.[0] && (
                                                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-50 border border-orange-100">
                                                    <Clock size={10} className="text-orange-600" />
                                                    <span className="text-[9px] font-black text-orange-700 uppercase">
                                                      {getTimeLeftStr(m.user.labSessions[0].endTime)}
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-gray-400 font-mono">{m.user.rollNumber}</span>
                                                {m.user.labSessions?.[0] && (
                                                  <>
                                                    <span className="text-[10px] text-gray-300">•</span>
                                                    <div className="flex items-center gap-1 text-[10px] text-indigo-500 font-bold">
                                                      <MapPin size={10} />
                                                      {m.user.labSessions[0].venue.name}
                                                    </div>
                                                    <span className="text-[10px] text-gray-300">•</span>
                                                    <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                                      {m.user.labSessions[0].title && <span className="text-indigo-600 mr-1">{m.user.labSessions[0].title}:</span>}
                                                      {formatSessionRange(m.user.labSessions[0].startTime, m.user.labSessions[0].endTime)}
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={!!isPresentState[m.user.id]}
                                                onChange={e => {
                                                  const isP = e.target.checked;
                                                  setIsPresentState(prev => ({ ...prev, [m.user.id]: isP }));
                                                  if (!isP) {
                                                    setIndividualMarks(prev => ({ ...prev, [m.user.id]: 0 }));
                                                    setRubricMarks(prev => ({ ...prev, [m.user.id]: {} }));
                                                  }
                                                }}
                                                className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                              />
                                              <span className={`text-[10px] font-black uppercase tracking-tighter ${isPresentState[m.user.id] ? 'text-blue-600' : 'text-gray-400'}`}>Present</span>
                                            </label>
                                          </div>
                                          <span className="font-mono font-bold text-blue-600">{currentTotal} / {rubric.totalMarks}</span>
                                        </div>
                                        <div className={`space-y-2 transition-opacity duration-200 ${!isPresentState[m.user.id] ? 'opacity-30 pointer-events-none' : ''}`}>
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
                                  <div key={m.user.id} className={`flex items-center justify-between gap-4 p-2 rounded-lg transition-all ${isPresentState[m.user.id] ? 'bg-blue-50 border border-blue-100' : ''}`}>
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-bold text-gray-700">{m.user.name}</span>
                                          {m.user.labSessions?.[0] && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-50 border border-orange-100 shrink-0">
                                              <Clock size={10} className="text-orange-600" />
                                              <span className="text-[9px] font-black text-orange-700 uppercase">
                                                {getTimeLeftStr(m.user.labSessions[0].endTime)}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-[10px] text-gray-400 font-mono shrink-0">{m.user.rollNumber}</span>
                                          {m.user.labSessions?.[0] && (
                                            <>
                                              <span className="text-[10px] text-gray-300">•</span>
                                              <div className="flex items-center gap-1 text-[10px] text-indigo-500 font-bold shrink-0">
                                                <MapPin size={10} />
                                                {m.user.labSessions[0].venue.name}
                                              </div>
                                              <span className="text-[10px] text-gray-300">•</span>
                                              <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                                {m.user.labSessions[0].title && <span className="text-indigo-600 mr-1">{m.user.labSessions[0].title}:</span>}
                                                {formatSessionRange(m.user.labSessions[0].startTime, m.user.labSessions[0].endTime)}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      <label className="flex items-center gap-1 cursor-pointer shrink-0">
                                        <input
                                          type="checkbox"
                                          checked={!!isPresentState[m.user.id]}
                                          onChange={e => {
                                            const isP = e.target.checked;
                                            setIsPresentState(prev => ({ ...prev, [m.user.id]: isP }));
                                            if (!isP) setIndividualMarks({ ...individualMarks, [m.user.id]: 0 });
                                          }}
                                          className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className={`text-[10px] font-black uppercase tracking-tighter ${isPresentState[m.user.id] ? 'text-blue-600' : 'text-gray-400'}`}>Present</span>
                                      </label>
                                    </div>
                                    <input
                                      type="number" min="0" max="100"
                                      disabled={!isPresentState[m.user.id]}
                                      className={`w-16 border p-1 rounded text-center text-sm font-bold outline-none ring-blue-500 focus:ring-1 ${!isPresentState[m.user.id] ? 'opacity-30' : ''}`}
                                      value={individualMarks[m.user.id] || ''}
                                      onChange={e => {
                                        const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                                        setIndividualMarks({ ...individualMarks, [m.user.id]: val });
                                      }}
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
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredItems.length === 0 && <p className="text-gray-400 text-center py-8">No assignments found.</p>}

              {/* Pagination Controls */}
              {assignmentsPagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 py-6 border-t border-gray-100">
                  <button
                    disabled={assignmentsPagination.page === 1}
                    onClick={() => setAssignmentsPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    className="px-4 py-2 bg-white border rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm font-medium text-gray-600">
                    Page <span className="font-bold text-gray-800">{assignmentsPagination.page}</span> of <span className="font-bold text-gray-800">{assignmentsPagination.totalPages}</span>
                  </span>
                  <button
                    disabled={assignmentsPagination.page === assignmentsPagination.totalPages}
                    onClick={() => setAssignmentsPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    className="px-4 py-2 bg-white border rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

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
                          <h3 onClick={() => toggleExpand(team.id, 'MENTORED')} className="font-bold text-xl text-gray-800 cursor-pointer hover:text-indigo-600 transition-colors leading-tight">{team.project?.title}</h3>
                          {team.project?.category && (
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-tight">{team.project.category}</span>
                          )}
                          <div className="flex gap-4 items-center mt-1">
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
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedTeamForDetails(team); }}
                              className="text-[10px] text-indigo-600 font-bold hover:underline bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100"
                            >
                              View Details & Edit Info
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500 mt-2">
                        <div className="flex gap-4 text-xs text-gray-500 mt-2">
                          <p>Batch: <span className="font-bold text-gray-700">
                            {team.project?.scope?.name || team.scope?.name || "N/A"}
                          </span></p>
                        </div>
                      </div>
                    </div>

                    {/* Team Average Mark */}
                    {(() => {
                      const phaseAverages = {};
                      let totalSum = 0;
                      let totalCount = 0;

                      const reviewsByPhase = team.reviews?.reduce((acc, r) => {
                        const phase = r.reviewPhase || 1;
                        if (!acc[phase]) acc[phase] = [];
                        acc[phase].push(r);
                        return acc;
                      }, {}) || {};

                      Object.entries(reviewsByPhase).forEach(([phase, reviews]) => {
                        const latestMarksInPhase = team.members.map(m => {
                          const marks = reviews
                            .flatMap(r => r.reviewMarks?.filter(rm => rm.studentId === m.user.id).map(rm => ({ ...rm, date: r.createdAt })))
                            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                          return marks?.marks ? parseFloat(marks.marks) : null;
                        }).filter(m => m !== null);

                        if (latestMarksInPhase.length > 0) {
                          const avg = latestMarksInPhase.reduce((a, b) => a + b, 0) / latestMarksInPhase.length;
                          phaseAverages[phase] = avg.toFixed(1);
                          totalSum += avg;
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

                  {expandedId === team.id && (
                    <div className="grid md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-gray-100">
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
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold">{m.user.name}</p>
                                    {m.user.labSessions?.[0] && (
                                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-50 border border-orange-100">
                                        <Clock size={10} className="text-orange-600" />
                                        <span className="text-[9px] font-black text-orange-700 uppercase">
                                          {getTimeLeftStr(m.user.labSessions[0].endTime)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs text-gray-400 shrink-0">{m.user.rollNumber}</p>
                                    {m.user.labSessions?.[0] && (
                                      <>
                                        <span className="text-[10px] text-gray-300">•</span>
                                        <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-bold shrink-0">
                                          <MapPin size={10} />
                                          {m.user.labSessions[0].venue.name}
                                        </div>
                                        <span className="text-[10px] text-gray-300">•</span>
                                        <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                          {m.user.labSessions[0].title && <span className="text-indigo-400 mr-1">{m.user.labSessions[0].title}:</span>}
                                          {formatSessionRange(m.user.labSessions[0].startTime, m.user.labSessions[0].endTime)}
                                        </span>
                                      </>
                                    )}
                                  </div>
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
                                      <span className="block font-bold text-blue-600">{latestMark.marks}</span>
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
                                      let tooltip = "";
                                      if (mark.criterionMarks) {
                                        try {
                                          const cm = JSON.parse(mark.criterionMarks);
                                          tooltip = Object.entries(cm).map(([name, val]) => `${name}: ${val}`).join('\n');
                                        } catch (e) { }
                                      }
                                      return (
                                        <span key={i} title={tooltip} className={`text-[9px] bg-gray-50 text-gray-700 px-2 py-0.5 rounded border border-gray-200 font-bold ${tooltip ? 'cursor-help underline decoration-dotted' : ''}`}>
                                          {studentName}: <span className="text-blue-600">{mark.marks}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}

                                <p className="text-gray-600 text-xs leading-relaxed bg-gray-50/50 p-3 rounded-lg border border-gray-100">{r.content}</p>
                                {r.resubmittedAt && (
                                  <div className="mt-2 flex flex-col">
                                    <span className="text-[8px] font-black text-blue-400 uppercase tracking-wider mb-1">Resubmission context</span>
                                    <pre className="text-[10px] text-blue-600 border-l-2 border-blue-200 pl-2 italic whitespace-pre-wrap font-sans leading-tight">
                                      {r.resubmissionNote}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* Submit Review Form for Mentored Teams */}
                        <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Submit New Review</h4>
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">Phase {(team.reviews?.length || 0) + 1}</span>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <select
                                className="w-full p-2 border rounded text-sm outline-none focus:ring-1 ring-blue-500"
                                value={reviewStatus}
                                onChange={e => setReviewStatus(e.target.value)}
                                disabled={!team.members?.filter(m => m.approved).some(m => isPresentState[m.user.id])}
                              >
                                <option value="CHANGES_REQUIRED">Changes Required</option>
                                <option value="COMPLETED">Completed</option>
                              </select>
                              <textarea
                                className="w-full p-2 border rounded h-32 text-sm outline-none focus:ring-1 ring-blue-500"
                                placeholder="Detailed feedback and guidance for the team..."
                                value={reviewText}
                                onChange={e => setReviewText(e.target.value)}
                                disabled={!team.members?.filter(m => m.approved).some(m => isPresentState[m.user.id])}
                              />
                            </div>
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                              <p className="text-[10px] font-black text-gray-400 uppercase mb-3">Student Performance {rubric && <span className="text-blue-600">(Rubric Active)</span>}</p>

                              {rubric ? (
                                <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                  {team.members.filter(m => m.approved).map(m => {
                                    const criteria = JSON.parse(rubric.criteria);
                                    const currentStudentMarks = rubricMarks[m.user.id] || {};
                                    const currentTotal = Object.values(currentStudentMarks).reduce((a, b) => a + (parseInt(b) || 0), 0);

                                    return (
                                      <div key={m.user.id} className={`bg-white p-2.5 rounded-lg border shadow-sm transition-all ${!isPresentState[m.user.id] ? 'border-gray-100 opacity-60' : 'border-blue-200 bg-blue-50/10'}`}>
                                        <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-1">
                                          <div className="flex items-center gap-3">
                                            <span className="font-bold text-xs text-gray-800">{m.user.name}</span>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={!!isPresentState[m.user.id]}
                                                onChange={e => {
                                                  const isP = e.target.checked;
                                                  setIsPresentState(prev => ({ ...prev, [m.user.id]: isP }));
                                                  if (!isP) {
                                                    setIndividualMarks(prev => ({ ...prev, [m.user.id]: 0 }));
                                                    setRubricMarks(prev => ({ ...prev, [m.user.id]: {} }));
                                                  }
                                                }}
                                                className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                              />
                                              <span className={`text-[9px] font-black uppercase tracking-tighter ${isPresentState[m.user.id] ? 'text-blue-600' : 'text-gray-400'}`}>Present</span>
                                            </label>
                                          </div>
                                          <span className="font-mono font-bold text-blue-600 text-xs">{currentTotal} / {rubric.totalMarks}</span>
                                        </div>
                                        <div className={`space-y-2 transition-opacity duration-200 ${!isPresentState[m.user.id] ? 'opacity-30 pointer-events-none' : ''}`}>
                                          {criteria.map((c, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-[10px]">
                                              <span className="text-gray-500 flex-1">{c.name} <span className="text-[9px] text-gray-400">({c.maxMarks})</span></span>
                                              <input
                                                type="number"
                                                min="0"
                                                max={c.maxMarks}
                                                placeholder="0"
                                                className="w-12 p-0.5 border rounded text-right bg-gray-50 outline-none focus:bg-white"
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
                                <div className="space-y-2">
                                  {team.members.filter(m => m.approved).map(m => (
                                    <div key={m.user.id} className={`flex items-center justify-between gap-4 p-2 rounded-lg transition-all ${isPresentState[m.user.id] ? 'bg-blue-50 border border-blue-100' : ''}`}>
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span className="text-xs font-medium text-gray-600 truncate">{m.user.name}</span>
                                        <label className="flex items-center gap-1 cursor-pointer shrink-0">
                                          <input
                                            type="checkbox"
                                            checked={!!isPresentState[m.user.id]}
                                            onChange={e => {
                                              const isP = e.target.checked;
                                              setIsPresentState(prev => ({ ...prev, [m.user.id]: isP }));
                                              if (!isP) setIndividualMarks({ ...individualMarks, [m.user.id]: 0 });
                                            }}
                                            className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                          />
                                          <span className={`text-[9px] font-black uppercase tracking-tighter ${isPresentState[m.user.id] ? 'text-blue-600' : 'text-gray-400'}`}>Present</span>
                                        </label>
                                      </div>
                                      <input
                                        type="number" max="100"
                                        placeholder="0"
                                        disabled={!isPresentState[m.user.id]}
                                        className={`w-16 border p-1 rounded text-center text-xs font-bold outline-none ring-blue-500 focus:ring-1 ${!isPresentState[m.user.id] ? 'opacity-30' : ''}`}
                                        value={individualMarks[m.user.id] || ''}
                                        onChange={e => {
                                          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                                          setIndividualMarks({ ...individualMarks, [m.user.id]: val });
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={(e) => submitReview(e, team.id, team.projectId, (team.reviews?.length || 0) + 1)}
                            className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                          >
                            <MessageSquare size={18} /> Submit Guidance Review
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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
                    const process = (list, source) => {
                      list.forEach(t => {
                        const scopeId = t.project?.scopeId || t.scopeId;
                        const scopeName = t.project?.scope?.name || t.scope?.name || "N/A";
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
                              studentMap.set(key, { ...m.user, project: t.project?.title, team: t, batch: scopeName, source });
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
                        <td className="p-4 text-sm"><span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-black uppercase border border-indigo-100">{s.batch}</span></td>
                        <td className="p-4 text-sm"><span className={`px-2 py-0.5 rounded text-xs font-bold ${s.source === 'Mentee' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{s.source}</span></td>
                        <td className="p-4 text-sm text-gray-600 truncate max-w-xs cursor-pointer hover:text-blue-600 hover:underline" onClick={() => setSelectedTeamForDetails(s.team)}>{s.project}</td>
                        <td className="p-4 text-sm text-blue-600 cursor-pointer" onClick={() => navigator.clipboard.writeText(s.email)}>{s.email}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {/* SCHEDULE */}
          {activeDashboardTab === 'SCHEDULE' && (
            <FacultyScheduleTab onViewProject={(team) => setSelectedTeamForDetails(team)} scopes={scopes} />
          )}
        </div>

        {/* Project Details Modal */}
        {selectedTeamForDetails && (
          <ProjectDetailsModal
            team={selectedTeamForDetails}
            onClose={() => setSelectedTeamForDetails(null)}
            onUpdate={() => loadData()}
            readOnly={activeDashboardTab === 'ASSIGNMENTS' || activeDashboardTab === 'STUDENTS'}
          />
        )}
      </div>
    </div>
  );
}