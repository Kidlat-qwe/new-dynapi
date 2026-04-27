import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { API_BASE_URL } from '@/config/api.js';

const Header = ({ user }) => {
  const navigate = useNavigate();
  const profilePhotoInputRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifLoading, setIsNotifLoading] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordState, setPasswordState] = useState({
    isLoading: false,
    error: '',
    success: '',
  });
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploadingProfilePhoto, setIsUploadingProfilePhoto] = useState(false);
  const [isProfilePhotoModalOpen, setIsProfilePhotoModalOpen] = useState(false);
  const [pendingProfilePhotoFile, setPendingProfilePhotoFile] = useState(null);
  const [pendingProfilePhotoPreviewUrl, setPendingProfilePhotoPreviewUrl] = useState('');

  const normalizeNotificationHref = useCallback(
    (href, notification) => {
      const raw = String(href || '').trim();
      const aliasMap = {
        '/superadmin/appointments': '/superadmin/appointment',
      };
      const normalized = aliasMap[raw] || raw;
      const role = String(user?.userType || '').toLowerCase();

      const allowedByRole = {
        superadmin: new Set([
          '/superadmin/dashboard',
          '/superadmin/appointment',
          '/superadmin/invoices',
          '/superadmin/teacher-availability',
          '/superadmin/credits',
          '/superadmin/users',
          '/superadmin/teachers',
          '/superadmin/materials',
          '/superadmin/payment-logs',
          '/superadmin/installment-invoice',
          '/superadmin/package',
        ]),
        school: new Set([
          '/school/dashboard',
          '/school/bookings',
          '/school/credits',
          '/school/materials',
          '/school/students',
          '/school/packages',
          '/school/reports',
        ]),
        teacher: new Set([
          '/teacher/dashboard',
          '/teacher/appointments',
          '/teacher/availability',
          '/teacher/materials',
          '/teacher/profile',
        ]),
      };

      const fallbackByRole = {
        superadmin: '/superadmin/dashboard',
        school: '/school/dashboard',
        teacher: '/teacher/dashboard',
      };

      if (normalized.startsWith('/') && allowedByRole[role]?.has(normalized)) {
        return normalized;
      }

      const entityType = String(notification?.entity_type || '').toLowerCase();
      if (entityType === 'appointment') {
        if (role === 'superadmin') return '/superadmin/appointment';
        if (role === 'school') return '/school/bookings';
        if (role === 'teacher') return '/teacher/appointments';
      }
      if (entityType === 'invoice') {
        if (role === 'superadmin') return '/superadmin/invoices';
        if (role === 'school') return '/school/credits';
      }
      if (entityType === 'availability' && role === 'superadmin') {
        return '/superadmin/teacher-availability';
      }
      if (entityType === 'material') {
        if (role === 'school') return '/school/materials';
        if (role === 'teacher') return '/teacher/materials';
      }
      return fallbackByRole[role] || '/login';
    },
    [user?.userType]
  );

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const formatRelativeTime = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'Just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const days = Math.floor(h / 24);
    return `${days}d`;
  };

  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setUnreadCount(Number(data.data?.unreadCount || 0));
      }
    } catch (e) {
      // silent: bell should not break header
      console.error('Unread count fetch failed:', e);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setIsNotifLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setNotifications(Array.isArray(data.data?.notifications) ? data.data.notifications : []);
      }
    } catch (e) {
      console.error('Notifications fetch failed:', e);
    } finally {
      setIsNotifLoading(false);
    }
  }, []);

  const markReadAndGo = async (n) => {
    try {
      const token = localStorage.getItem('token');
      if (token && n?.notification_id) {
        await fetch(`${API_BASE_URL}/notifications/${n.notification_id}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);
      }
    } finally {
      setIsNotifOpen(false);
      navigate(normalizeNotificationHref(n?.href, n));
      fetchUnreadCount();
      fetchNotifications();
    }
  };

  const markAllRead = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/notifications/mark-all-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);
        fetchNotifications();
      }
    } catch (e) {
      console.error('Mark all notifications read failed:', e);
    }
  };

  const getUserInitials = (name) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const toAbsoluteUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('http')) return raw;
    if (raw.startsWith('/')) return `${API_BASE_URL.replace('/api', '')}${raw}`;
    return raw;
  };

  const syncStoredUser = (patch = {}) => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      localStorage.setItem('user', JSON.stringify({ ...parsed, ...patch }));
    } catch {
      // no-op
    }
  };

  const fetchCurrentUserProfilePhoto = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) return;
      const next = toAbsoluteUrl(data?.data?.user?.profile_picture);
      setAvatarUrl(next);
      syncStoredUser({ profile_picture: data?.data?.user?.profile_picture || '' });
    } catch (error) {
      console.error('Unable to load profile photo:', error);
    }
  }, []);

  const handleChangeProfilePictureClick = () => {
    setIsMenuOpen(false);
    setPendingProfilePhotoFile(null);
    setPendingProfilePhotoPreviewUrl('');
    setIsProfilePhotoModalOpen(true);
  };

  const handleProfilePhotoSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const allowedTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
    if (!allowedTypes.has(file.type)) {
      window.appAlert?.('Invalid image type. Please upload JPG, PNG, GIF, or WEBP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      window.appAlert?.('Image is too large. Please upload a file smaller than 10MB.');
      return;
    }

    if (pendingProfilePhotoPreviewUrl) {
      URL.revokeObjectURL(pendingProfilePhotoPreviewUrl);
    }
    setPendingProfilePhotoFile(file);
    setPendingProfilePhotoPreviewUrl(URL.createObjectURL(file));
  };

  const handleProfilePhotoUpload = async () => {
    if (!pendingProfilePhotoFile) {
      window.appAlert?.('Please select an image first.');
      return;
    }

    setIsUploadingProfilePhoto(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.appAlert?.('Session expired. Please log in again.');
        return;
      }
      const payload = new FormData();
      payload.append('profilePhoto', pendingProfilePhotoFile);
      const response = await fetch(`${API_BASE_URL}/auth/me/profile-picture`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        window.appAlert?.(data.message || 'Failed to update profile picture.');
        return;
      }

      const savedPath = data?.data?.user?.profile_picture || '';
      setAvatarUrl(toAbsoluteUrl(savedPath));
      syncStoredUser({ profile_picture: savedPath });
      window.dispatchEvent(
        new CustomEvent('funtalk:profile-picture-updated', {
          detail: { profilePicture: savedPath },
        })
      );
      setIsProfilePhotoModalOpen(false);
      setPendingProfilePhotoFile(null);
      if (pendingProfilePhotoPreviewUrl) {
        URL.revokeObjectURL(pendingProfilePhotoPreviewUrl);
      }
      setPendingProfilePhotoPreviewUrl('');
      window.appAlert?.('Profile picture updated successfully.');
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      window.appAlert?.('Error uploading profile picture. Please try again.');
    } finally {
      setIsUploadingProfilePhoto(false);
    }
  };

  const closeProfilePhotoModal = () => {
    if (isUploadingProfilePhoto) return;
    setIsProfilePhotoModalOpen(false);
    setPendingProfilePhotoFile(null);
    if (pendingProfilePhotoPreviewUrl) {
      URL.revokeObjectURL(pendingProfilePhotoPreviewUrl);
    }
    setPendingProfilePhotoPreviewUrl('');
  };

  const closeChangePasswordModal = () => {
    if (passwordState.isLoading) return;
    setIsChangePasswordOpen(false);
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordState({ isLoading: false, error: '', success: '' });
  };

  const openChangePasswordModal = () => {
    setIsMenuOpen(false);
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordState({ isLoading: false, error: '', success: '' });
    setIsChangePasswordOpen(true);
  };

  const handlePasswordFormChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    if (passwordState.error || passwordState.success) {
      setPasswordState((prev) => ({ ...prev, error: '', success: '' }));
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    const currentUser = auth.currentUser;

    if (!currentUser?.email) {
      setPasswordState({
        isLoading: false,
        error: 'Session expired. Please log in again.',
        success: '',
      });
      return;
    }

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordState({
        isLoading: false,
        error: 'All password fields are required.',
        success: '',
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordState({
        isLoading: false,
        error: 'New password must be at least 6 characters.',
        success: '',
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordState({
        isLoading: false,
        error: 'New password and confirm password do not match.',
        success: '',
      });
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordState({
        isLoading: false,
        error: 'New password must be different from current password.',
        success: '',
      });
      return;
    }

    setPasswordState({ isLoading: true, error: '', success: '' });

    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordForm.currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, passwordForm.newPassword);

      setPasswordState({
        isLoading: false,
        error: '',
        success: 'Password updated successfully.',
      });

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      let errorMessage = 'Failed to update password. Please try again.';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Current password is incorrect.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please sign in again, then retry password change.';
      }

      setPasswordState({ isLoading: false, error: errorMessage, success: '' });
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.user-menu-container')) {
        setIsMenuOpen(false);
      }
      if (!event.target.closest('.notif-menu-container')) {
        setIsNotifOpen(false);
      }
    };

    if (isMenuOpen || isNotifOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isMenuOpen, isNotifOpen]);

  useEffect(() => {
    fetchUnreadCount();
    const id = window.setInterval(fetchUnreadCount, 15_000);
    return () => window.clearInterval(id);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!isNotifOpen) return undefined;
    fetchNotifications();
    fetchUnreadCount();
    const id = window.setInterval(() => {
      fetchNotifications();
      fetchUnreadCount();
    }, 8_000);
    return () => window.clearInterval(id);
  }, [isNotifOpen, fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount();
        if (isNotifOpen) fetchNotifications();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [fetchNotifications, fetchUnreadCount, isNotifOpen]);

  useEffect(() => {
    const localProfilePath = user?.profile_picture || user?.profilePicture || '';
    setAvatarUrl(toAbsoluteUrl(localProfilePath));
  }, [user?.profile_picture, user?.profilePicture]);

  useEffect(() => {
    fetchCurrentUserProfilePhoto();
  }, [fetchCurrentUserProfilePhoto]);

  useEffect(() => {
    return () => {
      if (pendingProfilePhotoPreviewUrl) {
        URL.revokeObjectURL(pendingProfilePhotoPreviewUrl);
      }
    };
  }, [pendingProfilePhotoPreviewUrl]);

  return (
    <header className="bg-gradient-to-r from-[#A7816D] via-[#AF8F7E] to-[#B66681] shadow-soft border-b border-white/20 sticky top-0 z-50">
      {/* UI: consistent header container + spacing */}
      <div className="px-4 sm:px-6 lg:px-8">
        {/* Align header brand with sidebar (sidebar uses p-4 on its nav) */}
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center space-x-3">
            <img 
              src="/funtalk-logo.png" 
              alt="Funtalk Logo" 
              className="h-10 sm:h-12 w-auto object-contain"
            />
            <div className="hidden sm:block">
              <h1 className="text-base sm:text-lg font-semibold text-white tracking-tight">Funtalk Online Tutor</h1>
            </div>
          </div>

          {/* Right side - User menu */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Notifications */}
            <div className="relative notif-menu-container">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const next = !isNotifOpen;
                  setIsNotifOpen(next);
                  if (next) {
                    fetchNotifications();
                    fetchUnreadCount();
                  }
                }}
                className="relative inline-flex items-center justify-center h-10 w-10 rounded-lg hover:bg-white/15 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
                aria-label="Notifications"
                title="Notifications"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#B66681] text-white text-[10px] font-semibold leading-[18px] text-center ring-2 ring-[#DFC1CB]">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div
                  className="
                  z-[120] flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl
                  fixed left-3 right-3 top-[calc(4rem+0.5rem)] max-h-[min(calc(100dvh-5.5rem),560px)]
                  lg:absolute lg:inset-x-auto lg:left-auto lg:right-0 lg:top-full lg:mt-2 lg:max-h-none lg:w-[min(92vw,360px)] lg:flex-none
                "
                >
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">Notifications</p>
                    <div className="flex shrink-0 items-center gap-3">
                      <p className="text-xs text-gray-500">{unreadCount} unread</p>
                      <button
                        type="button"
                        onClick={markAllRead}
                        disabled={unreadCount === 0}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        Mark all as read
                      </button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto lg:max-h-[420px]">
                    {isNotifLoading ? (
                      <div className="px-4 py-6 text-sm text-gray-600">Loading…</div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-gray-600">No notifications yet.</div>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {notifications.map((n) => (
                          <li key={n.notification_id}>
                            <button
                              type="button"
                              onClick={() => markReadAndGo(n)}
                              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                                n.read_at ? '' : 'bg-gray-50/60'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                                  <p className="mt-0.5 text-xs text-gray-600">{n.message}</p>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                  {!n.read_at && <span className="h-2 w-2 rounded-full bg-primary-600" aria-hidden />}
                                  <span className="text-[11px] text-gray-500">{formatRelativeTime(n.created_at)}</span>
                                </div>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User info with dropdown */}
            <div className="relative user-menu-container">
              <input
                ref={profilePhotoInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleProfilePhotoSelected}
                className="hidden"
              />
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-3 hover:bg-white/15 rounded-lg px-2.5 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-white">{user?.name || 'User'}</p>
                  <p className="text-xs text-[#f7edf1] capitalize">{user?.userType || 'user'}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white font-semibold overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getUserInitials(user?.name)
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-white transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Dropdown menu */}
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl z-[100] border border-gray-200 overflow-hidden">
                  <div className="py-1">
                    <div className="px-4 py-3 border-b border-gray-200 sm:hidden bg-gradient-to-r from-[#A7816D] to-[#B66681]">
                      <p className="text-sm font-medium text-white">{user?.name || 'User'}</p>
                      <p className="text-xs text-[#f7edf1] capitalize">{user?.userType || 'user'}</p>
                    </div>
                    <button
                      onClick={handleChangeProfilePictureClick}
                      disabled={isUploadingProfilePhoto}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 flex items-center gap-2 transition-colors"
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
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span>{isUploadingProfilePhoto ? 'Uploading picture...' : 'Change Profile Picture'}</span>
                    </button>
                    <button
                      onClick={openChangePasswordModal}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 flex items-center gap-2 transition-colors"
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
                          d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm-7 8a7 7 0 1114 0H5zm11-7h2a2 2 0 012 2v4m-7-6h.01"
                        />
                      </svg>
                      <span>Change Password</span>
                    </button>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
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
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      <span>Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isProfilePhotoModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close change profile picture modal"
            className="absolute inset-0 bg-black/50"
            onClick={closeProfilePhotoModal}
          />
          <div
            className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Change Profile Picture</h3>
              <button
                type="button"
                onClick={closeProfilePhotoModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close profile picture modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex flex-col items-center">
                <p className="text-sm text-gray-500">Current profile picture</p>
                <div className="mt-3 h-24 w-24 rounded-full border-4 border-gray-100 overflow-hidden bg-gray-100 flex items-center justify-center">
                  {pendingProfilePhotoPreviewUrl ? (
                    <img src={pendingProfilePhotoPreviewUrl} alt="Selected profile preview" className="h-full w-full object-cover" />
                  ) : avatarUrl ? (
                    <img src={avatarUrl} alt="Current profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-semibold text-gray-600">{getUserInitials(user?.name)}</span>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <input
                  ref={profilePhotoInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleProfilePhotoSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => profilePhotoInputRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-400 bg-gray-50/50 hover:bg-primary-50/30 px-4 py-8 transition-colors"
                  disabled={isUploadingProfilePhoto}
                >
                  <div className="mx-auto w-11 h-11 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="mt-3 text-sm font-medium text-gray-700">
                    {pendingProfilePhotoFile ? pendingProfilePhotoFile.name : 'Click to upload a new profile picture'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">PNG, JPG, GIF, WEBP up to 10MB</p>
                </button>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeProfilePhotoModal}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium"
                disabled={isUploadingProfilePhoto}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProfilePhotoUpload}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 text-sm font-medium disabled:opacity-60"
                disabled={isUploadingProfilePhoto || !pendingProfilePhotoFile}
              >
                {isUploadingProfilePhoto ? 'Uploading...' : 'Upload photo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close change password modal"
            className="absolute inset-0 bg-black/50"
            onClick={closeChangePasswordModal}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200 p-5 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Change password</h3>
            <p className="mt-1 text-sm text-gray-600">
              This updates your password in Firebase Authentication.
            </p>

            <form onSubmit={handleChangePasswordSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="currentPassword" className="label">Current Password</label>
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordFormChange}
                  className="input-field"
                  disabled={passwordState.isLoading}
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="label">New Password</label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordFormChange}
                  className="input-field"
                  disabled={passwordState.isLoading}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordFormChange}
                  className="input-field"
                  disabled={passwordState.isLoading}
                />
              </div>

              {passwordState.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{passwordState.error}</p>
                </div>
              )}

              {passwordState.success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">{passwordState.success}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeChangePasswordModal}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
                  disabled={passwordState.isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 text-sm font-medium disabled:opacity-60"
                  disabled={passwordState.isLoading}
                >
                  {passwordState.isLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;

