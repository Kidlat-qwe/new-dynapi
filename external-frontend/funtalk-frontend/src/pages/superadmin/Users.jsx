import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import ResponsiveSelect from '../../components/ResponsiveSelect';
import Pagination from '../../components/Pagination.jsx';
import { API_BASE_URL } from '@/config/api.js';
import { computeFixedActionMenuPosition } from '../../utils/actionMenuPosition.js';

const todayYyyyMmDd = () => new Date().toISOString().slice(0, 10);

const Users = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phoneNumber: '',
    gender: '',
    userType: 'school',
    billingType: '',
    billingConfig: {
      planName: '',
      creditsPerCycle: '',
      ratePerCredit: '',
      paymentDueDay: '1',
      billingDurationMonths: '12',
      penaltyPercentage: '10',
      graceDays: '7',
      startDate: todayYyyyMmDd(),
    },
    status: 'active',
    paymentStatus: 'pending',
    paymentType: 'bank_transfer',
    initialPaymentAmount: '',
    teacherEmploymentType: 'part_time',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [subscriptionStatusByUserId, setSubscriptionStatusByUserId] = useState({});

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

  // Fetch users
  useEffect(() => {
    if (user) {
      fetchUsers();
      fetchSubscriptionStatuses();
    }
  }, [user, roleFilter]);

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

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      phoneNumber: '',
      gender: '',
      userType: 'school',
      billingType: '',
      billingConfig: {
        planName: '',
        creditsPerCycle: '',
        ratePerCredit: '',
        paymentDueDay: '1',
        billingDurationMonths: '12',
        penaltyPercentage: '10',
        graceDays: '7',
        startDate: todayYyyyMmDd(),
      },
      status: 'active',
      paymentStatus: 'pending',
      paymentType: 'bank_transfer',
      initialPaymentAmount: '',
      teacherEmploymentType: 'part_time',
    });
    setReceiptFile(null);
    setFormErrors({});
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('billingConfig.')) {
      const key = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        billingConfig: {
          ...prev.billingConfig,
          [key]: type === 'checkbox' ? checked : value,
        },
      }));
      return;
    }

    if (name === 'billingType' && value === '') {
      setFormData((prev) => ({
        ...prev,
        billingType: '',
        paymentStatus: 'pending',
        initialPaymentAmount: '',
      }));
      setReceiptFile(null);
      return;
    }

    if (name === 'billingType' && value === 'patty') {
      setFormData((prev) => ({
        ...prev,
        billingType: 'patty',
        paymentStatus: 'pending',
        initialPaymentAmount: '',
      }));
      setReceiptFile(null);
      return;
    }

    if (name === 'paymentStatus' && value !== 'paid') {
      setFormData((prev) => ({
        ...prev,
        paymentStatus: value,
        initialPaymentAmount: '',
      }));
      return;
    }
    
    // If user type changes, clear billing type if not school
    if (name === 'userType' && value !== 'school') {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        billingType: '', // Clear billing type when not school
        paymentStatus: 'pending',
        initialPaymentAmount: '',
        gender: value === 'teacher' ? prev.gender || '' : '',
        teacherEmploymentType: value === 'teacher' ? prev.teacherEmploymentType || 'part_time' : 'part_time',
      }));
      setReceiptFile(null);
      // Clear billing type error if user type is not school
      if (formErrors.billingType) {
        setFormErrors((prev) => ({
          ...prev,
          billingType: '',
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
    
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

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (formData.phoneNumber.trim() && !/^[\d\s\-+()]+$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
    }

    if (!editingUserId) {
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }
    } else if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.userType) {
      newErrors.userType = 'Please select a user type';
    }
    if (!editingUserId && formData.userType === 'teacher' && !formData.gender) {
      newErrors.gender = 'Please select gender';
    }
    if (formData.userType === 'teacher' && !formData.teacherEmploymentType) {
      newErrors.teacherEmploymentType = 'Please select teacher type';
    }

    // Billing type is only required for school user type
    if (formData.userType === 'school' && !formData.billingType) {
      newErrors.billingType = 'Billing type is required';
    }
    if (formData.userType === 'school' && (formData.billingType === 'patty' || formData.billingType === 'explore')) {
      if (!formData.billingConfig.creditsPerCycle) {
        newErrors.creditsPerCycle =
          formData.billingType === 'patty' ? 'Monthly credits are required' : 'Credits are required';
      }
      if (!formData.billingConfig.ratePerCredit) {
        newErrors.ratePerCredit = 'Rate per credit is required';
      }
    }
    if (formData.userType === 'school' && formData.billingType === 'patty') {
      if (!['3', '6', '12'].includes(String(formData.billingConfig.billingDurationMonths || ''))) {
        newErrors.billingDurationMonths = 'Billing duration is required';
      }
      if (
        formData.billingConfig.penaltyPercentage === '' ||
        Number.isNaN(Number(formData.billingConfig.penaltyPercentage)) ||
        Number(formData.billingConfig.penaltyPercentage) < 0 ||
        Number(formData.billingConfig.penaltyPercentage) > 100
      ) {
        newErrors.penaltyPercentage = 'Penalty must be between 0 and 100';
      }
    }
    if (
      !editingUserId &&
      formData.userType === 'school' &&
      formData.billingType === 'explore' &&
      formData.paymentStatus === 'paid'
    ) {
      const amt = parseFloat(String(formData.initialPaymentAmount ?? '').trim(), 10);
      if (!Number.isFinite(amt) || amt <= 0) {
        newErrors.initialPaymentAmount = 'Enter a valid amount greater than 0';
      }
    }
    if (
      !editingUserId &&
      formData.userType === 'school' &&
      formData.billingType === 'explore' &&
      formData.paymentStatus === 'paid' &&
      !receiptFile
    ) {
      newErrors.receipt = 'Receipt attachment is required when status is Paid';
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildPattyBillingConfig = () => ({
    planName: formData.billingConfig.planName?.trim() || null,
    creditsPerCycle: parseInt(formData.billingConfig.creditsPerCycle || '0', 10),
    ratePerCredit: parseFloat(formData.billingConfig.ratePerCredit || '0'),
    paymentDueDay: parseInt(formData.billingConfig.paymentDueDay || '1', 10),
    billingDurationMonths: parseInt(formData.billingConfig.billingDurationMonths || '12', 10),
    penaltyPercentage: parseFloat(formData.billingConfig.penaltyPercentage || '10'),
    graceDays: parseInt(formData.billingConfig.graceDays || '0', 10),
    startDate: formData.billingConfig.startDate || null,
  });

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      const token = localStorage.getItem('token');

      if (editingUserId) {
        const requestBody = {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          userType: formData.userType,
          status: formData.status,
        };
        if (formData.phoneNumber && formData.phoneNumber.trim()) {
          requestBody.phoneNumber = formData.phoneNumber.trim();
        }
        if (formData.password) {
          requestBody.password = formData.password;
        }
        if (formData.userType === 'school' && formData.billingType) {
          requestBody.billingType = formData.billingType;
          if (formData.billingType === 'patty' || formData.billingType === 'explore') {
            requestBody.billingConfig = buildPattyBillingConfig();
          }
        }
        if (formData.userType === 'teacher') {
          requestBody.teacherEmploymentType = formData.teacherEmploymentType || 'part_time';
        }

        const response = await fetch(`${API_BASE_URL}/users/${editingUserId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
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
              submit: data.message || 'Error updating user. Please try again.',
            });
          }
          return;
        }

        if (data.warning) {
          alert(`${data.message || 'User updated.'}\n\nNote: ${data.warning}`);
        } else {
          alert(data.message || 'User updated successfully!');
        }
        handleModalClose();
        fetchUsers();
        fetchSubscriptionStatuses();
        return;
      }

      const requestBody = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        userType: formData.userType,
      };

      if (formData.phoneNumber && formData.phoneNumber.trim()) {
        requestBody.phoneNumber = formData.phoneNumber.trim();
      }

      if (formData.userType === 'school' && formData.billingType) {
        requestBody.billingType = formData.billingType;
        if (formData.billingType === 'explore') {
          requestBody.paymentStatus = formData.paymentStatus || 'pending';
          requestBody.paymentType = formData.paymentType || 'bank_transfer';
          if (formData.paymentStatus === 'paid') {
            requestBody.initialPaymentAmount = String(formData.initialPaymentAmount ?? '').trim();
          }
        }
        if (formData.billingType === 'patty') {
          requestBody.paymentStatus = 'pending';
          requestBody.paymentType = 'bank_transfer';
        }
        if (formData.billingType === 'patty' || formData.billingType === 'explore') {
          requestBody.billingConfig = buildPattyBillingConfig();
        }
      }
      if (formData.userType === 'teacher') {
        requestBody.teacherEmploymentType = formData.teacherEmploymentType || 'part_time';
      }
      if (!editingUserId && formData.userType === 'teacher') {
        requestBody.gender = formData.gender || '';
      }

      const payload = new FormData();
      Object.entries(requestBody).forEach(([k, v]) => {
        if (v === null || v === undefined) return;
        if (typeof v === 'object') {
          payload.append(k, JSON.stringify(v));
        } else {
          payload.append(k, String(v));
        }
      });
      if (
        receiptFile &&
        formData.userType === 'school' &&
        formData.billingType === 'explore' &&
        formData.paymentStatus === 'paid'
      ) {
        payload.append('receipt', receiptFile);
      }

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: payload,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Registration error:', data);

        if (data.errors && Array.isArray(data.errors)) {
          const validationErrors = {};
          data.errors.forEach((error) => {
            const fieldName = error.param || error.path || 'unknown';
            validationErrors[fieldName] = error.msg || error.message;
          });
          setFormErrors(validationErrors);
        } else {
          setFormErrors({
            submit: data.message || 'Error creating user. Please try again.',
          });
        }
        return;
      }

      alert('User created successfully!');
      handleModalClose();
      fetchUsers();
      fetchSubscriptionStatuses();
    } catch (error) {
      console.error('Error saving user:', error);
      setFormErrors({
        submit: 'Network error. Please check your connection and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditUser = async (userItem) => {
    setEditingUserId(userItem.user_id);
    setFormErrors({});
    setIsModalOpen(true);
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/users/${userItem.user_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success || !data.data?.user) {
        alert(data.message || 'Could not load user');
        setIsModalOpen(false);
        setEditingUserId(null);
        return;
      }
      const u = data.data.user;
      const pb = data.data.pattyBilling;
      const billingTypeRaw = u.billing_type && u.billing_type !== '-' ? u.billing_type : '';
      setFormData({
        name: u.name || '',
        email: u.email || '',
        password: '',
        phoneNumber: u.phone_number || '',
        gender: u.gender || '',
        userType: u.user_type || 'school',
        billingType: billingTypeRaw,
        billingConfig: pb
          ? {
              planName: pb.planName || '',
              creditsPerCycle: pb.creditsPerCycle || '',
              ratePerCredit: pb.ratePerCredit || '',
              paymentDueDay: pb.paymentDueDay || '1',
              billingDurationMonths: pb.billingDurationMonths || '12',
              penaltyPercentage: pb.penaltyPercentage || '10',
              graceDays: pb.graceDays || '7',
              startDate: pb.startDate || todayYyyyMmDd(),
            }
          : {
              planName: '',
              creditsPerCycle: '',
              ratePerCredit: '',
              paymentDueDay: '1',
              billingDurationMonths: '12',
              penaltyPercentage: '10',
              graceDays: '7',
              startDate: todayYyyyMmDd(),
            },
        status: u.status || 'active',
        paymentStatus: 'pending',
        paymentType: 'bank_transfer',
        initialPaymentAmount: '',
        teacherEmploymentType: u.teacher_employment_type || 'part_time',
      });
      setReceiptFile(null);
    } catch (err) {
      console.error(err);
      alert('Failed to load user');
      setIsModalOpen(false);
      setEditingUserId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open edit modal when navigated from Installment Invoice (or elsewhere) with state
  useEffect(() => {
    const id = location.state?.openEditUserId;
    if (id == null || users.length === 0) return;
    const userItem = users.find((u) => Number(u.user_id) === Number(id));
    if (!userItem) {
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    openEditUser(userItem);
    navigate(location.pathname, { replace: true, state: {} });
  }, [users, location.state, location.pathname, navigate]);

  const handleActionClick = (e, userId) => {
    e.stopPropagation();
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    
    setMenuPosition(
      computeFixedActionMenuPosition({
        rect,
        menuWidth: 192, // w-40 (mobile) / w-48 (>=sm) — keep safe max
        menuHeight: 140,
        gap: 6,
      })
    );
    
    setOpenMenuId(openMenuId === userId ? null : userId);
  };

  const fetchUsers = async () => {
    setIsFetching(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/users`;
      const params = new URLSearchParams();
      
      if (roleFilter) {
        params.append('userType', roleFilter);
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
      if (data.success && data.data?.users) {
        setUsers(data.data.users);
      } else {
        console.error('Error fetching users:', data.message);
        setUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    } finally {
      setIsFetching(false);
    }
  };

  const fetchSubscriptionStatuses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/billing`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!data.success || !data.data?.subscriptions) {
        setSubscriptionStatusByUserId({});
        return;
      }
      const map = {};
      data.data.subscriptions.forEach((s) => {
        map[s.user_id] = s;
      });
      setSubscriptionStatusByUserId(map);
    } catch (error) {
      console.error('Error fetching subscription statuses:', error);
      setSubscriptionStatusByUserId({});
    }
  };

  const searchQuery = nameSearch.trim().toLowerCase();

  // Filter users by name or email (search is client-side; toolbar stays visible when zero matches)
  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const name = String(u.name || '').toLowerCase();
    const email = String(u.email || '').toLowerCase();
    return name.includes(searchQuery) || email.includes(searchQuery);
  });

  const emptyListNoFilters =
    users.length === 0 && !roleFilter && !nameSearch.trim();
  const noMatchesWithData = users.length > 0 && filteredUsers.length === 0;

  useEffect(() => {
    setPage(1);
  }, [nameSearch, roleFilter]);

  const pageSize = 10;
  const pagedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  // Format user type for display
  const formatUserType = (userType) => {
    if (!userType) return 'N/A';
    return userType.charAt(0).toUpperCase() + userType.slice(1);
  };

  const getRoleBadgeClass = (userType) => {
    const role = String(userType || '').toLowerCase();
    if (role === 'superadmin') return 'bg-purple-100 text-purple-800';
    if (role === 'school') return 'bg-emerald-100 text-emerald-800';
    if (role === 'teacher') return 'bg-sky-100 text-sky-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatLastLogin = (lastLogin) => {
    if (!lastLogin) return null;
    const raw = String(lastLogin).trim();
    const hasTimezone = /z$/i.test(raw) || /[+-]\d{2}:?\d{2}$/.test(raw);

    // If timezone is missing, treat DB value as already UTC+8 wall-clock time.
    if (!hasTimezone) {
      const m = raw.match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/
      );
      if (!m) return null;
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      const hour24 = Number(m[4] ?? '0');
      const minute = Number(m[5] ?? '0');
      const monthShort = new Date(year, month - 1, day).toLocaleString('en-US', {
        month: 'short',
      });
      const period = hour24 >= 12 ? 'PM' : 'AM';
      const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
      return {
        dateText: `${monthShort} ${day}, ${year}`,
        timeText: `${hour12}:${String(minute).padStart(2, '0')} ${period}`,
      };
    }

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;

    const dateText = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);

    const timeText = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);

    return { dateText, timeText };
  };

  // Get billing type from user data
  const getBillingType = (userItem) => {
    if (!userItem.billing_type) return '-';
    
    // Format billing type for display
    const billingTypeMap = {
      'patty': 'Patty',
      'explore': 'Explore',
    };
    
    return billingTypeMap[userItem.billing_type.toLowerCase()] || userItem.billing_type;
  };

  const overdueCount = Object.values(subscriptionStatusByUserId).filter((s) => s.is_overdue).length;

  const toAbsoluteUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('http')) return raw;
    if (raw.startsWith('/')) return `${API_BASE_URL.replace('/api', '')}${raw}`;
    return raw;
  };

  // Get user initials for avatar
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get avatar color based on name
  const getAvatarColor = (name) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-teal-500',
    ];
    if (!name) return colors[0];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Handle delete user
  const handleDelete = async (userId, userName) => {
    const ok = await window.appConfirm?.(`Are you sure you want to delete user "${userName}"?`);
    if (!ok) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        let msg = data.message || 'User deleted successfully';
        if (data.warning) {
          msg += `\n\n${data.warning}`;
        }
        alert(msg);
        fetchUsers();
        fetchSubscriptionStatuses();
      } else {
        alert(data.message || 'Error deleting user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error deleting user. Please try again.');
    }
  };

  // Handle status update
  const handleStatusChange = async (userId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        fetchUsers(); // Refresh the list
      } else {
        alert(data.message || 'Error updating user status');
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Error updating user status. Please try again.');
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
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Users</h1>
                  <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">Manage all system users</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingUserId(null);
                    setIsModalOpen(true);
                  }}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Add New User
                </button>
              </div>

              {overdueCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4">
                  <p className="text-sm text-amber-800 font-medium">
                    {overdueCount} school account{overdueCount !== 1 ? 's are' : ' is'} currently overdue.
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-amber-700">
                    Bookings remain allowed, but finance follow-up is recommended.
                  </p>
                </div>
              )}


              {/* Users Table */}
              <div className="bg-white rounded-lg shadow">
                {isFetching ? (
                  <div className="p-8 sm:p-10 md:p-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">Loading users...</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 px-4 py-3 sm:px-6 border-b border-gray-200 bg-gray-50/90 min-w-0">
                      <div className="flex flex-col min-w-0 flex-1 sm:max-w-md">
                        <input
                          id="users-search"
                          type="search"
                          aria-label="Search users"
                          placeholder="Search by name or email"
                          value={nameSearch}
                          onChange={(e) => setNameSearch(e.target.value)}
                          autoComplete="off"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div className="flex flex-col w-full sm:w-auto sm:min-w-[10rem] min-w-0">
                        <ResponsiveSelect
                          id="users-role-filter"
                          aria-label="Filter users by role"
                          value={roleFilter}
                          onChange={(e) => setRoleFilter(e.target.value)}
                          className="w-full max-w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                        >
                          <option value="">All roles</option>
                          <option value="superadmin">Superadmin</option>
                          <option value="school">School</option>
                          <option value="teacher">Teacher</option>
                        </ResponsiveSelect>
                      </div>
                    </div>
                    {filteredUsers.length === 0 ? (
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
                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                        <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-gray-900">
                          {noMatchesWithData
                            ? 'No matching users'
                            : users.length === 0 && roleFilter
                              ? 'No users for this role'
                              : 'No users yet'}
                        </h3>
                        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                          {noMatchesWithData
                            ? 'Try a different name, email, or clear the search.'
                            : emptyListNoFilters
                              ? 'Get started by adding a new user.'
                              : users.length === 0 && roleFilter
                                ? 'Choose another role or clear the role filter.'
                                : 'Try adjusting your search or role filter.'}
                        </p>
                      </div>
                    ) : (
                  <>
                  <div className="overflow-x-auto rounded-b-xl">
                    <table className="min-w-[880px] w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Name
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Email
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Role
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Billing type
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Status
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap">
                            Last login
                          </th>
                          <th className="sticky right-0 z-10 bg-gray-50 px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pagedUsers.map((userItem) => (
                          <tr key={userItem.user_id} className="group hover:bg-gray-50">
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className={`flex-shrink-0 h-10 w-10 rounded-full ${getAvatarColor(userItem.name)} flex items-center justify-center text-white font-medium text-sm overflow-hidden`}>
                                  {toAbsoluteUrl(userItem.profile_picture) ? (
                                    <img
                                      src={toAbsoluteUrl(userItem.profile_picture)}
                                      alt={`${userItem.name || 'User'} profile`}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    getInitials(userItem.name)
                                  )}
                                </div>
                                <div className="ml-3 md:ml-4">
                                  <div className="text-sm font-medium text-gray-900">{userItem.name || 'N/A'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <div
                                className="max-w-[11rem] text-sm text-gray-900 break-all sm:max-w-none sm:break-normal"
                                title={userItem.email || ''}
                              >
                                {userItem.email || 'N/A'}
                              </div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeClass(userItem.user_type)}`}>
                                {formatUserType(userItem.user_type)}
                              </span>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-900">{getBillingType(userItem)}</span>
                                {subscriptionStatusByUserId[userItem.user_id]?.is_overdue && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                                    Overdue
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <ResponsiveSelect
                                value={userItem.status || 'active'}
                                onChange={(e) => handleStatusChange(userItem.user_id, e.target.value)}
                                className={`text-xs font-semibold rounded-full px-2 py-1 border-0 focus:ring-2 focus:ring-primary-500 ${
                                  userItem.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : userItem.status === 'inactive'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                                aria-label="Account status"
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="pending">Pending</option>
                              </ResponsiveSelect>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              {(() => {
                                const lastLogin = formatLastLogin(userItem.last_login);
                                if (!lastLogin) {
                                  return <span className="text-sm text-gray-500">Never</span>;
                                }
                                return (
                                  <div className="text-sm text-gray-700 leading-tight">
                                    <p>{lastLogin.dateText}</p>
                                    <p className="text-gray-500">{lastLogin.timeText} (UTC+8)</p>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="sticky right-0 z-[1] bg-white px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.06)] group-hover:bg-gray-50">
                              <div className="flex justify-end">
                                <button
                                  onClick={(e) => handleActionClick(e, userItem.user_id)}
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
                    <Pagination totalItems={filteredUsers.length} pageSize={pageSize} currentPage={page} onPageChange={setPage} />
                  </div>
                  </>
                    )}
                  </>
                )}
              </div>

              {/* Results Count */}
              {filteredUsers.length > 0 && (
                <div className="text-xs sm:text-sm text-gray-600">
                  Showing {filteredUsers.length} of {users.length} users
                </div>
              )}

              {/* Action Menu Dropdown - Rendered outside table */}
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
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const userItem = filteredUsers.find((u) => u.user_id === openMenuId);
                        if (userItem) {
                          openEditUser(userItem);
                        }
                        setOpenMenuId(null);
                      }}
                      className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const userItem = filteredUsers.find(u => u.user_id === openMenuId);
                        if (userItem) {
                          handleDelete(userItem.user_id, userItem.name);
                        }
                        setOpenMenuId(null);
                      }}
                      className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-red-600 hover:bg-gray-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>,
                document.body
              )}

              {/* Add User Modal - Rendered via Portal to body */}
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
                    className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto mx-4 sm:mx-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 sm:p-5 md:p-6">
                      {/* Modal Header */}
                      <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                          {editingUserId ? 'Edit User' : 'Add New User'}
                        </h2>
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
                      <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {/* Name */}
                        <div>
                          <label htmlFor="name" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="name"
                            name="name"
                            type="text"
                            value={formData.name}
                            onChange={handleFormChange}
                            className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                              formErrors.name ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="Enter full name"
                          />
                          {formErrors.name && (
                            <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.name}</p>
                          )}
                        </div>

                        {/* Email */}
                        <div>
                          <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Email <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleFormChange}
                            className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                              formErrors.email ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="Enter email address"
                          />
                          {formErrors.email && (
                            <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.email}</p>
                          )}
                        </div>

                        {editingUserId && (
                          <div>
                            <label htmlFor="status" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Account status
                            </label>
                            <ResponsiveSelect
                              id="status"
                              name="status"
                              value={formData.status}
                              onChange={handleFormChange}
                              className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                              <option value="pending">Pending</option>
                            </ResponsiveSelect>
                          </div>
                        )}

                        {/* Phone Number */}
                        <div>
                          <label htmlFor="phoneNumber" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Phone Number
                          </label>
                          <input
                            id="phoneNumber"
                            name="phoneNumber"
                            type="tel"
                            value={formData.phoneNumber}
                            onChange={handleFormChange}
                            className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                              formErrors.phoneNumber ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="Enter phone number (optional)"
                          />
                          {formErrors.phoneNumber && (
                            <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.phoneNumber}</p>
                          )}
                        </div>

                        {/* User Type */}
                        <div>
                          <label htmlFor="userType" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            User Type <span className="text-red-500">*</span>
                          </label>
                          <ResponsiveSelect
                            id="userType"
                            name="userType"
                            value={formData.userType}
                            onChange={handleFormChange}
                            className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                              formErrors.userType ? 'border-red-500' : 'border-gray-300'
                            }`}
                          >
                            <option value="school">School</option>
                            <option value="superadmin">Superadmin</option>
                            <option value="teacher">Teacher</option>
                          </ResponsiveSelect>
                          {formErrors.userType && (
                            <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.userType}</p>
                          )}
                        </div>

                        {/* Billing Type - Only shown for school user type */}
                        {formData.userType === 'school' && (
                          <div>
                            <label htmlFor="billingType" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Billing Type <span className="text-red-500">*</span>
                            </label>
                            <ResponsiveSelect
                              id="billingType"
                              name="billingType"
                              value={formData.billingType}
                              onChange={handleFormChange}
                              className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                formErrors.billingType ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="">Select billing type</option>
                              <option value="patty">Patty (Monthly)</option>
                              <option value="explore">Explore (Full Payment)</option>
                            </ResponsiveSelect>
                            {formErrors.billingType && (
                              <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.billingType}</p>
                            )}
                          </div>
                        )}

                        {formData.userType === 'teacher' && !editingUserId && (
                          <div>
                            <label htmlFor="gender" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Gender <span className="text-red-500">*</span>
                            </label>
                            <ResponsiveSelect
                              id="gender"
                              name="gender"
                              value={formData.gender}
                              onChange={handleFormChange}
                              className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                formErrors.gender ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="">Select gender</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other</option>
                            </ResponsiveSelect>
                            {formErrors.gender && (
                              <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.gender}</p>
                            )}
                          </div>
                        )}

                        {formData.userType === 'teacher' && (
                          <div>
                            <label htmlFor="teacherEmploymentType" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Teacher Type <span className="text-red-500">*</span>
                            </label>
                            <ResponsiveSelect
                              id="teacherEmploymentType"
                              name="teacherEmploymentType"
                              value={formData.teacherEmploymentType}
                              onChange={handleFormChange}
                              className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                formErrors.teacherEmploymentType ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="part_time">Part-time</option>
                              <option value="full_time">Full-time</option>
                            </ResponsiveSelect>
                            {formErrors.teacherEmploymentType && (
                              <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.teacherEmploymentType}</p>
                            )}
                          </div>
                        )}

                        {formData.userType === 'school' && formData.billingType === 'patty' && (
                          <div className="md:col-span-2 space-y-3 p-3 sm:p-4 rounded-lg border border-blue-100 bg-blue-50">
                            <p className="text-xs sm:text-sm font-medium text-blue-800">Patty Monthly Billing Settings</p>
                            <p className="text-xs text-blue-900/90 leading-relaxed">
                              Monthly installments are billed per cycle. Invoice amount is computed as{' '}
                              <span className="font-medium">(credits × rate) / duration months</span>. Invoices are auto-generated
                              7 days before due date, and finance can still generate invoices manually.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label htmlFor="creditsPerCycle" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                                  Total Credits <span className="text-red-500">*</span>
                                </label>
                                <input
                                  id="creditsPerCycle"
                                  name="billingConfig.creditsPerCycle"
                                  type="number"
                                  min="1"
                                  value={formData.billingConfig.creditsPerCycle}
                                  onChange={handleFormChange}
                                  className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                    formErrors.creditsPerCycle ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                />
                                {formErrors.creditsPerCycle && <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.creditsPerCycle}</p>}
                              </div>
                              <div>
                                <label htmlFor="ratePerCredit" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                                  Rate per Credit <span className="text-red-500">*</span>
                                </label>
                                <input
                                  id="ratePerCredit"
                                  name="billingConfig.ratePerCredit"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={formData.billingConfig.ratePerCredit}
                                  onChange={handleFormChange}
                                  className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                    formErrors.ratePerCredit ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                />
                                {formErrors.ratePerCredit && <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.ratePerCredit}</p>}
                              </div>
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Due Date (Day 1-28)</label>
                                <input
                                  name="billingConfig.paymentDueDay"
                                  type="number"
                                  min="1"
                                  max="28"
                                  value={formData.billingConfig.paymentDueDay}
                                  onChange={handleFormChange}
                                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                                  Penalty (%) 
                                </label>
                                <input
                                  name="billingConfig.penaltyPercentage"
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={formData.billingConfig.penaltyPercentage}
                                  onChange={handleFormChange}
                                  className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                    formErrors.penaltyPercentage ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                />
                                {formErrors.penaltyPercentage && (
                                  <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.penaltyPercentage}</p>
                                )}
                              </div>
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                                  Billing Duration
                                </label>
                                <ResponsiveSelect
                                  name="billingConfig.billingDurationMonths"
                                  value={formData.billingConfig.billingDurationMonths}
                                  onChange={handleFormChange}
                                  className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                    formErrors.billingDurationMonths ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                >
                                  <option value="3">3 months</option>
                                  <option value="6">6 months</option>
                                  <option value="12">12 months</option>
                                </ResponsiveSelect>
                                {formErrors.billingDurationMonths && (
                                  <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.billingDurationMonths}</p>
                                )}
                              </div>
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Grace Period</label>
                                <input
                                  name="billingConfig.graceDays"
                                  type="number"
                                  min="0"
                                  value={formData.billingConfig.graceDays}
                                  onChange={handleFormChange}
                                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                <input
                                  name="billingConfig.startDate"
                                  type="date"
                                  value={formData.billingConfig.startDate}
                                  onChange={handleFormChange}
                                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {formData.userType === 'school' && formData.billingType === 'explore' && (
                          <div className="md:col-span-2 space-y-3 p-3 sm:p-4 rounded-lg border border-blue-100 bg-blue-50">
                            <p className="text-xs sm:text-sm font-medium text-blue-800">Explore Billing Settings</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label htmlFor="exploreCredits" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                                  Credits <span className="text-red-500">*</span>
                                </label>
                                <input
                                  id="exploreCredits"
                                  name="billingConfig.creditsPerCycle"
                                  type="number"
                                  min="1"
                                  value={formData.billingConfig.creditsPerCycle}
                                  onChange={handleFormChange}
                                  className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                    formErrors.creditsPerCycle ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                />
                                {formErrors.creditsPerCycle && (
                                  <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.creditsPerCycle}</p>
                                )}
                              </div>
                              <div>
                                <label htmlFor="exploreRate" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                                  Rate per Credit <span className="text-red-500">*</span>
                                </label>
                                <input
                                  id="exploreRate"
                                  name="billingConfig.ratePerCredit"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={formData.billingConfig.ratePerCredit}
                                  onChange={handleFormChange}
                                  className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                    formErrors.ratePerCredit ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                />
                                {formErrors.ratePerCredit && (
                                  <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.ratePerCredit}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {!editingUserId && formData.userType === 'school' && formData.billingType === 'explore' && (
                          <div className="md:col-span-2 space-y-3 p-3 sm:p-4 rounded-lg border border-amber-100 bg-amber-50">
                            <p className="text-xs sm:text-sm font-medium text-amber-800">Invoice & Payment Setup</p>
                            <p className="text-xs text-amber-900/90">
                              Explore is a <span className="font-medium">full package</span> purchase — record payment and receipt
                              here if applicable.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label htmlFor="paymentStatus" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                                  Payment Status
                                </label>
                                <ResponsiveSelect
                                  id="paymentStatus"
                                  name="paymentStatus"
                                  value={formData.paymentStatus}
                                  onChange={handleFormChange}
                                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="paid">Paid</option>
                                </ResponsiveSelect>
                              </div>
                              <div>
                                <label htmlFor="paymentType" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                                  Payment Type
                                </label>
                                <ResponsiveSelect
                                  id="paymentType"
                                  name="paymentType"
                                  value={formData.paymentType}
                                  onChange={handleFormChange}
                                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                >
                                  <option value="bank_transfer">Bank Transfer</option>
                                  <option value="e_wallet">E-wallets</option>
                                  <option value="card">Card</option>
                                  <option value="cash">Cash</option>
                                </ResponsiveSelect>
                              </div>
                              {formData.paymentStatus === 'paid' && (
                                <>
                                  <div>
                                    <label htmlFor="initialPaymentAmount" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                                      Amount <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                      id="initialPaymentAmount"
                                      name="initialPaymentAmount"
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      value={formData.initialPaymentAmount}
                                      onChange={handleFormChange}
                                      placeholder="0.00"
                                      className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                        formErrors.initialPaymentAmount ? 'border-red-500' : 'border-gray-300'
                                      }`}
                                    />
                                    {formErrors.initialPaymentAmount && (
                                      <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.initialPaymentAmount}</p>
                                    )}
                                  </div>
                                  <div>
                                    <label htmlFor="receipt" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                                      Receipt Attachment (PDF/Image)
                                    </label>
                                    <input
                                      id="receipt"
                                      type="file"
                                      accept=".pdf,image/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        setReceiptFile(file);
                                        if (formErrors.receipt) {
                                          setFormErrors((prev) => ({ ...prev, receipt: '' }));
                                        }
                                      }}
                                      className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg bg-white ${
                                        formErrors.receipt ? 'border-red-500' : 'border-gray-300'
                                      }`}
                                    />
                                    {formErrors.receipt && (
                                      <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.receipt}</p>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Password */}
                        <div className="md:col-span-2">
                          <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Password {!editingUserId && <span className="text-red-500">*</span>}
                            {editingUserId && (
                              <span className="text-gray-500 font-normal"> (optional — leave blank to keep current)</span>
                            )}
                          </label>
                          <input
                            id="password"
                            name="password"
                            type="password"
                            value={formData.password}
                            onChange={handleFormChange}
                            autoComplete="new-password"
                            className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                              formErrors.password ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder={editingUserId ? 'New password (min 6 characters)' : 'Enter password (min 6 characters)'}
                          />
                          {formErrors.password && (
                            <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.password}</p>
                          )}
                        </div>

                        {/* Submit Error */}
                        {formErrors.submit && (
                          <div className="md:col-span-2 bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3">
                            <p className="text-xs sm:text-sm text-red-600">{formErrors.submit}</p>
                          </div>
                        )}

                        {/* Modal Footer */}
                        <div className="md:col-span-2 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4">
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
                            {isSubmitting
                              ? editingUserId
                                ? 'Saving...'
                                : 'Creating...'
                              : editingUserId
                                ? 'Save Changes'
                                : 'Create User'}
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

export default Users;
