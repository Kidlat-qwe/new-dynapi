import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { createUserWithEmail, createUserWithEmailVerification } from './firebase';
import Pagination from './components/Pagination';
import { gradingUrl, getAuthHeader } from './lib/api';

const ManageUser = () => {
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    fname: '',
    mname: '',
    lname: '',
    gender: '',
    user_type: '',
    email: '',
    confirmEmail: '',
    lrn: ''
  });
  const [editFormData, setEditFormData] = useState({
    fname: '',
    mname: '',
    lname: '',
    gender: '',
    user_type: '',
    email: '',
    lrn: ''
  });
  const [defaultPassword, setDefaultPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [showNoLrnOnly, setShowNoLrnOnly] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  // Set default password based on user type
  useEffect(() => {
    if (formData.user_type) {
      let password = '';
      
      switch(formData.user_type) {
        case 'teacher':
          password = 'Te@cher-1234';
          break;
        case 'student':
          password = '$tudent-1234';
          break;
        case 'admin':
          password = '@dmin-1234';
          break;
        default:
          password = '';
      }
      
      setDefaultPassword(password);
    } else {
      setDefaultPassword('');
    }
  }, [formData.user_type]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(gradingUrl('/users'), { headers: getAuthHeader() });
      setUsers(response.data.users || response.data); // support both array and {users: []}
      setError(null);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    try {
      // Validate required fields
      if (!formData.fname || !formData.lname || !formData.gender || !formData.user_type || !formData.email) {
        throw new Error('Please fill in all required fields');
      }
      
      // Check if emails match
      if (formData.email !== formData.confirmEmail) {
        throw new Error('Email addresses do not match. Please check and try again.');
      }
      
      // Show confirmation dialog instead of immediately submitting
      setShowConfirmation(true);
      
    } catch (error) {
      console.error('Validation error:', error);
      setError(error.message || 'Please check your input and try again.');
    }
  };
  
  const openAddModal = () => {
    setSuccessMessage('');
    setError(null);
    setIsModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage('');
    
    try {
      console.log(`Creating user with email: ${formData.email}`);
      
      // First create the user in backend
      const userData = {
        email: formData.email,
        fname: formData.fname,
        mname: formData.mname || null,
        lname: formData.lname,
        gender: formData.gender,
        user_type: formData.user_type,
        // Set teacher_status based on user_type
        teacher_status: formData.user_type === 'teacher' ? true : null,
        lrn: formData.user_type === 'student' ? formData.lrn : null
      };
      
      console.log('Sending user data to backend:', userData);
      
      const response = await axios.post(gradingUrl('/users'), userData, { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } });
      console.log('Database user created successfully:', response.data);
      
      // Now create the user in Firebase
      const firebaseResult = await createUserWithEmail(formData.email, defaultPassword);
      
      if (!firebaseResult.success) {
        throw new Error(`Firebase error: ${firebaseResult.error}`);
      }
      
      console.log('Firebase user created successfully:', firebaseResult.user.uid);
      
      // Update backend user with firebase_uid
      if (firebaseResult.user && firebaseResult.user.uid && response.data && response.data.user_id) {
        try {
          await axios.put(gradingUrl(`/users/${response.data.user_id}`), {
            ...userData,
            firebase_uid: firebaseResult.user.uid
          }, { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } });
        } catch (err) {
          console.error('Failed to update backend with firebase_uid:', err);
        }
      }
      
      // Reset form and close modal immediately
      setFormData({
        fname: '',
        mname: '',
        lname: '',
        gender: '',
        user_type: '',
        email: '',
        confirmEmail: '',
        lrn: ''
      });
      setShowConfirmation(false);
      setIsModalOpen(false);
      
      // Fetch updated users list
      fetchUsers();
      
    } catch (error) {
      console.error('Error creating user:', error);
      
      // Try to provide a more user-friendly error message
      let errorMessage = 'Failed to create user. Please try again.';
      
      if (error.message && error.message.includes('Firebase')) {
        if (error.message.includes('email-already-in-use')) {
          errorMessage = 'This email is already registered in Firebase. Please use a different email address.';
        } else if (error.message.includes('invalid-email')) {
          errorMessage = 'The email address is not valid. Please check and try again.';
        } else {
          errorMessage = 'Firebase authentication error. Please try again with a different email.';
        }
      } else if (error.response && error.response.data) {
        errorMessage = error.response.data.error || errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      setShowConfirmation(false);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (user) => {
    setSuccessMessage('');
    setError(null);
    setSelectedUser(user);
    setEditFormData({
      fname: user.fname || '',
      mname: user.mname || '',
      lname: user.lname || '',
      gender: user.gender || '',
      user_type: user.user_type || '',
      email: user.email || '',
      lrn: user.lrn || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage('');

    try {
      // Validate required fields
      if (!editFormData.fname || !editFormData.lname || !editFormData.gender || !editFormData.user_type) {
        throw new Error('Please fill in all required fields');
      }
      
      const userData = {
        email: selectedUser.email, // Use the original email instead of editFormData.email
        fname: editFormData.fname,
        mname: editFormData.mname || null,
        lname: editFormData.lname,
        gender: editFormData.gender,
        user_type: editFormData.user_type,
        // Update the teacher_status based on user_type
        teacher_status: editFormData.user_type === 'teacher' ? true : null,
        lrn: editFormData.user_type === 'student' ? editFormData.lrn : null
      };
      
      // Send update request to the backend
      const response = await axios.put(gradingUrl(`/users/${selectedUser.user_id}`), userData, { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } });
      
      // Update the users list
      await fetchUsers();
      
      // Show success message
      setSuccessMessage("User updated successfully.");
      
      // Close modal after a delay
      setTimeout(() => {
        setIsEditModalOpen(false);
        setSelectedUser(null);
        setSuccessMessage('');
      }, 3000);
      
    } catch (error) {
      console.error('Error updating user:', error);
      setError(
        error.response?.data?.message || 
        error.response?.data?.error || 
        error.message || 
        'Failed to update user. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Add useEffect to reset currentPage to 1 when searchQuery, userTypeFilter, or showNoLrnOnly changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, userTypeFilter, showNoLrnOnly]);

  // Filter users based on user type, search, and No LRN filter
  const filteredUsers = users.filter(user => {
    // User type filter
    const typeMatch = userTypeFilter === 'all' || user.user_type === userTypeFilter;
    // Name search (first, middle, last)
    const name = `${user.fname || ''} ${user.mname || ''} ${user.lname || ''}`.toLowerCase();
    const searchMatch = name.includes(searchQuery.toLowerCase());
    // No LRN filter
    const noLrnMatch = !showNoLrnOnly || (user.user_type === 'student' && (!user.lrn || user.lrn.trim() === ''));
    return typeMatch && searchMatch && noLrnMatch;
  });

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  // Ensure currentPage is always valid
  useEffect(() => {
    if (totalPages < 1) {
      if (currentPage !== 1) setCurrentPage(1);
    } else if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
    // Do NOT check for currentPage < 1 here, since we always reset to 1 on filter/search change
  }, [totalPages]);

  // In the confirmation modal, after successMessage is set, automatically close the modal after 2 seconds
  useEffect(() => {
    if (showConfirmation && successMessage) {
      const timer = setTimeout(() => {
        setIsModalOpen(false);
        setShowConfirmation(false);
        setSuccessMessage('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showConfirmation, successMessage]);

  return (
    <div className="content-container bg-[#F3F3F6]">
      <div className="p-8">
        {/* Add User button moved to top right */}
        <div className="flex justify-end mb-6">
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-[#526D82] text-white rounded-md font-medium
              hover:bg-[#3E5367] transition-colors duration-200"
          >
            + ADD USER
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#526D82]">
                <th className="py-4 px-6 text-left text-white font-medium text-sm w-[8%]">User ID</th>
                <th className="py-4 px-6 text-left text-white font-medium w-[18%]">
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="p-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#526D82] focus:border-[#526D82] w-full text-gray-800 bg-white shadow-sm text-sm"
                  />
                </th>
                <th className="py-4 px-6 text-left text-white font-medium w-[5%]">Gender</th>
                <th className="py-4 px-6 text-left text-white font-medium w-[18%]">Email</th>
                <th className="py-4 px-6 text-left text-white font-medium w-[12%]">
                  <select
                    id="userTypeFilter"
                    value={userTypeFilter}
                    onChange={e => setUserTypeFilter(e.target.value)}
                    className="p-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#526D82] focus:border-[#526D82] w-full text-gray-800 bg-white shadow-sm text-sm"
                  >
                    <option value="all">All Types</option>
                    <option value="admin">Admin</option>
                    <option value="teacher">Teacher</option>
                    <option value="student">Student</option>
                  </select>
                </th>
                <th className="py-4 px-6 text-left text-white font-medium w-[12%]">
                  <button
                    onClick={() => setShowNoLrnOnly(v => !v)}
                    className={`px-3 py-1 border rounded-full text-xs transition-colors duration-150 ${showNoLrnOnly ? 'border-[#526D82] bg-[#526D82] text-white' : 'border-gray-300 text-[#526D82] bg-white hover:bg-gray-100'}`}
                    title="Show students without LRN"
                  >
                    {showNoLrnOnly ? 'Show All' : 'No LRN'}
                  </button>
                </th>
                <th className="py-4 px-6 text-left text-white font-medium text-sm w-[10%]">
                  Last Logged In
                </th>
                <th className="py-4 px-6 text-center text-white font-medium w-[15%]">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user, index) => (
                  <tr 
                    key={user.user_id}
                    className={`border-t border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                  >
                    <td className="py-4 px-6 text-gray-800">{user.user_id}</td>
                    <td className="py-4 px-6 text-gray-800 truncate max-w-0" title={`${user.fname || ''} ${user.mname || ''} ${user.lname || ''}`.trim()}>
                      {`${user.fname || ''} ${user.mname || ''} ${user.lname || ''}`.trim()}
                    </td>
                    <td className="py-4 px-6 text-gray-800">
                      {user.gender === 'M' ? 'Male' : user.gender === 'F' ? 'Female' : user.gender}
                    </td>
                    <td className="py-4 px-6 text-gray-800 truncate max-w-0" title={user.email}>
                      {user.email}
                    </td>
                    <td className="py-4 px-6 text-gray-800">{user.user_type}</td>
                    <td className="py-4 px-6 text-gray-800">
                      {user.user_type === 'student' ? (user.lrn || '-') : '-'}
                    </td>
                    <td className="py-4 px-6 text-gray-800">
                      {user.last_logged_in ? new Date(user.last_logged_in).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : '-'}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button 
                        onClick={() => handleEditClick(user)}
                        className="px-4 py-1.5 text-[#526D82] border border-[#526D82] rounded-md
                          hover:bg-[#526D82] hover:text-white transition-colors duration-200"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {/* Add Pagination Component */}
          {filteredUsers.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>

        {/* Add User Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => {
              if (!showConfirmation) {
                setIsModalOpen(false);
              }
            }}></div>
            <div className="bg-white rounded-lg p-6 w-[500px] max-w-full relative z-50">
              {successMessage && (
                <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-md flex items-center justify-between">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="text-green-800 font-medium text-sm">Success!</h4>
                      <p className="text-green-700 text-sm">{successMessage}</p>
                      <p className="text-green-700 text-sm mt-1">
                        User will need to verify their email before logging in.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-md flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Error
                    </h3>
                    <div className="mt-1 text-sm text-red-700">
                      {error.includes('Firebase') ? (
                        <span>
                          This email is already registered. Please use a different email address.
                        </span>
                      ) : (
                        error
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => setError(null)} 
                    className="ml-auto pl-3 text-red-500 hover:text-red-800"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}
              
              {!showConfirmation ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Personal Information Section */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600">First Name</label>
                      <input
                        type="text"
                        name="fname"
                        value={formData.fname}
                        onChange={handleInputChange}
                        className="mt-1 w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-[#526D82] focus:border-[#526D82]"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Middle Name</label>
                      <input
                        type="text"
                        name="mname"
                        value={formData.mname}
                        onChange={handleInputChange}
                        className="mt-1 w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-[#526D82] focus:border-[#526D82]"
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Last Name</label>
                      <input
                        type="text"
                        name="lname"
                        value={formData.lname}
                        onChange={handleInputChange}
                        className="mt-1 w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-[#526D82] focus:border-[#526D82]"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Gender</label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleInputChange}
                        className="mt-1 w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-[#526D82] focus:border-[#526D82] bg-white"
                        required
                      >
                        <option value="">Select Gender</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                    </div>
                  </div>

                  {/* User Type and Password Section */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600">User Type</label>
                      <select
                        name="user_type"
                        value={formData.user_type}
                        onChange={handleInputChange}
                        className="mt-1 w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-[#526D82] focus:border-[#526D82] bg-white"
                        required
                      >
                        <option value="">Select User Type</option>
                        <option value="admin">Admin</option>
                        <option value="teacher">Teacher</option>
                        <option value="student">Student</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Default Password</label>
                      <input
                        type="text"
                        value={defaultPassword}
                        readOnly
                        className="mt-1 w-full px-3 py-1.5 text-sm border rounded-md bg-gray-50 text-gray-600 font-mono"
                      />
                    </div>
                  </div>

                  {/* LRN Field */}
                  {formData.user_type === 'student' && (
                    <div>
                      <label className="text-xs font-medium text-gray-600">LRN</label>
                      <input
                        type="text"
                        name="lrn"
                        value={formData.lrn}
                        onChange={handleInputChange}
                        className="mt-1 w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-[#526D82] focus:border-[#526D82]"
                        maxLength={30}
                      />
                    </div>
                  )}

                  {/* Email Fields */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="mt-1 w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-[#526D82] focus:border-[#526D82]"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Confirm Email</label>
                      <input
                        type="email"
                        name="confirmEmail"
                        value={formData.confirmEmail}
                        onChange={handleInputChange}
                        className={`mt-1 w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-[#526D82] focus:border-[#526D82] ${
                          formData.email && formData.confirmEmail && formData.email !== formData.confirmEmail 
                          ? 'border-red-500 bg-red-50' 
                          : ''
                        }`}
                        required
                      />
                      {formData.email && formData.confirmEmail && formData.email !== formData.confirmEmail && (
                        <p className="text-xs text-red-500 mt-1">Emails do not match</p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors duration-200"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-3 py-1.5 text-sm bg-[#526D82] text-white rounded-md hover:bg-[#3E5367] transition-colors duration-200 disabled:bg-gray-400"
                    >
                      {loading ? 'Checking...' : 'Next'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <h4 className="text-lg font-medium text-gray-700 mb-3">Please confirm the user information:</h4>
                  <div className="bg-gray-50 p-4 rounded-md border mb-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-600">First Name:</p>
                        <p className="text-gray-800">{formData.fname}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600">Middle Name:</p>
                        <p className="text-gray-800">{formData.mname || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600">Last Name:</p>
                        <p className="text-gray-800">{formData.lname}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600">Gender:</p>
                        <p className="text-gray-800">{formData.gender === 'M' ? 'Male' : 'Female'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600">User Type:</p>
                        <p className="text-gray-800 capitalize">{formData.user_type}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600">Email:</p>
                        <p className="text-gray-800">{formData.email}</p>
                      </div>
                      {formData.user_type === 'student' && (
                        <div>
                          <p className="text-sm font-semibold text-gray-600">LRN:</p>
                          <p className="text-gray-800">{formData.lrn}</p>
                        </div>
                      )}
                      <div className={formData.user_type === 'student' ? "col-span-1" : "col-span-2"}>
                        <p className="text-sm font-semibold text-gray-600">Default Password:</p>
                        <p className="text-gray-800 font-mono">{defaultPassword}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => setShowConfirmation(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors duration-200"
                          disabled={loading}
                    >
                      Edit Information
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSubmit}
                      disabled={loading}
                          className="px-4 py-2 bg-[#526D82] text-white rounded hover:bg-[#3E5367] transition-colors duration-200 disabled:bg-gray-400 flex items-center justify-center"
                        >
                          {loading ? (
                            <>
                              <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              Creating User...
                            </>
                          ) : 'Confirm & Create User'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {isEditModalOpen && selectedUser && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}></div>
            <div className="bg-white rounded-lg p-6 w-[500px] max-w-full relative z-50">
              <h3 className="text-xl text-[#526D82] font-semibold mb-4">Edit User</h3>
              
              {successMessage && (
                <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-md flex items-center justify-between">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="text-green-800 font-medium text-sm">Success!</h4>
                      <p className="text-green-700 text-sm">{successMessage}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-md flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Error
                    </h3>
                    <div className="mt-1 text-sm text-red-700">
                      {error}
                    </div>
                  </div>
                  <button 
                    onClick={() => setError(null)} 
                    className="ml-auto pl-3 text-red-500 hover:text-red-800"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}
              
              <form onSubmit={handleEditSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* First Name */}
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1">First Name:</label>
                    <input
                      type="text"
                      name="fname"
                      value={editFormData.fname}
                      onChange={handleEditInputChange}
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                    />
                  </div>
                  
                  {/* Middle Name */}
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1">Middle Name: (Optional)</label>
                    <input
                      type="text"
                      name="mname"
                      value={editFormData.mname}
                      onChange={handleEditInputChange}
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                    />
                  </div>
                  
                  {/* Last Name */}
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1">Last Name:</label>
                    <input
                      type="text"
                      name="lname"
                      value={editFormData.lname}
                      onChange={handleEditInputChange}
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                    />
                  </div>
                  
                  {/* Gender */}
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1">Gender:</label>
                    <select
                      name="gender"
                      value={editFormData.gender}
                      onChange={handleEditInputChange}
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                    >
                      <option value="">Select Gender</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </div>
                  
                  {/* User Type */}
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1">User Type:</label>
                    <select
                      name="user_type"
                      value={editFormData.user_type}
                      onChange={handleEditInputChange}
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                    >
                      <option value="">Select User Type</option>
                      <option value="admin">Admin</option>
                      <option value="teacher">Teacher</option>
                      <option value="student">Student</option>
                    </select>
                  </div>
                  
                  {/* LRN - Only show for Students */}
                  {editFormData.user_type === 'student' && (
                    <div>
                      <label className="block text-gray-700 text-sm font-medium mb-1">
                        LRN:
                      </label>
                      <input
                        type="text"
                        name="lrn"
                        value={editFormData.lrn}
                        onChange={handleEditInputChange}
                        className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                        maxLength={30}
                      />
                    </div>
                  )}
                  
                  {/* Email - Read Only */}
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1">
                      Email: <span className="text-xs text-gray-500">(cannot be changed)</span>
                    </label>
                    <div className="w-full p-2 border bg-gray-100 rounded text-gray-700">
                      {selectedUser.email}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setSelectedUser(null);
                      setError(null);
                      setSuccessMessage('');
                    }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-[#526D82] text-white rounded hover:bg-[#3E5367] transition-colors duration-200 disabled:bg-gray-400"
                  >
                    {loading ? 'Updating...' : 'Update User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageUser;
