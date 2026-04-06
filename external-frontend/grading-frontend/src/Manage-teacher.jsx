import React, { useState, useEffect } from 'react';
import Pagination from './components/Pagination';
import { fetchGrading } from './lib/api';

const ManageTeacher = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    teacherId: '',
    fname: '',
    mname: '',
    lname: '',
    gender: '',
    status: 'ACTIVE'
  });
  // Add search query state
  const [searchQuery, setSearchQuery] = useState('');
  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  // Track which dropdown is currently open
  const [openDropdownId, setOpenDropdownId] = useState(null);
  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    teacher: null,
    newStatus: ''
  });

  const fetchTeachers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchGrading('/api/teachers');
      if (!response.ok) {
        throw new Error('Failed to fetch teachers');
      }
      const data = await response.json();
      // Map the boolean teacher_status to string status values
      const teachersWithStatus = data.map(teacher => ({
        ...teacher,
        status: teacher.teacher_status ? 'ACTIVE' : 'INACTIVE'
      }));
      setTeachers(teachersWithStatus);
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdownId(null);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Add useEffect to reset currentPage to 1 when searchQuery changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const getFullName = (teacher) => {
    return `${teacher.fname} ${teacher.mname || ''} ${teacher.lname}`.trim();
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
    try {
      // Create a random password for new teachers (they can reset it later)
      const tempPassword = Math.random().toString(36).slice(-8);
      
      const response = await fetchGrading('/api/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          fname: formData.fname,
          mname: formData.mname,
          lname: formData.lname,
          gender: formData.gender,
          email: formData.teacherId + '@school.edu', // Generate an email from the teacher ID
          password: tempPassword
          // No need to specify teacher_status as the backend will set it to true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add teacher');
      }

      await fetchTeachers();
      setIsModalOpen(false);
      setFormData({ 
        teacherId: '', 
        fname: '', 
        mname: '', 
        lname: '', 
        gender: '',
        status: 'ACTIVE'
      });
    } catch (error) {
      console.error('Error adding teacher:', error);
      setError('Failed to add teacher. Please try again.');
    }
  };

  // Show confirmation modal before changing status
  const showStatusConfirmation = (teacher, newStatus) => {
    setConfirmModal({
      isOpen: true,
      teacher,
      newStatus
    });
    // Close the dropdown
    setOpenDropdownId(null);
  };

  // Handle actual status change after confirmation
  const handleStatusChange = async () => {
    const { teacher, newStatus } = confirmModal;
    
    try {
      const response = await fetchGrading(`/api/teachers/${teacher.user_id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        // Convert string status to boolean
        body: JSON.stringify({ status: newStatus === 'ACTIVE' }),
      });

      if (!response.ok) {
        throw new Error('Failed to update teacher status');
      }

      fetchTeachers();
      setConfirmModal({ isOpen: false, teacher: null, newStatus: '' });
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to update teacher status');
      setConfirmModal({ isOpen: false, teacher: null, newStatus: '' });
    }
  };

  const toggleDropdown = (e, teacherId) => {
    e.stopPropagation(); // Prevent the document click handler from firing
    setOpenDropdownId(openDropdownId === teacherId ? null : teacherId);
  };

  // Update the getDropdownPosition function to be more intelligent
  const getDropdownPosition = (index, totalTeachers) => {
    // If it's one of the last rows, show dropdown above
    // Otherwise show it below
    return index >= totalTeachers - 1 ? 'bottom-full mb-2' : 'top-full mt-2';
  };

  // Add filtering logic for search
  const filteredTeachers = teachers.filter(teacher => {
    const fullName = getFullName(teacher).toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  // Add pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTeachers = filteredTeachers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage);

  // Add page change handler
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  return (
    <div className="content-container bg-[#F3F3F6]">
      <div className="p-8">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#526D82]">
                <th className="py-4 px-6 text-left text-white font-medium">Teacher ID</th>
                <th className="py-4 px-6 text-left text-white font-medium">
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="p-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#526D82] focus:border-[#526D82] w-full text-gray-800 bg-white shadow-sm text-sm"
                  />
                </th>
                <th className="py-4 px-6 text-left text-white font-medium">Gender</th>
                <th className="py-4 px-6 text-center text-white font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500">
                    No teacher found.
                  </td>
                </tr>
              ) : (
                currentTeachers.map((teacher) => (
                <tr key={teacher.user_id} className="border-b border-gray-100">
                  <td className="py-4 px-6 text-gray-800">{teacher.user_id}</td>
                  <td className="py-4 px-6 text-gray-800">{getFullName(teacher)}</td>
                  <td className="py-4 px-6 text-gray-800">{teacher.gender}</td>
                  <td className="py-4 px-6 text-center">
                    <div className="relative inline-block">
                      <button
                        id={`status-${teacher.user_id}`}
                        type="button"
                        onClick={(e) => toggleDropdown(e, teacher.user_id)}
                        className={`inline-flex justify-between items-center w-28 px-3 py-1.5 text-sm font-medium rounded-md ${
                          teacher.status === 'ACTIVE' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {teacher.status || 'ACTIVE'}
                        <svg className="-mr-1 ml-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {openDropdownId === teacher.user_id && (
                        <div 
                          className={`absolute right-0 w-28 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 ${
                              getDropdownPosition(currentTeachers.indexOf(teacher), currentTeachers.length)
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="py-0.5" role="menu" aria-orientation="vertical">
                            <button
                              onClick={() => showStatusConfirmation(teacher, 'ACTIVE')}
                              className={`block w-full text-left px-3 py-1.5 text-sm ${
                                teacher.status === 'ACTIVE' 
                                  ? 'bg-gray-100 text-gray-900 font-medium' 
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                              role="menuitem"
                            >
                              ACTIVE
                            </button>
                            <button
                              onClick={() => showStatusConfirmation(teacher, 'INACTIVE')}
                              className={`block w-full text-left px-3 py-1.5 text-sm ${
                                teacher.status === 'INACTIVE' 
                                  ? 'bg-gray-100 text-gray-900 font-medium' 
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                              role="menuitem"
                            >
                              INACTIVE
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Add Pagination Component */}
          {filteredTeachers.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>

        {loading && (
          <div className="text-center mt-6">
            <p>Loading...</p>
          </div>
        )}
        
        {error && (
          <div className="text-center mt-6 text-red-600">
            <p>{error}</p>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96 relative z-50">
              <h3 className="text-xl text-[#526D82] mb-4">Add New Teacher</h3>
              
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  {/* Teacher ID */}
                  <div>
                    <label className="block text-gray-700 mb-2">Teacher ID:</label>
                    <input
                      type="text"
                      name="teacherId"
                      value={formData.teacherId}
                      onChange={handleInputChange}
                      placeholder="TCH###"
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                      required
                    />
                  </div>

                  {/* First Name */}
                  <div>
                    <label className="block text-gray-700 mb-2">First Name:</label>
                    <input
                      type="text"
                      name="fname"
                      value={formData.fname}
                      onChange={handleInputChange}
                      placeholder="Enter first name"
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                      required
                    />
                  </div>

                  {/* Middle Name */}
                  <div>
                    <label className="block text-gray-700 mb-2">Middle Name:</label>
                    <input
                      type="text"
                      name="mname"
                      value={formData.mname}
                      onChange={handleInputChange}
                      placeholder="Enter middle name"
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-gray-700 mb-2">Last Name:</label>
                    <input
                      type="text"
                      name="lname"
                      value={formData.lname}
                      onChange={handleInputChange}
                      placeholder="Enter last name"
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                      required
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-gray-700 mb-2">Gender:</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                      required
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#526D82] text-white rounded hover:bg-[#3E5367] transition-colors duration-200"
                  >
                    Add Teacher
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirmation Modal - Updated to match Manage-class.jsx style */}
        {confirmModal.isOpen && confirmModal.teacher && (
          <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 100 }}>
            <div className="bg-white p-0 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
              {/* Modal Header with gradient background */}
              <div className="bg-gradient-to-r from-[#3E5367] to-[#526D82] px-6 py-4">
                <h2 className="text-2xl font-bold text-white">Confirm Status Change</h2>
              </div>
              
              <div className="p-6">
                {/* Warning Note */}
                <div className="mb-6 bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500 flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-yellow-700">
                    <strong>Warning:</strong> You are about to change the status of teacher <strong>{getFullName(confirmModal.teacher)}</strong> from <strong>{confirmModal.teacher.status || 'ACTIVE'}</strong> to <strong>{confirmModal.newStatus}</strong>.
                  </p>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setConfirmModal({ isOpen: false, teacher: null, newStatus: '' })}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2.5 px-5 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStatusChange}
                    type="button"
                    className={`font-medium py-2.5 px-5 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-white ${
                      confirmModal.newStatus === 'ACTIVE' 
                        ? 'bg-[#526D82] hover:bg-[#3E5367] focus:ring-[#526D82]' 
                        : 'bg-red-600 hover:bg-red-700 focus:ring-red-600'
                    }`}
                  >
                    Confirm Change
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageTeacher;
