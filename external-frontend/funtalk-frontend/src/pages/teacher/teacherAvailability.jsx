import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { fetchFuntalk } from '../../lib/api';

const TeacherAvailability = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [availability, setAvailability] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExceptionModalOpen, setIsExceptionModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    dayOfWeek: '',
    startTime: '',
    endTime: '',
    isActive: true,
  });
  const [exceptionFormData, setExceptionFormData] = useState({
    exceptionDate: '',
    startTime: '',
    endTime: '',
    reason: '',
    isBlocked: true,
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.userType !== 'teacher') {
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

  // Fetch availability
  useEffect(() => {
    if (user) {
      fetchAvailability();
      fetchExceptions();
    }
  }, [user]);

  const fetchAvailability = async () => {
    setIsFetching(true);
    try {
      const response = await fetchFuntalk(`/availability/teacher/${user.userId}`, {});

      const data = await response.json();
      if (data.success && data.data?.availability) {
        setAvailability(data.data.availability);
      } else {
        console.error('Error fetching availability:', data.message);
        setAvailability([]);
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
      setAvailability([]);
    } finally {
      setIsFetching(false);
    }
  };

  const fetchExceptions = async () => {
    try {
      const response = await fetchFuntalk(`/availability/teacher/${user.userId}/exceptions`, {});

      const data = await response.json();
      if (data.success && data.data?.exceptions) {
        setExceptions(data.data.exceptions);
      } else {
        setExceptions([]);
      }
    } catch (error) {
      console.error('Error fetching exceptions:', error);
      setExceptions([]);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({
      dayOfWeek: '',
      startTime: '',
      endTime: '',
      isActive: true,
    });
    setFormErrors({});
  };

  const handleExceptionModalClose = () => {
    setIsExceptionModalOpen(false);
    setExceptionFormData({
      exceptionDate: '',
      startTime: '',
      endTime: '',
      reason: '',
      isBlocked: true,
    });
    setFormErrors({});
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      dayOfWeek: item.day_of_week.toString(),
      startTime: item.start_time,
      endTime: item.end_time,
      isActive: item.is_active,
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

  const handleExceptionFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setExceptionFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.dayOfWeek) {
      newErrors.dayOfWeek = 'Day of week is required';
    }
    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }
    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      newErrors.endTime = 'End time must be after start time';
    }
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    try {
      const path = editingItem
        ? `/availability/${editingItem.availability_id}`
        : '/availability';
      const method = editingItem ? 'PUT' : 'POST';
      const requestBody = editingItem
        ? {
            startTime: formData.startTime,
            endTime: formData.endTime,
            isActive: formData.isActive,
          }
        : {
            dayOfWeek: parseInt(formData.dayOfWeek),
            startTime: formData.startTime,
            endTime: formData.endTime,
            isActive: formData.isActive,
          };

      const response = await fetchFuntalk(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert(editingItem ? 'Availability updated successfully!' : 'Availability added successfully!');
        handleModalClose();
        fetchAvailability();
      } else {
        alert(data.message || 'Error saving availability');
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('Error saving availability. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this availability slot?')) {
      return;
    }

    try {
      const response = await fetchFuntalk(`/availability/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert('Availability deleted successfully');
        fetchAvailability();
      } else {
        alert(data.message || 'Error deleting availability');
      }
    } catch (error) {
      console.error('Error deleting availability:', error);
      alert('Error deleting availability. Please try again.');
    }
  };

  const handleExceptionSubmit = async (e) => {
    e.preventDefault();
    if (!exceptionFormData.exceptionDate) {
      alert('Exception date is required');
      return;
    }

    try {
      const response = await fetchFuntalk('/availability/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exceptionFormData),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert('Exception added successfully!');
        handleExceptionModalClose();
        fetchExceptions();
      } else {
        alert(data.message || 'Error adding exception');
      }
    } catch (error) {
      console.error('Error adding exception:', error);
      alert('Error adding exception. Please try again.');
    }
  };

  const handleDeleteException = async (id) => {
    if (!window.confirm('Are you sure you want to remove this exception?')) {
      return;
    }

    try {
      const response = await fetchFuntalk(`/availability/exceptions/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert('Exception removed successfully');
        fetchExceptions();
      } else {
        alert(data.message || 'Error removing exception');
      }
    } catch (error) {
      console.error('Error removing exception:', error);
      alert('Error removing exception. Please try again.');
    }
  };

  // Get day name
  const getDayName = (dayOfWeek) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  };

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
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Availability</h1>
                  <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">Manage your weekly schedule and exceptions</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsExceptionModalOpen(true)}
                    className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Add Exception
                  </button>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Add Availability
                  </button>
                </div>
              </div>

              {/* Weekly Availability */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 sm:p-6 border-b border-gray-200">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Weekly Schedule</h2>
                  <p className="mt-1 text-xs sm:text-sm text-gray-600">Set your recurring weekly availability</p>
                </div>
                <div className="p-4 sm:p-6">
                  {isFetching ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="mt-3 text-sm text-gray-600">Loading...</p>
                    </div>
                  ) : availability.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="mt-3 text-sm text-gray-600">No availability set. Add your weekly schedule to get started.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto overflow-hidden">
                      <table className="w-full divide-y divide-gray-200" style={{ minWidth: '600px' }}>
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {availability.map((item) => (
                            <tr key={item.availability_id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{getDayName(item.day_of_week)}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {item.start_time?.substring(0, 5)} - {item.end_time?.substring(0, 5)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  item.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {item.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleEdit(item)}
                                    className="text-primary-600 hover:text-primary-800"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(item.availability_id)}
                                    className="text-red-600 hover:text-red-800"
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
              </div>

              {/* Exceptions */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 sm:p-6 border-b border-gray-200">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Exceptions</h2>
                  <p className="mt-1 text-xs sm:text-sm text-gray-600">Block specific dates (holidays, personal time, etc.)</p>
                </div>
                <div className="p-4 sm:p-6">
                  {exceptions.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-3 text-sm text-gray-600">No exceptions set</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {exceptions.map((exception) => (
                        <div
                          key={exception.exception_id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-gray-900">{formatDate(exception.exception_date)}</h3>
                              {exception.start_time && exception.end_time && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {exception.start_time.substring(0, 5)} - {exception.end_time.substring(0, 5)}
                                </p>
                              )}
                              {exception.reason && (
                                <p className="text-xs text-gray-600 mt-1">{exception.reason}</p>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteException(exception.exception_id)}
                              className="text-red-600 hover:text-red-800 ml-4"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add/Edit Availability Modal */}
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
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 sm:mx-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {editingItem ? 'Edit Availability' : 'Add Availability'}
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
                {!editingItem && (
                  <div>
                    <label htmlFor="dayOfWeek" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Day of Week <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="dayOfWeek"
                      name="dayOfWeek"
                      value={formData.dayOfWeek}
                      onChange={handleFormChange}
                      className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                        formErrors.dayOfWeek ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select day</option>
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                    {formErrors.dayOfWeek && (
                      <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.dayOfWeek}</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label htmlFor="startTime" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Start Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="startTime"
                      name="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={handleFormChange}
                      className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                        formErrors.startTime ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.startTime && (
                      <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.startTime}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="endTime" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      End Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="endTime"
                      name="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={handleFormChange}
                      className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                        formErrors.endTime ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.endTime && (
                      <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.endTime}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    id="isActive"
                    name="isActive"
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-xs sm:text-sm text-gray-700">
                    Active
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    {editingItem ? 'Update' : 'Add'} Availability
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Exception Modal */}
      {isExceptionModalOpen && createPortal(
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
              handleExceptionModalClose();
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 sm:mx-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Add Exception</h2>
                <button
                  onClick={handleExceptionModalClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleExceptionSubmit} className="space-y-3 sm:space-y-4">
                <div>
                  <label htmlFor="exceptionDate" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="exceptionDate"
                    name="exceptionDate"
                    type="date"
                    value={exceptionFormData.exceptionDate}
                    onChange={handleExceptionFormChange}
                    className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label htmlFor="exceptionStartTime" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Start Time (Optional)
                    </label>
                    <input
                      id="exceptionStartTime"
                      name="startTime"
                      type="time"
                      value={exceptionFormData.startTime}
                      onChange={handleExceptionFormChange}
                      className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="exceptionEndTime" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      End Time (Optional)
                    </label>
                    <input
                      id="exceptionEndTime"
                      name="endTime"
                      type="time"
                      value={exceptionFormData.endTime}
                      onChange={handleExceptionFormChange}
                      className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reason" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Reason (Optional)
                  </label>
                  <input
                    id="reason"
                    name="reason"
                    type="text"
                    value={exceptionFormData.reason}
                    onChange={handleExceptionFormChange}
                    className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g., Holiday, Personal time"
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    type="button"
                    onClick={handleExceptionModalClose}
                    className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Add Exception
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

export default TeacherAvailability;
