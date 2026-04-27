import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { API_BASE_URL } from '@/config/api.js';
import ResponsiveSelect from '../../components/ResponsiveSelect';
import { computeFixedActionMenuPosition } from '../../utils/actionMenuPosition.js';

const Package = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [packages, setPackages] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [formData, setFormData] = useState({
    packageName: '',
    description: '',
    creditsValue: '',
    price: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterActive, setFilterActive] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

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

  // Fetch packages
  useEffect(() => {
    if (user) {
      fetchPackages();
    }
  }, [user, filterActive]);

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

  const fetchPackages = async () => {
    setIsFetching(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/billing/packages`;
      
      if (filterActive !== '') {
        url += `?isActive=${filterActive}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success && data.data?.packages) {
        setPackages(data.data.packages);
      } else {
        console.error('Error fetching packages:', data.message);
        setPackages([]);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      setPackages([]);
    } finally {
      setIsFetching(false);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingPackage(null);
    setFormData({
      packageName: '',
      description: '',
      creditsValue: '',
      price: '',
      isActive: true,
    });
    setFormErrors({});
  };

  const handleEditClick = (pkg) => {
    setEditingPackage(pkg);
    setFormData({
      packageName: pkg.package_name || '',
      description: pkg.package_type || '',
      creditsValue: pkg.credits_value || '',
      price: pkg.price || '',
      isActive: pkg.is_active !== undefined ? pkg.is_active : true,
    });
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
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

    if (!formData.packageName.trim()) {
      newErrors.packageName = 'Package name is required';
    }

    if (!formData.creditsValue) {
      newErrors.creditsValue = 'Credits value is required';
    } else if (parseInt(formData.creditsValue) < 1) {
      newErrors.creditsValue = 'Credits value must be at least 1';
    }

    if (!formData.price) {
      newErrors.price = 'Price is required';
    } else if (parseFloat(formData.price) < 0) {
      newErrors.price = 'Price must be a positive number';
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
      const url = editingPackage
        ? `${API_BASE_URL}/billing/packages/${editingPackage.package_id}`
        : `${API_BASE_URL}/billing/packages`;
      
      const method = editingPackage ? 'PUT' : 'POST';
      
      const requestBody = {
        packageName: formData.packageName.trim(),
        description: formData.description.trim() || null,
        creditsValue: parseInt(formData.creditsValue),
        price: parseFloat(formData.price),
        isActive: formData.isActive,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Package save error:', data);
        
        if (data.errors && Array.isArray(data.errors)) {
          const validationErrors = {};
          data.errors.forEach((error) => {
            const fieldName = error.param || error.path || 'unknown';
            validationErrors[fieldName] = error.msg || error.message;
          });
          setFormErrors(validationErrors);
        } else {
          setFormErrors({
            submit: data.message || 'Error saving package. Please try again.',
          });
        }
        return;
      }

      // Success
      alert(editingPackage ? 'Package updated successfully!' : 'Package created successfully!');
      handleModalClose();
      fetchPackages(); // Refresh the list
    } catch (error) {
      console.error('Error saving package:', error);
      setFormErrors({
        submit: 'Network error. Please check your connection and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (packageId, packageName) => {
    const ok = await window.appConfirm?.(`Are you sure you want to delete package "${packageName}"?`);
    if (!ok) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/billing/packages/${packageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert('Package deleted successfully');
        fetchPackages(); // Refresh the list
      } else {
        alert(data.message || 'Error deleting package');
      }
    } catch (error) {
      console.error('Error deleting package:', error);
      alert('Error deleting package. Please try again.');
    }
  };

  const handleToggleActive = async (pkg) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/billing/packages/${pkg.package_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: !pkg.is_active,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        fetchPackages(); // Refresh the list
      } else {
        alert(data.message || 'Error updating package status');
      }
    } catch (error) {
      console.error('Error updating package status:', error);
      alert('Error updating package status. Please try again.');
    }
  };

  const handleActionClick = (e, packageId) => {
    e.stopPropagation();
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();

    setMenuPosition(
      computeFixedActionMenuPosition({
        rect,
        menuWidth: 176, // w-44
        menuHeight: 200,
        gap: 6,
      })
    );

    setOpenMenuId(openMenuId === packageId ? null : packageId);
  };

  // Format price for display
  const formatPrice = (price) => {
    if (!price) return 'NT$0.00';
    return `${'NT$'}${parseFloat(price).toFixed(2)}`;
  };

  const searchQuery = nameSearch.trim().toLowerCase();
  const filteredPackages = packages.filter((pkg) => {
    if (!searchQuery) return true;
    return String(pkg.package_name || '').toLowerCase().includes(searchQuery);
  });

  const hasFilters = Boolean(searchQuery || filterActive);

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
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Packages</h1>
                  <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">Manage credit packages for purchase</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Add New Package
                </button>
              </div>

              {/* Filter toolbar */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
                  <div className="min-w-0 flex-1 sm:max-w-md">
                    <input
                      id="packages-search"
                      type="search"
                      aria-label="Search package name"
                      placeholder="Search by package name"
                      value={nameSearch}
                      onChange={(e) => setNameSearch(e.target.value)}
                      autoComplete="off"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div className="w-full sm:w-auto sm:min-w-[11rem]">
                    <ResponsiveSelect
                      value={filterActive}
                      onChange={(e) => setFilterActive(e.target.value)}
                      aria-label="Filter packages by status"
                      className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">All statuses</option>
                      <option value="true">Active only</option>
                      <option value="false">Inactive only</option>
                    </ResponsiveSelect>
                  </div>
                </div>
              </div>

              {/* Packages Grid - Shop Style */}
              {isFetching ? (
                <div className="p-8 sm:p-10 md:p-12 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">Loading packages...</p>
                </div>
              ) : filteredPackages.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-6 sm:p-8 md:p-10 lg:p-12 text-center">
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
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                  <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-gray-900">
                    {hasFilters ? 'No matching packages' : 'No packages found'}
                  </h3>
                  <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                    {hasFilters
                      ? 'Try a different package name or clear filters.'
                      : 'Get started by creating a new package'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
                  {filteredPackages.map((pkg) => (
                    <div
                      key={pkg.package_id}
                      className={`bg-white rounded-lg shadow-lg overflow-hidden transition-transform hover:scale-105 relative ${
                        !pkg.is_active ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Package Status Badge */}
                      <div className="relative">
                        {!pkg.is_active && (
                          <div className="absolute top-2 right-2 bg-gray-500 text-white text-xs px-2 py-1 rounded-full z-10">
                            Inactive
                          </div>
                        )}
                      </div>

                      {/* Action Menu Trigger */}
                      <div className="absolute top-2 right-2 z-10">
                        <button
                          type="button"
                          onClick={(e) => handleActionClick(e, pkg.package_id)}
                          className="text-gray-600 hover:text-gray-900 focus:outline-none p-1 bg-white/90 rounded-md border border-gray-200"
                          title="Actions"
                          aria-label="Open package actions"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Package Card Content */}
                      <div className="p-4 sm:p-5 md:p-6">
                        {/* Package Name */}
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">{pkg.package_name || 'N/A'}</h3>
                        
                        {/* Package Type */}
                        {pkg.package_type && (
                          <span className="inline-block px-2 py-1 text-xs font-medium text-primary-600 bg-primary-50 rounded-full mb-3">
                            {pkg.package_type}
                          </span>
                        )}

                        {/* Credits Display */}
                        <div className="my-4 sm:my-5">
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary-600">
                              {pkg.credits_value || 0}
                            </span>
                            <span className="text-sm sm:text-base text-gray-600">Credits</span>
                          </div>
                        </div>

                        {/* Price Display */}
                        <div className="mb-4 sm:mb-5 pb-4 sm:pb-5 border-b border-gray-200">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                              {formatPrice(pkg.price)}
                            </span>
                            {pkg.credits_value && pkg.price && (
                              <span className="text-xs sm:text-sm text-gray-500">
                                {`(NT${'$'}${(parseFloat(pkg.price) / pkg.credits_value).toFixed(2)}/credit)`}
                              </span>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Results Count */}
              {filteredPackages.length > 0 && (
                <div className="text-xs sm:text-sm text-gray-600">
                  Showing {filteredPackages.length} of {packages.length} package{packages.length !== 1 ? 's' : ''}
                </div>
              )}

              {/* Package Action Menu */}
              {openMenuId && createPortal(
                <div
                  className="fixed w-44 bg-white rounded-md shadow-xl z-[9999] border border-gray-200 action-menu"
                  style={{
                    top: `${menuPosition.top}px`,
                    right: `${menuPosition.right}px`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        const target = packages.find((p) => p.package_id === openMenuId);
                        if (target) {
                          handleToggleActive(target);
                        }
                        setOpenMenuId(null);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      {(() => {
                        const target = packages.find((p) => p.package_id === openMenuId);
                        return target?.is_active ? 'Deactivate' : 'Activate';
                      })()}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = packages.find((p) => p.package_id === openMenuId);
                        if (target) {
                          handleEditClick(target);
                        }
                        setOpenMenuId(null);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = packages.find((p) => p.package_id === openMenuId);
                        if (target) {
                          handleDelete(target.package_id, target.package_name);
                        }
                        setOpenMenuId(null);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>,
                document.body
              )}

              {/* Add/Edit Package Modal - Rendered via Portal to body */}
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
                    className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto mx-4 sm:mx-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 sm:p-5 md:p-6">
                      {/* Modal Header */}
                      <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                          {editingPackage ? 'Edit Package' : 'Add New Package'}
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
                      <form onSubmit={handleFormSubmit} className="space-y-3 sm:space-y-4">
                        {/* Package Name */}
                        <div>
                          <label htmlFor="packageName" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Package Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="packageName"
                            name="packageName"
                            type="text"
                            value={formData.packageName}
                            onChange={handleFormChange}
                            className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                              formErrors.packageName ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="e.g., Starter Pack, Premium Bundle"
                          />
                          {formErrors.packageName && (
                            <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.packageName}</p>
                          )}
                        </div>

                        {/* Description */}
                        <div>
                          <label htmlFor="description" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <input
                            id="description"
                            name="description"
                            type="text"
                            value={formData.description}
                            onChange={handleFormChange}
                            className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="e.g., Best for beginners (optional)"
                          />
                        </div>

                        {/* Credits Value and Price */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div>
                            <label htmlFor="creditsValue" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Credits Value <span className="text-red-500">*</span>
                            </label>
                            <input
                              id="creditsValue"
                              name="creditsValue"
                              type="number"
                              min="1"
                              value={formData.creditsValue}
                              onChange={handleFormChange}
                              className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                formErrors.creditsValue ? 'border-red-500' : 'border-gray-300'
                              }`}
                              placeholder="100"
                            />
                            {formErrors.creditsValue && (
                              <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.creditsValue}</p>
                            )}
                          </div>

                          <div>
                            <label htmlFor="price" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Price <span className="text-red-500">*</span>
                            </label>
                            <input
                              id="price"
                              name="price"
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.price}
                              onChange={handleFormChange}
                              className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                formErrors.price ? 'border-red-500' : 'border-gray-300'
                              }`}
                              placeholder="99.99"
                            />
                            {formErrors.price && (
                              <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.price}</p>
                            )}
                          </div>
                        </div>

                        {/* Active Status */}
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
                            Package is active (available for purchase)
                          </label>
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
                            {isSubmitting ? (editingPackage ? 'Updating...' : 'Creating...') : (editingPackage ? 'Update Package' : 'Create Package')}
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

export default Package;
