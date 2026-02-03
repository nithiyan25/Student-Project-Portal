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
  LogOut
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

// Import extracted tab components
import StudentsTab from '../components/admin/StudentsTab';
import FacultyTab from '../components/admin/FacultyTab';
import AdminsTab from '../components/admin/AdminsTab';
import ProjectsTab from '../components/admin/ProjectsTab';
import TeamsTab from '../components/admin/TeamsTab';
import ManageTeamsTab from '../components/admin/ManageTeamsTab';
import FacultyAssignmentsTab from '../components/admin/FacultyAssignmentsTab';
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

export default function AdminDashboard() {
  const { user: currentUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedGroups, setExpandedGroups] = useState(['General']); // Default open group
  const [adminPermissions, setAdminPermissions] = useState({ hasFullAccess: true, allowedTabs: null });

  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [unassignedStudents, setUnassignedStudents] = useState([]);
  const [allSoloProjects, setAllSoloProjects] = useState([]);
  const [allAssignedProjects, setAllAssignedProjects] = useState([]);
  const [projects, setProjects] = useState([]);
  const [scopes, setScopes] = useState([]); // New Scopes State
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
  const [statsScopeFilter, setStatsScopeFilter] = useState('ALL'); // Batch filter for Overview Stats

  // New States for Search & Filtering
  const [teamSearch, setTeamSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [assignmentSearch, setAssignmentSearch] = useState('');

  // Sorting States
  const [studentSort, setStudentSort] = useState({ sortBy: 'createdAt', order: 'desc' });
  const [facultySort, setFacultySort] = useState({ sortBy: 'createdAt', order: 'desc' });
  const [projectSort, setProjectSort] = useState({ sortBy: 'createdAt', order: 'desc' });

  // Bulk Selection
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);

  // Pagination
  const [studentPagination, setStudentPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [facultyPagination, setFacultyPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [projectPagination, setProjectPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });

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
          params: { role: 'STUDENT', page: studentPagination.page, limit: studentPagination.limit, search: debouncedUserSearch, sortBy: studentSort.sortBy, order: studentSort.order }
        }));
        keys.push('students_paginated');
      }

      // Faculty data
      if (isFaculty || isManageTeams || isFacultyAssignments || isReviews || isStats) {
        promises.push(api.get('/admin/faculty-stats'));
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
          params: { page: projectPagination.page, limit: projectPagination.limit, search: debouncedProjectSearch, status: projectFilter, scopeId: projectScopeFilter, sortBy: projectSort.sortBy, order: projectSort.order }
        }));
        keys.push('projects_paginated');
      }

      // Scopes data (Fetch when Projects, Overview, or even Scopes tab is active)
      if (isProjects || isOverview || activeTab === 'scopes' || isFacultyAssignments || isStats) {
        promises.push(api.get('/scopes'));
        keys.push('scopes');
      }

      // Teams data
      if (isTeams || isManageTeams || isStats || isFacultyAssignments) {
        promises.push(api.get('/admin/teams', { params: { limit: 5000 } }));
        keys.push('teams');
      }

      // Exhaustive lists for dropdowns/stats
      if (isManageTeams || isStats) {
        promises.push(api.get('/users', { params: { role: 'STUDENT', limit: 5000 } }));
        keys.push('allStudents');
      }
      if (isManageTeams) {
        promises.push(api.get('/projects', { params: { status: 'AVAILABLE', limit: 5000 } }));
        keys.push('allSoloProjects');
      }
      if (isFacultyAssignments) {
        promises.push(api.get('/projects', { params: { status: 'ASSIGNED', limit: 5000 } }));
        keys.push('allAssignedProjects');
      }

      // Specialized tabs
      if (activeTab === 'faculty-assignments') {
        promises.push(api.get('/admin/faculty-assignments'));
        keys.push('facultyAssignments');
      }
      if (activeTab === 'reviews') {
        promises.push(api.get('/reviews/assignments'));
        keys.push('reviewTeams');
      }

      const results = await Promise.all(promises);
      const data = {};
      keys.forEach((key, i) => { data[key] = results[i].data; });

      // Update states
      if (data.stats) setAdminStats(data.stats);
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
      if (data.teams) setTeams(data.teams.teams || data.teams || []);
      if (data.allStudents) {
        const allStuds = data.allStudents.users || [];
        setAllStudents(allStuds);
        const currentTeams = data.teams?.teams || data.teams || teams;
        const inTeamIds = new Set(currentTeams.flatMap(t => t.members.map(m => m.userId)));
        setUnassignedStudents(allStuds.filter(s => !inTeamIds.has(s.id)));
      }
      if (data.allSoloProjects) setAllSoloProjects((data.allSoloProjects.projects || []).filter(p => p.maxTeamSize === 1));
      if (data.allAssignedProjects) setAllAssignedProjects(data.allAssignedProjects.projects || data.allAssignedProjects || []);
      if (data.facultyAssignments) setFacultyAssignments(data.facultyAssignments.assignments || data.facultyAssignments || []);
      if (data.reviewTeams) setReviewTeams(data.reviewTeams.teams || data.reviewTeams || []);

      setSelectedUserIds([]);
      setSelectedProjectIds([]);
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
    projectSort.order
  ]);

  // Pagination reset is now handled in the debouncing logic above
  // to prevent race conditions between search and page state updates.


  // --- Handlers ---
  const addStudent = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', { ...newStudent, role: 'STUDENT' });
      setNewStudent({ name: '', email: '', rollNumber: '', department: '', year: '' });
      alert("Student Added!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error adding student");
    }
  };

  const addFaculty = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', { ...newFaculty, role: 'FACULTY' });
      setNewFaculty({ name: '', email: '', rollNumber: '' });
      alert("Faculty added successfully!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error adding faculty");
    }
  };

  const addAdmin = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', { ...newAdmin, role: 'ADMIN' });
      setNewAdmin({ name: '', email: '' });
      alert("Admin Added!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error adding admin");
    }
  };

  const createTeamManually = async (e, scopeId) => {
    if (e) e.preventDefault();
    try {
      await api.post('/admin/create-team', { memberEmail: newTeamMemberEmail, scopeId });
      setNewTeamMemberEmail('');
      alert("Team Created!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error creating team");
    }
  };

  const addMemberToTeam = async (e) => {
    e.preventDefault();
    if (!selectedTeamId) {
      alert("Please select a team first");
      return;
    }
    try {
      await api.post('/admin/add-member', { teamId: selectedTeamId, memberEmail: teamMemberEmail });
      setTeamMemberEmail('');
      alert("Member Added to Team!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error adding member");
    }
  };

  const assignProjectToTeam = async (e) => {
    e.preventDefault();
    if (!selectedTeamId || !selectedProjectId) {
      alert("Please select both team and project");
      return;
    }
    try {
      await api.post('/admin/assign-project', { teamId: selectedTeamId, projectId: selectedProjectId });
      setSelectedTeamId('');
      setSelectedProjectId('');
      alert("Project Assigned!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error assigning project");
    }
  };

  const assignFacultyToProject = async (e) => {
    e.preventDefault();
    if (!selectedProjectForFaculty || !selectedFacultyId) {
      alert("Please select both project and faculty");
      return;
    }
    try {
      await api.post('/admin/assign-faculty', {
        projectId: selectedProjectForFaculty,
        facultyId: selectedFacultyId,
        accessDurationHours: accessDurationHours,
        reviewPhase: parseInt(reviewPhase),
        mode: reviewMode,
        accessStartsAt: accessStartsAt || null
      });
      setSelectedProjectForFaculty('');
      setSelectedFacultyId('');
      setAccessDurationHours(null);
      setAccessStartsAt('');
      setReviewPhase("1");
      setReviewMode('OFFLINE');
      alert(accessDurationHours ? `Faculty Assigned with ${accessDurationHours}h access!` : "Faculty Assigned with Permanent Access!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error assigning faculty");
    }
  };

  const unassignFaculty = async (assignmentId, facultyName, projectTitle) => {
    if (!window.confirm(`Remove ${facultyName} from reviewing "${projectTitle}"?`)) {
      return;
    }
    try {
      await api.delete(`/admin/unassign-faculty/${assignmentId}`);
      alert("Faculty unassigned successfully!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error removing assignment");
    }
  };

  const updateFacultyAccess = async (assignmentId, accessDurationHours) => {
    try {
      await api.post('/admin/update-faculty-access', {
        assignmentId,
        accessDurationHours
      });
      alert("Faculty access duration updated!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error updating access duration");
    }
  };

  const bulkUpdateFacultyAccess = async (assignmentIds, accessDurationHours) => {
    try {
      await api.post('/admin/bulk-update-faculty-access', {
        assignmentIds,
        accessDurationHours
      });
      alert(`Access duration updated for ${assignmentIds.length} faculty assignments!`);
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error during bulk access update");
    }
  };

  const addProject = async (e) => {
    e.preventDefault();
    try {
      await api.post('/projects', newProj);
      setNewProj({ title: '', category: '', maxTeamSize: 3, description: '', scopeId: '', techStack: '', srs: '' });
      alert("Project Created!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error adding project");
    }
  };

  // --- BULK HANDLERS ---
  const [bulkModal, setBulkModal] = useState({ isOpen: false, type: 'STUDENT' });
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [releaseReviewsModalOpen, setReleaseReviewsModalOpen] = useState(false);

  // Release Guide Reviews Handler
  const handleReleaseGuideReviews = async (payload) => {
    try {
      const res = await api.post('/admin/auto-assign-guide-reviews', payload);
      alert(res.data.message);
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error releasing reviews");
      throw err;
    }
  };

  const handleBulkImport = async (data) => {
    try {
      if (bulkModal.type === 'PROJECT') {
        const res = await api.post('/projects/bulk', { projects: data });
        alert(`Successfully imported ${res.data.count} projects!`);
      } else {
        const res = await api.post('/users/bulk', { users: data });
        alert(`Successfully imported ${res.data.count} ${bulkModal.type.toLowerCase()}s!`);
      }
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Bulk import failed");
    }
  };

  const updateUser = async (userId, data) => {
    try {
      await api.patch(`/users/${userId}`, data);
      alert("User updated successfully!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error updating user");
    }
  };

  const updateProject = async (projectId, data) => {
    try {
      await api.patch(`/projects/${projectId}`, data);
      alert("Project updated successfully!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error updating project");
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
      alert(err.response?.data?.error || "Error updating mark");
    }
  };

  const updateReview = async (reviewId, data) => {
    try {
      await api.patch(`/reviews/${reviewId}`, data);
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error updating review");
    }
  };

  // --- DELETE HANDLERS ---
  const deleteUser = async (userId, userName, userRole) => {
    if (!window.confirm(`Are you sure you want to delete ${userName} (${userRole})?\n\nThis action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/users/${userId}`);
      alert("User deleted successfully!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error deleting user. User may be part of a team.");
    }
  };

  const bulkDeleteUsers = async (ids, type = 'students') => {
    if (!ids || ids.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${ids.length} selected ${type}?`)) {
      return;
    }
    try {
      const res = await api.post('/users/bulk-delete', { ids });
      alert(res.data.message);
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error during bulk deletion");
    }
  };

  const toggleTempAdmin = async (userId, grant, allowedTabs = []) => {
    try {
      await api.post('/admin/toggle-temp-admin', { userId, grant, allowedTabs });
      alert(`Temporary admin access ${grant ? 'granted' : 'revoked'} successfully!`);
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error updating admin access");
    }
  };

  const isRealAdmin = currentUser?.role === 'ADMIN';

  const deleteProject = async (projectId, projectTitle) => {
    if (!window.confirm(`Are you sure you want to delete project "${projectTitle}"?\n\nThis action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/projects/${projectId}`);
      alert("Project deleted successfully!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error deleting project. It may be assigned to a team.");
    }
  };

  const bulkDeleteProjects = async (ids) => {
    if (!ids || ids.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${ids.length} selected projects?`)) {
      return;
    }
    try {
      const res = await api.post('/projects/bulk-delete', { ids });
      alert(res.data.message);
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error during bulk deletion");
    }
  };

  const deleteTeam = async (teamId, leaderName) => {
    if (!window.confirm(`Are you sure you want to delete the team led by ${leaderName}?\n\nThis will remove all team members and unassign the project.\n\nThis action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/teams/${teamId}`);
      alert("Team deleted successfully!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error deleting team");
    }
  };

  const removeMemberFromTeam = async (teamId, userId, userName) => {
    if (!window.confirm(`Are you sure you want to remove ${userName} from the team?`)) {
      return;
    }
    try {
      const res = await api.post('/admin/remove-member', { teamId, userId });
      alert(res.data.message);
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error removing member");
    }
  };

  const changeTeamLeader = async (teamId, newLeaderId, userName) => {
    if (!window.confirm(`Set ${userName} as the new team leader?`)) {
      return;
    }
    try {
      await api.post('/admin/change-leader', { teamId, newLeaderId });
      alert("Team leader updated successfully!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error updating leader");
    }
  };

  const unassignProjectFromTeam = async (teamId, projectTitle) => {
    if (!window.confirm(`Are you sure you want to unassign project "${projectTitle}" from this team?\n\nThis will free the project and reset the team status.`)) {
      return;
    }
    try {
      await api.post('/admin/unassign-project', { teamId });
      alert("Project unassigned successfully!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error unassigning project");
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
      alert("Solo Project Assigned successfully!");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error assigning solo project");
    }
  };

  const unassignFacultyFromTeam = async (teamId, role) => {
    if (!window.confirm(`Are you sure you want to unassign the ${role.toLowerCase()} from this team?`)) return;
    try {
      await api.post('/admin/unassign-team-faculty', { teamId, role });
      alert(`${role} unassigned successfully`);
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error unassigning faculty");
    }
  };

  const assignFacultyToTeam = async (teamId, facultyId, role) => {
    try {
      await api.post('/admin/assign-team-faculty', { teamId, facultyId, role });
      alert(`${role} assigned successfully`);
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.error || "Error assigning faculty");
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
        { id: 'teams', label: 'Teams', icon: Users },
        { id: 'manage-teams', label: 'Manage Teams', icon: Settings },
        { id: 'faculty-assignments', label: 'Faculty Assignments', icon: LinkIcon },
      ]
    },
    {
      title: "Evaluation & Analytics",
      items: [
        { id: 'rubrics', label: 'Rubrics', icon: LayoutList },
        { id: 'reviews', label: 'Reviews', icon: CheckSquare },
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
                />
              )}

              {activeTab === 'project-requests' && (
                <ProjectRequestsTab scopes={scopes} />
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
                />
              )}

              {activeTab === 'manage-teams' && (
                <ManageTeamsTab
                  teams={teams}
                  projects={allSoloProjects}
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
                  facultyAssignments={filteredFacultyAssignments}
                  unassignFaculty={unassignFaculty}
                  updateFacultyAccess={updateFacultyAccess}
                  bulkUpdateFacultyAccess={bulkUpdateFacultyAccess}
                  users={faculty}
                  assignmentSearch={assignmentSearch}
                  setAssignmentSearch={setAssignmentSearch}
                  api={api}
                  loadData={refreshData}
                  onOpenReleaseReviews={() => setReleaseReviewsModalOpen(true)}
                  scopes={scopes}
                />
              )}

              {activeTab === 'rubrics' && <RubricsTab />}

              {activeTab === 'reviews' && (
                <ReviewsTab
                  teams={reviewTeams}
                  loadData={refreshData}
                  api={api}
                  faculty={faculty}
                />
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
                  alert('Error exporting data: ' + (err.response?.data?.error || err.message));
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