import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import ResponsiveSelect from '../../components/ResponsiveSelect.jsx';
import { BOOKING_TIME_OPTIONS } from '../../constants/bookingTimeOptions.js';
import { API_BASE_URL } from '@/config/api.js';
import { computeFixedActionMenuPosition } from '../../utils/actionMenuPosition.js';
import Pagination from '../../components/Pagination.jsx';

const DURATION_OPTIONS = [
  { value: '25', label: '25 mins (1 credit)', credits: 1 },
  { value: '50', label: '50 mins (2 credits)', credits: 2 },
  { value: '75', label: '75 mins (3 credits)', credits: 3 },
  { value: '100', label: '100 mins (4 credits)', credits: 4 },
];
const CLASS_TYPE_OPTIONS = [
  { value: 'one_on_one', label: 'One-on-one' },
  { value: 'group', label: 'Group' },
  { value: 'vip', label: 'VIP' },
];
const CEFR_LEVEL_OPTIONS = [
  { value: 'A1', label: 'A1' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
  { value: 'C1', label: 'C1' },
  { value: 'C2', label: 'C2' },
];
const CEFR_LEVEL_VALUES = new Set(CEFR_LEVEL_OPTIONS.map((o) => o.value));
const MATERIAL_TYPE_OPTIONS = [
  { value: 'teacher_provided', label: 'Teacher Provided' },
  { value: 'student_provided', label: 'Student Provided' },
  { value: 'free_talk', label: 'Free Talk' },
];
const TEACHER_REQUIREMENT_OPTIONS = [
  { value: 'picture', label: 'Picture' },
  { value: 'intro_video', label: 'Intro Video' },
  { value: 'curriculum_vitae', label: 'Curriculum Vitae' },
  { value: 'intro_audio', label: 'Intro Audio' },
  { value: 'intro_text', label: 'Intro Text' },
];

const teacherRequirementLabel = (value) => {
  const v = String(value || '').trim();
  const found = TEACHER_REQUIREMENT_OPTIONS.find((o) => o.value === v);
  return found ? found.label : v;
};

/** Parses "Teacher Requirements: a, b" line from appointment additional_notes (school booking metadata). */
const parseTeacherRequirementsFromNotes = (additionalNotes) => {
  if (!additionalNotes) return [];
  const lines = String(additionalNotes).split('\n');
  const line = lines.find((l) => l.trim().toLowerCase().startsWith('teacher requirements:'));
  if (!line) return [];
  const afterColon = line.split(':').slice(1).join(':').trim();
  if (!afterColon) return [];
  return afterColon.split(',').map((s) => s.trim()).filter(Boolean);
};

/** Resolves stored paths (e.g. /uploads/...) or full URLs for teacher media. */
const toAbsoluteMediaUrl = (url) => {
  if (url == null || String(url).trim() === '') return '';
  const u = String(url).trim();
  if (/^https?:\/\//i.test(u)) return u;
  const base = API_BASE_URL.replace(/\/?api\/?$/i, '');
  return u.startsWith('/') ? `${base}${u}` : `${base}/${u}`;
};

/**
 * Renders the assigned teacher’s asset for each requirement the school selected (picture, video, etc.).
 */
function TeacherRequirementPreview({ reqKey, appointment, teacherRequirementLabel }) {
  const [pictureError, setPictureError] = useState(false);
  const key = String(reqKey || '').trim().toLowerCase();
  const label = teacherRequirementLabel(key);
  const hasTeacher = appointment.teacher_id != null;

  if (!hasTeacher) {
    return (
      <div className="rounded-lg border border-amber-100 bg-amber-50/90 p-3 sm:p-4">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="mt-1 text-xs sm:text-sm text-amber-900/90">
          No teacher assigned yet. After a teacher is assigned, their materials for this request will appear here.
        </p>
      </div>
    );
  }

  if (key === 'picture') {
    const src = toAbsoluteMediaUrl(appointment.teacher_profile_picture);
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        {!src ? (
          <p className="text-sm text-gray-500">The teacher has not uploaded a profile picture yet.</p>
        ) : pictureError ? (
          <p className="text-sm text-red-600">Unable to load the profile picture.</p>
        ) : (
          <img
            src={src}
            alt={appointment.teacher_name ? `${appointment.teacher_name} profile` : 'Teacher profile'}
            className="max-h-64 w-full max-w-md rounded-lg border border-gray-100 bg-gray-50 object-contain"
            loading="lazy"
            onError={() => setPictureError(true)}
          />
        )}
      </div>
    );
  }

  if (key === 'intro_video') {
    const src = toAbsoluteMediaUrl(appointment.teacher_video_intro);
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        {!src ? (
          <p className="text-sm text-gray-500">The teacher has not uploaded an intro video yet.</p>
        ) : (
          <video
            src={src}
            controls
            playsInline
            className="aspect-video w-full max-w-full rounded-lg border border-gray-200 bg-black sm:max-h-80"
          >
            <a href={src} className="text-sm text-primary-600" target="_blank" rel="noopener noreferrer">
              Open video
            </a>
          </video>
        )}
      </div>
    );
  }

  if (key === 'intro_audio') {
    const src = toAbsoluteMediaUrl(appointment.teacher_audio_intro);
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        {!src ? (
          <p className="text-sm text-gray-500">The teacher has not uploaded intro audio yet.</p>
        ) : (
          <audio src={src} controls className="w-full max-w-md">
            <a href={src} target="_blank" rel="noopener noreferrer">
              Download audio
            </a>
          </audio>
        )}
      </div>
    );
  }

  if (key === 'curriculum_vitae') {
    const src = toAbsoluteMediaUrl(appointment.teacher_docs);
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        {!src ? (
          <p className="text-sm text-gray-500">The teacher has not uploaded a CV yet.</p>
        ) : (
          <div className="space-y-3">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm font-medium text-primary-600 hover:text-primary-800 underline-offset-2 hover:underline"
            >
              Open document in new tab
            </a>
            <iframe
              title="Curriculum vitae preview"
              src={src}
              className="h-64 w-full max-w-full rounded-lg border border-gray-200 sm:h-80"
            />
          </div>
        )}
      </div>
    );
  }

  if (key === 'intro_text') {
    const text = appointment.teacher_description;
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        {text && String(text).trim() ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap">
            {String(text).trim()}
          </div>
        ) : (
          <p className="text-sm text-gray-500">The teacher has not added intro text yet.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-gray-900">{label}</p>
      <p className="text-xs text-gray-500">No preview is available for this requirement type.</p>
    </div>
  );
}

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
  const [page, setPage] = useState(1);
  const [formData, setFormData] = useState({
    studentId: '',
    studentLevel: '',
    appointmentDate: '',
    appointmentTime: '',
    duration: '25',
    classType: '',
    materialType: 'teacher_provided',
    materialId: '',
    teacherRequirements: [],
    additionalNotes: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [billingStatus, setBillingStatus] = useState(null);
  const [requirementsViewAppointment, setRequirementsViewAppointment] = useState(null);
  const [detailsViewAppointment, setDetailsViewAppointment] = useState(null);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [actionMenuPosition, setActionMenuPosition] = useState({ top: 0, right: 0 });

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
      fetchBillingStatus();
    }
  }, [user, statusFilter, teacherFilter]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        !event.target.closest('.booking-action-menu') &&
        !event.target.closest('.booking-action-trigger')
      ) {
        setOpenActionMenuId(null);
      }
    };
    if (openActionMenuId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openActionMenuId]);

  const fetchAppointments = async () => {
    setIsFetching(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/appointments`;
      const params = new URLSearchParams();
      
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      
      if (teacherFilter) {
        params.append('teacherId', teacherFilter);
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

  const fetchTeachers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/teachers?status=active`, {
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

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/students`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success && data.data?.students) {
        setStudents(data.data.students.filter((item) => item.is_active));
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      setStudents([]);
    }
  };

  const fetchMaterials = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/materials`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

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
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/credits/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success && data.data?.current_balance !== undefined) {
        setCreditBalance(data.data.current_balance);
      }
    } catch (error) {
      console.error('Error fetching credit balance:', error);
    }
  };

  const fetchBillingStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/billing/subscriptions/${user.userId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success && data.data) {
        setBillingStatus(data.data);
      } else {
        setBillingStatus(null);
      }
    } catch (error) {
      console.error('Error fetching billing status:', error);
      setBillingStatus(null);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    if (name === 'studentId') {
      const selected = students.find((item) => String(item.student_id) === String(value));
      const autoLevel =
        selected?.student_level && CEFR_LEVEL_VALUES.has(String(selected.student_level).trim())
          ? String(selected.student_level).trim()
          : '';
      setFormData((prev) => ({
        ...prev,
        studentId: value,
        studentLevel: autoLevel,
      }));
      if (formErrors.studentId || formErrors.studentLevel) {
        setFormErrors((prev) => ({ ...prev, studentId: '', studentLevel: '' }));
      }
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleTeacherRequirementToggle = (value) => {
    setFormData((prev) => {
      const exists = prev.teacherRequirements.includes(value);
      return {
        ...prev,
        teacherRequirements: exists
          ? prev.teacherRequirements.filter((item) => item !== value)
          : [...prev.teacherRequirements, value],
      };
    });
  };

  const validateForm = () => {
    const newErrors = {};
    const selectedDuration = DURATION_OPTIONS.find((item) => item.value === formData.duration);
    const requiredCredits = selectedDuration?.credits || 1;

    if (!formData.studentId) {
      newErrors.studentId = 'Please select a student';
    }

    if (!formData.studentLevel) {
      newErrors.studentLevel = 'Please select a CEFR level';
    }

    if (!formData.appointmentDate) {
      newErrors.appointmentDate = 'Please select a date';
    }

    if (!formData.appointmentTime) {
      newErrors.appointmentTime = 'Please select a time';
    }

    if (!formData.duration) {
      newErrors.duration = 'Please select a duration';
    }

    if (!formData.classType) {
      newErrors.classType = 'Please select a class type';
    }

    if (!formData.materialType) {
      newErrors.materialType = 'Please select a material type';
    }

    if (formData.materialType === 'student_provided' && !formData.materialId) {
      newErrors.materialId = 'Please select material for student provided class';
    }

    if (creditBalance < requiredCredits) {
      newErrors.submit = `Insufficient credits. This class requires ${requiredCredits} credit${requiredCredits > 1 ? 's' : ''}.`;
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
      const token = localStorage.getItem('token');
      const selectedDuration = DURATION_OPTIONS.find((item) => item.value === formData.duration);
      const requiredCredits = selectedDuration?.credits || 1;
      const selectedStudent = students.find((item) => item.student_id === Number(formData.studentId));
      const response = await fetch(`${API_BASE_URL}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId: formData.studentId ? Number(formData.studentId) : null,
          appointmentDate: formData.appointmentDate,
          appointmentTime: formData.appointmentTime,
          duration: formData.duration,
          classType: formData.classType,
          materialType: formData.materialType,
          materialId: formData.materialType === 'student_provided' ? (formData.materialId || null) : null,
          teacherRequirements: formData.teacherRequirements,
          studentName: selectedStudent?.student_name || user?.name || 'Student',
          additionalNotes: formData.additionalNotes || null,
          studentAge: selectedStudent?.student_age || null,
          studentLevel: formData.studentLevel.trim() || null,
          requiredCredits,
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
        studentId: '',
        studentLevel: '',
        appointmentDate: '',
        appointmentTime: '',
        duration: '25',
        classType: '',
        materialType: 'teacher_provided',
        materialId: '',
        teacherRequirements: [],
        additionalNotes: '',
      });
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

  useEffect(() => {
    setPage(1);
  }, [statusFilter, teacherFilter, studentSearch]);

  const pageSize = 10;
  const pagedAppointments = filteredAppointments.slice((page - 1) * pageSize, page * pageSize);

  const actionMenuAppointment =
    openActionMenuId != null
      ? filteredAppointments.find((a) => a.appointment_id === openActionMenuId) ?? null
      : null;

  useEffect(() => {
    if (
      openActionMenuId != null &&
      !filteredAppointments.some((a) => a.appointment_id === openActionMenuId)
    ) {
      setOpenActionMenuId(null);
    }
  }, [filteredAppointments, openActionMenuId]);

  // Format date and time (handles PostgreSQL date/time strings without Invalid Date)
  const formatDateTime = (date, time) => {
    if (!date) return 'N/A';
    let ymd = String(date);
    if (ymd.includes('T')) ymd = ymd.split('T')[0];
    if (ymd.includes(' ')) ymd = ymd.split(' ')[0];
    let hm = '00:00:00';
    if (time != null && String(time).trim() !== '') {
      const t = String(time).trim();
      const parts = t.split(':');
      const h = (parts[0] ?? '0').padStart(2, '0');
      const m = (parts[1] ?? '00').padStart(2, '0');
      const s = (parts[2] ?? '00').toString().padStart(2, '0').slice(0, 2);
      hm = `${h}:${m}:${s}`;
    }
    const d = new Date(`${ymd}T${hm}`);
    if (Number.isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
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

  const canJoinClass = (apt) => apt.status === 'approved' && Boolean(apt.meeting_link);

  const canViewTeacherRequirements = (apt) => {
    const reqs = parseTeacherRequirementsFromNotes(apt.additional_notes);
    if (reqs.length === 0) return false;
    return ['pending', 'approved', 'completed'].includes(apt.status);
  };

  const handleStudentJoinClass = (appointment) => {
    if (appointment.meeting_link) {
      window.open(appointment.meeting_link, '_blank', 'noopener,noreferrer');
    } else {
      alert('Meeting link is not available yet. It appears after the booking is approved.');
    }
  };

  const handleBookingActionClick = (e, appointmentId) => {
    e.stopPropagation();
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    setActionMenuPosition(
      computeFixedActionMenuPosition({
        rect,
        menuWidth: 224, // w-52 / w-56
        menuHeight: 220,
        gap: 6,
      })
    );
    setOpenActionMenuId(openActionMenuId === appointmentId ? null : appointmentId);
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

              {billingStatus?.is_overdue && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4">
                  <p className="text-sm text-amber-800 font-medium">
                    Billing overdue by {billingStatus.days_overdue} day{billingStatus.days_overdue !== 1 ? 's' : ''}.
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-amber-700">
                    Bookings are still allowed, but please settle payment due on {billingStatus.next_due_date}.
                  </p>
                </div>
              )}

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
                      <ResponsiveSelect
                        id="school-bookings-status-filter"
                        aria-label="Filter by status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
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
                      <ResponsiveSelect
                        id="school-bookings-teacher-filter"
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
                  </div>
                </div>
                <div className={filteredAppointments.length > 0 && !isFetching ? 'overflow-x-auto rounded-b-xl' : ''}>
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
                    <>
                    <table className="min-w-[1120px] w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Date & Time</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Student</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Teacher</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Material</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Status</th>
                          <th className="sticky right-0 z-10 bg-gray-50 px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pagedAppointments.map((apt) => (
                          <tr key={apt.appointment_id} className="group hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDateTime(apt.appointment_date, apt.appointment_time)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {apt.student_name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {apt.teacher_name || (apt.status === 'pending' ? 'To be assigned' : 'N/A')}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 max-w-[14rem] break-words sm:max-w-none sm:whitespace-nowrap">
                              {apt.material_name || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(apt.status)}`}>
                                {formatStatus(apt.status)}
                              </span>
                            </td>
                            <td className="sticky right-0 z-[1] bg-white px-6 py-4 whitespace-nowrap text-right text-sm shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.06)] group-hover:bg-gray-50">
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={(e) => handleBookingActionClick(e, apt.appointment_id)}
                                  className="booking-action-trigger text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded p-1"
                                  title="Booking actions"
                                  aria-label="Booking actions"
                                  aria-expanded={openActionMenuId === apt.appointment_id}
                                  aria-haspopup="menu"
                                >
                                  <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden
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
                    <div className="px-4 py-3 sm:px-6 border-t border-gray-200">
                      <Pagination totalItems={filteredAppointments.length} pageSize={pageSize} currentPage={page} onPageChange={setPage} />
                    </div>
                    </>
                  )}
                </div>

                {openActionMenuId !== null && actionMenuAppointment && createPortal(
                  <div
                    className="booking-action-menu fixed w-52 sm:w-56 bg-white rounded-md shadow-xl z-[9999] border border-gray-200 py-1"
                    style={{
                      top: `${actionMenuPosition.top}px`,
                      right: `${actionMenuPosition.right}px`,
                    }}
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailsViewAppointment(actionMenuAppointment);
                        setOpenActionMenuId(null);
                      }}
                      className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-800 hover:bg-gray-100"
                    >
                      View details
                    </button>
                    {canViewTeacherRequirements(actionMenuAppointment) && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRequirementsViewAppointment(actionMenuAppointment);
                          setOpenActionMenuId(null);
                        }}
                        className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100 border-t border-gray-100"
                      >
                        Teacher requirements
                      </button>
                    )}
                    {canJoinClass(actionMenuAppointment) && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStudentJoinClass(actionMenuAppointment);
                          setOpenActionMenuId(null);
                        }}
                        className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-primary-700 font-medium hover:bg-gray-100"
                      >
                        Join class
                      </button>
                    )}
                    {actionMenuAppointment.status === 'approved' && !actionMenuAppointment.meeting_link && (
                      <div
                        className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-amber-800 border-t border-gray-100"
                        title="Superadmin has not set a meeting link yet"
                        role="presentation"
                      >
                        Awaiting meeting link
                      </div>
                    )}
                  </div>,
                  document.body
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Teacher requirements (from booking request) */}
      {requirementsViewAppointment &&
        createPortal(
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
              padding: '1rem',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setRequirementsViewAppointment(null);
            }}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 sm:mx-0 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="school-req-modal-title"
            >
              <div className="p-4 sm:p-6 border-b border-gray-200 flex items-start justify-between gap-3">
                <div>
                  <h2 id="school-req-modal-title" className="text-lg sm:text-xl font-bold text-gray-900">
                    Teacher requirements
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-gray-600">
                    Requested for this class when you booked ({formatStatus(requirementsViewAppointment.status)}).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequirementsViewAppointment(null)}
                  className="text-gray-400 hover:text-gray-600 p-1 shrink-0"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 sm:p-6">
                <p className="text-xs text-gray-500 mb-2">
                  {requirementsViewAppointment.student_name || 'Student'} ·{' '}
                  {formatDateTime(
                    requirementsViewAppointment.appointment_date,
                    requirementsViewAppointment.appointment_time
                  )}
                </p>
                <div className="space-y-6">
                  {parseTeacherRequirementsFromNotes(requirementsViewAppointment.additional_notes).map((req, idx) => (
                    <TeacherRequirementPreview
                      key={`${requirementsViewAppointment.appointment_id}-${req}-${idx}`}
                      reqKey={req}
                      appointment={requirementsViewAppointment}
                      teacherRequirementLabel={teacherRequirementLabel}
                    />
                  ))}
                </div>
              </div>
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setRequirementsViewAppointment(null)}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Booking details */}
      {detailsViewAppointment &&
        createPortal(
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
              padding: '1rem',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setDetailsViewAppointment(null);
            }}
            role="presentation"
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 sm:mx-0 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="school-booking-details-title"
            >
              <div className="p-4 sm:p-6 border-b border-gray-200 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="school-booking-details-title" className="text-lg sm:text-xl font-bold text-gray-900">
                    Booking details
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-gray-600 break-words">
                    {detailsViewAppointment.student_name || 'Student'} ·{' '}
                    {formatDateTime(detailsViewAppointment.appointment_date, detailsViewAppointment.appointment_time)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsViewAppointment(null)}
                  className="text-gray-400 hover:text-gray-600 p-1 shrink-0"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500">Student</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{detailsViewAppointment.student_name || '—'}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500">Teacher</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {detailsViewAppointment.teacher_name || (detailsViewAppointment.status === 'pending' ? 'To be assigned' : '—')}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500">Date & time</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {formatDateTime(detailsViewAppointment.appointment_date, detailsViewAppointment.appointment_time)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500">Status</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formatStatus(detailsViewAppointment.status)}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-medium text-gray-500">Class info</p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Class type</p>
                      <p className="text-sm text-gray-900">{detailsViewAppointment.class_type || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Material</p>
                      <p className="text-sm text-gray-900">{detailsViewAppointment.material_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Duration</p>
                      <p className="text-sm text-gray-900">
                        {detailsViewAppointment.duration
                          ? `${detailsViewAppointment.duration} mins`
                          : detailsViewAppointment.duration_minutes
                            ? `${detailsViewAppointment.duration_minutes} mins`
                            : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Created</p>
                      <p className="text-sm text-gray-900">{formatDateTime(detailsViewAppointment.created_at, null)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-medium text-gray-500">Teacher requirements</p>
                  {parseTeacherRequirementsFromNotes(detailsViewAppointment.additional_notes).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {parseTeacherRequirementsFromNotes(detailsViewAppointment.additional_notes).map((req) => (
                        <span
                          key={req}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-100"
                        >
                          {teacherRequirementLabel(req)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">—</p>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-medium text-gray-500">Notes</p>
                  <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">
                    {detailsViewAppointment.additional_notes && String(detailsViewAppointment.additional_notes).trim()
                      ? String(detailsViewAppointment.additional_notes).trim()
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDetailsViewAppointment(null)}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Booking Modal */}
      {isBookingModalOpen && createPortal(
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
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Student <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="studentId"
                    value={formData.studentId}
                    onChange={handleFormChange}
                    className={`w-full px-3 sm:px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                      formErrors.studentId ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select a student</option>
                    {students.map((student) => (
                      <option key={student.student_id} value={student.student_id}>
                        {student.student_name}
                        {student.student_level ? ` (${student.student_level})` : ''}
                      </option>
                    ))}
                  </select>
                  {formErrors.studentId && <p className="mt-1 text-xs text-red-600">{formErrors.studentId}</p>}
                </div>

                <div>
                  <label htmlFor="schoolBookingStudentLevel" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Level (CEFR) <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="schoolBookingStudentLevel"
                    name="studentLevel"
                    value={formData.studentLevel}
                    onChange={handleFormChange}
                    className={`w-full px-3 sm:px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 bg-white ${
                      formErrors.studentLevel ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select level</option>
                    {CEFR_LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {formErrors.studentLevel && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.studentLevel}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                    {formErrors.appointmentDate && <p className="mt-1 text-xs text-red-600">{formErrors.appointmentDate}</p>}
                  </div>
                  <div>
                    <label htmlFor="schoolBookingAppointmentTime" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Time <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="schoolBookingAppointmentTime"
                      name="appointmentTime"
                      value={formData.appointmentTime}
                      onChange={handleFormChange}
                      className={`w-full px-3 sm:px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 bg-white ${
                        formErrors.appointmentTime ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select time</option>
                      {BOOKING_TIME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {formErrors.appointmentTime && <p className="mt-1 text-xs text-red-600">{formErrors.appointmentTime}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Duration <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="duration"
                      value={formData.duration}
                      onChange={handleFormChange}
                      className={`w-full px-3 sm:px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                        formErrors.duration ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      {DURATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {formErrors.duration && <p className="mt-1 text-xs text-red-600">{formErrors.duration}</p>}
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Class Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="classType"
                      value={formData.classType}
                      onChange={handleFormChange}
                      className={`w-full px-3 sm:px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                        formErrors.classType ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select class type</option>
                      {CLASS_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {formErrors.classType && <p className="mt-1 text-xs text-red-600">{formErrors.classType}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Material Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="materialType"
                    value={formData.materialType}
                    onChange={handleFormChange}
                    className={`w-full px-3 sm:px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                      formErrors.materialType ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    {MATERIAL_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {formErrors.materialType && <p className="mt-1 text-xs text-red-600">{formErrors.materialType}</p>}
                </div>

                {formData.materialType === 'student_provided' && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Material <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="materialId"
                      value={formData.materialId}
                      onChange={handleFormChange}
                      className={`w-full px-3 sm:px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                        formErrors.materialId ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select material</option>
                      {materials.map((material) => (
                        <option key={material.material_id} value={material.material_id}>
                          {material.material_name}
                        </option>
                      ))}
                    </select>
                    {formErrors.materialId && <p className="mt-1 text-xs text-red-600">{formErrors.materialId}</p>}
                  </div>
                )}

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Teacher Requirements</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {TEACHER_REQUIREMENT_OPTIONS.map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={formData.teacherRequirements.includes(option.value)}
                          onChange={() => handleTeacherRequirementToggle(option.value)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>

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

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-700">This booking will deduct:</span>
                    <span className="text-sm font-semibold text-primary-600">
                      {DURATION_OPTIONS.find((item) => item.value === formData.duration)?.credits || 1} Credit(s)
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs sm:text-sm text-gray-700">Current Balance:</span>
                    <span className="text-sm font-semibold">{creditBalance} Credits</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs sm:text-sm text-gray-700">Balance After:</span>
                    <span className="text-sm font-semibold text-primary-600">
                      {creditBalance - (DURATION_OPTIONS.find((item) => item.value === formData.duration)?.credits || 1)} Credits
                    </span>
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
                    disabled={
                      isSubmitting ||
                      creditBalance < (DURATION_OPTIONS.find((item) => item.value === formData.duration)?.credits || 1)
                    }
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
