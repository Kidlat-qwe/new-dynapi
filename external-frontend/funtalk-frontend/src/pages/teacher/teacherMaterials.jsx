import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { API_BASE_URL } from '@/config/api.js';

const TeacherMaterials = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [materialTypeFilter, setMaterialTypeFilter] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [viewMaterial, setViewMaterial] = useState(null);
  const [deletingMaterialId, setDeletingMaterialId] = useState(null);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [formData, setFormData] = useState({
    materialName: '',
    materialType: '',
    file: null,
  });
  const [selectedFileName, setSelectedFileName] = useState('');
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

  // Fetch materials
  useEffect(() => {
    if (user) {
      fetchMaterials();
    }
  }, [user, materialTypeFilter]);

  const fetchMaterials = async () => {
    setIsFetching(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/materials`;
      const params = new URLSearchParams();
      
      if (materialTypeFilter) {
        params.append('materialType', materialTypeFilter);
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
      if (data.success && data.data?.materials) {
        setMaterials(data.data.materials);
      } else if (data.success && Array.isArray(data.data)) {
        setMaterials(data.data);
      } else {
        console.error('Error fetching materials:', data.message);
        setMaterials([]);
      }
    } catch (error) {
      console.error('Error fetching materials:', error);
      setMaterials([]);
    } finally {
      setIsFetching(false);
    }
  };

  // Filter materials
  const filteredMaterials = materials.filter((m) => {
    const matchesName = !nameSearch || 
      m.material_name?.toLowerCase().includes(nameSearch.toLowerCase());
    return matchesName;
  });

  // Get unique material types
  const materialTypes = [...new Set(materials.map(m => m.material_type).filter(Boolean))];

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

  // Modal handlers
  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingMaterial(null);
    setFormData({
      materialName: '',
      materialType: '',
      file: null,
    });
    setSelectedFileName('');
    setFormErrors({});
  };

  const getResolvedFileUrl = (material) => {
    if (!material?.file_url) return '';
    return material.file_url.startsWith('http')
      ? material.file_url
      : `${API_BASE_URL.replace('/api', '')}${material.file_url}`;
  };

  const openCreateModal = () => {
    setEditingMaterial(null);
    setFormData({
      materialName: '',
      materialType: '',
      file: null,
    });
    setSelectedFileName('');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (material) => {
    setEditingMaterial(material);
    setFormData({
      materialName: material.material_name || '',
      materialType: material.material_type || '',
      file: null,
    });
    setSelectedFileName('');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleDeleteMaterial = async (material) => {
    setOpenActionMenuId(null);
    const shouldDelete = window.confirm(`Delete "${material.material_name}"?`);
    if (!shouldDelete) return;
    setDeletingMaterialId(material.material_id);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/materials/${material.material_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.message || 'Failed to delete material');
        return;
      }
      if (viewMaterial?.material_id === material.material_id) {
        setViewMaterial(null);
      }
      fetchMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
      alert('Network error while deleting material.');
    } finally {
      setDeletingMaterialId(null);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, files } = e.target;
    
    if (name === 'file' && files && files[0]) {
      const file = files[0];
      setFormData((prev) => ({
        ...prev,
        file: file,
      }));
      setSelectedFileName(file.name);
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

    if (!formData.materialName.trim()) {
      newErrors.materialName = 'Material name is required';
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
      const url = editingMaterial
        ? `${API_BASE_URL}/materials/${editingMaterial.material_id}`
        : `${API_BASE_URL}/materials`;
      const method = editingMaterial ? 'PUT' : 'POST';
      
      // Use FormData for file uploads
      const formDataToSend = new FormData();
      formDataToSend.append('materialName', formData.materialName.trim());
      
      if (formData.materialType && formData.materialType.trim()) {
        formDataToSend.append('materialType', formData.materialType.trim());
      }
      
      if (formData.file) {
        formDataToSend.append('file', formData.file);
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formDataToSend,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Material save error:', data);
        
        if (data.errors && Array.isArray(data.errors)) {
          const validationErrors = {};
          data.errors.forEach((error) => {
            const fieldName = error.param || error.path || 'unknown';
            validationErrors[fieldName] = error.msg || error.message;
          });
          setFormErrors(validationErrors);
        } else {
          setFormErrors({
            submit: data.message || 'Error saving material. Please try again.',
          });
        }
        return;
      }

      // Success
      alert(editingMaterial ? 'Material updated successfully!' : 'Material created successfully!');
      handleModalClose();
      fetchMaterials(); // Refresh the list
    } catch (error) {
      console.error('Error saving material:', error);
      setFormErrors({
        submit: 'Network error. Please check your connection and try again.',
      });
    } finally {
      setIsSubmitting(false);
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
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Materials</h1>
                  <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">View and manage teaching materials</p>
                </div>
                <button
                  onClick={openCreateModal}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Add New Material
                </button>
              </div>

              {/* Materials Grid */}
              <div className="bg-white rounded-lg shadow">
                {isFetching ? (
                  <div className="p-8 sm:p-10 md:p-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">Loading materials...</p>
                  </div>
                ) : filteredMaterials.length === 0 ? (
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-gray-900">No materials found</h3>
                    <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                      {nameSearch || materialTypeFilter
                        ? 'Try adjusting your filters'
                        : 'No materials available'}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 sm:p-6">
                    {/* Filters */}
                    <div className="mb-4 sm:mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <input
                          type="text"
                          placeholder="Search materials..."
                          value={nameSearch}
                          onChange={(e) => setNameSearch(e.target.value)}
                          className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <select
                          value={materialTypeFilter}
                          onChange={(e) => setMaterialTypeFilter(e.target.value)}
                          className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="">All Types</option>
                          {materialTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Materials Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {filteredMaterials.map((material) => (
                        <div
                          key={material.material_id}
                          className="border border-gray-200 rounded-lg p-4 sm:p-6 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                                {material.material_name || 'N/A'}
                              </h3>
                              {material.material_type && (
                                <span className="mt-1 inline-block px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {material.material_type}
                                </span>
                              )}
                            </div>
                            <div className="relative ml-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenActionMenuId((prev) =>
                                    prev === material.material_id ? null : material.material_id
                                  )
                                }
                                className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                aria-label="Open material actions"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                                </svg>
                              </button>
                              {openActionMenuId === material.material_id && (
                                <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      openEditModal(material);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMaterial(material)}
                                    disabled={deletingMaterialId === material.material_id}
                                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {deletingMaterialId === material.material_id ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {material.file_url && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => setViewMaterial(material)}
                                className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 hover:underline"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                View Material
                              </button>
                            </div>
                          )}

                          <div className="mt-3 text-xs text-gray-500">
                            Added {formatDate(material.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Results Count */}
              {filteredMaterials.length > 0 && (
                <div className="text-xs sm:text-sm text-gray-600">
                  Showing {filteredMaterials.length} of {materials.length} material{materials.length !== 1 ? 's' : ''}
                </div>
              )}

              {/* Add Material Modal - Rendered via Portal to body */}
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
                          {editingMaterial ? 'Edit Material' : 'Add New Material'}
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
                        {/* Material Name */}
                        <div>
                          <label htmlFor="materialName" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Material Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="materialName"
                            name="materialName"
                            type="text"
                            value={formData.materialName}
                            onChange={handleFormChange}
                            className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                              formErrors.materialName ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="e.g., Beginner Grammar Guide, Vocabulary List"
                          />
                          {formErrors.materialName && (
                            <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.materialName}</p>
                          )}
                        </div>

                        {/* Material Type */}
                        <div>
                          <label htmlFor="materialType" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Material Type
                          </label>
                          <input
                            id="materialType"
                            name="materialType"
                            type="text"
                            value={formData.materialType}
                            onChange={handleFormChange}
                            className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="e.g., PDF, Video, Worksheet (optional)"
                          />
                        </div>

                        {/* File Upload */}
                        <div>
                          <label htmlFor="file" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Attach File
                          </label>
                          <div className="space-y-2">
                            {/* File input button */}
                            <label
                              htmlFor="file"
                              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors"
                            >
                              <svg
                                className="w-5 h-5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                              </svg>
                              <span className="text-gray-600 font-medium">Choose File</span>
                              <input
                                id="file"
                                name="file"
                                type="file"
                                onChange={handleFormChange}
                                className="hidden"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*,video/*,audio/*"
                              />
                            </label>
                            
                            {/* Selected file display */}
                            {selectedFileName && (
                              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <svg
                                    className="w-5 h-5 text-green-600 flex-shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                  </svg>
                                  <span className="text-sm text-gray-900 truncate" title={selectedFileName}>
                                    {selectedFileName}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, file: null }));
                                    setSelectedFileName('');
                                  }}
                                  className="ml-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                                  title="Remove file"
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
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                          {formErrors.file && (
                            <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.file}</p>
                          )}
                          <p className="mt-1 text-xs text-gray-500">
                            Supported formats: PDF, Word, Excel, PowerPoint, Images, Videos, Audio (Max 50MB)
                          </p>
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
                            {isSubmitting ? (editingMaterial ? 'Updating...' : 'Creating...') : (editingMaterial ? 'Update Material' : 'Create Material')}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>,
                document.body
              )}

              {/* View Material Modal */}
              {viewMaterial && createPortal(
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
                    padding: '1rem',
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setViewMaterial(null);
                    }
                  }}
                >
                  <div
                    className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 sm:p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <h2 className="text-lg sm:text-xl font-bold text-gray-900">{viewMaterial.material_name}</h2>
                          <p className="text-xs sm:text-sm text-gray-500 mt-1">Added {formatDate(viewMaterial.created_at)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewMaterial(null)}
                          className="text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {(() => {
                        const url = getResolvedFileUrl(viewMaterial);
                        const lower = url.toLowerCase();
                        const isImage = /\.(png|jpe?g|gif|webp|svg)$/.test(lower);
                        const isVideo = /\.(mp4|mov|webm|m4v)$/.test(lower);
                        const isAudio = /\.(mp3|wav|ogg|m4a)$/.test(lower);
                        const isPdf = /\.pdf($|\?)/.test(lower);

                        if (isImage) {
                          return <img src={url} alt={viewMaterial.material_name} className="w-full max-h-[65vh] object-contain rounded border" />;
                        }
                        if (isVideo) {
                          return <video src={url} controls className="w-full rounded border max-h-[65vh]" />;
                        }
                        if (isAudio) {
                          return <audio src={url} controls className="w-full" />;
                        }
                        if (isPdf) {
                          return <iframe src={url} title={viewMaterial.material_name} className="w-full h-[65vh] rounded border" />;
                        }

                        return (
                          <div className="border rounded-lg p-6 text-center">
                            <p className="text-sm text-gray-600 mb-4">Preview not available for this file type.</p>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                            >
                              Open File
                            </a>
                          </div>
                        );
                      })()}
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

export default TeacherMaterials;
