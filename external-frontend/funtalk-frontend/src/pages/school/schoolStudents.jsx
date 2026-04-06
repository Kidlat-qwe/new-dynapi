import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { fetchFuntalk } from '../../lib/api';

const SchoolStudents = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [nameSearch, setNameSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formData, setFormData] = useState({
    studentName: '',
    studentAge: '',
    studentLevel: '',
    studentEmail: '',
    studentPhone: '',
    parentName: '',
    parentContact: '',
    notes: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Fetch students
  useEffect(() => {
    if (user) {
      fetchStudents();
    }
  }, [user, levelFilter, statusFilter]);

  const fetchStudents = async () => {
    setIsFetching(true);
    try {
      const response = await fetchFuntalk('/students', {});

      const data = await response.json();
      if (data.success && data.data?.students) {
        setStudents(data.data.students);
      } else {
        console.error('Error fetching students:', data.message);
        setStudents([]);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      setStudents([]);
    } finally {
      setIsFetching(false);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingStudent(null);
    setFormData({
      studentName: '',
      studentAge: '',
      studentLevel: '',
      studentEmail: '',
      studentPhone: '',
      parentName: '',
      parentContact: '',
      notes: '',
      isActive: true,
    });
    setFormErrors({});
  };

  const handleEditClick = (student) => {
    setEditingStudent(student);
    setFormData({
      studentName: student.student_name || '',
      studentAge: student.student_age || '',
      studentLevel: student.student_level || '',
      studentEmail: student.student_email || '',
      studentPhone: student.student_phone || '',
      parentName: student.parent_name || '',
      parentContact: student.parent_contact || '',
      notes: student.notes || '',
      isActive: student.is_active !== false,
    });
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.studentName.trim()) {
      newErrors.studentName = 'Student name is required';
    }

    if (formData.studentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.studentEmail)) {
      newErrors.studentEmail = 'Please enter a valid email address';
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
      const path = editingStudent
        ? `/students/${editingStudent.student_id}`
        : '/students';
      const method = editingStudent ? 'PUT' : 'POST';

      const response = await fetchFuntalk(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentName: formData.studentName.trim(),
          studentAge: formData.studentAge ? parseInt(formData.studentAge) : null,
          studentLevel: formData.studentLevel || null,
          studentEmail: formData.studentEmail || null,
          studentPhone: formData.studentPhone || null,
          parentName: formData.parentName || null,
          parentContact: formData.parentContact || null,
          notes: formData.notes || null,
          isActive: editingStudent ? formData.isActive : true,
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
            submit: data.message || 'Error saving student. Please try again.',
          });
        }
        return;
      }

      alert(editingStudent ? 'Student updated successfully!' : 'Student created successfully!');
      handleModalClose();
      fetchStudents();
    } catch (error) {
      console.error('Error saving student:', error);
      setFormErrors({
        submit: 'Network error. Please check your connection and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (studentId, studentName) => {
    if (!window.confirm(`Are you sure you want to delete student "${studentName}"?`)) {
      return;
    }

    try {
      const response = await fetchFuntalk(`/students/${studentId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert('Student deleted successfully');
        fetchStudents();
      } else {
        alert(data.message || 'Error deleting student');
      }
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('Error deleting student. Please try again.');
    }
  };

  // Filter students
  const filteredStudents = students.filter((s) => {
    const matchesName = !nameSearch || 
      s.student_name?.toLowerCase().includes(nameSearch.toLowerCase());
    const matchesLevel = !levelFilter || s.student_level === levelFilter;
    const matchesStatus = !statusFilter || 
      (statusFilter === 'active' && s.is_active) ||
      (statusFilter === 'inactive' && !s.is_active);
    return matchesName && matchesLevel && matchesStatus;
  });

  // Get unique levels
  const levels = [...new Set(students.map(s => s.student_level).filter(Boolean))];

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
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
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Students</h1>
                  <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">Manage your student roster</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Add New Student
                </button>
              </div>

              {/* Students Table */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                {isFetching ? (
                  <div className="p-8 sm:p-10 md:p-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">Loading students...</p>
                  </div>
                ) : filteredStudents.length === 0 ? (
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
                    <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-gray-900">No students found</h3>
                    <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                      {nameSearch || levelFilter || statusFilter
                        ? 'Try adjusting your filters'
                        : 'Get started by adding a new student'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto overflow-hidden">
                    <table className="w-full divide-y divide-gray-200" style={{ minWidth: '900px' }}>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <div className="flex items-center space-x-2">
                              <span>Name</span>
                              <input
                                type="text"
                                placeholder="Search..."
                                value={nameSearch}
                                onChange={(e) => setNameSearch(e.target.value)}
                                className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 w-32"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <select
                              value={levelFilter}
                              onChange={(e) => setLevelFilter(e.target.value)}
                              className="text-xs font-medium text-gray-500 bg-transparent border-0 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="">Level</option>
                              {levels.map((level) => (
                                <option key={level} value={level}>
                                  {level}
                                </option>
                              ))}
                            </select>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Phone</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <select
                              value={statusFilter}
                              onChange={(e) => setStatusFilter(e.target.value)}
                              className="text-xs font-medium text-gray-500 bg-transparent border-0 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="">Status</option>
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Created</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredStudents.map((student) => (
                          <tr key={student.student_id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{student.student_name || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{student.student_age || '-'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {student.student_level ? (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {student.student_level}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-500">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                              <div className="text-sm text-gray-900">{student.student_email || '-'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                              <div className="text-sm text-gray-900">{student.student_phone || '-'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {student.is_active ? (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                              <div className="text-sm text-gray-500">{formatDate(student.created_at)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleEditClick(student)}
                                  className="text-primary-600 hover:text-primary-900"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(student.student_id, student.student_name)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Delete
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
              {filteredStudents.length > 0 && (
                <div className="text-xs sm:text-sm text-gray-600">
                  Showing {filteredStudents.length} of {students.length} student{students.length !== 1 ? 's' : ''}
                </div>
              )}

              {/* Add/Edit Student Modal */}
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
                    className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4 sm:mx-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 sm:p-5 md:p-6">
                      <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                          {editingStudent ? 'Edit Student' : 'Add New Student'}
                        </h2>
                        <button
                          onClick={handleModalClose}
                          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                        >
                          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <form onSubmit={handleFormSubmit} className="space-y-3 sm:space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                            />
                            {formErrors.studentName && (
                              <p className="mt-1 text-xs text-red-600">{formErrors.studentName}</p>
                            )}
                          </div>

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

                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Level</label>
                            <input
                              name="studentLevel"
                              type="text"
                              value={formData.studentLevel}
                              onChange={handleFormChange}
                              className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                              placeholder="e.g., Beginner, Intermediate"
                            />
                          </div>

                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                              name="studentEmail"
                              type="email"
                              value={formData.studentEmail}
                              onChange={handleFormChange}
                              className={`w-full px-3 sm:px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                                formErrors.studentEmail ? 'border-red-500' : 'border-gray-300'
                              }`}
                            />
                            {formErrors.studentEmail && (
                              <p className="mt-1 text-xs text-red-600">{formErrors.studentEmail}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone</label>
                            <input
                              name="studentPhone"
                              type="tel"
                              value={formData.studentPhone}
                              onChange={handleFormChange}
                              className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Parent Name</label>
                            <input
                              name="parentName"
                              type="text"
                              value={formData.parentName}
                              onChange={handleFormChange}
                              className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Parent Contact</label>
                            <input
                              name="parentContact"
                              type="text"
                              value={formData.parentContact}
                              onChange={handleFormChange}
                              className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Notes</label>
                          <textarea
                            name="notes"
                            rows="3"
                            value={formData.notes}
                            onChange={handleFormChange}
                            className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          />
                        </div>

                        {editingStudent && (
                          <div>
                            <label className="flex items-center">
                              <input
                                name="isActive"
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={handleFormChange}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                              <span className="ml-2 text-xs sm:text-sm text-gray-700">Active</span>
                            </label>
                          </div>
                        )}

                        {formErrors.submit && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3">
                            <p className="text-xs sm:text-sm text-red-600">{formErrors.submit}</p>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4">
                          <button
                            type="button"
                            onClick={handleModalClose}
                            className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            disabled={isSubmitting}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="w-full sm:w-auto px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? (editingStudent ? 'Updating...' : 'Creating...') : (editingStudent ? 'Update Student' : 'Create Student')}
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

export default SchoolStudents;
