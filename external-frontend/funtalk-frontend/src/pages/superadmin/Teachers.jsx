import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

import { fetchFuntalk } from '../../lib/api';

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
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  
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
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (genderFilter) params.append('gender', genderFilter);
      const qs = params.toString();
      const path = qs ? `/teachers?${qs}` : '/teachers';
      const response = await fetchFuntalk(path, {});

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

  // Filter teachers based on name search
  const filteredTeachers = teachers.filter((t) => {
    const matchesName = !nameSearch || t.fullname?.toLowerCase().includes(nameSearch.toLowerCase());
    return matchesName;
  });

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
    
    setMenuPosition({
      top: rect.bottom + window.scrollY + 1,
      right: window.innerWidth - rect.right + window.scrollX,
    });
    
    setOpenMenuId(openMenuId === teacherId ? null : teacherId);
  };

  // Handle status change
  const handleStatusChange = async (teacherId, newStatus) => {
    try {
      const response = await fetchFuntalk(`/teachers/${teacherId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
                ) : filteredTeachers.length === 0 ? (
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
                    <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-gray-900">No teachers found</h3>
                    <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                      {nameSearch || statusFilter || genderFilter
                        ? 'Try adjusting your filters'
                        : 'No teachers registered yet'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-medium text-gray-500 uppercase">Name</span>
                              <input
                                type="text"
                                placeholder="Search..."
                                value={nameSearch}
                                onChange={(e) => setNameSearch(e.target.value)}
                                className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 w-32"
                              />
                            </div>
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                            <select
                              value={genderFilter}
                              onChange={(e) => setGenderFilter(e.target.value)}
                              className="text-xs font-medium text-gray-500 bg-transparent border-0 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                            >
                              <option value="">Gender</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other</option>
                            </select>
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                            Media
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                            <select
                              value={statusFilter}
                              onChange={(e) => setStatusFilter(e.target.value)}
                              className="text-xs font-medium text-gray-500 bg-transparent border-0 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                            >
                              <option value="">Status</option>
                              <option value="active">Active</option>
                              <option value="pending">Pending</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </th>
                          <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredTeachers.map((teacher) => (
                          <tr key={teacher.teacher_id} className="hover:bg-gray-50">
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
                              <div className="text-sm text-gray-900">{teacher.email || 'N/A'}</div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                {formatGender(teacher.gender)}
                              </span>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
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
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                              <select
                                value={teacher.status || 'pending'}
                                onChange={(e) => handleStatusChange(teacher.teacher_id, e.target.value)}
                                className={`text-xs font-semibold rounded-full px-2 py-1 border-0 focus:ring-2 focus:ring-primary-500 ${
                                  teacher.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : teacher.status === 'inactive'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                <option value="active">Active</option>
                                <option value="pending">Pending</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium hidden md:table-cell">
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
                )}
              </div>

              {/* Results Count */}
              {filteredTeachers.length > 0 && (
                <div className="text-xs sm:text-sm text-gray-600">
                  Showing {filteredTeachers.length} of {teachers.length} teachers
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
                        const teacher = filteredTeachers.find(t => t.teacher_id === openMenuId);
                        if (teacher) {
                          alert('Edit functionality coming soon');
                        }
                        setOpenMenuId(null);
                      }}
                      className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Edit Profile
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const teacher = filteredTeachers.find(t => t.teacher_id === openMenuId);
                        if (teacher) {
                          alert('View details functionality coming soon');
                        }
                        setOpenMenuId(null);
                      }}
                      className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100"
                    >
                      View Details
                    </button>
                  </div>
                </div>
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
