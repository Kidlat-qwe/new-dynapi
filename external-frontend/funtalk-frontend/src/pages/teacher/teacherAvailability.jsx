import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { API_BASE_URL } from '@/config/api.js';

const toYyyyMmDd = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toMonthKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const TeacherAvailability = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [teacherEmploymentType, setTeacherEmploymentType] = useState('part_time');
  const [availability, setAvailability] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => toMonthKey(new Date()));
  const [isFetching, setIsFetching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExceptionModalOpen, setIsExceptionModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    dayOfWeek: '',
    startTime: '',
    endTime: '',
    isActive: true,
  });
  const [exceptionFormData, setExceptionFormData] = useState({
    exceptionDate: '',
    startTime: '',
    endTime: '',
    reason: '',
    isBlocked: true,
  });
  const [formErrors, setFormErrors] = useState({});
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isMeetingDetailModalOpen, setIsMeetingDetailModalOpen] = useState(false);

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

  // Fetch availability
  useEffect(() => {
    if (user) {
      fetchTeacherProfile();
      fetchAvailability();
      fetchExceptions();
      fetchAppointments();
    }
  }, [user]);

  const fetchTeacherProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/teachers/me/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success && data.data?.profile) {
        setTeacherEmploymentType(
          String(data.data.profile.employment_type || 'part_time').toLowerCase() === 'full_time'
            ? 'full_time'
            : 'part_time'
        );
      }
    } catch (error) {
      console.error('Error fetching teacher profile:', error);
    }
  };

  const fetchAvailability = async () => {
    setIsFetching(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/availability/teacher/${user.userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success && data.data?.availability) {
        setAvailability(data.data.availability);
      } else {
        console.error('Error fetching availability:', data.message);
        setAvailability([]);
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
      setAvailability([]);
    } finally {
      setIsFetching(false);
    }
  };

  const fetchExceptions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/availability/teacher/${user.userId}/exceptions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success && data.data?.exceptions) {
        setExceptions(data.data.exceptions);
      } else {
        setExceptions([]);
      }
    } catch (error) {
      console.error('Error fetching exceptions:', error);
      setExceptions([]);
    }
  };

  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/appointments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success && data.data?.appointments) {
        setAppointments(data.data.appointments);
      } else {
        setAppointments([]);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setAppointments([]);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({
      dayOfWeek: '',
      startTime: '',
      endTime: '',
      isActive: true,
    });
    setFormErrors({});
  };

  const handleExceptionModalClose = () => {
    setIsExceptionModalOpen(false);
    setExceptionFormData({
      exceptionDate: '',
      startTime: '',
      endTime: '',
      reason: '',
      isBlocked: true,
    });
    setFormErrors({});
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      dayOfWeek: item.day_of_week.toString(),
      startTime: item.start_time,
      endTime: item.end_time,
      isActive: item.is_active,
    });
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleExceptionFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setExceptionFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.dayOfWeek) {
      newErrors.dayOfWeek = 'Day of week is required';
    }
    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }
    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      newErrors.endTime = 'End time must be after start time';
    }
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingItem
        ? `${API_BASE_URL}/availability/${editingItem.availability_id}`
        : `${API_BASE_URL}/availability`;
      
      const method = editingItem ? 'PUT' : 'POST';
      
      const requestBody = editingItem
        ? {
            startTime: formData.startTime,
            endTime: formData.endTime,
            isActive: formData.isActive,
          }
        : {
            dayOfWeek: parseInt(formData.dayOfWeek),
            startTime: formData.startTime,
            endTime: formData.endTime,
            isActive: formData.isActive,
          };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert(editingItem ? 'Availability updated successfully!' : 'Availability added successfully!');
        handleModalClose();
        fetchAvailability();
      } else {
        alert(data.message || 'Error saving availability');
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('Error saving availability. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    const ok = await window.appConfirm?.('Are you sure you want to delete this availability slot?');
    if (!ok) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/availability/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert('Availability deleted successfully');
        fetchAvailability();
      } else {
        alert(data.message || 'Error deleting availability');
      }
    } catch (error) {
      console.error('Error deleting availability:', error);
      alert('Error deleting availability. Please try again.');
    }
  };

  const handleExceptionSubmit = async (e) => {
    e.preventDefault();
    if (!exceptionFormData.exceptionDate) {
      alert('Exception date is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/availability/exceptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(exceptionFormData),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert('Exception added successfully!');
        handleExceptionModalClose();
        fetchExceptions();
      } else {
        alert(data.message || 'Error adding exception');
      }
    } catch (error) {
      console.error('Error adding exception:', error);
      alert('Error adding exception. Please try again.');
    }
  };

  const handleDeleteException = async (id) => {
    const ok = await window.appConfirm?.('Are you sure you want to remove this exception?');
    if (!ok) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/availability/exceptions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert('Exception removed successfully');
        fetchExceptions();
      } else {
        alert(data.message || 'Error removing exception');
      }
    } catch (error) {
      console.error('Error removing exception:', error);
      alert('Error removing exception. Please try again.');
    }
  };

  // Get day name
  const getDayName = (dayOfWeek) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'Time TBA';
    const [hourPart, minutePart] = String(timeString).split(':');
    const hours = Number(hourPart);
    const minutes = Number(minutePart || 0);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return String(timeString).slice(0, 5);
    const period = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const formatStatus = (status) => {
    const map = {
      pending: 'Pending',
      approved: 'Approved',
      completed: 'Completed',
      cancelled: 'Cancelled',
      no_show: 'No Show',
    };
    const key = String(status || '').toLowerCase();
    return map[key] || 'Unknown';
  };

  const getStatusBadgeClass = (status) => {
    const key = String(status || '').toLowerCase();
    if (key === 'approved') return 'bg-blue-100 text-blue-800';
    if (key === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (key === 'completed') return 'bg-green-100 text-green-800';
    if (key === 'cancelled') return 'bg-red-100 text-red-800';
    if (key === 'no_show') return 'bg-gray-100 text-gray-700';
    return 'bg-gray-100 text-gray-700';
  };

  const openMeetingDetail = (meeting) => {
    setSelectedMeeting(meeting);
    setIsMeetingDetailModalOpen(true);
  };

  const monthDate = new Date(`${calendarMonth}-01T00:00:00`);
  const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const lastDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const leadingEmptyDays = firstDayOfMonth.getDay();
  const totalDays = lastDayOfMonth.getDate();
  const meetingDaySet = new Set(
    appointments
      .filter((apt) => !['cancelled', 'no_show'].includes(String(apt.status || '').toLowerCase()))
      .map((apt) => String(apt.appointment_date || '').slice(0, 10))
      .filter(Boolean)
  );
  const exceptionDaySet = new Set(exceptions.map((ex) => String(ex.exception_date || '').slice(0, 10)).filter(Boolean));
  const meetingsByDate = appointments
    .filter((apt) => !['cancelled', 'no_show'].includes(String(apt.status || '').toLowerCase()))
    .reduce((acc, apt) => {
      const dateKey = String(apt.appointment_date || '').slice(0, 10);
      if (!dateKey) return acc;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(apt);
      return acc;
    }, {});

  Object.keys(meetingsByDate).forEach((dateKey) => {
    meetingsByDate[dateKey].sort((a, b) =>
      String(a.appointment_time || '').localeCompare(String(b.appointment_time || ''))
    );
  });
  const todayKey = toYyyyMmDd(new Date());

  const getDayStatus = (isoDate) => {
    if (exceptionDaySet.has(isoDate)) return 'exception';
    if (meetingDaySet.has(isoDate)) return 'meeting';
    return 'free';
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
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Availability</h1>
                  <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">Manage your weekly schedule and exceptions</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsExceptionModalOpen(true)}
                    className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Add Exception
                  </button>
                  {teacherEmploymentType !== 'full_time' && (
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Add Availability
                    </button>
                  )}
                </div>
              </div>

              {teacherEmploymentType === 'full_time' && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  Full-time mode is active. You are available for booking all days and times by default.
                  Add exceptions for leaves/time-off. Booked slots and exception blocks are unavailable.
                </div>
              )}

              {/* Calendar Overview */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 sm:p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900">Schedule Calendar</h2>
                      <p className="mt-1 text-xs sm:text-sm text-gray-600">
                        Track meeting days, exception days, and free days.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date(`${calendarMonth}-01T00:00:00`);
                          d.setMonth(d.getMonth() - 1);
                          setCalendarMonth(toMonthKey(d));
                        }}
                        className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                        aria-label="Previous month"
                      >
                        ←
                      </button>
                      <span className="text-sm font-medium text-gray-800 min-w-[130px] text-center">{monthLabel}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date(`${calendarMonth}-01T00:00:00`);
                          d.setMonth(d.getMonth() + 1);
                          setCalendarMonth(toMonthKey(d));
                        }}
                        className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                        aria-label="Next month"
                      >
                        →
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      Meeting
                    </span>
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      Exception
                    </span>
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                      Free
                    </span>
                  </div>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 mb-2">
                    <div>Sun</div>
                    <div>Mon</div>
                    <div>Tue</div>
                    <div>Wed</div>
                    <div>Thu</div>
                    <div>Fri</div>
                    <div>Sat</div>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: leadingEmptyDays }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="h-16 sm:h-20 rounded border border-transparent" />
                    ))}
                    {Array.from({ length: totalDays }).map((_, idx) => {
                      const day = idx + 1;
                      const cellDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
                      const isoDate = toYyyyMmDd(cellDate);
                      const status = getDayStatus(isoDate);
                      const isToday = isoDate === todayKey;
                      const dayMeetings = meetingsByDate[isoDate] || [];
                      const statusClasses =
                        status === 'exception'
                          ? 'bg-amber-50 border-amber-200'
                          : status === 'meeting'
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-green-50 border-green-200';
                      const dotClasses =
                        status === 'exception' ? 'bg-amber-500' : status === 'meeting' ? 'bg-blue-500' : 'bg-green-500';

                      return (
                        <div
                          key={isoDate}
                          className={`h-24 sm:h-28 rounded border p-1.5 text-left ${statusClasses} ${
                            isToday ? 'ring-2 ring-primary-500' : ''
                          }`}
                          title={`${isoDate} - ${status}`}
                        >
                          <div className="text-xs font-semibold text-gray-800">{day}</div>
                          <div className="mt-1 inline-flex items-center gap-1">
                            <span className={`h-2 w-2 rounded-full ${dotClasses}`} />
                            <span className="text-[10px] text-gray-600 capitalize">{status}</span>
                          </div>
                          {dayMeetings.length > 0 && (
                            <div className="mt-1.5 space-y-1 max-h-[44px] sm:max-h-[64px] overflow-y-auto pr-0.5">
                              {dayMeetings.map((meeting) => (
                                <button
                                  key={meeting.appointment_id}
                                  type="button"
                                  onClick={() => openMeetingDetail(meeting)}
                                  className="w-full text-left px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors text-[10px] font-medium"
                                  title={`View meeting details (${formatTime(meeting.appointment_time)})`}
                                >
                                  {formatTime(meeting.appointment_time)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Weekly Availability */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 sm:p-6 border-b border-gray-200">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Weekly Schedule</h2>
                  <p className="mt-1 text-xs sm:text-sm text-gray-600">Set your recurring weekly availability</p>
                </div>
                <div className="p-4 sm:p-6">
                  {teacherEmploymentType === 'full_time' ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-medium text-gray-900">Full-time availability</p>
                      <p className="mt-1 text-sm text-gray-600">
                        Weekly schedule setup is not required for full-time teachers.
                      </p>
                    </div>
                  ) : isFetching ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="mt-3 text-sm text-gray-600">Loading...</p>
                    </div>
                  ) : availability.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="mt-3 text-sm text-gray-600">No availability set. Add your weekly schedule to get started.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto overflow-hidden">
                      <table className="w-full divide-y divide-gray-200" style={{ minWidth: '600px' }}>
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Day</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Time</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {availability.map((item) => (
                            <tr key={item.availability_id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{getDayName(item.day_of_week)}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {item.start_time?.substring(0, 5)} - {item.end_time?.substring(0, 5)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  item.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {item.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleEdit(item)}
                                    className="text-primary-600 hover:text-primary-800"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(item.availability_id)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    Delete
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
              </div>

              {/* Exceptions */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 sm:p-6 border-b border-gray-200">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Exceptions</h2>
                  <p className="mt-1 text-xs sm:text-sm text-gray-600">Block specific dates (holidays, personal time, etc.)</p>
                </div>
                <div className="p-4 sm:p-6">
                  {exceptions.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-3 text-sm text-gray-600">No exceptions set</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {exceptions.map((exception) => (
                        <div
                          key={exception.exception_id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-gray-900">{formatDate(exception.exception_date)}</h3>
                              {exception.start_time && exception.end_time && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {exception.start_time.substring(0, 5)} - {exception.end_time.substring(0, 5)}
                                </p>
                              )}
                              {exception.reason && (
                                <p className="text-xs text-gray-600 mt-1">{exception.reason}</p>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteException(exception.exception_id)}
                              className="text-red-600 hover:text-red-800 ml-4"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
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

      {/* Add/Edit Availability Modal */}
      {isModalOpen && teacherEmploymentType !== 'full_time' && createPortal(
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
              handleModalClose();
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 sm:mx-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {editingItem ? 'Edit Availability' : 'Add Availability'}
                </h2>
                <button
                  onClick={handleModalClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-3 sm:space-y-4">
                {!editingItem && (
                  <div>
                    <label htmlFor="dayOfWeek" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Day of Week <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="dayOfWeek"
                      name="dayOfWeek"
                      value={formData.dayOfWeek}
                      onChange={handleFormChange}
                      className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                        formErrors.dayOfWeek ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select day</option>
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                    {formErrors.dayOfWeek && (
                      <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.dayOfWeek}</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label htmlFor="startTime" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Start Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="startTime"
                      name="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={handleFormChange}
                      className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                        formErrors.startTime ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.startTime && (
                      <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.startTime}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="endTime" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      End Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="endTime"
                      name="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={handleFormChange}
                      className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                        formErrors.endTime ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.endTime && (
                      <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.endTime}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    id="isActive"
                    name="isActive"
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-xs sm:text-sm text-gray-700">
                    Active
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    {editingItem ? 'Update' : 'Add'} Availability
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Exception Modal */}
      {isExceptionModalOpen && createPortal(
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
              handleExceptionModalClose();
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 sm:mx-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Add Exception</h2>
                <button
                  onClick={handleExceptionModalClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleExceptionSubmit} className="space-y-3 sm:space-y-4">
                <div>
                  <label htmlFor="exceptionDate" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="exceptionDate"
                    name="exceptionDate"
                    type="date"
                    value={exceptionFormData.exceptionDate}
                    onChange={handleExceptionFormChange}
                    className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label htmlFor="exceptionStartTime" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Start Time (Optional)
                    </label>
                    <input
                      id="exceptionStartTime"
                      name="startTime"
                      type="time"
                      value={exceptionFormData.startTime}
                      onChange={handleExceptionFormChange}
                      className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="exceptionEndTime" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      End Time (Optional)
                    </label>
                    <input
                      id="exceptionEndTime"
                      name="endTime"
                      type="time"
                      value={exceptionFormData.endTime}
                      onChange={handleExceptionFormChange}
                      className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reason" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Reason (Optional)
                  </label>
                  <input
                    id="reason"
                    name="reason"
                    type="text"
                    value={exceptionFormData.reason}
                    onChange={handleExceptionFormChange}
                    className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g., Holiday, Personal time"
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    type="button"
                    onClick={handleExceptionModalClose}
                    className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Add Exception
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

      {isMeetingDetailModalOpen && selectedMeeting && createPortal(
        <div
          className="fixed bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsMeetingDetailModalOpen(false);
              setSelectedMeeting(null);
            }
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Meeting details</h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsMeetingDetailModalOpen(false);
                    setSelectedMeeting(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  aria-label="Close meeting details"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-2 text-sm text-gray-700">
                <div><span className="font-medium text-gray-900">Date:</span> {formatDate(selectedMeeting.appointment_date)}</div>
                <div><span className="font-medium text-gray-900">Time:</span> {formatTime(selectedMeeting.appointment_time)}</div>
                <div><span className="font-medium text-gray-900">Student:</span> {selectedMeeting.student_name || 'N/A'}</div>
                <div><span className="font-medium text-gray-900">School:</span> {selectedMeeting.school_name || 'N/A'}</div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">Status:</span>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusBadgeClass(selectedMeeting.status)}`}>
                    {formatStatus(selectedMeeting.status)}
                  </span>
                </div>
                {selectedMeeting.meeting_link && (
                  <div className="pt-1">
                    <a
                      href={String(selectedMeeting.meeting_link).startsWith('http') ? selectedMeeting.meeting_link : `https://${selectedMeeting.meeting_link}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
                    >
                      Open meeting link
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TeacherAvailability;
