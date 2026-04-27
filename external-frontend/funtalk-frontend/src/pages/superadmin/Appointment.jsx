import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { BOOKING_TIME_OPTIONS } from '../../constants/bookingTimeOptions.js';
import { API_BASE_URL } from '@/config/api.js';
import { computeFixedActionMenuPosition } from '../../utils/actionMenuPosition.js';
import ResponsiveSelect from '../../components/ResponsiveSelect';
import Pagination from '../../components/Pagination.jsx';
import {
  normalizeAppointmentTimeHHMM,
  toCalendarYyyyMmDd,
} from '@/utils/appointmentCalendar.js';

const DURATION_OPTIONS = [
  { value: '25', label: '25 mins (1 credit)' },
  { value: '50', label: '50 mins (2 credits)' },
  { value: '75', label: '75 mins (3 credits)' },
  { value: '100', label: '100 mins (4 credits)' },
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

const SLOT_MINUTES = 30;

const parseDurationMinutesFromNotes = (notes) => {
  const m = String(notes ?? '').match(/Duration:\s*(\d+)\s*mins/i);
  if (!m) return 25;
  const mins = Number(m[1]);
  return Number.isFinite(mins) && mins > 0 ? mins : 25;
};

const slotKeysForDuration = (startHHMM, durationMinutes) => {
  const raw = String(startHHMM).substring(0, 5);
  const [h, mi] = raw.split(':').map((v) => parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(mi)) return [];
  const start = h * 60 + mi;
  const dm = Math.max(1, Number(durationMinutes) || 25);
  const slotCount = Math.ceil(dm / SLOT_MINUTES);
  const keys = [];
  for (let i = 0; i < slotCount; i++) {
    const m = start + i * SLOT_MINUTES;
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    keys.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return keys;
};

const slotsCoverBooking = (availableSlots, startHHMM, durationMinutes) => {
  const needed = slotKeysForDuration(startHHMM, durationMinutes);
  if (needed.length === 0) return false;
  const set = new Set(availableSlots.map((s) => normalizeAppointmentTimeHHMM(s)));
  return needed.every((k) => set.has(k));
};

const normalizeClassType = (classType) => {
  const v = String(classType ?? '').trim().toLowerCase();
  if (v === 'group' || v === 'one_on_one' || v === 'vip') return v;
  return '';
};

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
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [formData, setFormData] = useState({
    teacherId: '',
    appointmentDate: '',
    appointmentTime: '',
    duration: '25',
    studentName: '',
    studentAge: '',
    studentLevel: '',
    classType: '',
    materialType: 'teacher_provided',
    materialId: '',
    teacherRequirements: [],
    additionalNotes: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableTeacherIds, setAvailableTeacherIds] = useState([]);
  const [isCheckingTeacherAvailability, setIsCheckingTeacherAvailability] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approveStep, setApproveStep] = useState(1);
  const [selectedApprovalAppointment, setSelectedApprovalAppointment] = useState(null);
  const [approveForm, setApproveForm] = useState({
    teacherId: '',
    meetingLink: '',
    meetingPlatform: 'other',
  });
  const [approveError, setApproveError] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [approvalAvailableTeacherIds, setApprovalAvailableTeacherIds] = useState([]);
  const [isCheckingApprovalTeacherAvailability, setIsCheckingApprovalTeacherAvailability] =
    useState(false);
  /** 'active' = pending, approved, no_show. 'history' = completed, cancelled only. */
  const [appointmentsTab, setAppointmentsTab] = useState('active');
  const [detailViewAppointment, setDetailViewAppointment] = useState(null);

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

  useEffect(() => {
    setStatusFilter('');
  }, [appointmentsTab]);

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
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/appointments`;
      const params = new URLSearchParams();
      
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      
      if (teacherFilter) {
        params.append('teacherId', teacherFilter);
      }
      
      if (dateFilter) {
        params.append('startDate', dateFilter);
        // Optionally set endDate to same day or next day
        const endDate = new Date(dateFilter);
        endDate.setDate(endDate.getDate() + 1);
        params.append('endDate', endDate.toISOString().split('T')[0]);
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

  // Student search + tab: active vs lesson history (completed / cancelled)
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const matchesStudent =
        !studentSearch ||
        apt.student_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        apt.profile_student_name?.toLowerCase().includes(studentSearch.toLowerCase());
      if (!matchesStudent) return false;
      const s = apt.status || 'pending';
      if (appointmentsTab === 'history') {
        return s === 'completed' || s === 'cancelled';
      }
      return s !== 'completed' && s !== 'cancelled';
    });
  }, [appointments, studentSearch, appointmentsTab]);

  useEffect(() => {
    setPage(1);
  }, [appointmentsTab, statusFilter, teacherFilter, dateFilter, studentSearch]);

  const pageSize = 10;
  const pagedAppointments = filteredAppointments.slice((page - 1) * pageSize, page * pageSize);

  /** Allowed status changes (no_show removed from UI; legacy rows stay read-only). */
  const canChangeAppointmentStatus = (current, next) => {
    const c = current || 'pending';
    const n = next;
    if (n === c) return true;
    if (c === 'completed' || c === 'cancelled' || c === 'no_show') return false;
    if (c === 'pending') return n === 'approved' || n === 'cancelled';
    if (c === 'approved') return n === 'completed' || n === 'cancelled';
    return false;
  };

  const isRowStatusTerminal = (status) => status === 'completed' || status === 'cancelled';

  const STATUS_SELECT_OPTIONS = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

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

  // Format time for display (handles "HH:MM:SS" or ISO datetime from API)
  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const hhmm = normalizeAppointmentTimeHHMM(timeString);
    if (!hhmm) return 'N/A';
    const [hours, minutes] = hhmm.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatStatusLabel = (status) => {
    const labels = {
      pending: 'Pending',
      approved: 'Approved',
      completed: 'Completed',
      cancelled: 'Cancelled',
      no_show: 'No Show',
    };
    return labels[status] || status || '—';
  };

  // Handle action menu
  const handleActionClick = (e, appointmentId) => {
    e.stopPropagation();
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    
    setMenuPosition(
      computeFixedActionMenuPosition({
        rect,
        menuWidth: 192, // w-40 / w-48
        menuHeight: 220,
        gap: 6,
      })
    );
    
    setOpenMenuId(openMenuId === appointmentId ? null : appointmentId);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setAvailableTeacherIds([]);
    setIsCheckingTeacherAvailability(false);
    setFormData({
      teacherId: '',
      appointmentDate: '',
      appointmentTime: '',
      duration: '25',
      studentName: '',
      studentAge: '',
      studentLevel: '',
      classType: '',
      materialType: 'teacher_provided',
      materialId: '',
      teacherRequirements: [],
      additionalNotes: '',
    });
    setFormErrors({});
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };
      if (name === 'materialType' && value !== 'student_provided') {
        next.materialId = '';
      }
      if ((name === 'appointmentDate' || name === 'appointmentTime') && prev.teacherId) {
        next.teacherId = '';
      }
      return next;
    });
    // Clear error when user starts typing
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

    if (!formData.studentLevel) {
      newErrors.studentLevel = 'Please select a CEFR level';
    }

    if (!formData.duration) {
      newErrors.duration = 'Duration is required';
    }

    if (!formData.classType) {
      newErrors.classType = 'Class type is required';
    }

    if (!formData.materialType) {
      newErrors.materialType = 'Material type is required';
    }

    if (formData.materialType === 'student_provided' && !formData.materialId) {
      newErrors.materialId = 'Material is required for student provided classes';
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
      
      const requestBody = {
        teacherId: parseInt(formData.teacherId),
        appointmentDate: formData.appointmentDate,
        appointmentTime: formData.appointmentTime,
        duration: formData.duration,
        studentName: formData.studentName.trim(),
        studentAge: formData.studentAge ? parseInt(formData.studentAge) : null,
        studentLevel: formData.studentLevel.trim() || null,
        classType: formData.classType || null,
        materialType: formData.materialType,
        materialId: formData.materialType === 'student_provided' && formData.materialId
          ? parseInt(formData.materialId)
          : null,
        teacherRequirements: formData.teacherRequirements,
        additionalNotes: formData.additionalNotes.trim() || null,
      };

      const response = await fetch(`${API_BASE_URL}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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

  const checkAvailableTeachers = useCallback(
    async (dateValue, timeValue, durationMinutes, classType) => {
      const ymd = toCalendarYyyyMmDd(dateValue);
      const timeNorm = normalizeAppointmentTimeHHMM(timeValue);
      const dm = Math.max(1, Number(durationMinutes) || 25);
      const normalizedClassType = normalizeClassType(classType);
      if (!ymd || !timeNorm || !normalizedClassType || teachers.length === 0) {
        setAvailableTeacherIds([]);
        return;
      }

      setIsCheckingTeacherAvailability(true);
      try {
        const token = localStorage.getItem('token');
        const checks = teachers.map(async (teacher) => {
          try {
            const response = await fetch(
              `${API_BASE_URL}/availability/teacher/${teacher.teacher_id}/available-slots?date=${encodeURIComponent(ymd)}&classType=${encodeURIComponent(normalizedClassType)}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            const data = await response.json();
            const slots = data.success && data.data?.slots ? data.data.slots : [];
            return slotsCoverBooking(slots, timeNorm, dm) ? teacher.teacher_id : null;
          } catch (error) {
            console.error('Error checking teacher availability:', error);
            return null;
          }
        });

        const results = await Promise.all(checks);
        setAvailableTeacherIds(results.filter((id) => id !== null));
      } finally {
        setIsCheckingTeacherAvailability(false);
      }
    },
    [teachers]
  );

  const checkApprovalAvailableTeachers = useCallback(
    async (appointment) => {
      if (!appointment) {
        setApprovalAvailableTeacherIds([]);
        setIsCheckingApprovalTeacherAvailability(false);
        return;
      }
      const ymd = toCalendarYyyyMmDd(appointment.appointment_date);
      const timeNorm = normalizeAppointmentTimeHHMM(appointment.appointment_time);
      const dm = parseDurationMinutesFromNotes(appointment.additional_notes);
      const normalizedClassType = normalizeClassType(appointment.class_type);
      if (!ymd || !timeNorm || !normalizedClassType || teachers.length === 0) {
        setApprovalAvailableTeacherIds([]);
        setIsCheckingApprovalTeacherAvailability(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const checks = teachers.map(async (teacher) => {
          try {
            const exclude =
              appointment.appointment_id != null
                ? `&excludeAppointmentId=${encodeURIComponent(String(appointment.appointment_id))}`
                : '';
            const response = await fetch(
              `${API_BASE_URL}/availability/teacher/${teacher.teacher_id}/available-slots?date=${encodeURIComponent(ymd)}${exclude}&classType=${encodeURIComponent(normalizedClassType)}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            const data = await response.json();
            const slots = data.success && data.data?.slots ? data.data.slots : [];
            return slotsCoverBooking(slots, timeNorm, dm) ? teacher.teacher_id : null;
          } catch (error) {
            console.error('Error checking teacher availability for approval:', error);
            return null;
          }
        });

        const results = await Promise.all(checks);
        setApprovalAvailableTeacherIds(results.filter((id) => id !== null));
      } finally {
        setIsCheckingApprovalTeacherAvailability(false);
      }
    },
    [teachers]
  );

  useEffect(() => {
    if (!isModalOpen) return;
    checkAvailableTeachers(
      formData.appointmentDate,
      formData.appointmentTime,
      formData.duration,
      formData.classType
    );
  }, [
    isModalOpen,
    formData.appointmentDate,
    formData.appointmentTime,
    formData.duration,
    formData.classType,
    checkAvailableTeachers,
  ]);

  useEffect(() => {
    if (!formData.teacherId) return;
    const selectedId = Number(formData.teacherId);
    if (!availableTeacherIds.includes(selectedId)) {
      setFormData((prev) => ({ ...prev, teacherId: '' }));
    }
  }, [availableTeacherIds, formData.teacherId]);

  const selectableTeachers = useMemo(() => {
    if (!formData.appointmentDate || !formData.appointmentTime) return [];
    if (availableTeacherIds.length === 0) return [];
    return teachers.filter((teacher) => availableTeacherIds.includes(teacher.teacher_id));
  }, [teachers, availableTeacherIds, formData.appointmentDate, formData.appointmentTime]);

  const approvalSelectableTeachers = useMemo(() => {
    if (!selectedApprovalAppointment) return [];
    if (approvalAvailableTeacherIds.length === 0) return [];
    return teachers.filter((teacher) => approvalAvailableTeacherIds.includes(teacher.teacher_id));
  }, [teachers, approvalAvailableTeacherIds, selectedApprovalAppointment]);

  useLayoutEffect(() => {
    if (!isApproveModalOpen || approveStep !== 2 || !selectedApprovalAppointment) {
      return;
    }
    setIsCheckingApprovalTeacherAvailability(true);
  }, [isApproveModalOpen, approveStep, selectedApprovalAppointment]);

  useEffect(() => {
    if (!isApproveModalOpen || approveStep !== 2 || !selectedApprovalAppointment) return;
    checkApprovalAvailableTeachers(selectedApprovalAppointment);
  }, [
    isApproveModalOpen,
    approveStep,
    selectedApprovalAppointment,
    checkApprovalAvailableTeachers,
  ]);

  useEffect(() => {
    if (!approveForm.teacherId) return;
    if (approveStep !== 2) return;
    if (isCheckingApprovalTeacherAvailability) return;
    const selectedId = Number(approveForm.teacherId);
    if (Number.isNaN(selectedId)) {
      setApproveForm((prev) => ({ ...prev, teacherId: '' }));
      return;
    }
    if (approvalAvailableTeacherIds.length === 0) {
      setApproveForm((prev) => ({ ...prev, teacherId: '' }));
      return;
    }
    if (!approvalAvailableTeacherIds.includes(selectedId)) {
      setApproveForm((prev) => ({ ...prev, teacherId: '' }));
    }
  }, [
    approvalAvailableTeacherIds,
    approveForm.teacherId,
    approveStep,
    isCheckingApprovalTeacherAvailability,
  ]);

  // Handle status change
  const handleStatusChange = async (appointmentId, newStatus) => {
    const appointment = filteredAppointments.find((item) => item.appointment_id === appointmentId);
    if (appointment && appointment.status === newStatus) {
      return;
    }
    if (appointment && !canChangeAppointmentStatus(appointment.status, newStatus)) {
      return;
    }
    if (newStatus === 'approved' && appointment) {
      setSelectedApprovalAppointment(appointment);
      setApproveStep(1);
      setApproveError('');
      setApprovalAvailableTeacherIds([]);
      setApproveForm({
        teacherId: appointment.teacher_id ? String(appointment.teacher_id) : '',
        meetingLink: appointment.meeting_link || '',
        meetingPlatform: appointment.meeting_platform || 'other',
      });
      setIsApproveModalOpen(true);
      return;
    }
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
        fetchAppointments(); // Refresh the list
      } else {
        alert(data.message || 'Error updating appointment status');
      }
    } catch (error) {
      console.error('Error updating appointment status:', error);
      alert('Error updating appointment status. Please try again.');
    }
  };

  const handleConfirmApproval = async () => {
    if (!selectedApprovalAppointment) return;
    if (!approveForm.teacherId) {
      setApproveError('Please select a teacher');
      return;
    }
    if (!approveForm.meetingLink.trim()) {
      setApproveError('Please provide a meeting link');
      return;
    }

    setIsApproving(true);
    setApproveError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/appointments/${selectedApprovalAppointment.appointment_id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: 'approved',
          teacherId: Number(approveForm.teacherId),
          meetingLink: approveForm.meetingLink.trim(),
          meetingPlatform: approveForm.meetingPlatform || 'other',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setApproveError(data.message || 'Unable to approve appointment');
        return;
      }
      setIsApproveModalOpen(false);
      setSelectedApprovalAppointment(null);
      fetchAppointments();
    } catch {
      setApproveError('Network error while approving appointment');
    } finally {
      setIsApproving(false);
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

              {/* Active appointments vs Lesson history */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex flex-wrap gap-1 sm:gap-2" aria-label="Appointment views">
                  <button
                    type="button"
                    onClick={() => setAppointmentsTab('active')}
                    className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors rounded-t-md sm:rounded-t-lg ${
                      appointmentsTab === 'active'
                        ? 'border-primary-600 text-primary-700 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Active appointments
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppointmentsTab('history')}
                    className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors rounded-t-md sm:rounded-t-lg ${
                      appointmentsTab === 'history'
                        ? 'border-primary-600 text-primary-700 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Lesson history
                  </button>
                </nav>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
                <div className="min-w-0 flex-1 sm:max-w-md">
                  <input
                    id="appointments-search"
                    type="search"
                    aria-label="Search appointments"
                    placeholder="Search by student name"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    autoComplete="off"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="w-full sm:w-auto sm:min-w-[10rem]">
                  <ResponsiveSelect
                    id="appointments-status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    aria-label="Filter appointments by status"
                  >
                    <option value="">All statuses</option>
                    {appointmentsTab === 'history' ? (
                      <>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </>
                    ) : (
                      <>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                      </>
                    )}
                  </ResponsiveSelect>
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
                    <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-gray-900">
                      {appointmentsTab === 'history' ? 'No lesson history yet' : 'No appointments found'}
                    </h3>
                    <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                      {studentSearch || statusFilter || teacherFilter || dateFilter
                        ? 'Try adjusting your filters'
                        : appointmentsTab === 'history'
                          ? 'No completed or cancelled classes in this view yet'
                          : 'No appointments scheduled yet'}
                    </p>
                  </div>
                ) : (
                  <>
                  <div className="overflow-x-auto rounded-b-xl">
                    <table className="min-w-[1120px] w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Student
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Teacher
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            School
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Date & Time
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Class Type
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Material
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Status
                          </th>
                          <th className="sticky right-0 z-10 bg-gray-50 px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pagedAppointments.map((appointment) => (
                          <tr key={appointment.appointment_id} className="group hover:bg-gray-50">
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
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{appointment.teacher_name || 'N/A'}</div>
                              {appointment.teacher_email && (
                                <div className="text-xs text-gray-500">{appointment.teacher_email}</div>
                              )}
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{appointment.school_name || 'N/A'}</div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{formatDate(appointment.appointment_date)}</div>
                              <div className="text-xs text-gray-500">{formatTime(appointment.appointment_time)}</div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{appointment.class_type || '-'}</div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{appointment.material_name || '-'}</div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              {appointment.status === 'no_show' ? (
                                <span
                                  className={`inline-block text-xs font-semibold rounded-full px-2 py-1 ${getStatusColor('no_show')}`}
                                >
                                  No Show
                                </span>
                              ) : isRowStatusTerminal(appointment.status) ? (
                                <ResponsiveSelect
                                  value={appointment.status || 'pending'}
                                  disabled
                                  aria-label="Appointment status (locked)"
                                  className={`text-xs font-semibold rounded-full px-2 py-1 border-0 opacity-90 cursor-not-allowed ${getStatusColor(appointment.status)}`}
                                >
                                  {STATUS_SELECT_OPTIONS.filter((o) => o.value === appointment.status).map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </ResponsiveSelect>
                              ) : (
                                <ResponsiveSelect
                                  value={appointment.status || 'pending'}
                                  onChange={(e) => handleStatusChange(appointment.appointment_id, e.target.value)}
                                  className={`text-xs font-semibold rounded-full px-2 py-1 border-0 focus:ring-2 focus:ring-primary-500 ${getStatusColor(appointment.status)}`}
                                  aria-label="Appointment status"
                                >
                                  {STATUS_SELECT_OPTIONS.map((o) => (
                                    <option
                                      key={o.value}
                                      value={o.value}
                                      disabled={!canChangeAppointmentStatus(appointment.status, o.value)}
                                    >
                                      {o.label}
                                    </option>
                                  ))}
                                </ResponsiveSelect>
                              )}
                            </td>
                            <td className="sticky right-0 z-[1] bg-white px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.06)] group-hover:bg-gray-50">
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
                  <div className="px-4 py-3 sm:px-6 border-t border-gray-200">
                    <Pagination totalItems={filteredAppointments.length} pageSize={pageSize} currentPage={page} onPageChange={setPage} />
                  </div>
                  </>
                )}
              </div>

              {/* Results Count */}
              {filteredAppointments.length > 0 && (
                <div className="text-xs sm:text-sm text-gray-600">
                  Showing {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? 's' : ''} ·{' '}
                  {appointmentsTab === 'history' ? 'Lesson history' : 'Active appointments'}
                </div>
              )}

              {/* Action Menu Dropdown */}
              {openMenuId && createPortal(
                <div
                  className="fixed w-40 sm:w-48 bg-white rounded-md shadow-xl z-[9999] border border-gray-200 action-menu"
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
                        const appointment = filteredAppointments.find((a) => a.appointment_id === openMenuId);
                        if (appointment) {
                          setDetailViewAppointment(appointment);
                        }
                        setOpenMenuId(null);
                      }}
                      className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100"
                    >
                      View Details
                    </button>
                    {appointmentsTab !== 'history' && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const appointment = filteredAppointments.find((a) => a.appointment_id === openMenuId);
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
                          const appointment = filteredAppointments.find((a) => a.appointment_id === openMenuId);
                          return appointment?.meeting_link ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (appointment.meeting_link) {
                                  window.open(appointment.meeting_link, '_blank', 'noopener,noreferrer');
                                }
                                setOpenMenuId(null);
                              }}
                              className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-blue-600 hover:bg-gray-100"
                            >
                              Join Meeting
                            </button>
                          ) : null;
                        })()}
                      </>
                    )}
                  </div>
                </div>,
                document.body
              )}

              {/* View details (read-only) */}
              {detailViewAppointment &&
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
                      if (e.target === e.currentTarget) {
                        setDetailViewAppointment(null);
                      }
                    }}
                  >
                    <div
                      className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto mx-4 sm:mx-0"
                      onClick={(e) => e.stopPropagation()}
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="appointment-detail-title"
                    >
                      <div className="p-4 sm:p-6 border-b border-gray-200 flex items-start justify-between gap-3">
                        <h2 id="appointment-detail-title" className="text-lg sm:text-xl font-bold text-gray-900 pr-2">
                          Appointment details
                        </h2>
                        <button
                          type="button"
                          onClick={() => setDetailViewAppointment(null)}
                          className="text-gray-400 hover:text-gray-600 transition-colors p-1 shrink-0"
                          aria-label="Close"
                        >
                          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="p-4 sm:p-6 space-y-0">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 py-2.5 border-b border-gray-100">
                          <span className="text-xs sm:text-sm font-medium text-gray-500">Student</span>
                          <div className="sm:col-span-2 text-sm text-gray-900">
                            {detailViewAppointment.student_name || detailViewAppointment.profile_student_name || '—'}
                            {detailViewAppointment.student_age != null && (
                              <span className="text-gray-600"> · Age {detailViewAppointment.student_age}</span>
                            )}
                            {detailViewAppointment.student_level && (
                              <span className="text-gray-600"> · {detailViewAppointment.student_level}</span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 py-2.5 border-b border-gray-100">
                          <span className="text-xs sm:text-sm font-medium text-gray-500">Teacher</span>
                          <div className="sm:col-span-2 text-sm text-gray-900">
                            <div>{detailViewAppointment.teacher_name || '—'}</div>
                            {detailViewAppointment.teacher_email && (
                              <div className="text-xs text-gray-500 mt-0.5">{detailViewAppointment.teacher_email}</div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 py-2.5 border-b border-gray-100">
                          <span className="text-xs sm:text-sm font-medium text-gray-500">School</span>
                          <div className="sm:col-span-2 text-sm text-gray-900">
                            {detailViewAppointment.school_name || '—'}
                            {detailViewAppointment.school_email && (
                              <div className="text-xs text-gray-500 mt-0.5">{detailViewAppointment.school_email}</div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 py-2.5 border-b border-gray-100">
                          <span className="text-xs sm:text-sm font-medium text-gray-500">Date & time</span>
                          <div className="sm:col-span-2 text-sm text-gray-900">
                            {formatDate(detailViewAppointment.appointment_date)} ·{' '}
                            {formatTime(detailViewAppointment.appointment_time)}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 py-2.5 border-b border-gray-100">
                          <span className="text-xs sm:text-sm font-medium text-gray-500">Class type</span>
                          <span className="sm:col-span-2 text-sm text-gray-900">
                            {detailViewAppointment.class_type
                              ? String(detailViewAppointment.class_type).replace(/_/g, ' ')
                              : '—'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 py-2.5 border-b border-gray-100">
                          <span className="text-xs sm:text-sm font-medium text-gray-500">Material</span>
                          <span className="sm:col-span-2 text-sm text-gray-900">
                            {detailViewAppointment.material_name || '—'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 py-2.5 border-b border-gray-100">
                          <span className="text-xs sm:text-sm font-medium text-gray-500">Status</span>
                          <span className="sm:col-span-2">
                            <span
                              className={`inline-block text-xs font-semibold rounded-full px-2.5 py-1 ${getStatusColor(
                                detailViewAppointment.status
                              )}`}
                            >
                              {formatStatusLabel(detailViewAppointment.status)}
                            </span>
                          </span>
                        </div>
                        {detailViewAppointment.approved_by_name && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 py-2.5 border-b border-gray-100">
                            <span className="text-xs sm:text-sm font-medium text-gray-500">Approved by</span>
                            <span className="sm:col-span-2 text-sm text-gray-900">
                              {detailViewAppointment.approved_by_name}
                            </span>
                          </div>
                        )}
                        {detailViewAppointment.meeting_link && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 py-2.5 border-b border-gray-100">
                            <span className="text-xs sm:text-sm font-medium text-gray-500">Meeting</span>
                            <div className="sm:col-span-2 text-sm">
                              <a
                                href={detailViewAppointment.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:text-primary-800 underline break-all"
                              >
                                {detailViewAppointment.meeting_link}
                              </a>
                              {detailViewAppointment.meeting_platform && (
                                <span className="block text-xs text-gray-500 mt-1">
                                  {detailViewAppointment.meeting_platform}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {detailViewAppointment.additional_notes && (
                          <div className="pt-2.5">
                            <span className="text-xs sm:text-sm font-medium text-gray-500 block mb-1">Notes</span>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3">
                              {detailViewAppointment.additional_notes}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="p-4 sm:p-6 pt-0 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setDetailViewAppointment(null)}
                          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}

              {/* Add Appointment Modal - Rendered via Portal to body */}
              {isModalOpen && createPortal(
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
                        {/* Date and Time (first) */}
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
                            <ResponsiveSelect
                              id="appointmentTime"
                              name="appointmentTime"
                              value={formData.appointmentTime}
                              onChange={handleFormChange}
                              className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white ${
                                formErrors.appointmentTime ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="">Select time</option>
                              {BOOKING_TIME_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </ResponsiveSelect>
                            {formErrors.appointmentTime && (
                              <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.appointmentTime}</p>
                            )}
                          </div>
                        </div>

                        {/* Teacher (filtered by selected date + time) */}
                        <div>
                          <label htmlFor="teacherId" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Teacher <span className="text-red-500">*</span>
                          </label>
                          <ResponsiveSelect
                            id="teacherId"
                            name="teacherId"
                            value={formData.teacherId}
                            onChange={handleFormChange}
                            disabled={!formData.appointmentDate || !formData.appointmentTime || isCheckingTeacherAvailability}
                            className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:text-gray-500 ${
                              formErrors.teacherId ? 'border-red-500' : 'border-gray-300'
                            }`}
                          >
                            {!formData.appointmentDate || !formData.appointmentTime ? (
                              <option value="">Select date and time first</option>
                            ) : isCheckingTeacherAvailability ? (
                              <option value="">Checking available teachers...</option>
                            ) : selectableTeachers.length === 0 ? (
                              <option value="">No teacher available for this slot</option>
                            ) : (
                              <option value="">Select available teacher</option>
                            )}
                            {selectableTeachers.map((teacher) => (
                              <option key={teacher.teacher_id} value={teacher.teacher_id}>
                                {teacher.fullname || teacher.user_name || 'N/A'}
                              </option>
                            ))}
                          </ResponsiveSelect>
                          {formErrors.teacherId && (
                            <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.teacherId}</p>
                          )}
                          {formData.appointmentDate && formData.appointmentTime && !isCheckingTeacherAvailability && (
                            <p className="mt-1 text-xs text-gray-500">
                              {selectableTeachers.length} teacher{selectableTeachers.length !== 1 ? 's' : ''} available at this time.
                            </p>
                          )}
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

                        {/* Level (CEFR), Duration, and Class Type */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                          <div>
                            <label htmlFor="studentLevel" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Level (CEFR) <span className="text-red-500">*</span>
                            </label>
                            <ResponsiveSelect
                              id="studentLevel"
                              name="studentLevel"
                              value={formData.studentLevel}
                              onChange={handleFormChange}
                              className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white ${
                                formErrors.studentLevel ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="">Select level</option>
                              {CEFR_LEVEL_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </ResponsiveSelect>
                            {formErrors.studentLevel && (
                              <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.studentLevel}</p>
                            )}
                          </div>

                          <div>
                            <label htmlFor="duration" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Duration <span className="text-red-500">*</span>
                            </label>
                            <ResponsiveSelect
                              id="duration"
                              name="duration"
                              value={formData.duration}
                              onChange={handleFormChange}
                              className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                formErrors.duration ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              {DURATION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </ResponsiveSelect>
                            {formErrors.duration && (
                              <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.duration}</p>
                            )}
                          </div>

                          <div>
                            <label htmlFor="classType" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Class Type <span className="text-red-500">*</span>
                            </label>
                            <ResponsiveSelect
                              id="classType"
                              name="classType"
                              value={formData.classType}
                              onChange={handleFormChange}
                              className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                formErrors.classType ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="">Select class type</option>
                              {CLASS_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </ResponsiveSelect>
                            {formErrors.classType && (
                              <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.classType}</p>
                            )}
                          </div>
                        </div>

                        {/* Material Type */}
                        <div>
                          <label htmlFor="materialType" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Material Type <span className="text-red-500">*</span>
                          </label>
                          <ResponsiveSelect
                            id="materialType"
                            name="materialType"
                            value={formData.materialType}
                            onChange={handleFormChange}
                            className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                              formErrors.materialType ? 'border-red-500' : 'border-gray-300'
                            }`}
                          >
                            {MATERIAL_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </ResponsiveSelect>
                          {formErrors.materialType && (
                            <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.materialType}</p>
                          )}
                        </div>

                        {formData.materialType === 'student_provided' && (
                          <div>
                            <label htmlFor="materialId" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Teaching Material <span className="text-red-500">*</span>
                            </label>
                            <ResponsiveSelect
                              id="materialId"
                              name="materialId"
                              value={formData.materialId}
                              onChange={handleFormChange}
                              className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                formErrors.materialId ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="">Select material</option>
                              {materials.map((material) => (
                                <option key={material.material_id} value={material.material_id}>
                                  {material.material_name || 'N/A'}
                                </option>
                              ))}
                            </ResponsiveSelect>
                            {formErrors.materialId && (
                              <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.materialId}</p>
                            )}
                          </div>
                        )}

                        {/* Teacher Requirements */}
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                            Teacher Requirements
                          </label>
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

      {isApproveModalOpen && selectedApprovalAppointment && createPortal(
        <div
          className="fixed bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isApproving) {
              setIsApproveModalOpen(false);
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Approve Booking</h3>
                <button
                  type="button"
                  onClick={() => !isApproving && setIsApproveModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              {approveStep === 1 ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700">Review customer booking details before assigning a teacher.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><span className="font-medium text-gray-700">Student:</span> {selectedApprovalAppointment.student_name || 'N/A'}</div>
                    <div><span className="font-medium text-gray-700">School:</span> {selectedApprovalAppointment.school_name || 'N/A'}</div>
                    <div><span className="font-medium text-gray-700">Date:</span> {formatDate(selectedApprovalAppointment.appointment_date)}</div>
                    <div><span className="font-medium text-gray-700">Time:</span> {formatTime(selectedApprovalAppointment.appointment_time)}</div>
                    <div>
                      <span className="font-medium text-gray-700">Duration:</span>{' '}
                      {parseDurationMinutesFromNotes(selectedApprovalAppointment.additional_notes)} mins
                    </div>
                    <div><span className="font-medium text-gray-700">Class Type:</span> {selectedApprovalAppointment.class_type || '-'}</div>
                    <div><span className="font-medium text-gray-700">Material:</span> {selectedApprovalAppointment.material_name || '-'}</div>
                  </div>
                  {selectedApprovalAppointment.additional_notes && (
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedApprovalAppointment.additional_notes}
                    </div>
                  )}
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setApproveStep(2)}
                      className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-gray-600">
                    Only teachers who are free for this booking&apos;s date, start time, and duration are listed.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign Teacher</label>
                    {isCheckingApprovalTeacherAvailability ? (
                      <div className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
                        Checking who is available for this slot…
                      </div>
                    ) : (
                      <select
                        value={approveForm.teacherId}
                        onChange={(e) => setApproveForm((prev) => ({ ...prev, teacherId: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">
                          {approvalSelectableTeachers.length === 0
                            ? 'No teachers available for this slot'
                            : 'Select teacher'}
                        </option>
                        {approvalSelectableTeachers.map((teacher) => (
                          <option key={teacher.teacher_id} value={teacher.teacher_id}>
                            {teacher.fullname || teacher.email}
                          </option>
                        ))}
                      </select>
                    )}
                    {!isCheckingApprovalTeacherAvailability && approvalSelectableTeachers.length === 0 && (
                      <p className="mt-1 text-xs text-amber-700">
                        No teacher has this window open on their schedule (or all are already booked). Ask the school to pick
                        another time or update teacher availability.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
                      <input
                        type="url"
                        value={approveForm.meetingLink}
                        onChange={(e) => setApproveForm((prev) => ({ ...prev, meetingLink: e.target.value }))}
                        placeholder="https://..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                      <select
                        value={approveForm.meetingPlatform}
                        onChange={(e) => setApproveForm((prev) => ({ ...prev, meetingPlatform: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="zoom">Zoom</option>
                        <option value="google_meet">Google Meet</option>
                        <option value="agora">Agora</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  {approveError && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{approveError}</div>
                  )}
                  <div className="flex justify-between">
                    <button
                      type="button"
                      onClick={() => setApproveStep(1)}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                      disabled={isApproving}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmApproval}
                      className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      disabled={isApproving}
                    >
                      {isApproving ? 'Approving...' : 'Approve'}
                    </button>
                  </div>
                </div>
              )}
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

export default Appointment;
