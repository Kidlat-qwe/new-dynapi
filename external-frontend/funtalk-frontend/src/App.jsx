import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ensureFuntalkConfig } from './lib/api';
import Login from './pages/Login';
import Signup from './pages/Signup';
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import Appointment from './pages/superadmin/Appointment';
import Users from './pages/superadmin/Users';
import Teachers from './pages/superadmin/Teachers';
import Package from './pages/superadmin/Package';
import Materials from './pages/superadmin/Materials';
import Credits from './pages/superadmin/Credits';
import Invoices from './pages/superadmin/Invoices';
import TeacherDashboard from './pages/teacher/teacherDashboard';
import TeacherAppointments from './pages/teacher/teacherAppointments';
import TeacherAvailability from './pages/teacher/teacherAvailability';
import TeacherMaterials from './pages/teacher/teacherMaterials';
import SchoolDashboard from './pages/school/schoolDashboard';
import SchoolStudents from './pages/school/schoolStudents';
import SchoolBookings from './pages/school/schoolBookings';
import SchoolPackages from './pages/school/schoolPackages';
import SchoolCredits from './pages/school/schoolCredits';
import SchoolReports from './pages/school/schoolReports';
import './App.css';

function App() {
  useEffect(() => {
    ensureFuntalkConfig();
  }, []);

  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
        {/* Super Admin Routes */}
        <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
        <Route path="/superadmin/users" element={<Users />} />
        <Route path="/superadmin/teachers" element={<Teachers />} />
        <Route path="/superadmin/appointment" element={<Appointment />} />
        <Route path="/superadmin/package" element={<Package />} />
        <Route path="/superadmin/materials" element={<Materials />} />
        <Route path="/superadmin/credits" element={<Credits />} />
        <Route path="/superadmin/invoices" element={<Invoices />} />
        
        {/* Teacher Routes */}
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
        <Route path="/teacher/appointments" element={<TeacherAppointments />} />
        <Route path="/teacher/availability" element={<TeacherAvailability />} />
        <Route path="/teacher/materials" element={<TeacherMaterials />} />
        
        {/* School Routes */}
        <Route path="/school/dashboard" element={<SchoolDashboard />} />
        <Route path="/school/students" element={<SchoolStudents />} />
        <Route path="/school/bookings" element={<SchoolBookings />} />
        <Route path="/school/packages" element={<SchoolPackages />} />
        <Route path="/school/credits" element={<SchoolCredits />} />
        <Route path="/school/reports" element={<SchoolReports />} />
        
        {/* Default redirect to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* 404 - Catch all unmatched routes */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
