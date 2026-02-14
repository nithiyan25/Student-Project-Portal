import React, { useState, useEffect, useContext } from 'react';
import api from '../api';
import Navbar from '../components/Navbar';
import {
  RefreshCcw,
  LayoutDashboard,
  User,
  GraduationCap,
  ShieldCheck,
  Folder,
  MessageSquare,
  Users,
  Settings,
  Link as LinkIcon,
  CheckSquare,
  BarChart2,
  ChevronRight,
  LayoutList,
  ArrowLeft,
  LogOut,
  ClipboardCheck,
  Calendar,
  CheckCircle,
  AlertCircle,
  UserX
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

// Import extracted tab components
import StudentsTab from '../components/admin/StudentsTab';
import FacultyTab from '../components/admin/FacultyTab';
import AdminsTab from '../components/admin/AdminsTab';
import ProjectsTab from '../components/admin/ProjectsTab';
import TeamsTab from '../components/admin/TeamsTab';
import ManageTeamsTab from '../components/admin/ManageTeamsTab';
import FacultyAssignmentsTab from '../components/admin/FacultyAssignmentsTab';
import VenueSchedulerTab from '../components/admin/VenueSchedulerTab';
import ReviewsTab from '../components/admin/ReviewsTab';
import BulkImportModal from '../components/ui/BulkImportModal';
import ExportSelectionModal from '../components/ui/ExportSelectionModal';
import ReleaseReviewsModal from '../components/admin/ReleaseReviewsModal';
import OverviewDashboardTab from '../components/admin/OverviewDashboardTab';
import IndividualStatsTab from '../components/admin/IndividualStatsTab';
import ProjectRequestsTab from '../components/admin/ProjectRequestsTab';
import ProjectScopesTab from '../components/admin/ProjectScopesTab';
import SettingsTab from '../components/admin/SettingsTab';
import RubricsTab from '../components/admin/RubricsTab';
import StudentRequestStatusTab from '../components/admin/StudentRequestStatusTab';
import AbsenteesTab from '../components/admin/AbsenteesTab';

export default function AdminDashboard() {
  const { user: currentUser } = useContext(AuthContext);
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedGroups, setExpandedGroups] = useState(['General']); // Default open group
  const [adminPermissions, setAdminPermissions] = useState({ hasFullAccess: true, allowedTabs: null });

  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [unassignedStudents, setUnassignedStudents] = useState([]);
  const [allAvailableProjects, setAllAvailableProjects] = useState([]);
  const [allAssignedProjects, setAllAssignedProjects] = useState([]);
  const [projects, setProjects] = useState([]);
  const [scopes, setScopes] = useState([]); // New Scopes State
  const [categories, setCategories] = useState([]); // Unique project categories
  const [teams, setTeams] = useState([]);
  const [facultyAssignments, setFacultyAssignments] = useState([]);
  const [reviewTeams, setReviewTeams] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Forms
  const [newStudent, setNewStudent] = useState({ name: '', email: '', rollNumber: '', department: '', year: '' });
  const [newFaculty, setNewFaculty] = useState({ name: '', email: '', rollNumber: '' });
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '' });
  const [newProj, setNewProj] = useState({ title: '', category: '', maxTeamSize: 3, description: '', scopeId: '', techStack: '', srs: '' });

  // Manual Team Assignment
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [newTeamMemberEmail, setNewTeamMemberEmail] = useState('');
  const [teamMemberEmail, setTeamMemberEmail] = useState('');

  // Faculty Assignment
  const [selectedProjectForFaculty, setSelectedProjectForFaculty] = useState('');
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [accessDurationHours, setAccessDurationHours] = useState(null);
  const [accessStartsAt, setAccessStartsAt] = useState('');
  const [reviewPhase, setReviewPhase] = useState("1");
  const [reviewMode, setReviewMode] = useState('OFFLINE');

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [debouncedProjectSearch, setDebouncedProjectSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [projectScopeFilter, setProjectScopeFilter] = useState('ALL');
  const [projectCategoryFilter, setProjectCategoryFilter] = useState('ALL');
  const [projectSRSFilter, setProjectSRSFilter] = useState('ALL');
  const [statsScopeFilter, setStatsScopeFilter] = useState('ALL'); // Batch filter for Overview Stats
  const [studentScopeFilter, setStudentScopeFilter] = useState('ALL'); // NEW: Batch filter for Students Tab

  // New States for Search & Filtering
  const [teamSearch, setTeamSearch] = useState('');
  const [debouncedTeamSearch, setDebouncedTeamSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [debouncedAssignmentSearch, setDebouncedAssignmentSearch] = useState('');
  const [assignmentExpiredFilter, setAssignmentExpiredFilter] = useState(false);

  // Sorting States
  const [studentSort, setStudentSort] = useState({ sortBy: 'createdAt', order: 'desc' });
  const [facultySort, setFacultySort] = useState({ sortBy: 'createdAt', order: 'desc' });
  const [projectSort, setProjectSort] = useState({ sortBy: 'createdAt', order: 'desc' });

  // Bulk Selection
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);

  // Review Assignments Filters
  const [pendingReviewSearch, setPendingReviewSearch] = useState('');
  const [debouncedPendingReviewSearch, setDebouncedPendingReviewSearch] = useState('');
  const [pendingReviewPhaseFilter, setPendingReviewPhaseFilter] = useState('ALL');
  const [pendingReviewScopeFilter, setPendingReviewScopeFilter] = useState('ALL');
  const [pendingReviewActiveFilter, setPendingReviewActiveFilter] = useState('ALL');

  // Pagination
  const [studentPagination, setStudentPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [facultyPagination, setFacultyPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [projectPagination, setProjectPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [teamsPagination, setTeamsPagination] = useState({ page: 1, limit: 100, total: 0, totalPages: 1 });
  const [facultyAssignmentsPagination, setFacultyAssignmentsPagination] = useState({ page: 1, limit: 100, total: 0, totalPages: 1 });

  // --- Fetch Admin Permissions ---
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const res = await api.get('/admin/my-permissions');
        setAdminPermissions(res.data);

        // If temp admin and current tab not allowed, switch to first allowed tab
        if (res.data.isTemporaryAdmin && res.data.allowedTabs && !res.data.allowedTabs.includes(activeTab)) {
          setActiveTab(res.data.allowedTabs[0] || 'overview');
        }
      } catch (err) {
        console.error("Error fetching permissions:", err);
        // Handle 404 (User deleted/Invalid Token) -> Logout
        if (err.response && err.response.status === 404) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/';
        }
      }
    };
    fetchPermissions();
  }, []);

  // --- Debouncing Logic ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedUserSearch(userSearch);
      // Reset pagination ONLY when search changes
      setStudentPagination(prev => (prev.page === 1 ? prev : { ...prev, page: 1 }));
      setFacultyPagination(prev => (prev.page === 1 ? prev : { ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(handler);
  }, [userSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedProjectSearch(projectSearch);
      setProjectPagination(prev => (prev.page === 1 ? prev : { ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(handler);
  }, [projectSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTeamSearch(teamSearch);
      setTeamsPagination(prev => (prev.page === 1 ? prev : { ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(handler);
  }, [teamSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPendingReviewSearch(pendingReviewSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [pendingReviewSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedAssignmentSearch(assignmentSearch);
      setFacultyAssignmentsPagination(prev => (prev.page === 1 ? prev : { ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(handler);
  }, [assignmentSearch]);

  // Reset page to 1 when the expired filter changes
  useEffect(() => {
    setFacultyAssignmentsPagination(prev => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [assignmentExpiredFilter]);

  // --- Load Data ---
  const refreshData = async () => {
    setIsLoading(true);
    try {
      const promises = [];
      const keys = [];

      // Determine what to fetch based on active tab
      const isOverview = activeTab === 'overview';
      const isStudents = activeTab === 'students';
      const isFaculty = activeTab === 'faculty';
      const isAdmins = activeTab === 'admins';
      const isProjects = activeTab === 'projects';
      const isTeams = activeTab === 'teams';
      const isManageTeams = activeTab === 'manage-teams';
      const isStats = activeTab === 'individual-stats';
      const isFacultyAssignments = activeTab === 'faculty-assignments';
      const isReviews = activeTab === 'reviews';

      // Always fetch stats for overview
      if (isOverview) {
        promises.push(api.get('/admin/stats', { params: { scopeId: statsScopeFilter } }));
        keys.push('stats');
      }

      // Students data
      if (isStudents || isStats) {
        promises.push(api.get('/users', {
          params: {
            role: 'STUDENT',
            page: studentPagination.page,
            limit: studentPagination.limit,
            search: debouncedUserSearch,
            sortBy: studentSort.sortBy,
            order: studentSort.order,
            scopeId: studentScopeFilter // Include Scope Filter
          }
        }));
        keys.push('students_paginated');
      }

      // Faculty data
      if (isFaculty || isManageTeams || isFacultyAssignments || isReviews || isStats) {
        promises.push(api.get('/admin/faculty-stats', { params: { search: debouncedUserSearch } }));
        keys.push('faculty_stats');
      }

      // Admins data
      if (isAdmins) {
        promises.push(api.get('/users', { params: { role: 'ADMIN', search: debouncedUserSearch } }));
        keys.push('admins');
      }

      // Projects data
      if (isProjects || isManageTeams) {
        promises.push(api.get('/projects', {
          params: {
            page: projectPagination.page,
            limit: projectPagination.limit,
            search: debouncedProjectSearch,
            status: projectFilter,
            scopeId: projectScopeFilter,
            category: projectCategoryFilter,
            hasSRS: projectSRSFilter === 'ALL' ? undefined : (projectSRSFilter === 'HAS_SRS' ? 'true' : 'false'),
            sortBy: projectSort.sortBy,
            order: projectSort.order
          }
        }));
        keys.push('projects_paginated');
      }

      // Scopes data (Fetch when Projects, Overview, or even Scopes tab is active)
      // Also fetch for Students tab now!
      if (isProjects || isOverview || activeTab === 'scopes' || isFacultyAssignments || isStats || isStudents) {
        promises.push(api.get('/scopes'));
        keys.push('scopes');

        if (isProjects) {
          promises.push(api.get('/projects/categories'));
          keys.push('categories');
        }
      }

      if (isTeams || isManageTeams || isStats || isFacultyAssignments) {
        // Use pagination for Teams Tab view
        const limit = isTeams ? teamsPagination.limit : 5000;
        const page = isTeams ? teamsPagination.page : 1;

        promises.push(api.get('/admin/teams', {
          params: {
            page: page,
            limit: limit,
            search: isTeams ? debouncedTeamSearch : undefined,
            status: isTeams ? teamFilter : undefined
          }
        }));
        keys.push('teams');
      }

      // Exhaustive lists for dropdowns/stats
      if (isManageTeams || isStats) {
        promises.push(api.get('/users', { params: { role: 'STUDENT', limit: 10000 } })); // Increased to 10000
        keys.push('allStudents');
      }
      if (isManageTeams) {
        promises.push(api.get('/projects', { params: { status: 'AVAILABLE', limit: 5000 } }));
        keys.push('allAvailableProjects');
      }
      if (isFacultyAssignments) {
        promises.push(api.get('/projects', { params: { status: 'ASSIGNED', limit: 5000 } }));
        keys.push('allAssignedProjects');
      }

      // Specialized tabs
      if (activeTab === 'faculty-assignments') {
        promises.push(api.get('/admin/faculty-assignments', {
          params: {
            page: facultyAssignmentsPagination.page,
            limit: facultyAssignmentsPagination.limit,
            search: debouncedAssignmentSearch,
            expired: assignmentExpiredFilter
          }
        }));
        keys.push('facultyAssignments');
      }
      if (activeTab === 'reviews') {
        promises.push(api.get('/reviews/assignments'));
        keys.push('reviewTeams');
      }
      if (activeTab === 'review-assignments') {
        promises.push(api.get('/admin/pending-reviews', {
          params: {
            search: debouncedPendingReviewSearch,
            phase: pendingReviewPhaseFilter,
            scopeId: pendingReviewScopeFilter,
            activeSession: pendingReviewActiveFilter
          }
        }));
        keys.push('pendingReviews');
      }

      const results = await Promise.all(promises);
      const data = {};
      keys.forEach((key, i) => { data[key] = results[i].data; });

      // Update states
      if (data.stats) setAdminStats(data.stats);
      if (data.pendingReviews) setPendingReviews(data.pendingReviews);
      if (data.students_paginated) {
        setStudents(data.students_paginated.users || []);
        setStudentPagination(prev => ({
          ...prev,
          total: data.students_paginated.pagination?.total || 0,
          totalPages: data.students_paginated.pagination?.totalPages || 1
        }));
      }
      if (data.faculty_stats) {
        setFaculty(data.faculty_stats || []);
        // Client-side pagination setup if needed, or just show all
        setFacultyPagination(prev => ({ ...prev, total: data.faculty_stats.length, totalPages: 1 }));
      }
      if (data.admins) setAdmins(data.admins.users || data.admins || []);
      if (data.projects_paginated) {
        setProjects(data.projects_paginated.projects || []);
        setProjectPagination(prev => ({ ...prev, total: data.projects_paginated.pagination?.total || 0, totalPages: data.projects_paginated.pagination?.totalPages || 1 }));
      }
      if (data.scopes) setScopes(data.scopes || []);
      if (data.categories) setCategories(data.categories || []);
      if (data.teams) {
        setTeams(data.teams.teams || data.teams || []);
        if (data.teams.pagination) {
          setTeamsPagination(prev => ({
            ...prev,
            total: data.teams.pagination.total || 0,
            totalPages: data.teams.pagination.totalPages || 1
          }));
        }
      }
      if (data.allStudents) {
        const allStuds = data.allStudents.users || [];
        setAllStudents(allStuds);
        const currentTeams = data.teams?.teams || data.teams || teams;
        const inTeamIds = new Set(currentTeams.flatMap(t => t.members.map(m => m.userId)));
        setUnassignedStudents(allStuds.filter(s => !inTeamIds.has(s.id)));
      }
      if (data.allAvailableProjects) setAllAvailableProjects(data.allAvailableProjects.projects || []);
      if (data.allAssignedProjects) setAllAssignedProjects(data.allAssignedProjects.projects || data.allAssignedProjects || []);
      if (data.facultyAssignments) {
        setFacultyAssignments(data.facultyAssignments.assignments || data.facultyAssignments || []);
        if (data.facultyAssignments.pagination) {
          setFacultyAssignmentsPagination(prev => ({
            ...prev,
            total: data.facultyAssignments.pagination.total || 0,
            totalPages: data.facultyAssignments.pagination.totalPages || 1
          }));
        }
      }
      if (data.reviewTeams) setReviewTeams(data.reviewTeams.teams || data.reviewTeams || []);

      setSelectedUserIds([]);
      setSelectedProjectIds([]);
      setSelectedTeamIds([]);
    } catch (err) {
      console.error("Failed to refresh data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { refreshData(); }, [
    activeTab,
    studentPagination.page,
    studentPagination.limit,
    studentScopeFilter, // Trigger refresh when student filter changes
    facultyPagination.page,
    facultyPagination.limit,
    projectPagination.page,
    projectPagination.limit,
    projectFilter,
    projectScopeFilter,
    statsScopeFilter,
    debouncedUserSearch,
    debouncedProjectSearch,
    studentSort.sortBy,
    studentSort.order,
    facultySort.sortBy,
    facultySort.order,
    projectSort.sortBy,
    projectSort.order,
    teamsPagination.page,
    teamsPagination.limit,
    teamFilter,
    debouncedTeamSearch,
    debouncedPendingReviewSearch,
    pendingReviewScopeFilter,
    pendingReviewActiveFilter,
    facultyAssignmentsPagination.page,
    facultyAssignmentsPagination.limit,
    debouncedAssignmentSearch,
    assignmentExpiredFilter
  ]);

  // Pagination reset is now handled in the debouncing logic above
  // to prevent race conditions between search and page state updates.


  // --- Handlers ---
  const addStudent = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', { ...newStudent, role: 'STUDENT' });
      setNewStudent({ name: '', email: '', rollNumber: '', department: '', year: '' });
      addToast("Student Added!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error adding student", 'error');
    }
  };

  const addFaculty = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', { ...newFaculty, role: 'FACULTY' });
      setNewFaculty({ name: '', email: '', rollNumber: '' });
      addToast("Faculty added successfully!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error adding faculty", 'error');
    }
  };

  const addAdmin = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', { ...newAdmin, role: 'ADMIN' });
      setNewAdmin({ name: '', email: '' });
      addToast("Admin Added!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error adding admin", 'error');
    }
  };

  const createTeamManually = async (e, scopeId) => {
    if (e) e.preventDefault();
    try {
      await api.post('/admin/create-team', { memberEmail: newTeamMemberEmail, scopeId });
      setNewTeamMemberEmail('');
      addToast("Team Created!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error creating team", 'error');
    }
  };

  const addMemberToTeam = async (e) => {
    e.preventDefault();
    if (!selectedTeamId) {
      addToast("Please select a team first", 'warning');
      return;
    }
    try {
      await api.post('/admin/add-member', { teamId: selectedTeamId, memberEmail: teamMemberEmail });
      setTeamMemberEmail('');
      addToast("Member Added to Team!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error adding member", 'error');
    }
  };

  const assignProjectToTeam = async (e) => {
    e.preventDefault();
    if (!selectedTeamId || !selectedProjectId) {
      addToast("Please select both team and project", 'warning');
      return;
    }
    try {
      await api.post('/admin/assign-project', { teamId: selectedTeamId, projectId: selectedProjectId });
      setSelectedTeamId('');
      setSelectedProjectId('');
      addToast("Project Assigned!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error assigning project", 'error');
    }
  };



  const assignFacultyToProject = async (e) => {
    e.preventDefault();
    if (!selectedProjectForFaculty || !selectedFacultyId) {
      addToast("Please select both project and faculty", 'warning');
      return;
    }
    try {
      const payload = {
        projectId: selectedProjectForFaculty,
        facultyId: selectedFacultyId,
        reviewPhase: parseInt(reviewPhase),
        mode: reviewMode,
        accessStartsAt: accessStartsAt || null
      };

      if (accessDurationHours && parseInt(accessDurationHours) > 0) {
        payload.accessDurationHours = parseInt(accessDurationHours);
      }

      await api.post('/admin/assign-faculty', payload);
      setSelectedProjectForFaculty('');
      setSelectedFacultyId('');
      setAccessDurationHours(null);
      setAccessStartsAt('');
      setReviewPhase("1");
      setReviewMode('OFFLINE');
      setReviewMode('OFFLINE');
      addToast(accessDurationHours ? `Faculty Assigned with ${accessDurationHours}h access!` : "Faculty Assigned with Permanent Access!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error assigning faculty", 'error');
    }
  };

  const unassignFaculty = async (assignmentId, facultyName, projectTitle) => {
    if (!await confirm(`Remove ${facultyName} from reviewing "${projectTitle}"?`, 'Confirm Unassignment', 'danger')) {
      return;
    }
    try {
      await api.delete(`/admin/unassign-faculty/${assignmentId}`);
      addToast("Faculty unassigned successfully!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error removing assignment", 'error');
    }
  };

  const updateFacultyAccess = async (assignmentId, accessDurationHours) => {
    try {
      await api.post('/admin/update-faculty-access', {
        assignmentId,
        accessDurationHours
      });
      addToast("Faculty access duration updated!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error updating access duration", 'error');
    }
  };

  const bulkUpdateFacultyAccess = async (assignmentIds, accessDurationHours) => {
    try {
      await api.post('/admin/bulk-update-faculty-access', {
        assignmentIds,
        accessDurationHours
      });
      addToast(`Access duration updated for ${assignmentIds.length} faculty assignments!`, 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error during bulk access update", 'error');
    }
  };

  const addProject = async (e) => {
    e.preventDefault();
    try {
      await api.post('/projects', newProj);
      setNewProj({ title: '', category: '', maxTeamSize: 3, description: '', scopeId: '', techStack: '', srs: '' });
      addToast("Project Created!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error adding project", 'error');
    }
  };

  // --- BULK HANDLERS ---
  const [bulkModal, setBulkModal] = useState({ isOpen: false, type: 'STUDENT' });
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [releaseReviewsModalOpen, setReleaseReviewsModalOpen] = useState(false);

  // Review Assignments State
  const [selectedReviewIds, setSelectedReviewIds] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [manualFacultyAssignments, setManualFacultyAssignments] = useState({});
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  const handleAutoAssignReviews = async () => {
    if (selectedReviewIds.length === 0) {
      addToast("Please select at least one team to assign.", 'warning');
      return;
    }

    // Filter manual assignments to only include those that are selected
    const activeManualAssignments = {};
    selectedReviewIds.forEach(id => {
      if (manualFacultyAssignments[id]) {
        activeManualAssignments[id] = manualFacultyAssignments[id];
      }
    });

    if (!await confirm(`Auto-assign reviews for ${selectedReviewIds.length} teams?`, 'Confirm Auto-Assignment')) return;
    setIsAutoAssigning(true);
    try {
      const res = await api.post('/admin/auto-assign-reviews', {
        teamIds: selectedReviewIds,
        manualAssignments: activeManualAssignments
      });
      addToast(`Success: ${res.data.successCount} Assigned, ${res.data.failCount} Failed.`, 'success');
      refreshData();
      setSelectedReviewIds([]);
      setManualFacultyAssignments({});
    } catch (err) {
      addToast(err.response?.data?.error || "Error auto-assigning reviews", 'error');
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const toggleReviewSelection = (id) => {
    setSelectedReviewIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Release Guide Reviews Handler
  const handleReleaseGuideReviews = async (payload) => {
    try {
      const res = await api.post('/admin/auto-assign-guide-reviews', payload);
      addToast(res.data.message, 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error releasing reviews", 'error');
      throw err;
    }
  };

  const handleBulkImport = async (data) => {
    try {
      if (bulkModal.type === 'PROJECT') {
        const res = await api.post('/projects/bulk', { projects: data });
        addToast(`Successfully imported ${res.data.count} projects!`, 'success');
      } else {
        const res = await api.post('/users/bulk', { users: data });
        addToast(`Successfully imported ${res.data.count} ${bulkModal.type.toLowerCase()}s!`, 'success');
      }
      await refreshData();
      await refreshData();
    } catch (err) {
      throw err; // Let modal handle error toast
    }
  };

  const updateUser = async (userId, data) => {
    try {
      await api.patch(`/users/${userId}`, data);
      addToast("User updated successfully!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error updating user", 'error');
    }
  };
  const updateProject = async (projectId, data) => {
    try {
      await api.patch(`/projects/${projectId}`, data);
      addToast("Project updated successfully!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error updating project", 'error');
    }
  };

  const updateMark = async (markId, marks, studentId) => {
    try {
      if (markId && markId.startsWith('new-')) {
        const reviewId = markId.split('-')[1];
        await api.post('/reviews/marks', { reviewId, studentId, marks });
      } else {
        await api.patch(`/reviews/marks/${markId}`, { marks });
      }
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error updating mark", 'error');
    }
  };

  const updateReview = async (reviewId, data) => {
    try {
      await api.patch(`/reviews/${reviewId}`, data);
      await refreshData();
    } catch (err) {
    }
  };

  // --- DELETE HANDLERS ---
  const deleteUser = async (userId, userName, userRole) => {
    if (!await confirm(`Are you sure you want to delete ${userName} (${userRole})?\n\nThis action cannot be undone.`, 'Delete User', 'danger')) {
      return;
    }
    try {
      await api.delete(`/users/${userId}`);
      addToast("User deleted successfully!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error deleting user. User may be part of a team.", 'error');
    }
  };

  const bulkDeleteUsers = async (ids, type = 'students') => {
    if (!ids || ids.length === 0) return;
    if (!await confirm(`Are you sure you want to delete ${ids.length} selected ${type}?`, 'Bulk Delete', 'danger')) {
      return;
    }
    try {
      const res = await api.post('/users/bulk-delete', { ids });
      addToast(res.data.message, 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error during bulk deletion", 'error');
    }
  };

  const toggleTempAdmin = async (userId, grant, allowedTabs = []) => {
    try {
      await api.post('/admin/toggle-temp-admin', { userId, grant, allowedTabs });
      addToast(`Temporary admin access ${grant ? 'granted' : 'revoked'} successfully!`, 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error updating admin access", 'error');
    }
  };

  const isRealAdmin = currentUser?.role === 'ADMIN';

  const deleteProject = async (projectId, projectTitle) => {
    if (!await confirm(`Are you sure you want to delete project "${projectTitle}"?\n\nThis action cannot be undone.`, 'Delete Project', 'danger')) {
      return;
    }
    try {
      await api.delete(`/projects/${projectId}`);
      addToast("Project deleted successfully!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error deleting project. It may be assigned to a team.", 'error');
    }
  };

  const bulkDeleteProjects = async (ids) => {
    if (!ids || ids.length === 0) return;
    if (!await confirm(`Are you sure you want to delete ${ids.length} selected projects?`, 'Bulk Delete Projects', 'danger')) {
      return;
    }
    try {
      const res = await api.post('/projects/bulk-delete', { ids });
      addToast(res.data.message, 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error during bulk deletion", 'error');
    }
  };

  const deleteTeam = async (teamId, leaderName) => {
    if (!await confirm(`Are you sure you want to delete the team led by ${leaderName}?\n\nThis will remove all team members and unassign the project.\n\nThis action cannot be undone.`, 'Delete Team', 'danger')) {
      return;
    }
    try {
      await api.delete(`/teams/${teamId}`);
      addToast("Team deleted successfully!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error deleting team", 'error');
    }
  };

  const updateTeamStatus = async (teamId, status) => {
    try {
      await api.patch(`/teams/${teamId}/status`, { status });
      addToast(`Team status updated to ${status}`, 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error updating team status", 'error');
    }
  };

  const updateTeamStatusBulk = async (teamIds, status) => {
    try {
      await api.post('/admin/teams/bulk-status', { teamIds, status });
      addToast(`Successfully updated ${teamIds.length} teams to ${status}`, 'success');
      setSelectedTeamIds([]);
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error during bulk status update", 'error');
    }
  };

  const removeMemberFromTeam = async (teamId, userId, userName) => {
    if (!await confirm(`Are you sure you want to remove ${userName} from the team?`, 'Remove Member', 'danger')) {
      return;
    }
    try {
      const res = await api.post('/admin/remove-member', { teamId, userId });
      addToast(res.data.message, 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error removing member", 'error');
    }
  };

  const changeTeamLeader = async (teamId, newLeaderId, userName) => {
    if (!await confirm(`Set ${userName} as the new team leader?`, 'Change Leader')) {
      return;
    }
    try {
      await api.post('/admin/change-leader', { teamId, newLeaderId });
      addToast("Team leader updated successfully!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error updating leader", 'error');
    }
  };

  const unassignProjectFromTeam = async (teamId, projectTitle) => {
    if (!await confirm(`Are you sure you want to unassign project "${projectTitle}" from this team?\n\nThis will free the project and reset the team status.`, 'Unassign Project', 'danger')) {
      return;
    }
    try {
      await api.post('/admin/unassign-project', { teamId });
      addToast("Project unassigned successfully!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error unassigning project", 'error');
    }
  };

  // --- FILTER LOGIC ---
  const safeIncludes = (text, term) => text && text.toLowerCase().includes(term.toLowerCase());

  const allUsers = [...students, ...faculty, ...admins];

  const filteredStudents = students;
  const filteredFaculty = faculty;
  const filteredAdmins = admins;

  const filteredProjects = projects;

  const filteredTeams = teams.filter(t => {
    const term = teamSearch.toLowerCase();
    const matchSearch = (t.project && safeIncludes(t.project.title, term)) ||
      t.members.some(m => safeIncludes(m.user.name, term) || safeIncludes(m.user.rollNumber, term));
    const matchStatus = teamFilter === 'ALL' || t.status === teamFilter;
    return matchSearch && matchStatus;
  });

  const filteredFacultyAssignments = facultyAssignments.filter(a => {
    const term = assignmentSearch.toLowerCase();
    return safeIncludes(a.faculty?.name, term) ||
      safeIncludes(a.project?.title, term) ||
      (a.project?.team?.members?.some(m => safeIncludes(m.user.name, term)));
  });

  // Calculate Eligible Faculty (Load < 4 teams)
  const eligibleFaculty = faculty.map(f => {
    // Count teams where this faculty is guide or expert
    const count = teams.filter(t => t.guideId === f.id || t.subjectExpertId === f.id).length;
    return { ...f, count, isEligible: count < 4 };
  }).filter(f => f.isEligible);

  const assignSoloProject = async (studentId, projectId) => {
    try {
      await api.post('/admin/assign-solo-project', { studentId, projectId });
      addToast("Solo Project Assigned successfully!", 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error assigning solo project", 'error');
    }
  };

  const unassignFacultyFromTeam = async (teamId, role) => {
    if (!await confirm(`Are you sure you want to unassign the ${role.toLowerCase()} from this team?`, 'Unassign Faculty', 'danger')) return;
    try {
      await api.post('/admin/unassign-team-faculty', { teamId, role });
      addToast(`${role} unassigned successfully`, 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error unassigning faculty", 'error');
    }
  };

  const assignFacultyToTeam = async (teamId, facultyId, role) => {
    try {
      await api.post('/admin/assign-team-faculty', { teamId, facultyId, role });
      addToast(`${role} assigned successfully`, 'success');
      await refreshData();
    } catch (err) {
      addToast(err.response?.data?.error || "Error assigning faculty", 'error');
    }
  };

  // Auto-expand group containing active tab
  useEffect(() => {
    sidebarGroups.forEach(group => {
      if (group.items.some(item => item.id === activeTab)) {
        if (!expandedGroups.includes(group.title)) {
          setExpandedGroups(prev => [...prev, group.title]);
        }
      }
    });
  }, [activeTab]);

  const toggleGroup = (title) => {
    setExpandedGroups(prev =>
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    );
  };

  // Filter sidebar groups based on permissions
  const sidebarGroups = [
    {
      title: "General",
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'settings', label: 'System Settings', icon: Settings },
      ]
    },
    {
      title: "User Management",
      items: [
        { id: 'students', label: 'Students', icon: User },
        { id: 'faculty', label: 'Faculty', icon: GraduationCap },
        { id: 'admins', label: 'Admins', icon: ShieldCheck },
      ]
    },
    {
      title: "Projects & Teams",
      items: [
        { id: 'scopes', label: 'Project Batches', icon: Folder },
        { id: 'projects', label: 'Projects', icon: Folder },
        { id: 'project-requests', label: 'Project Requests', icon: MessageSquare },
        { id: 'student-request-status', label: 'Request Status List', icon: ClipboardCheck },
        { id: 'teams', label: 'Teams', icon: Users },
        { id: 'manage-teams', label: 'Manage Teams', icon: Settings },
        { id: 'venues-schedule', label: 'Venues & Schedule', icon: Calendar },
        { id: 'faculty-assignments', label: 'Faculty Assignments', icon: LinkIcon },
      ]
    },
    {
      title: "Evaluation & Analytics",
      items: [
        { id: 'rubrics', label: 'Rubrics', icon: LayoutList },
        { id: 'review-assignments', label: 'Review Assignments', icon: CheckCircle },
        { id: 'reviews', label: 'Reviews', icon: CheckSquare },
        { id: 'absentees', label: 'Absentees Report', icon: UserX },
        { id: 'individual-stats', label: 'Student Stats', icon: BarChart2 },
      ]
    }
  ].map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (adminPermissions.hasFullAccess) return true;
      return adminPermissions.allowedTabs?.includes(item.id);
    })
  })).filter(group => group.items.length > 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="flex">
        {/* Sidebar */}
        <aside
          className="w-56 bg-white border-r border-slate-200 h-screen fixed top-0 hidden lg:block overflow-y-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', zIndex: 60 }}
        >
          {/* Webkit scrollbar hide */}
          <style>{`
            aside::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          <div className="p-4">
            <div className="mb-8 px-3">
              <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <ShieldCheck className="text-white" size={18} />
                </div>
                Admin Portal
              </h1>
              {!isRealAdmin && (
                <div className="mt-2 bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-100 flex items-center gap-2 inline-flex">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                  Limited Access
                </div>
              )}
            </div>

            {currentUser?.role === 'FACULTY' && (
              <div className="px-4 mb-6">
                <Link
                  to="/faculty"
                  className="flex items-center gap-2 w-full px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold border border-slate-100 hover:bg-white hover:shadow-sm transition-all"
                >
                  <ArrowLeft size={14} /> Back to Faculty View
                </Link>
              </div>
            )}

            <nav className="space-y-4">
              {sidebarGroups.map((group) => {
                const isExpanded = expandedGroups.includes(group.title);

                return (
                  <div key={group.title} className="space-y-1">
                    <button
                      onClick={() => toggleGroup(group.title)}
                      className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-slate-600 transition-colors"
                    >
                      {group.title}
                      <ChevronRight
                        size={12}
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                        {group.items.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group ${activeTab === item.id
                              ? 'bg-blue-50 text-blue-700 shadow-sm'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <item.icon
                                size={18}
                                className={`${activeTab === item.id ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}
                              />
                              <span className="text-sm font-bold tracking-tight">{item.label}</span>
                            </div>
                            {activeTab === item.id && <ChevronRight size={14} className="text-blue-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Wrapper for Navbar + Content */}
        <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
          <Navbar compact variant="light" />

          {/* Main Content Area */}
          <main className="flex-1 p-8 lg:p-12 max-w-[1600px] mx-auto w-full">
            {/* Header Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
              <div>
                <h2 className="text-3xl font-black text-slate-900 capitalize tracking-tight">
                  {activeTab.replace('-', ' ')}
                </h2>
                <p className="text-slate-500 text-sm mt-1 font-medium">Manage your project portal {activeTab.replace('-', ' ')} section.</p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={() => setExportModalOpen(true)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-slate-200 active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Export Data
                </button>
                <button
                  onClick={refreshData}
                  disabled={isLoading}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                >
                  <RefreshCcw size={18} className={`${isLoading ? "animate-spin" : ""} text-slate-400`} />
                  {isLoading ? "Syncing..." : "Refresh"}
                </button>
              </div>
            </div>

            <div className="relative animate-in fade-in duration-500">

              {/* Tab Content */}
              {activeTab === 'settings' && <SettingsTab />}
              {activeTab === 'scopes' && <ProjectScopesTab />}
              {activeTab === 'overview' && (
                <OverviewDashboardTab
                  users={allUsers}
                  projects={projects}
                  teams={teams}
                  stats={adminStats}
                  onNavigate={setActiveTab}
                  scopes={scopes}
                  statsScopeFilter={statsScopeFilter}
                  setStatsScopeFilter={setStatsScopeFilter}
                />
              )}

              {activeTab === 'students' && (
                <StudentsTab
                  filteredStudents={filteredStudents}
                  newStudent={newStudent}
                  setNewStudent={setNewStudent}
                  addStudent={addStudent}
                  deleteUser={deleteUser}
                  userSearch={userSearch}
                  setUserSearch={setUserSearch}
                  openBulk={() => setBulkModal({ isOpen: true, type: 'STUDENT' })}
                  selectedIds={selectedUserIds}
                  setSelectedIds={setSelectedUserIds}
                  bulkDelete={bulkDeleteUsers}
                  pagination={studentPagination}
                  setPagination={setStudentPagination}
                  sortConfig={studentSort}
                  onSort={setStudentSort}
                  updateUser={updateUser}
                  studentScopeFilter={studentScopeFilter}
                  setStudentScopeFilter={setStudentScopeFilter}
                  scopes={scopes}
                />
              )}

              {activeTab === 'project-requests' && (
                <ProjectRequestsTab scopes={scopes} />
              )}

              {activeTab === 'student-request-status' && (
                <StudentRequestStatusTab scopes={scopes} />
              )}

              {activeTab === 'individual-stats' && (
                <IndividualStatsTab
                  users={allStudents}
                  teams={teams}
                  onBack={() => setActiveTab('overview')}
                  updateMark={updateMark}
                  updateReview={updateReview}
                  scopes={scopes}
                />
              )}

              {activeTab === 'faculty' && (
                <FacultyTab
                  filteredFaculty={filteredFaculty}
                  newFaculty={newFaculty}
                  setNewFaculty={setNewFaculty}
                  addFaculty={addFaculty}
                  deleteUser={deleteUser}
                  toggleTempAdmin={toggleTempAdmin}
                  isRealAdmin={isRealAdmin}
                  userSearch={userSearch}
                  setUserSearch={setUserSearch}
                  openBulk={() => setBulkModal({ isOpen: true, type: 'FACULTY' })}
                  selectedIds={selectedUserIds}
                  setSelectedIds={setSelectedUserIds}
                  bulkDelete={bulkDeleteUsers}
                  pagination={facultyPagination}
                  setPagination={setFacultyPagination}
                  sortConfig={facultySort}
                  onSort={setFacultySort}
                  updateUser={updateUser}
                />
              )}

              {activeTab === 'admins' && (
                <AdminsTab
                  filteredAdmins={filteredAdmins}
                  newAdmin={newAdmin}
                  setNewAdmin={setNewAdmin}
                  addAdmin={addAdmin}
                  deleteUser={deleteUser}
                  userSearch={userSearch}
                  setUserSearch={setUserSearch}
                />
              )}

              {activeTab === 'projects' && (
                <ProjectsTab
                  filteredProjects={filteredProjects}
                  deleteProject={deleteProject}
                  projectSearch={projectSearch}
                  setProjectSearch={setProjectSearch}
                  projectFilter={projectFilter}
                  setProjectFilter={setProjectFilter}
                  scopeFilter={projectScopeFilter}
                  setScopeFilter={setProjectScopeFilter}
                  selectedIds={selectedProjectIds}
                  setSelectedIds={setSelectedProjectIds}
                  bulkDelete={bulkDeleteProjects}
                  pagination={projectPagination}
                  setPagination={setProjectPagination}
                  sortConfig={projectSort}
                  onSort={setProjectSort}
                  updateProject={updateProject}
                  scopes={scopes} // Pass scopes
                  categories={categories}
                  categoryFilter={projectCategoryFilter}
                  setCategoryFilter={setProjectCategoryFilter}
                  srsFilter={projectSRSFilter}
                  setSrsFilter={setProjectSRSFilter}
                />
              )}

              {activeTab === 'teams' && (
                <TeamsTab
                  teams={filteredTeams}
                  deleteTeam={deleteTeam}
                  teamSearch={teamSearch}
                  setTeamSearch={setTeamSearch}
                  teamFilter={teamFilter}
                  setTeamFilter={setTeamFilter}
                  pagination={teamsPagination}
                  setPagination={setTeamsPagination}
                  updateTeamStatus={updateTeamStatus}
                  selectedIds={selectedTeamIds}
                  setSelectedIds={setSelectedTeamIds}
                  updateTeamStatusBulk={updateTeamStatusBulk}
                />
              )}

              {activeTab === 'manage-teams' && (
                <ManageTeamsTab
                  teams={teams}
                  projects={allAvailableProjects}
                  users={allStudents}
                  scopes={scopes}
                  newTeamMemberEmail={newTeamMemberEmail}
                  setNewTeamMemberEmail={setNewTeamMemberEmail}
                  createTeamManually={createTeamManually}
                  selectedTeamId={selectedTeamId}
                  setSelectedTeamId={setSelectedTeamId}
                  teamMemberEmail={teamMemberEmail}
                  setTeamMemberEmail={setTeamMemberEmail}
                  addMemberToTeam={addMemberToTeam}
                  selectedProjectId={selectedProjectId}
                  setSelectedProjectId={setSelectedProjectId}
                  assignProjectToTeam={assignProjectToTeam}
                  removeMember={removeMemberFromTeam}
                  changeLeader={changeTeamLeader}
                  unassignProject={unassignProjectFromTeam}
                  assignSoloProject={assignSoloProject}
                  unassignFacultyFromTeam={unassignFacultyFromTeam}
                  assignFacultyToTeam={assignFacultyToTeam}
                  facultyList={eligibleFaculty}

                />
              )}

              {activeTab === 'venues-schedule' && (
                <VenueSchedulerTab scopes={scopes} />
              )}

              {activeTab === 'faculty-assignments' && (
                <FacultyAssignmentsTab
                  projects={allAssignedProjects}
                  teams={teams}
                  selectedProjectForFaculty={selectedProjectForFaculty}
                  setSelectedProjectForFaculty={setSelectedProjectForFaculty}
                  selectedFacultyId={selectedFacultyId}
                  setSelectedFacultyId={setSelectedFacultyId}
                  accessDurationHours={accessDurationHours}
                  setAccessDurationHours={setAccessDurationHours}
                  reviewPhase={reviewPhase}
                  setReviewPhase={setReviewPhase}
                  reviewMode={reviewMode}
                  setReviewMode={setReviewMode}
                  accessStartsAt={accessStartsAt}
                  setAccessStartsAt={setAccessStartsAt}
                  assignFacultyToProject={assignFacultyToProject}
                  facultyAssignments={facultyAssignments}
                  unassignFaculty={unassignFaculty}
                  updateFacultyAccess={updateFacultyAccess}
                  bulkUpdateFacultyAccess={bulkUpdateFacultyAccess}
                  users={faculty}
                  assignmentSearch={assignmentSearch}
                  setAssignmentSearch={setAssignmentSearch}
                  pagination={facultyAssignmentsPagination}
                  setPagination={setFacultyAssignmentsPagination}
                  expiredFilter={assignmentExpiredFilter}
                  setExpiredFilter={setAssignmentExpiredFilter}
                  loadData={refreshData}
                  onOpenReleaseReviews={() => setReleaseReviewsModalOpen(true)}
                  scopes={scopes}
                  api={api}
                />
              )}



              {activeTab === 'rubrics' && <RubricsTab />}

              {activeTab === 'review-assignments' && (
                <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Review Assignments</h2>
                        <p className="text-slate-500 font-medium">Approve and auto-assign reviews to venue faculty.</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {pendingReviews.length > 0 && (
                          <div className="text-sm font-bold text-slate-500">
                            {selectedReviewIds.length} selected
                          </div>
                        )}
                        <button
                          onClick={() => handleAutoAssignReviews()}
                          disabled={selectedReviewIds.length === 0 || isAutoAssigning}
                          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 flex items-center gap-2 relative overflow-hidden"
                        >
                          {isAutoAssigning ? (
                            <>
                              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                              Assigning...
                            </>
                          ) : (
                            <>
                              <CheckCircle size={20} /> Auto-Assign Selected
                            </>
                          )}
                          {isAutoAssigning && (
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-400/30">
                              <div className="h-full bg-white/80 rounded-full animate-[indeterminate_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
                            </div>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Filters Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search (Project, Student, Faculty)..."
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400 placeholder:font-medium transition-all"
                          value={pendingReviewSearch}
                          onChange={(e) => setPendingReviewSearch(e.target.value)}
                        />
                        <div className="absolute left-3.5 top-2.5 text-slate-400">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                      </div>

                      <select
                        value={pendingReviewScopeFilter}
                        onChange={(e) => setPendingReviewScopeFilter(e.target.value)}
                        className="px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="ALL">All Batches</option>
                        {scopes.map(scope => (
                          <option key={scope.id} value={scope.id}>{scope.name}</option>
                        ))}
                      </select>

                      <select
                        value={pendingReviewPhaseFilter}
                        onChange={(e) => setPendingReviewPhaseFilter(e.target.value)}
                        className="px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="ALL">All Phases</option>
                        <option value="1">Phase 1</option>
                        <option value="2">Phase 2</option>
                        <option value="3">Phase 3</option>
                        <option value="4">Phase 4</option>
                      </select>

                      <select
                        value={pendingReviewActiveFilter}
                        onChange={(e) => setPendingReviewActiveFilter(e.target.value)}
                        className="px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="ALL">All Sessions</option>
                        <option value="true">Active Session On-going</option>
                        <option value="false">No Active Session</option>
                      </select>
                    </div>
                  </div>

                  {pendingReviews.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckSquare className="text-slate-300" size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-700">All Caught Up!</h3>
                      <p className="text-slate-400">No pending review requests at the moment.</p>
                    </div>
                  ) : (
                    Object.entries(
                      pendingReviews.reduce((acc, team) => {
                        const batchName = team.scope?.name || 'Unknown Batch';
                        const phase = `Phase ${team.nextPhase}`;
                        const key = `${batchName} - ${phase}`;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(team);
                        return acc;
                      }, {})
                    ).map(([groupTitle, groupTeams]) => (
                      <div key={groupTitle} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                          <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Folder size={18} className="text-indigo-500" />
                            {groupTitle}
                            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full border border-indigo-200">
                              {groupTeams.length} Requests
                            </span>
                          </h3>
                          <button
                            onClick={() => {
                              const groupIds = groupTeams.map(t => t.id);
                              const allSelected = groupIds.every(id => selectedReviewIds.includes(id));
                              if (allSelected) {
                                setSelectedReviewIds(prev => prev.filter(id => !groupIds.includes(id)));
                              } else {
                                setSelectedReviewIds(prev => [...new Set([...prev, ...groupIds])]);
                              }
                            }}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                          >
                            {groupTeams.every(t => selectedReviewIds.includes(t.id)) ? 'Deselect Group' : 'Select Group'}
                          </button>
                        </div>

                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-100">
                              <th className="p-4 font-bold text-center w-12">
                                <span className="sr-only">Select</span>
                              </th>
                              <th className="p-4 font-bold">Team / Project</th>
                              <th className="p-4 font-bold">Current Venue / Suggested Faculty</th>
                              <th className="p-4 font-bold">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {groupTeams.map(team => (
                              <tr key={team.id} className={`hover:bg-slate-50/80 transition-colors ${selectedReviewIds.includes(team.id) ? 'bg-indigo-50/30' : ''}`}>
                                <td className="p-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedReviewIds.includes(team.id)}
                                    onChange={() => toggleReviewSelection(team.id)}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="p-4">
                                  <div className="font-bold text-slate-800">{team.project?.title || "No Project Assigned"}</div>
                                  <div className="mt-2 space-y-1">
                                    {team.members?.map(m => (
                                      <div key={m.userId} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded w-fit">
                                        <span className="font-bold">{m.user.name}</span>
                                        <span className="font-mono text-slate-400">({m.user.rollNumber})</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    {team.project?.title && (
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                        {team.project.category}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4">
                                  {team.suggestedFaculty ? (
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold border border-indigo-200 shadow-sm">
                                        {team.suggestedFaculty.name[0]}
                                      </div>
                                      <div>
                                        <div className="text-sm font-bold text-slate-700">{team.suggestedFaculty.name}</div>
                                        <div className="text-xs text-slate-500">Active in Venue</div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 w-fit">
                                        <AlertCircle size={16} />
                                        <div>
                                          <div className="text-xs font-bold">No Active Session</div>
                                          <div className="text-[10px] opacity-80">Manual assignment required</div>
                                        </div>
                                      </div>
                                      <select
                                        className="text-[10px] font-bold border-slate-200 rounded-lg p-1.5 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm"
                                        value={manualFacultyAssignments[team.id] || ''}
                                        onChange={(e) => setManualFacultyAssignments(prev => ({ ...prev, [team.id]: e.target.value }))}
                                      >
                                        <option value="">Pick Faculty Override...</option>
                                        {faculty.map(f => (
                                          <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <span className="relative flex h-2.5 w-2.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                    </span>
                                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Ready</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
                <ReviewsTab
                  api={api}
                  scopes={scopes}
                />
              )}

              {activeTab === 'absentees' && (
                <AbsenteesTab scopes={scopes} />
              )}

            </div>

            <BulkImportModal
              isOpen={bulkModal.isOpen}
              onClose={() => setBulkModal({ ...bulkModal, isOpen: false })}
              type={bulkModal.type}
              onImport={handleBulkImport}
            />

            <ExportSelectionModal
              isOpen={exportModalOpen}
              onClose={() => setExportModalOpen(false)}
              onExport={async (selectedSheets) => {
                try {
                  const sheetsParam = selectedSheets.join(',');
                  const response = await api.get(`/export/all?sheets=${sheetsParam}`, { responseType: 'blob' });
                  const url = window.URL.createObjectURL(new Blob([response.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `portal_export_${new Date().toISOString().split('T')[0]}.xlsx`);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                } catch (err) {
                  addToast('Error exporting data: ' + (err.response?.data?.error || err.message), 'error');
                }
              }}
            />
          </main>
        </div>
      </div>
      <ReleaseReviewsModal
        isOpen={releaseReviewsModalOpen}
        onClose={() => setReleaseReviewsModalOpen(false)}
        scopes={scopes}
        onRelease={handleReleaseGuideReviews}
      />
    </div>
  );
}