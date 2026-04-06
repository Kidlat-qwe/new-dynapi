import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { fetchFuntalk } from '../../lib/api';

const Appointment = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [formData, setFormData] = useState({
    teacherId: '',
    appointmentDate: '',
    appointmentTime: '',
    studentName: '',
    studentAge: '',
    studentLevel: '',
    classType: '',
    materialId: '',
    additionalNotes: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.userType !== 'superadmin') {
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
      fetchTeachers();
      fetchMaterials();
    }
  }, [user, statusFilter, teacherFilter, dateFilter]);

  // Close dropdown menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.action-menu') && !event.target.closest('button[title="Actions"]')) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const fetchTeachers = async () => {
    try {
      const response = await fetchFuntalk('/teachers?status=active', {});

      const data = await response.json();
      if (data.success && data.data?.teachers) {
        setTeachers(data.data.teachers);
      }
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  };

  const fetchMaterials = async () => {
    try {
      const response = await fetchFuntalk('/materials', {});

      const data = await response.json();
      if (data.success && data.data?.materials) {
        setMaterials(data.data.materials);
      } else if (data.success && Array.isArray(data.data)) {
        setMaterials(data.data);
      }
    } catch (error) {
      console.error('Error fetching materials:', error);
    }
  };

  const fetchAppointments = async () => {
    setIsFetching(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (teacherFilter) params.append('teacherId', teacherFilter);
      if (dateFilter) {
        params.append('startDate', dateFilter);
        const endDate = new Date(dateFilter);
        endDate.setDate(endDate.getDate() + 1);
        params.append('endDate', endDate.toISOString().split('T')[0]);
      }
      const qs = params.toString();
      const path = qs ? `/appointments?${qs}` : '/appointments';
      const response = await fetchFuntalk(path, {});

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

  // Filter appointments based on student name search
  const filteredAppointments = appointments.filter((apt) => {
    const matchesStudent = !studentSearch || 
      apt.student_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      apt.profile_student_name?.toLowerCase().includes(studentSearch.toLowerCase());
    return matchesStudent;
  });

  // Format status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'no_show':
        return 'bg-orange-100 text-orange-800';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Handle action menu
  const handleActionClick = (e, appointmentId) => {
    e.stopPropagation();
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    
    setMenuPosition({
      top: rect.bottom + window.scrollY + 1,
      right: window.innerWidth - rect.right + window.scrollX,
    });
    
    setOpenMenuId(openMenuId === appointmentId ? null : appointmentId);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setFormData({
      teacherId: '',
      appointmentDate: '',
      appointmentTime: '',
      studentName: '',
      studentAge: '',
      studentLevel: '',
      classType: '',
      materialId: '',
      additionalNotes: '',
    });
    setFormErrors({});
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.teacherId) {
      newErrors.teacherId = 'Teacher is required';
    }

    if (!formData.appointmentDate) {
      newErrors.appointmentDate = 'Appointment date is required';
    }

    if (!formData.appointmentTime) {
      newErrors.appointmentTime = 'Appointment time is required';
    }

    if (!formData.studentName.trim()) {
      newErrors.studentName = 'Student name is required';
    }

    if (formData.studentAge && (isNaN(formData.studentAge) || formData.studentAge < 1 || formData.studentAge > 120)) {
      newErrors.studentAge = 'Student age must be between 1 and 120';
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      const requestBody = {
        teacherId: parseInt(formData.teacherId),
        appointmentDate: formData.appointmentDate,
        appointmentTime: formData.appointmentTime,
        studentName: formData.studentName.trim(),
        studentAge: formData.studentAge ? parseInt(formData.studentAge) : null,
        studentLevel: formData.studentLevel.trim() || null,
        classType: formData.classType.trim() || null,
        materialId: formData.materialId ? parseInt(formData.materialId) : null,
        additionalNotes: formData.additionalNotes.trim() || null,
      };

      const response = await fetchFuntalk('/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Appointment creation error:', data);
        
        if (data.errors && Array.isArray(data.errors)) {
          const validationErrors = {};
          data.errors.forEach((error) => {
            const fieldName = error.param || error.path || 'unknown';
            validationErrors[fieldName] = error.msg || error.message;
          });
          setFormErrors(validationErrors);
        } else {
          setFormErrors({
            submit: data.message || 'Error creating appointment. Please try again.',
          });
        }
        return;
      }

      // Success
      alert('Appointment created successfully!');
      handleModalClose();
      fetchAppointments(); // Refresh the list
    } catch (error) {
      console.error('Error creating appointment:', error);
      setFormErrors({
        submit: 'Network error. Please check your connection and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle status change
  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      const response = await fetchFuntalk(`/appointments/${appointmentId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        fetchAppointments(); // Refresh the list
      } else {
        alert(data.message || 'Error updating appointment status');
      }
    } catch (error) {
      console.error('Error updating appointment status:', error);
      alert('Error updating appointment status. Please try again.');
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Appointments</h1>
                  <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">Manage all class appointments</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Add New Appointment
                </button>
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
                    <svg
                      className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-gray-900">No appointments found</h3>
                    <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                      {studentSearch || statusFilter || teacherFilter || dateFilter
                        ? 'Try adjusting your filters'
                        : 'No appointments scheduled yet'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-medium text-gray-500 uppercase">Student</span>
                              <input
                                type="text"
                                placeholder="Search..."
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 w-32"
                              />
                            </div>
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                            Teacher
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                            School
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date & Time
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                            Class Type
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                            Material
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                            <select
                              value={statusFilter}
                              onChange={(e) => setStatusFilter(e.target.value)}
                              className="text-xs font-medium text-gray-500 bg-transparent border-0 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                            >
                              <option value="">Status</option>
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                              <option value="no_show">No Show</option>
                            </select>
                          </th>
                          <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAppointments.map((appointment) => (
                          <tr key={appointment.appointment_id} className="hover:bg-gray-50">
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {appointment.student_name || appointment.profile_student_name || 'N/A'}
                                </div>
                                {appointment.student_age && (
                                  <div className="text-xs text-gray-500">Age: {appointment.student_age}</div>
                                )}
                                {appointment.student_level && (
                                  <div className="text-xs text-gray-500">Level: {appointment.student_level}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                              <div className="text-sm text-gray-900">{appointment.teacher_name || 'N/A'}</div>
                              {appointment.teacher_email && (
                                <div className="text-xs text-gray-500">{appointment.teacher_email}</div>
                              )}
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                              <div className="text-sm text-gray-900">{appointment.school_name || 'N/A'}</div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{formatDate(appointment.appointment_date)}</div>
                              <div className="text-xs text-gray-500">{formatTime(appointment.appointment_time)}</div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                              <div className="text-sm text-gray-900">{appointment.class_type || '-'}</div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                              <div className="text-sm text-gray-900">{appointment.material_name || '-'}</div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                              <select
                                value={appointment.status || 'pending'}
                                onChange={(e) => handleStatusChange(appointment.appointment_id, e.target.value)}
                                className={`text-xs font-semibold rounded-full px-2 py-1 border-0 focus:ring-2 focus:ring-primary-500 ${getStatusColor(appointment.status)}`}
                              >
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="no_show">No Show</option>
                              </select>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium hidden md:table-cell">
                              <div className="flex justify-end">
                                <button
                                  onClick={(e) => handleActionClick(e, appointment.appointment_id)}
                                  className="text-gray-600 hover:text-gray-900 focus:outline-none p-1"
                                  title="Actions"
                                >
                                  <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Results Count */}
              {filteredAppointments.length > 0 && (
                <div className="text-xs sm:text-sm text-gray-600">
                  Showing {filteredAppointments.length} of {appointments.length} appointments
                </div>
              )}

              {/* Action Menu Dropdown */}
              {openMenuId && (
                <div
                  className="fixed w-40 sm:w-48 bg-white rounded-md shadow-xl z-[9999] border border-gray-200"
                  style={{
                    top: `${menuPosition.top}px`,
                    right: `${menuPosition.right}px`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="py-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const appointment = filteredAppointments.find(a => a.appointment_id === openMenuId);
                        if (appointment) {
                          alert('View details functionality coming soon');
                        }
                        setOpenMenuId(null);
                      }}
                      className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100"
                    >
                      View Details
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const appointment = filteredAppointments.find(a => a.appointment_id === openMenuId);
                        if (appointment) {
                          alert('Edit functionality coming soon');
                        }
                        setOpenMenuId(null);
                      }}
                      className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Edit
                    </button>
                    {(() => {
                      const appointment = filteredAppointments.find(a => a.appointment_id === openMenuId);
                      return appointment?.meeting_link ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (appointment.meeting_link) {
                              window.open(appointment.meeting_link, '_blank');
                            }
                            setOpenMenuId(null);
                          }}
                          className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-blue-600 hover:bg-gray-100"
                        >
                          Join Meeting
                        </button>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}

              {/* Add Appointment Modal - Rendered via Portal to body */}
              {isModalOpen && createPortal(
                <div 
                  className="fixed bg-black bg-opacity-50 flex items-center justify-center p-4" 
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
                      handleModalClose();
                    }
                  }}
                >
                  <div 
                    className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4 sm:mx-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 sm:p-5 md:p-6">
                      {/* Modal Header */}
                      <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Add New Appointment</h2>
                        <button
                          onClick={handleModalClose}
                          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                        >
                          <svg
                            className="w-5 h-5 sm:w-6 sm:h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Modal Form */}
                      <form onSubmit={handleFormSubmit} className="space-y-3 sm:space-y-4">
                        {/* Teacher */}
                        <div>
                          <label htmlFor="teacherId" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Teacher <span className="text-red-500">*</span>
                          </label>
                          <select
                            id="teacherId"
                            name="teacherId"
                            value={formData.teacherId}
                            onChange={handleFormChange}
                            className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                              formErrors.teacherId ? 'border-red-500' : 'border-gray-300'
                            }`}
                          >
                            <option value="">Select teacher</option>
                            {teachers.map((teacher) => (
                              <option key={teacher.teacher_id} value={teacher.teacher_id}>
                                {teacher.fullname || teacher.user_name || 'N/A'}
                              </option>
                            ))}
                          </select>
                          {formErrors.teacherId && (
                            <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.teacherId}</p>
                          )}
                        </div>

                        {/* Date and Time */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div>
                            <label htmlFor="appointmentDate" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Date <span className="text-red-500">*</span>
                            </label>
                            <input
                              id="appointmentDate"
                              name="appointmentDate"
                              type="date"
                              value={formData.appointmentDate}
                              onChange={handleFormChange}
                              min={new Date().toISOString().split('T')[0]}
                              className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                formErrors.appointmentDate ? 'border-red-500' : 'border-gray-300'
                              }`}
                            />
                            {formErrors.appointmentDate && (
                              <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.appointmentDate}</p>
                            )}
                          </div>

                          <div>
                            <label htmlFor="appointmentTime" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Time <span className="text-red-500">*</span>
                            </label>
                            <input
                              id="appointmentTime"
                              name="appointmentTime"
                              type="time"
                              value={formData.appointmentTime}
                              onChange={handleFormChange}
                              className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                formErrors.appointmentTime ? 'border-red-500' : 'border-gray-300'
                              }`}
                            />
                            {formErrors.appointmentTime && (
                              <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.appointmentTime}</p>
                            )}
                          </div>
                        </div>

                        {/* Student Information */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                          <div className="sm:col-span-2">
                            <label htmlFor="studentName" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Student Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              id="studentName"
                              name="studentName"
                              type="text"
                              value={formData.studentName}
                              onChange={handleFormChange}
                              className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                formErrors.studentName ? 'border-red-500' : 'border-gray-300'
                              }`}
                              placeholder="Enter student name"
                            />
                            {formErrors.studentName && (
                              <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.studentName}</p>
                            )}
                          </div>

                          <div>
                            <label htmlFor="studentAge" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Age
                            </label>
                            <input
                              id="studentAge"
                              name="studentAge"
                              type="number"
                              min="1"
                              max="120"
                              value={formData.studentAge}
                              onChange={handleFormChange}
                              className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                formErrors.studentAge ? 'border-red-500' : 'border-gray-300'
                              }`}
                              placeholder="Age"
                            />
                            {formErrors.studentAge && (
                              <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.studentAge}</p>
                            )}
                          </div>
                        </div>

                        {/* Student Level and Class Type */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div>
                            <label htmlFor="studentLevel" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Student Level
                            </label>
                            <input
                              id="studentLevel"
                              name="studentLevel"
                              type="text"
                              value={formData.studentLevel}
                              onChange={handleFormChange}
                              className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              placeholder="e.g., Beginner, Intermediate"
                            />
                          </div>

                          <div>
                            <label htmlFor="classType" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Class Type
                            </label>
                            <input
                              id="classType"
                              name="classType"
                              type="text"
                              value={formData.classType}
                              onChange={handleFormChange}
                              className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              placeholder="e.g., One-on-one, Group"
                            />
                          </div>
                        </div>

                        {/* Material */}
                        <div>
                          <label htmlFor="materialId" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Teaching Material
                          </label>
                          <select
                            id="materialId"
                            name="materialId"
                            value={formData.materialId}
                            onChange={handleFormChange}
                            className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          >
                            <option value="">Select material (optional)</option>
                            {materials.map((material) => (
                              <option key={material.material_id} value={material.material_id}>
                                {material.material_name || 'N/A'}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Additional Notes */}
                        <div>
                          <label htmlFor="additionalNotes" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Additional Notes
                          </label>
                          <textarea
                            id="additionalNotes"
                            name="additionalNotes"
                            rows="3"
                            value={formData.additionalNotes}
                            onChange={handleFormChange}
                            className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="Any additional notes or special requirements..."
                          />
                        </div>

                        {/* Submit Error */}
                        {formErrors.submit && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3">
                            <p className="text-xs sm:text-sm text-red-600">{formErrors.submit}</p>
                          </div>
                        )}

                        {/* Modal Footer */}
                        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4">
                          <button
                            type="button"
                            onClick={handleModalClose}
                            className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                            disabled={isSubmitting}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="w-full sm:w-auto px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? 'Creating...' : 'Create Appointment'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>,
                document.body
              )}
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

export default Appointment;
