import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import ResponsiveSelect from '../../components/ResponsiveSelect.jsx';
import Pagination from '../../components/Pagination.jsx';
import { API_BASE_URL } from '@/config/api.js';

const SchoolReports = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.userType !== 'school') {
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

  useEffect(() => {
    if (user) {
      fetchAppointments();
      fetchStudents();
      fetchTeachers();
    }
  }, [user, statusFilter, studentFilter, teacherFilter, dateFilter]);

  const fetchAppointments = async () => {
    setIsFetching(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/appointments`;
      const params = new URLSearchParams();
      
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      
      if (dateFilter) {
        params.append('startDate', dateFilter);
        params.append('endDate', dateFilter);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

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

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/students`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success && data.data?.students) {
        setStudents(data.data.students.filter(s => s.is_active));
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchTeachers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/teachers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success && data.data?.teachers) {
        setTeachers(data.data.teachers);
      }
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  };

  // Calculate stats
  const totalClasses = appointments.length;
  const completedClasses = appointments.filter(apt => apt.status === 'completed').length;
  const cancelledClasses = appointments.filter(apt => apt.status === 'cancelled').length;
  const noShowClasses = appointments.filter(apt => apt.status === 'no_show').length;
  const attendanceRate = totalClasses > 0 ? ((completedClasses / totalClasses) * 100).toFixed(1) : 0;

  // Filter appointments
  const filteredAppointments = appointments.filter((apt) => {
    const matchesStatus = !statusFilter || apt.status === statusFilter;
    const matchesStudent = !studentFilter || apt.student_name?.toLowerCase().includes(studentFilter.toLowerCase());
    const matchesTeacher = !teacherFilter || apt.teacher_id === parseInt(teacherFilter);
    return matchesStatus && matchesStudent && matchesTeacher;
  });

  useEffect(() => {
    setPage(1);
  }, [statusFilter, studentFilter, teacherFilter, dateFilter]);

  const pageSize = 10;
  const pagedAppointments = filteredAppointments.slice((page - 1) * pageSize, page * pageSize);

  // Format date and time
  const formatDateTime = (date, time) => {
    if (!date) return 'N/A';
    const d = new Date(`${date}T${time || '00:00'}`);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
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
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Reports</h1>
                <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">View attendance and teacher feedback</p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <p className="text-xs sm:text-sm text-gray-600">Total Classes</p>
                  <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{totalClasses}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <p className="text-xs sm:text-sm text-gray-600">Completed</p>
                  <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-green-600">{completedClasses}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <p className="text-xs sm:text-sm text-gray-600">Cancelled</p>
                  <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-red-600">{cancelledClasses}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <p className="text-xs sm:text-sm text-gray-600">No Show</p>
                  <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-600">{noShowClasses}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <p className="text-xs sm:text-sm text-gray-600">Attendance Rate</p>
                  <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-primary-600">{attendanceRate}%</p>
                </div>
              </div>

              {/* Attendance Report */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 sm:p-6 border-b border-gray-200">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Attendance Report</h2>
                  {/* Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div>
                      <input
                        type="text"
                        placeholder="Search student..."
                        value={studentFilter}
                        onChange={(e) => setStudentFilter(e.target.value)}
                        className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <ResponsiveSelect
                        id="school-reports-status-filter"
                        aria-label="Filter by status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                      >
                        <option value="">All Status</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="no_show">No Show</option>
                      </ResponsiveSelect>
                    </div>
                    <div>
                      <ResponsiveSelect
                        id="school-reports-teacher-filter"
                        aria-label="Filter by teacher"
                        value={teacherFilter}
                        onChange={(e) => setTeacherFilter(e.target.value)}
                        className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                      >
                        <option value="">All Teachers</option>
                        {teachers.map((teacher) => (
                          <option key={teacher.teacher_id} value={teacher.teacher_id}>
                            {teacher.fullname}
                          </option>
                        ))}
                      </ResponsiveSelect>
                    </div>
                    <div>
                      <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto overflow-hidden">
                  {isFetching ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="mt-3 text-sm text-gray-600">Loading reports...</p>
                    </div>
                  ) : filteredAppointments.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-sm text-gray-500">No records found</p>
                    </div>
                ) : (
                    <>
                    <table className="w-full divide-y divide-gray-200" style={{ minWidth: '900px' }}>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Student</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Teacher</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Class Time</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Feedback</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pagedAppointments.map((apt) => (
                          <tr key={apt.appointment_id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {apt.appointment_date ? new Date(apt.appointment_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              }) : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {apt.student_name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {apt.teacher_name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {apt.appointment_time || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(apt.status)}`}>
                                {formatStatus(apt.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {apt.teacher_feedback ? (
                                <span className="line-clamp-1" title={apt.teacher_feedback}>
                                  {apt.teacher_feedback}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-4 py-3 sm:px-6 border-t border-gray-200">
                      <Pagination totalItems={filteredAppointments.length} pageSize={pageSize} currentPage={page} onPageChange={setPage} />
                    </div>
                    </>
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
        className="fixed bottom-6 right-6 lg:hidden z-50 bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isSidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
    </div>
  );
};

export default SchoolReports;
