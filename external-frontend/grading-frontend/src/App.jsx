import './App.css'
import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ensureGradingConfig } from './lib/api'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import Login from './Login.jsx'
import Home from './Home.jsx'
import ManageClass from './Manage-class.jsx'
import ManageTeacher from './Manage-teacher.jsx'
import ManageSubject from './Manage-subject.jsx'
import ViewGrade from './View-grade.jsx'
import AcademicRanking from './Academic-ranking.jsx'
import SchoolYear from './School-year.jsx'
import ManageUser from './Manage-user.jsx'
import ManageClassViewSubject from './Manage-class-View-subject.jsx'
import ManageClassViewStudent from './Manage-class-View-student.jsx'
import StudentGrade from './Student-grade.jsx'
import MyClass from './My-class.jsx'
import MyClassView from './My-class-view.jsx'
import GradingCriteria from './Grading-criteria.jsx'
import Attendance from './Attendance.jsx'
import SummaryQuarterlyGrade from './Summary-quarterly-grade.jsx'
import StudentList from './Student-list.jsx'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
const App = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isAuthenticated = localStorage.getItem('userToken');

  useEffect(() => {
    ensureGradingConfig();
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <>
      {!isAuthenticated ? (
        <div className="min-h-screen bg-[#F3F3F6] flex justify-center items-center">
          <ToastContainer position="top-right" autoClose={3000} />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      ) : (
        <div className="flex h-screen bg-[#F3F3F6] overflow-hidden">
          <ToastContainer position="top-right" autoClose={3000} />
          
          <Sidebar 
            isSidebarOpen={isSidebarOpen} 
            isMobileMenuOpen={isMobileMenuOpen}
          />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header toggleSidebar={toggleSidebar} />
            <div className="flex-1 overflow-auto">
              <Routes>
                <Route path="*" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<Home />} />
                <Route path="/manage-teacher" element={<ManageTeacher />} />
                <Route path="/manage-class" element={<ManageClass />} />
                <Route path="/manage-subject" element={<ManageSubject />} />
                <Route path="/view-grade" element={<ViewGrade />} />
                <Route path="/academic-ranking" element={<AcademicRanking />} />
                <Route path="/school-year" element={<SchoolYear />} />
                <Route path="/manage-user" element={<ManageUser />} />
                <Route path="/manage-class-view-subject/:classId" element={<ManageClassViewSubject />} />
                <Route path="/manage-class-view-student/:classId" element={<ManageClassViewStudent />} />
                <Route path="/student-grade" element={<StudentGrade />} />
                <Route path="/my-class" element={<MyClass />} />
                <Route path="/my-class-view" element={<MyClassView />} />
                <Route path="/grading-criteria" element={<GradingCriteria />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/summary-quarterly-grade" element={<SummaryQuarterlyGrade />} />
                <Route path="/student-list" element={<StudentList />} />
              </Routes>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
