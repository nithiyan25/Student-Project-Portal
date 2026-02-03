import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import StudentDashboard from './pages/StudentDashboard';
import StudentBatchDetail from './pages/StudentBatchDetail';

// Google OAuth is managed in main.jsx via environment variables

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div className="p-10 text-center font-semibold text-gray-500">Loading Portal...</div>;
  if (!user) return <Navigate to="/" />;

  // Check if user has required role OR is a temporary admin (for ADMIN routes)
  const hasAccess = roles.includes(user.role) ||
    (roles.includes('ADMIN') && user.isTemporaryAdmin);

  if (!hasAccess) return <Navigate to="/" />;
  return children;
};

const LoginWrapper = () => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;

  // Route based on role, temp admins go to admin dashboard
  if (user?.role === 'ADMIN') return <Navigate to="/admin" />;
  if (user?.role === 'FACULTY') {
    return <Navigate to="/faculty" />;
  }
  if (user?.role === 'STUDENT') return <Navigate to="/student" />;
  return <Login />;
};

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LoginWrapper />} />

        <Route path="/admin" element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        <Route path="/student" element={
          <ProtectedRoute roles={['STUDENT']}>
            <StudentDashboard />
          </ProtectedRoute>
        } />

        <Route path="/student/batch/:scopeId" element={
          <ProtectedRoute roles={['STUDENT']}>
            <StudentBatchDetail />
          </ProtectedRoute>
        } />

        <Route path="/faculty" element={
          <ProtectedRoute roles={['FACULTY', 'ADMIN']}>
            <FacultyDashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </AuthProvider>
  );
}