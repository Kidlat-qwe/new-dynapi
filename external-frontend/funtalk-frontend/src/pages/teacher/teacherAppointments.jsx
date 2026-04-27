import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { API_BASE_URL } from '@/config/api.js';
import ResponsiveSelect from '../../components/ResponsiveSelect';
import Pagination from '../../components/Pagination.jsx';

const TeacherAppointments = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

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
  }, [user, statusFilter, dateFilter]);

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

  // Filter appointments
  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch = !studentSearch || 
      apt.student_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      apt.school_name?.toLowerCase().includes(studentSearch.toLowerCase());
    return matchesSearch;
  });

  useEffect(() => {
    setPage(1);
  }, [studentSearch, statusFilter, dateFilter]);

  const pageSize = 10;
  const pagedAppointments = filteredAppointments.slice((page - 1) * pageSize, page * pageSize);

  // Format date and time
  const formatDateTime = (date, time) => {
    if (!date) return 'N/A';
    const d = new Date(`${date}T${time || '00:00'}`);
    return d.toLocaleDateString('en-US', { 
      weekday: 'short',
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

  // Handle view details
  const handleViewDetails = (appointment) => {
    setSelectedAppointment(appointment);
    setIsDetailModalOpen(true);
  };

  // Handle launch class
  const normalizeMeetingUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
  };

  const handleLaunchClass = (appointment) => {
    const meetingUrl = normalizeMeetingUrl(appointment.meeting_link);
    if (meetingUrl) {
      window.open(meetingUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert('Meeting link not available yet. Please contact support.');
    }
  };

  // Handle mark status
  const handleMarkStatus = async (appointmentId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/appointments/${appointmentId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert(`Appointment marked as ${formatStatus(newStatus)}`);
        fetchAppointments();
        setIsDetailModalOpen(false);
      } else {
        alert(data.message || 'Error updating status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status. Please try again.');
    }
  };

  // Handle add feedback
  const handleOpenFeedback = (appointment) => {
    setSelectedAppointment(appointment);
    setFeedbackText('');
    setIsFeedbackModalOpen(true);
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) {
      alert('Please enter feedback');
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/appointments/${selectedAppointment.appointment_id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ feedback: feedbackText.trim() }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert('Feedback added successfully');
        setIsFeedbackModalOpen(false);
        setFeedbackText('');
        fetchAppointments();
      } else {
        alert(data.message || 'Error adding feedback');
      }
    } catch (error) {
      console.error('Error adding feedback:', error);
      alert('Error adding feedback. Please try again.');
    } finally {
      setIsSubmittingFeedback(false);
    }
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
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">My Classes</h1>
                <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">View and manage your appointments</p>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Search Student/School</label>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Status</label>
                    <ResponsiveSelect
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      aria-label="Status"
                    >
                      <option value="">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="no_show">No Show</option>
                    </ResponsiveSelect>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Date From</label>
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Appointments Table */}
              <div className="bg-white rounded-lg shadow">
                {isFetching ? (
                  <div className="p-8 sm:p-10 md:p-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">Loading appointments...</p>
                  </div>
                ) : filteredAppointments.length === 0 ? (
                  <div className="p-8 sm:p-10 md:p-12 text-center">
                    <svg className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-gray-900">No appointments found</h3>
                    <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                      {studentSearch || statusFilter || dateFilter
                        ? 'Try adjusting your filters'
                        : 'No appointments scheduled'}
                    </p>
                  </div>
                ) : (
                  <>
                  <div className="overflow-x-auto rounded-b-xl">
                    <table className="min-w-[980px] w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Date & Time</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Student</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">School</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Material</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Status</th>
                          <th className="sticky right-0 z-10 bg-gray-50 px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.08)]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pagedAppointments.map((appointment) => (
                          <tr key={appointment.appointment_id} className="group hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {formatDateTime(appointment.appointment_date, appointment.appointment_time)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{appointment.student_name || 'N/A'}</div>
                              {appointment.student_level && (
                                <div className="text-xs text-gray-500">Level: {appointment.student_level}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{appointment.school_name || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{appointment.material_name || '-'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(appointment.status)}`}>
                                {formatStatus(appointment.status)}
                              </span>
                            </td>
                            <td className="sticky right-0 z-[1] bg-white px-6 py-4 whitespace-nowrap text-right text-sm font-medium shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.06)] group-hover:bg-gray-50">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleViewDetails(appointment)}
                                  className="text-primary-600 hover:text-primary-800"
                                  title="View Details"
                                >
                                  View
                                </button>
                                {appointment.status === 'approved' && appointment.meeting_link && (
                                  <button
                                    onClick={() => handleLaunchClass(appointment)}
                                    className="px-3 py-1 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                  >
                                    Launch
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-3 sm:px-6 border-t border-gray-200">
                    <Pagination totalItems={filteredAppointments.length} pageSize={pageSize} currentPage={page} onPageChange={setPage} />
                  </div>
                  </>
                )}
              </div>

              {/* Results Count */}
              {filteredAppointments.length > 0 && (
                <div className="text-xs sm:text-sm text-gray-600">
                  Showing {filteredAppointments.length} of {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Appointment Details Modal */}
      {isDetailModalOpen && selectedAppointment && createPortal(
        <div 
          className="fixed bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            zIndex: 99999,
            width: '100vw',
            height: '100vh',
            margin: 0,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsDetailModalOpen(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 sm:mx-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Appointment Details</h2>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                {/* Student Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 mb-1">Student Information</h3>
                    <div className="bg-gray-50 rounded-lg p-2.5 space-y-1.5 text-sm">
                      <div><span className="font-medium">Name:</span> {selectedAppointment.student_name || 'N/A'}</div>
                      {selectedAppointment.student_age && <div><span className="font-medium">Age:</span> {selectedAppointment.student_age}</div>}
                      {selectedAppointment.student_level && <div><span className="font-medium">Level:</span> {selectedAppointment.student_level}</div>}
                    </div>
                  </div>

                  {/* Class Details */}
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 mb-1">Class Details</h3>
                    <div className="bg-gray-50 rounded-lg p-2.5 space-y-1.5 text-sm">
                      <div><span className="font-medium">Date & Time:</span> {formatDateTime(selectedAppointment.appointment_date, selectedAppointment.appointment_time)}</div>
                      <div><span className="font-medium">School:</span> {selectedAppointment.school_name || 'N/A'}</div>
                      {selectedAppointment.material_name && <div><span className="font-medium">Material:</span> {selectedAppointment.material_name}</div>}
                      {selectedAppointment.class_type && <div><span className="font-medium">Class Type:</span> {selectedAppointment.class_type}</div>}
                      <div><span className="font-medium">Status:</span> <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(selectedAppointment.status)}`}>{formatStatus(selectedAppointment.status)}</span></div>
                    </div>
                  </div>
                </div>

                {/* Additional Notes */}
                {selectedAppointment.additional_notes && (
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 mb-1">Additional Notes</h3>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-sm text-gray-700">{selectedAppointment.additional_notes}</p>
                    </div>
                  </div>
                )}

                {/* Meeting Link */}
                {selectedAppointment.meeting_link && (
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 mb-1">Meeting Link</h3>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <a
                        href={normalizeMeetingUrl(selectedAppointment.meeting_link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-800 underline break-all"
                      >
                        {selectedAppointment.meeting_link}
                      </a>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-3 border-t">
                  {selectedAppointment.status === 'approved' && selectedAppointment.meeting_link && (
                    <button
                      onClick={() => {
                        handleLaunchClass(selectedAppointment);
                        setIsDetailModalOpen(false);
                      }}
                      className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Launch Class
                    </button>
                  )}
                  {(selectedAppointment.status === 'approved' || selectedAppointment.status === 'pending') && (
                    <>
                      <button
                        onClick={() => {
                          if (window.confirm('Mark this appointment as Completed?')) {
                            handleMarkStatus(selectedAppointment.appointment_id, 'completed');
                          }
                        }}
                        className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Mark Completed
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Mark this appointment as No Show?')) {
                            handleMarkStatus(selectedAppointment.appointment_id, 'no_show');
                          }
                        }}
                        className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Mark No Show
                      </button>
                    </>
                  )}
                  {selectedAppointment.status === 'completed' && (
                    <button
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        handleOpenFeedback(selectedAppointment);
                      }}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add Feedback
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Feedback Modal */}
      {isFeedbackModalOpen && selectedAppointment && createPortal(
        <div 
          className="fixed bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            zIndex: 99999,
            width: '100vw',
            height: '100vh',
            margin: 0,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsFeedbackModalOpen(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 sm:mx-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Add Feedback</h2>
                <button
                  onClick={() => setIsFeedbackModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Feedback for {selectedAppointment.student_name}
                  </label>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    rows="6"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter your feedback about the student's performance, progress, areas for improvement, etc."
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsFeedbackModalOpen(false)}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={isSubmittingFeedback}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmittingFeedback}
                  >
                    {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

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

export default TeacherAppointments;
