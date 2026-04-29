import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import Login from '@/pages/Login';
import AdminDashboard from '@/pages/admin/adminDashboard';
import AdminSystems from '@/pages/admin/adminSystems';
import AdminUsers from '@/pages/admin/adminUsers';
import AdminApiTokens from '@/pages/admin/adminApiTokens';
import AdminSystemRoutes from '@/pages/admin/AdminSystemRoutes';
import AdminHealthMonitoring from '@/pages/admin/adminHealthMonitoring';
import AdminSystemLogs from '@/pages/admin/adminSystemLogs';
import AdminSecrets from '@/pages/admin/adminSecrets';
import UserDashboard from '@/pages/user/userDashboard';
import UserSystems from '@/pages/user/userSystems';
import UserSecrets from '@/pages/user/userSecrets';
import UserApiTokens from '@/pages/user/userApiTokens';

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/user'} replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="systems" element={<AdminSystems />} />
        <Route path="systems/:id/routes" element={<AdminSystemRoutes />} />
        <Route path="health" element={<AdminHealthMonitoring />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="api-tokens" element={<AdminApiTokens />} />
        <Route path="secrets" element={<AdminSecrets />} />
        <Route path="system-logs" element={<AdminSystemLogs />} />
      </Route>
      <Route
        path="/user"
        element={
          <ProtectedRoute allowedRoles={['user']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<UserDashboard />} />
        <Route path="systems" element={<UserSystems />} />
        <Route path="secrets" element={<UserSecrets />} />
        <Route path="api-tokens" element={<UserApiTokens />} />
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
