import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

import { fetchFuntalk } from '../../lib/api';

const Users = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phoneNumber: '',
    userType: 'school',
    billingType: '',
    status: 'active',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    setFormData({
      name: '',
      email: '',
      password: '',
      phoneNumber: '',
      userType: 'school',
      billingType: '',
      status: 'active',
    });
    setFormErrors({});
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    
    // If user type changes, clear billing type if not school
    if (name === 'userType' && value !== 'school') {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        billingType: '', // Clear billing type when not school
      }));
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

    if (formData.phoneNumber.trim() && !/^[\d\s\-\+\(\)]+$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.userType) {
      newErrors.userType = 'Please select a user type';
    }

    // Billing type is only required for school user type
    if (formData.userType === 'school' && !formData.billingType) {
      newErrors.billingType = 'Billing type is required';
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
      // Build request body - only include billingType if userType is school
      const requestBody = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        userType: formData.userType,
      };
      
      // Only add phoneNumber if it's provided
      if (formData.phoneNumber && formData.phoneNumber.trim()) {
        requestBody.phoneNumber = formData.phoneNumber.trim();
      }
      
      // Only add billingType if userType is school and billingType is provided
      if (formData.userType === 'school' && formData.billingType) {
        requestBody.billingType = formData.billingType;
      }
      
      const response = await fetchFuntalk('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Registration error:', data);
        
        if (data.errors && Array.isArray(data.errors)) {
          const validationErrors = {};
          data.errors.forEach((error) => {
            // Handle both error formats: { param, msg } and { path, msg }
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

      // Success
      alert('User created successfully!');
      handleModalClose();
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error creating user:', error);
      setFormErrors({
        submit: 'Network error. Please check your connection and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActionClick = (e, userId) => {
    e.stopPropagation();
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    
    setMenuPosition({
      top: rect.bottom + window.scrollY + 1,
      right: window.innerWidth - rect.right + window.scrollX,
    });
    
    setOpenMenuId(openMenuId === userId ? null : userId);
  };

  const fetchUsers = async () => {
    setIsFetching(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.append('userType', roleFilter);
      const qs = params.toString();
      const path = qs ? `/users?${qs}` : '/users';
      const response = await fetchFuntalk(path, {});

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

  // Filter users based on name search
  const filteredUsers = users.filter((u) => {
    const matchesName = !nameSearch || u.name?.toLowerCase().includes(nameSearch.toLowerCase());
    return matchesName;
  });

  // Format user type for display
  const formatUserType = (userType) => {
    if (!userType) return 'N/A';
    return userType.charAt(0).toUpperCase() + userType.slice(1);
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
    if (!window.confirm(`Are you sure you want to delete user "${userName}"?`)) {
      return;
    }

    try {
      const response = await fetchFuntalk(`/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert('User deleted successfully');
        fetchUsers(); // Refresh the list
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
      const response = await fetchFuntalk(`/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
                  onClick={() => setIsModalOpen(true)}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Add New User
                </button>
              </div>


              {/* Users Table */}
              <div className="bg-white rounded-lg shadow">
                {isFetching ? (
                  <div className="p-8 sm:p-10 md:p-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">Loading users...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
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
                    <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-gray-900">No users found</h3>
                    <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                      {nameSearch || roleFilter
                        ? 'Try adjusting your filters'
                        : 'Get started by adding a new user'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-medium text-gray-500 uppercase">NAME</span>
                              <input
                                type="text"
                                placeholder="Search..."
                                value={nameSearch}
                                onChange={(e) => setNameSearch(e.target.value)}
                                className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                              />
                            </div>
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            EMAIL
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                            <select
                              value={roleFilter}
                              onChange={(e) => setRoleFilter(e.target.value)}
                              className="text-xs font-medium text-gray-500 bg-transparent border-0 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                            >
                              <option value="">Role</option>
                              <option value="superadmin">Superadmin</option>
                              <option value="admin">Admin</option>
                              <option value="school">School</option>
                              <option value="teacher">Teacher</option>
                            </select>
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                            Billing Type
                          </th>
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                            Status
                          </th>
                          <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredUsers.map((userItem) => (
                          <tr key={userItem.user_id} className="hover:bg-gray-50">
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className={`flex-shrink-0 h-10 w-10 rounded-full ${getAvatarColor(userItem.name)} flex items-center justify-center text-white font-medium text-sm`}>
                                  {getInitials(userItem.name)}
                                </div>
                                <div className="ml-3 md:ml-4">
                                  <div className="text-sm font-medium text-gray-900">{userItem.name || 'N/A'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{userItem.email || 'N/A'}</div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                {formatUserType(userItem.user_type)}
                              </span>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                              <div className="text-sm text-gray-900">{getBillingType(userItem)}</div>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                              <select
                                value={userItem.status || 'active'}
                                onChange={(e) => handleStatusChange(userItem.user_id, e.target.value)}
                                className={`text-xs font-semibold rounded-full px-2 py-1 border-0 focus:ring-2 focus:ring-primary-500 ${
                                  userItem.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : userItem.status === 'inactive'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="pending">Pending</option>
                              </select>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium hidden md:table-cell">
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
                )}
              </div>

              {/* Results Count */}
              {filteredUsers.length > 0 && (
                <div className="text-xs sm:text-sm text-gray-600">
                  Showing {filteredUsers.length} of {users.length} users
                </div>
              )}

              {/* Action Menu Dropdown - Rendered outside table */}
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
                        const userItem = filteredUsers.find(u => u.user_id === openMenuId);
                        if (userItem) {
                          // TODO: Navigate to edit page or open edit modal
                          alert('Edit functionality coming soon');
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
                </div>
              )}

              {/* Add User Modal - Rendered via Portal to body */}
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
                    className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto mx-4 sm:mx-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 sm:p-5 md:p-6">
                      {/* Modal Header */}
                      <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Add New User</h2>
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
                          <select
                            id="userType"
                            name="userType"
                            value={formData.userType}
                            onChange={handleFormChange}
                            className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                              formErrors.userType ? 'border-red-500' : 'border-gray-300'
                            }`}
                          >
                            <option value="school">School</option>
                            <option value="admin">Admin</option>
                            <option value="superadmin">Superadmin</option>
                            <option value="teacher">Teacher</option>
                          </select>
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
                            <select
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
                            </select>
                            {formErrors.billingType && (
                              <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.billingType}</p>
                            )}
                          </div>
                        )}

                        {/* Password */}
                        <div>
                          <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Password <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="password"
                            name="password"
                            type="password"
                            value={formData.password}
                            onChange={handleFormChange}
                            className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                              formErrors.password ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="Enter password (min 6 characters)"
                          />
                          {formErrors.password && (
                            <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.password}</p>
                          )}
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
                            {isSubmitting ? 'Creating...' : 'Create User'}
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
