import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

import { fetchFuntalk } from '../../lib/api';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.userType !== 'teacher') {
        navigate('/login');
        return;
      }
      setUser(parsedUser);
    } catch (error) {
      console.error('Error parsing user data:', error);
      navigate('/login');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  // Fetch appointments
  useEffect(() => {
    if (user) {
      fetchAppointments();
    }
  }, [user]);

  const fetchAppointments = async () => {
    setIsFetching(true);
    try {
      const response = await fetchFuntalk('/appointments', {});

      const data = await response.json();
      if (data.success && data.data?.appointments) {
        setAppointments(data.data.appointments);
      } else {
        console.error('Error fetching appointments:', data.message);
        setAppointments([]);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setAppointments([]);
    } finally {
      setIsFetching(false);
    }
  };

  // Get today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Get next 7 days
  const next7Days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    next7Days.push(date.toISOString().split('T')[0]);
  }

  // Filter appointments
  const todayAppointments = appointments.filter(apt => apt.appointment_date === todayStr);
  const upcomingAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.appointment_date);
    aptDate.setHours(0, 0, 0, 0);
    return aptDate >= today && apt.status !== 'completed' && apt.status !== 'cancelled';
  }).slice(0, 7);
  const pastAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.appointment_date);
    aptDate.setHours(0, 0, 0, 0);
    return aptDate < today || apt.status === 'completed';
  }).slice(0, 5);

  // Calculate stats
  const totalClasses = appointments.length;
  const completedClasses = appointments.filter(apt => apt.status === 'completed').length;
  const pendingClasses = appointments.filter(apt => apt.status === 'pending' || apt.status === 'approved').length;

  // Format date and time
  const formatDateTime = (date, time) => {
    if (!date) return 'N/A';
    const d = new Date(`${date}T${time || '00:00'}`);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format status
  const formatStatus = (status) => {
    const statuses = {
      pending: 'Pending',
      approved: 'Approved',
      completed: 'Completed',
      cancelled: 'Cancelled',
      no_show: 'No Show',
    };
    return statuses[status] || status;
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      no_show: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />
      <div className="flex">
        <Sidebar 
          userType={user.userType} 
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        
        <main className="flex-1 lg:ml-64 p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-4 sm:space-y-6">
              {/* Page Header */}
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Dashboard</h1>
                <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">Welcome back, {user.name}</p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-500">Total Classes</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalClasses}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-500">Completed</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-600">{completedClasses}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-500">Pending</p>
                      <p className="text-xl sm:text-2xl font-bold text-yellow-600">{pendingClasses}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Today's Classes */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 sm:p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Today's Classes</h2>
                    <Link
                      to="/teacher/appointments"
                      className="text-xs sm:text-sm text-primary-600 hover:text-primary-800 font-medium"
                    >
                      View All →
                    </Link>
                  </div>
                </div>
                <div className="p-4 sm:p-6">
                  {isFetching ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="mt-3 text-sm text-gray-600">Loading...</p>
                    </div>
                  ) : todayAppointments.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-3 text-sm text-gray-600">No classes scheduled for today</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {todayAppointments.map((appointment) => (
                        <div
                          key={appointment.appointment_id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0">
                                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                                    <span className="text-primary-600 font-semibold text-sm">
                                      {appointment.appointment_time?.substring(0, 5)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                                    {appointment.student_name || 'Student'}
                                  </h3>
                                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                                    {appointment.school_name || 'School'} • {appointment.material_name || 'No material'}
                                  </p>
                                  {appointment.student_level && (
                                    <p className="text-xs text-gray-400 mt-1">Level: {appointment.student_level}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(appointment.status)}`}>
                                {formatStatus(appointment.status)}
                              </span>
                              {appointment.meeting_link && (appointment.status === 'approved' || appointment.status === 'pending') && (
                                <Link
                                  to={`/teacher/appointments`}
                                  className="px-3 py-1.5 text-xs sm:text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                                >
                                  Launch Class
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming Classes */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 sm:p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Upcoming Classes</h2>
                    <Link
                      to="/teacher/appointments"
                      className="text-xs sm:text-sm text-primary-600 hover:text-primary-800 font-medium"
                    >
                      View All →
                    </Link>
                  </div>
                </div>
                <div className="p-4 sm:p-6">
                  {upcomingAppointments.length === 0 ? (
                    <p className="text-sm text-gray-600">No upcoming classes</p>
                  ) : (
                    <div className="space-y-3">
                      {upcomingAppointments.map((appointment) => (
                        <div
                          key={appointment.appointment_id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                                {appointment.student_name || 'Student'}
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                                {formatDateTime(appointment.appointment_date, appointment.appointment_time)}
                              </p>
                            </div>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(appointment.status)}`}>
                              {formatStatus(appointment.status)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Past Classes */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 sm:p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Recent Past Classes</h2>
                    <Link
                      to="/teacher/appointments"
                      className="text-xs sm:text-sm text-primary-600 hover:text-primary-800 font-medium"
                    >
                      View All →
                    </Link>
                  </div>
                </div>
                <div className="p-4 sm:p-6">
                  {pastAppointments.length === 0 ? (
                    <p className="text-sm text-gray-600">No past classes</p>
                  ) : (
                    <div className="space-y-3">
                      {pastAppointments.map((appointment) => (
                        <div
                          key={appointment.appointment_id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                                {appointment.student_name || 'Student'}
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                                {formatDateTime(appointment.appointment_date, appointment.appointment_time)}
                              </p>
                            </div>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(appointment.status)}`}>
                              {formatStatus(appointment.status)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Floating Hamburger Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 right-6 lg:hidden z-50 bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label="Toggle sidebar"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isSidebarOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>
    </div>
  );
};

export default TeacherDashboard;
