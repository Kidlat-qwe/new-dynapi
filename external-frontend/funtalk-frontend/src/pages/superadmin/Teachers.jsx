import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { API_BASE_URL } from '@/config/api.js';
import ResponsiveSelect from '../../components/ResponsiveSelect';
import Pagination from '../../components/Pagination.jsx';
import { computeFixedActionMenuPosition } from '../../utils/actionMenuPosition.js';

const Teachers = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [editFormData, setEditFormData] = useState({
    fullname: '',
    email: '',
    gender: '',
    description: '',
  });
  
  // Media preview modal state
  const [mediaModal, setMediaModal] = useState({
    isOpen: false,
    type: '', // 'image', 'audio', 'video'
    url: '',
    title: '',
  });

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

  // Fetch teachers
  useEffect(() => {
    if (user) {
      fetchTeachers();
    }
  }, [user, statusFilter, genderFilter]);

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
    setIsFetching(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/teachers`;
      const params = new URLSearchParams();
      
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      
      if (genderFilter) {
        params.append('gender', genderFilter);
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
      if (data.success && data.data?.teachers) {
        setTeachers(data.data.teachers);
      } else {
        console.error('Error fetching teachers:', data.message);
        setTeachers([]);
      }
    } catch (error) {
      console.error('Error fetching teachers:', error);
      setTeachers([]);
    } finally {
      setIsFetching(false);
    }
  };

  const searchQuery = nameSearch.trim().toLowerCase();

  const filteredTeachers = teachers.filter((t) => {
    if (!searchQuery) return true;
    const name = String(t.fullname || '').toLowerCase();
    const email = String(t.email || '').toLowerCase();
    return name.includes(searchQuery) || email.includes(searchQuery);
  });

  const noMatchesWithData = teachers.length > 0 && filteredTeachers.length === 0;
  const emptyListNoFilters =
    teachers.length === 0 && !statusFilter && !genderFilter && !nameSearch.trim();

  useEffect(() => {
    setPage(1);
  }, [nameSearch, statusFilter, genderFilter]);

  const pageSize = 10;
  const pagedTeachers = filteredTeachers.slice((page - 1) * pageSize, page * pageSize);

  // Format gender for display
  const formatGender = (gender) => {
    if (!gender) return 'N/A';
    return gender.charAt(0).toUpperCase() + gender.slice(1);
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

  // Handle action menu
  const handleActionClick = (e, teacherId) => {
    e.stopPropagation();
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    // Keep menu near trigger and in-viewport on mobile/desktop.
    const pos = computeFixedActionMenuPosition({
      rect,
      menuWidth: 192, // w-40 / w-48
      menuHeight: 170,
      gap: 6,
    });
    setMenuPosition(pos);
    
    setOpenMenuId(openMenuId === teacherId ? null : teacherId);
  };

  // Handle status change
  const handleStatusChange = async (teacherId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/teachers/${teacherId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        fetchTeachers(); // Refresh the list
      } else {
        alert(data.message || 'Error updating teacher status');
      }
    } catch (error) {
      console.error('Error updating teacher status:', error);
      alert('Error updating teacher status. Please try again.');
    }
  };

  const fetchTeacherDetails = async (teacherId) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/teachers/${teacherId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok || !data.success || !data.data?.teacher) {
      throw new Error(data.message || 'Unable to fetch teacher details');
    }
    return data.data.teacher;
  };

  const openTeacherDetails = async (teacherId) => {
    setOpenMenuId(null);
    setIsDetailsModalOpen(true);
    setIsDetailsLoading(true);
    setSelectedTeacher(null);
    try {
      const teacher = await fetchTeacherDetails(teacherId);
      setSelectedTeacher(teacher);
    } catch (error) {
      console.error('Error fetching teacher details:', error);
      alert(error.message || 'Error loading teacher details');
      setIsDetailsModalOpen(false);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const openEditTeacher = async (teacherId) => {
    setOpenMenuId(null);
    setIsEditModalOpen(true);
    setIsEditSubmitting(false);
    setEditError('');
    setEditingTeacherId(teacherId);
    try {
      const teacher = await fetchTeacherDetails(teacherId);
      setSelectedTeacher(teacher);
      setEditFormData({
        fullname: teacher.fullname || '',
        email: teacher.email || '',
        gender: teacher.gender || '',
        description: teacher.description || '',
      });
    } catch (error) {
      console.error('Error loading teacher for edit:', error);
      alert(error.message || 'Error loading teacher profile');
      setIsEditModalOpen(false);
      setEditingTeacherId(null);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingTeacherId) return;

    const fullname = editFormData.fullname.trim();
    const email = editFormData.email.trim().toLowerCase();
    if (!fullname || !email) {
      setEditError('Full name and email are required.');
      return;
    }

    setIsEditSubmitting(true);
    setEditError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/teachers/${editingTeacherId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullname,
          email,
          gender: editFormData.gender || null,
          description: editFormData.description.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setEditError(data.message || 'Error updating teacher profile');
        return;
      }

      setIsEditModalOpen(false);
      setEditingTeacherId(null);
      setSelectedTeacher(null);
      await fetchTeachers();
    } catch (error) {
      console.error('Error updating teacher:', error);
      setEditError('Network error. Please try again.');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Open media modal
  const openMediaModal = (type, url, title) => {
    if (!url) {
      alert('Media not available');
      return;
    }
    setMediaModal({
      isOpen: true,
      type,
      url,
      title,
    });
  };

  // Close media modal
  const closeMediaModal = () => {
    setMediaModal({
      isOpen: false,
      type: '',
      url: '',
      title: '',
    });
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
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Teachers</h1>
                  <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">Manage all teachers and their profiles</p>
                </div>
              </div>

              {/* Teachers Table */}
              <div className="bg-white rounded-lg shadow">
                {isFetching ? (
                  <div className="p-8 sm:p-10 md:p-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">Loading teachers...</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 px-4 py-3 sm:px-6 border-b border-gray-200 bg-gray-50/90">
                      <div className="flex flex-col min-w-0 flex-1 sm:max-w-md">
                        <input
                          id="teachers-search"
                          type="search"
                          aria-label="Search teachers"
                          placeholder="Search by name or email"
                          value={nameSearch}
                          onChange={(e) => setNameSearch(e.target.value)}
                          autoComplete="off"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div className="flex flex-col w-full sm:w-auto sm:min-w-[9rem]">
                        <ResponsiveSelect
                          id="teachers-gender-filter"
                          aria-label="Filter teachers by gender"
                          value={genderFilter}
                          onChange={(e) => setGenderFilter(e.target.value)}
                          className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                        >
                          <option value="">All genders</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </ResponsiveSelect>
                      </div>
                      <div className="flex flex-col w-full sm:w-auto sm:min-w-[9rem]">
                        <ResponsiveSelect
                          id="teachers-status-filter"
                          aria-label="Filter teachers by status"
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                        >
                          <option value="">All statuses</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </ResponsiveSelect>
                      </div>
                    </div>
                    {filteredTeachers.length === 0 ? (
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
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-gray-900">
                      {noMatchesWithData
                        ? 'No matching teachers'
                        : teachers.length === 0 && (statusFilter || genderFilter)
                          ? 'No teachers for these filters'
                          : 'No teachers yet'}
                    </h3>
                    <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                      {noMatchesWithData
                        ? 'Try a different name, email, or clear the search.'
                        : emptyListNoFilters
                          ? 'Teachers will appear here once they are registered.'
                          : teachers.length === 0 && (statusFilter || genderFilter)
                            ? 'Change gender or status, or clear filters to see all teachers.'
                            : 'Try adjusting your search or filters.'}
                    </p>
                  </div>
                ) : (
                  <>
                  <div className="overflow-x-auto rounded-b-xl">
                    <table className="min-w-[980px] w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Name
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Email
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Gender
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Media
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
                        {pagedTeachers.map((teacher) => (
                          <tr key={teacher.teacher_id} className="group hover:bg-gray-50">
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {teacher.profile_picture ? (
                                  <img
                                    src={teacher.profile_picture}
                                    alt={teacher.fullname}
                                    className="flex-shrink-0 h-10 w-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition"
                                    onClick={() => openMediaModal('image', teacher.profile_picture, teacher.fullname)}
                                  />
                                ) : (
                                  <div className={`flex-shrink-0 h-10 w-10 rounded-full ${getAvatarColor(teacher.fullname)} flex items-center justify-center text-white font-medium text-sm`}>
                                    {getInitials(teacher.fullname)}
                                  </div>
                                )}
                                <div className="ml-3 md:ml-4">
                                  <div className="text-sm font-medium text-gray-900">{teacher.fullname || 'N/A'}</div>
                                  {teacher.description && (
                                    <div className="text-xs text-gray-500 truncate max-w-xs hidden lg:block">
                                      {teacher.description.substring(0, 50)}...
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <div className="max-w-[11rem] text-sm text-gray-900 break-all sm:max-w-none sm:break-normal" title={teacher.email || ''}>
                                {teacher.email || 'N/A'}
                              </div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                {formatGender(teacher.gender)}
                              </span>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                {/* Audio Icon */}
                                <button
                                  onClick={() => openMediaModal('audio', teacher.audio_intro, `${teacher.fullname} - Audio Introduction`)}
                                  disabled={!teacher.audio_intro}
                                  className={`p-1 rounded ${
                                    teacher.audio_intro
                                      ? 'text-blue-600 hover:bg-blue-50 cursor-pointer'
                                      : 'text-gray-300 cursor-not-allowed'
                                  }`}
                                  title={teacher.audio_intro ? 'Play audio introduction' : 'No audio available'}
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                  </svg>
                                </button>
                                
                                {/* Video Icon */}
                                <button
                                  onClick={() => openMediaModal('video', teacher.video_intro, `${teacher.fullname} - Video Introduction`)}
                                  disabled={!teacher.video_intro}
                                  className={`p-1 rounded ${
                                    teacher.video_intro
                                      ? 'text-purple-600 hover:bg-purple-50 cursor-pointer'
                                      : 'text-gray-300 cursor-not-allowed'
                                  }`}
                                  title={teacher.video_intro ? 'Play video introduction' : 'No video available'}
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>

                                {/* Docs Icon */}
                                {teacher.docs && (
                                  <button
                                    className="p-1 rounded text-green-600 hover:bg-green-50 cursor-pointer"
                                    title="Documents available"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <ResponsiveSelect
                                value={teacher.status === 'inactive' ? 'inactive' : 'active'}
                                onChange={(e) => handleStatusChange(teacher.teacher_id, e.target.value)}
                                className={`text-xs font-semibold rounded-full px-2 py-1 border-0 focus:ring-2 focus:ring-primary-500 ${
                                  teacher.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : teacher.status === 'inactive'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-green-100 text-green-800'
                                }`}
                                aria-label="Teacher status"
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </ResponsiveSelect>
                            </td>
                            <td className="sticky right-0 z-[1] bg-white px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.06)] group-hover:bg-gray-50">
                              <div className="flex justify-end">
                                <button
                                  onClick={(e) => handleActionClick(e, teacher.teacher_id)}
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
                    <Pagination totalItems={filteredTeachers.length} pageSize={pageSize} currentPage={page} onPageChange={setPage} />
                  </div>
                  </>
                    )}
                  </>
                )}
              </div>

              {/* Results Count */}
              {filteredTeachers.length > 0 && (
                <div className="text-xs sm:text-sm text-gray-600">
                  Showing {filteredTeachers.length} of {teachers.length} teachers
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
                        openEditTeacher(openMenuId);
                      }}
                      className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Edit Profile
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openTeacherDetails(openMenuId);
                      }}
                      className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100"
                    >
                      View Details
                    </button>
                  </div>
                </div>,
                document.body
              )}

              {/* Teacher Details Modal */}
              {isDetailsModalOpen && createPortal(
                <div
                  className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setIsDetailsModalOpen(false);
                      setSelectedTeacher(null);
                    }
                  }}
                >
                  <div
                    className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900">Teacher Details</h2>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDetailsModalOpen(false);
                          setSelectedTeacher(null);
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Close teacher details modal"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="p-4 sm:p-6">
                      {isDetailsLoading ? (
                        <div className="py-8 text-center text-sm text-gray-600">Loading teacher details...</div>
                      ) : selectedTeacher ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs uppercase text-gray-500">Full name</p>
                            <p className="text-sm text-gray-900">{selectedTeacher.fullname || 'N/A'}</p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs uppercase text-gray-500">Email</p>
                              <p className="text-sm text-gray-900 break-all">{selectedTeacher.email || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-gray-500">Gender</p>
                              <p className="text-sm text-gray-900">{formatGender(selectedTeacher.gender)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-gray-500">Status</p>
                              <p className="text-sm text-gray-900">{selectedTeacher.status || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-gray-500">Phone number</p>
                              <p className="text-sm text-gray-900">{selectedTeacher.phone_number || 'N/A'}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs uppercase text-gray-500">Description</p>
                            <p className="text-sm text-gray-900 whitespace-pre-wrap">
                              {selectedTeacher.description || 'No description provided.'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-sm text-gray-600">No teacher details found.</div>
                      )}
                    </div>
                  </div>
                </div>,
                document.body
              )}

              {/* Edit Teacher Modal */}
              {isEditModalOpen && createPortal(
                <div
                  className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setIsEditModalOpen(false);
                      setEditingTeacherId(null);
                      setEditError('');
                    }
                  }}
                >
                  <div
                    className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900">Edit Teacher Profile</h2>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditModalOpen(false);
                          setEditingTeacherId(null);
                          setEditError('');
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Close edit teacher modal"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <form onSubmit={handleEditSubmit} className="p-4 sm:p-6 space-y-4">
                      <div>
                        <label htmlFor="edit-fullname" className="block text-sm font-medium text-gray-700 mb-1">
                          Full name
                        </label>
                        <input
                          id="edit-fullname"
                          name="fullname"
                          type="text"
                          value={editFormData.fullname}
                          onChange={handleEditChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <input
                          id="edit-email"
                          name="email"
                          type="email"
                          value={editFormData.email}
                          onChange={handleEditChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-gender" className="block text-sm font-medium text-gray-700 mb-1">
                          Gender
                        </label>
                        <ResponsiveSelect
                          id="edit-gender"
                          name="gender"
                          value={editFormData.gender}
                          onChange={handleEditChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                          aria-label="Gender"
                        >
                          <option value="">Not specified</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </ResponsiveSelect>
                      </div>
                      <div>
                        <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          id="edit-description"
                          name="description"
                          rows={4}
                          value={editFormData.description}
                          onChange={handleEditChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      {editError && (
                        <p className="text-sm text-red-600">{editError}</p>
                      )}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditModalOpen(false);
                            setEditingTeacherId(null);
                            setEditError('');
                          }}
                          className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isEditSubmitting}
                          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {isEditSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>,
                document.body
              )}

              {/* Media Preview Modal */}
              {mediaModal.isOpen && createPortal(
                <div 
                  className="fixed bg-black bg-opacity-75 flex items-center justify-center p-4" 
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
                      closeMediaModal();
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
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{mediaModal.title}</h2>
                        <button
                          onClick={closeMediaModal}
                          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                        >
                          <svg
                            className="w-6 h-6"
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

                      {/* Modal Content */}
                      <div className="w-full">
                        {mediaModal.type === 'image' && (
                          <img
                            src={mediaModal.url}
                            alt={mediaModal.title}
                            className="w-full h-auto max-h-[70vh] object-contain rounded"
                          />
                        )}
                        
                        {mediaModal.type === 'audio' && (
                          <div className="flex flex-col items-center py-8">
                            <svg className="w-24 h-24 text-blue-500 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                            <audio
                              controls
                              className="w-full max-w-md"
                              autoPlay
                            >
                              <source src={mediaModal.url} type="audio/mpeg" />
                              <source src={mediaModal.url} type="audio/ogg" />
                              <source src={mediaModal.url} type="audio/wav" />
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        )}
                        
                        {mediaModal.type === 'video' && (
                          <video
                            controls
                            className="w-full h-auto max-h-[70vh] rounded"
                            autoPlay
                          >
                            <source src={mediaModal.url} type="video/mp4" />
                            <source src={mediaModal.url} type="video/webm" />
                            <source src={mediaModal.url} type="video/ogg" />
                            Your browser does not support the video element.
                          </video>
                        )}
                      </div>
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

export default Teachers;
