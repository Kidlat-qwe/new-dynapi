import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { fetchFuntalk } from '../../lib/api';

const SchoolBookings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [formData, setFormData] = useState({
    teacherId: '',
    appointmentDate: '',
    appointmentTime: '',
    studentId: '',
    studentName: '',
    studentAge: '',
    studentLevel: '',
    materialId: '',
    classType: '',
    additionalNotes: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);

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
      fetchTeachers();
      fetchStudents();
      fetchMaterials();
      fetchCreditBalance();
    }
  }, [user, statusFilter, teacherFilter]);

  const fetchAppointments = async () => {
    setIsFetching(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (teacherFilter) params.append('teacherId', teacherFilter);
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

  const fetchStudents = async () => {
    try {
      const response = await fetchFuntalk('/students', {});

      const data = await response.json();
      if (data.success && data.data?.students) {
        setStudents(data.data.students.filter(s => s.is_active));
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchMaterials = async () => {
    try {
      const response = await fetchFuntalk('/materials', {});

      const data = await response.json();
      if (data.success && data.data?.materials) {
        setMaterials(data.data.materials);
      }
    } catch (error) {
      console.error('Error fetching materials:', error);
    }
  };

  const fetchCreditBalance = async () => {
    try {
      const response = await fetchFuntalk('/credits/balance', {});

      const data = await response.json();
      if (data.success && data.data?.current_balance !== undefined) {
        setCreditBalance(data.data.current_balance);
      }
    } catch (error) {
      console.error('Error fetching credit balance:', error);
    }
  };

  const fetchAvailableSlots = async (teacherId, date) => {
    if (!teacherId || !date) return;
    try {
      const response = await fetchFuntalk(`/availability/teacher/${teacherId}/available-slots?date=${date}`, {});

      const data = await response.json();
      if (data.success && data.data?.slots) {
        setAvailableSlots(data.data.slots);
      } else {
        setAvailableSlots([]);
      }
    } catch (error) {
      console.error('Error fetching available slots:', error);
      setAvailableSlots([]);
    }
  };

  const handleBookingClick = (teacher) => {
    setSelectedTeacher(teacher);
    setFormData({
      ...formData,
      teacherId: teacher.teacher_id,
    });
    setIsBookingModalOpen(true);
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setFormData({
      ...formData,
      appointmentDate: date,
      appointmentTime: '', // Reset time when date changes
    });
    if (formData.teacherId) {
      fetchAvailableSlots(formData.teacherId, date);
    }
  };

  const handleTeacherChange = (teacherId) => {
    setFormData({
      ...formData,
      teacherId,
      appointmentDate: '',
      appointmentTime: '',
    });
    setSelectedDate('');
    setAvailableSlots([]);
  };

  const handleStudentChange = (studentId) => {
    const student = students.find(s => s.student_id === parseInt(studentId));
    if (student) {
      setFormData({
        ...formData,
        studentId: studentId,
        studentName: student.student_name,
        studentAge: student.student_age || '',
        studentLevel: student.student_level || '',
      });
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    if (name === 'appointmentDate') {
      handleDateChange(value);
    } else if (name === 'teacherId') {
      handleTeacherChange(value);
    } else if (name === 'studentId') {
      handleStudentChange(value);
    }
    
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
      newErrors.teacherId = 'Please select a teacher';
    }

    if (!formData.appointmentDate) {
      newErrors.appointmentDate = 'Please select a date';
    }

    if (!formData.appointmentTime) {
      newErrors.appointmentTime = 'Please select a time slot';
    }

    if (!formData.studentName || !formData.studentName.trim()) {
      newErrors.studentName = 'Student name is required';
    }

    if (creditBalance < 1) {
      newErrors.submit = 'Insufficient credits. Please purchase credits first.';
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
      const response = await fetchFuntalk('/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teacherId: parseInt(formData.teacherId),
          appointmentDate: formData.appointmentDate,
          appointmentTime: formData.appointmentTime,
          studentName: formData.studentName.trim(),
          studentAge: formData.studentAge ? parseInt(formData.studentAge) : null,
          studentLevel: formData.studentLevel || null,
          materialId: formData.materialId || null,
          classType: formData.classType || null,
          additionalNotes: formData.additionalNotes || null,
          studentId: formData.studentId ? parseInt(formData.studentId) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          const validationErrors = {};
          data.errors.forEach((error) => {
            const fieldName = error.param || error.path || 'unknown';
            validationErrors[fieldName] = error.msg || error.message;
          });
          setFormErrors(validationErrors);
        } else {
          setFormErrors({
            submit: data.message || 'Error creating booking. Please try again.',
          });
        }
        return;
      }

      alert('Booking created successfully! It will be reviewed by admin.');
      setIsBookingModalOpen(false);
      setFormData({
        teacherId: '',
        appointmentDate: '',
        appointmentTime: '',
        studentId: '',
        studentName: '',
        studentAge: '',
        studentLevel: '',
        materialId: '',
        classType: '',
        additionalNotes: '',
      });
      setSelectedDate('');
      setAvailableSlots([]);
      fetchAppointments();
      fetchCreditBalance();
    } catch (error) {
      console.error('Error creating booking:', error);
      setFormErrors({
        submit: 'Network error. Please check your connection and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter appointments
  const filteredAppointments = appointments.filter((apt) => {
    const matchesStatus = !statusFilter || apt.status === statusFilter;
    const matchesTeacher = !teacherFilter || apt.teacher_id === parseInt(teacherFilter);
    const matchesStudent = !studentSearch || 
      apt.student_name?.toLowerCase().includes(studentSearch.toLowerCase());
    return matchesStatus && matchesTeacher && matchesStudent;
  });

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

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
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
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Bookings</h1>
                  <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">Book classes with teachers</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-600">Credits</p>
                    <p className="text-lg font-bold text-primary-600">{creditBalance}</p>
                  </div>
                  <button
                    onClick={() => setIsBookingModalOpen(true)}
                    className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Book New Class
                  </button>
                </div>
              </div>

              {/* Teachers Grid - Quick Book */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Available Teachers</h2>
                {teachers.length === 0 ? (
                  <p className="text-sm text-gray-500">No teachers available</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teachers.map((teacher) => (
                      <div key={teacher.teacher_id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">{teacher.fullname || 'N/A'}</h3>
                            {teacher.gender && (
                              <p className="text-xs text-gray-500">{teacher.gender}</p>
                            )}
                          </div>
                        </div>
                        {teacher.description && (
                          <p className="text-xs sm:text-sm text-gray-600 mb-3 line-clamp-2">{teacher.description}</p>
                        )}
                        <button
                          onClick={() => handleBookingClick(teacher)}
                          className="w-full px-3 py-2 text-xs sm:text-sm font-medium text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                        >
                          Book Class
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* My Bookings Table */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 sm:p-6 border-b border-gray-200">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">My Bookings</h2>
                  {/* Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <input
                        type="text"
                        placeholder="Search student..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="no_show">No Show</option>
                      </select>
                    </div>
                    <div>
                      <select
                        value={teacherFilter}
                        onChange={(e) => setTeacherFilter(e.target.value)}
                        className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">All Teachers</option>
                        {teachers.map((teacher) => (
                          <option key={teacher.teacher_id} value={teacher.teacher_id}>
                            {teacher.fullname}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto overflow-hidden">
                  {isFetching ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="mt-3 text-sm text-gray-600">Loading bookings...</p>
                    </div>
                  ) : filteredAppointments.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-sm text-gray-500">No bookings found</p>
                    </div>
                  ) : (
                    <table className="w-full divide-y divide-gray-200" style={{ minWidth: '900px' }}>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAppointments.map((apt) => (
                          <tr key={apt.appointment_id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDateTime(apt.appointment_date, apt.appointment_time)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {apt.student_name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {apt.teacher_name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {apt.material_name || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(apt.status)}`}>
                                {formatStatus(apt.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Booking Modal */}
      {isBookingModalOpen && createPortal(
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
              setIsBookingModalOpen(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4 sm:mx-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Book New Class</h2>
                <button
                  onClick={() => setIsBookingModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-3 sm:space-y-4">
                {/* Teacher Selection */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Teacher <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="teacherId"
                    value={formData.teacherId}
                    onChange={handleFormChange}
                    className={`w-full px-3 sm:px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                      formErrors.teacherId ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select a teacher</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.teacher_id} value={teacher.teacher_id}>
                        {teacher.fullname}
                      </option>
                    ))}
                  </select>
                  {formErrors.teacherId && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.teacherId}</p>
                  )}
                </div>

                {/* Date Selection */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="appointmentDate"
                    type="date"
                    min={getMinDate()}
                    value={formData.appointmentDate}
                    onChange={handleFormChange}
                    className={`w-full px-3 sm:px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                      formErrors.appointmentDate ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.appointmentDate && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.appointmentDate}</p>
                  )}
                </div>

                {/* Time Slot Selection */}
                {formData.appointmentDate && formData.teacherId && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Time Slot <span className="text-red-500">*</span>
                    </label>
                    {availableSlots.length === 0 ? (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-xs sm:text-sm text-yellow-800">
                          {selectedDate ? 'No available slots for this date. Please select another date.' : 'Please select a date first.'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {availableSlots.map((slot, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, appointmentTime: slot });
                              setFormErrors({ ...formErrors, appointmentTime: '' });
                            }}
                            className={`px-3 py-2 text-xs sm:text-sm border rounded-lg transition-colors ${
                              formData.appointmentTime === slot
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-primary-50'
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
                    {formErrors.appointmentTime && (
                      <p className="mt-1 text-xs text-red-600">{formErrors.appointmentTime}</p>
                    )}
                  </div>
                )}

                {/* Student Selection */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Student <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="studentId"
                    value={formData.studentId}
                    onChange={handleFormChange}
                    className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select existing student or enter new</option>
                    {students.map((student) => (
                      <option key={student.student_id} value={student.student_id}>
                        {student.student_name} {student.student_level ? `(${student.student_level})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Student Name */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Student Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="studentName"
                    type="text"
                    value={formData.studentName}
                    onChange={handleFormChange}
                    className={`w-full px-3 sm:px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                      formErrors.studentName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter student name"
                  />
                  {formErrors.studentName && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.studentName}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {/* Student Age */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Age</label>
                    <input
                      name="studentAge"
                      type="number"
                      min="1"
                      max="120"
                      value={formData.studentAge}
                      onChange={handleFormChange}
                      className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Student Level */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Level</label>
                    <input
                      name="studentLevel"
                      type="text"
                      value={formData.studentLevel}
                      onChange={handleFormChange}
                      className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., Beginner"
                    />
                  </div>
                </div>

                {/* Material Selection */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Material</label>
                  <select
                    name="materialId"
                    value={formData.materialId}
                    onChange={handleFormChange}
                    className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select material (optional)</option>
                    {materials.map((material) => (
                      <option key={material.material_id} value={material.material_id}>
                        {material.material_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                  <textarea
                    name="additionalNotes"
                    rows="3"
                    value={formData.additionalNotes}
                    onChange={handleFormChange}
                    className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Any special instructions or notes..."
                  />
                </div>

                {/* Credit Deduction Warning */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-700">This booking will deduct:</span>
                    <span className="text-sm font-semibold text-primary-600">1 Credit</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs sm:text-sm text-gray-700">Current Balance:</span>
                    <span className="text-sm font-semibold">{creditBalance} Credits</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs sm:text-sm text-gray-700">Balance After:</span>
                    <span className="text-sm font-semibold text-primary-600">{creditBalance - 1} Credits</span>
                  </div>
                </div>

                {formErrors.submit && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3">
                    <p className="text-xs sm:text-sm text-red-600">{formErrors.submit}</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    type="button"
                    onClick={() => setIsBookingModalOpen(false)}
                    className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmitting || creditBalance < 1}
                  >
                    {isSubmitting ? 'Creating...' : 'Create Booking'}
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

export default SchoolBookings;
