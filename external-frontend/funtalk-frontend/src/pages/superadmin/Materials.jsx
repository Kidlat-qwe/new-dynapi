import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { API_BASE_URL } from '@/config/api.js';
import ResponsiveSelect from '../../components/ResponsiveSelect';
import Pagination from '../../components/Pagination.jsx';
import { computeFixedActionMenuPosition } from '../../utils/actionMenuPosition.js';

const MATERIAL_TYPE_OPTIONS = [
  'Lesson Plan',
  'Worksheet',
  'Presentation',
  'Video Lesson',
  'Audio Lesson',
  'Reading Material',
  'Other',
];

const getMaterialFileHref = (fileUrl) => {
  if (!fileUrl) return '';
  return fileUrl.startsWith('http')
    ? fileUrl
    : `${API_BASE_URL.replace('/api', '')}${fileUrl}`;
};

const getPreviewType = (fileUrl) => {
  const lower = String(fileUrl || '').toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/.test(lower)) return 'image';
  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/.test(lower)) return 'audio';
  if (/\.pdf(\?.*)?$/.test(lower)) return 'pdf';
  return 'other';
};

const Materials = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [nameSearch, setNameSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [filePreview, setFilePreview] = useState({ isOpen: false, url: '', type: '' });
  const [formData, setFormData] = useState({
    materialName: '',
    materialType: '',
    file: null,
    fileUrl: '', // For editing existing URL (optional)
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

  // Fetch materials
  useEffect(() => {
    if (user) {
      fetchMaterials();
    }
  }, [user, typeFilter]);

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

  const fetchMaterials = async () => {
    setIsFetching(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/materials`;
      const params = new URLSearchParams();
      
      if (typeFilter) {
        params.append('materialType', typeFilter);
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

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingMaterial(null);
    setFormData({
      materialName: '',
      materialType: '',
      file: null,
      fileUrl: '',
    });
    setSelectedFileName('');
    setFormErrors({});
  };

  const handleEditClick = (material) => {
    setEditingMaterial(material);
    setFormData({
      materialName: material.material_name || '',
      materialType: material.material_type || '',
      file: null, // Reset file for edit
      fileUrl: material.file_url || '', // Keep existing URL for reference
    });
    setSelectedFileName('');
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value, files } = e.target;
    
    if (name === 'file' && files && files[0]) {
      // Handle file input
      const file = files[0];
      setFormData((prev) => ({
        ...prev,
        file: file,
        fileUrl: '', // Clear URL when file is selected
      }));
      setSelectedFileName(file.name);
    } else {
      // Handle text inputs
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
    if (!formData.materialType || !formData.materialType.trim()) {
      newErrors.materialType = 'Material type is required';
    }

    // File or URL is optional, but if URL is provided, it should be valid
    if (formData.fileUrl && formData.fileUrl.trim() && !isValidUrl(formData.fileUrl.trim())) {
      newErrors.fileUrl = 'Please enter a valid URL';
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
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
      formDataToSend.append('materialType', formData.materialType.trim());
      
      // If a file is selected, append it; otherwise, if URL is provided, append it
      if (formData.file) {
        formDataToSend.append('file', formData.file);
      } else if (formData.fileUrl && formData.fileUrl.trim()) {
        formDataToSend.append('fileUrl', formData.fileUrl.trim());
      }

      const response = await fetch(url, {
        method,
        headers: {
          // Don't set Content-Type header - browser will set it with boundary for FormData
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

  // Handle action menu
  const handleActionClick = (e, materialId) => {
    e.stopPropagation();
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    
    setMenuPosition(
      computeFixedActionMenuPosition({
        rect,
        menuWidth: 192, // w-40 / w-48
        menuHeight: 170,
        gap: 6,
      })
    );
    
    setOpenMenuId(openMenuId === materialId ? null : materialId);
  };

  const openFilePreview = (fileUrl) => {
    const resolvedUrl = getMaterialFileHref(fileUrl);
    setFilePreview({
      isOpen: true,
      url: resolvedUrl,
      type: getPreviewType(resolvedUrl),
    });
  };

  // Handle delete
  const handleDelete = async (materialId, materialName) => {
    const ok = await window.appConfirm?.(`Are you sure you want to delete material "${materialName}"?`);
    if (!ok) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/materials/${materialId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert('Material deleted successfully');
        fetchMaterials(); // Refresh the list
      } else {
        alert(data.message || 'Error deleting material');
      }
    } catch (error) {
      console.error('Error deleting material:', error);
      alert('Error deleting material. Please try again.');
    }
  };

  // Filter materials based on name search
  const filteredMaterials = materials.filter((m) => {
    const matchesName = !nameSearch || 
      m.material_name?.toLowerCase().includes(nameSearch.toLowerCase());
    return matchesName;
  });

  useEffect(() => {
    setPage(1);
  }, [nameSearch, typeFilter]);

  const pageSize = 10;
  const pagedMaterials = filteredMaterials.slice((page - 1) * pageSize, page * pageSize);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Get unique material types for filter
  const materialTypes = [...new Set(materials.map(m => m.material_type).filter(Boolean))];

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
                  <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">Manage teaching materials</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Add New Material
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
                <div className="min-w-0 flex-1 sm:max-w-md">
                  <input
                    id="materials-search"
                    type="search"
                    aria-label="Search materials"
                    placeholder="Search by material name"
                    value={nameSearch}
                    onChange={(e) => setNameSearch(e.target.value)}
                    autoComplete="off"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="w-full sm:w-auto sm:min-w-[10rem]">
                  <ResponsiveSelect
                    id="materials-type-filter"
                    aria-label="Filter materials by type"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="">All types</option>
                    {materialTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </ResponsiveSelect>
                </div>
              </div>

              {/* Materials Table */}
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
                      {nameSearch || typeFilter
                        ? 'Try adjusting your filters'
                        : 'Get started by adding a new material'}
                    </p>
                  </div>
                ) : (
                  <>
                  <div className="overflow-x-auto rounded-b-xl">
                    <table className="min-w-[1040px] w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Material name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            File URL
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Created At
                          </th>
                          <th className="sticky right-0 z-10 bg-gray-50 px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pagedMaterials.map((material) => (
                          <tr key={material.material_id} className="group hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{material.material_name || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {material.material_type ? (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {material.material_type}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-500">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {material.file_url ? (
                                <button
                                  type="button"
                                  onClick={() => openFilePreview(material.file_url)}
                                  className="text-sm text-primary-600 hover:text-primary-800 hover:underline truncate max-w-[14rem] sm:max-w-xs inline-block text-left"
                                  title={material.file_url}
                                >
                                  <div className="flex items-center gap-1">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    <span className="truncate">View File</span>
                                  </div>
                                </button>
                              ) : (
                                <span className="text-sm text-gray-500">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{formatDate(material.created_at)}</div>
                            </td>
                            <td className="sticky right-0 z-[1] bg-white px-6 py-4 whitespace-nowrap text-right text-sm font-medium shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.06)] group-hover:bg-gray-50">
                              <div className="flex justify-end">
                                <button
                                  onClick={(e) => handleActionClick(e, material.material_id)}
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
                    <Pagination totalItems={filteredMaterials.length} pageSize={pageSize} currentPage={page} onPageChange={setPage} />
                  </div>
                  </>
                )}
              </div>

              {/* Results Count */}
              {filteredMaterials.length > 0 && (
                <div className="text-xs sm:text-sm text-gray-600">
                  Showing {filteredMaterials.length} of {materials.length} material{materials.length !== 1 ? 's' : ''}
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
                        const material = filteredMaterials.find(m => m.material_id === openMenuId);
                        if (material) {
                          handleEditClick(material);
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
                        const material = filteredMaterials.find(m => m.material_id === openMenuId);
                        if (material) {
                          handleDelete(material.material_id, material.material_name);
                        }
                        setOpenMenuId(null);
                      }}
                      className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-red-600 hover:bg-gray-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>,
                document.body
              )}

              {/* File Preview Modal */}
              {filePreview.isOpen && createPortal(
                <div
                  className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setFilePreview({ isOpen: false, url: '', type: '' });
                    }
                  }}
                >
                  <div
                    className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between">
                      <h2 className="text-lg sm:text-xl font-semibold text-gray-900">File Preview</h2>
                      <button
                        type="button"
                        onClick={() => setFilePreview({ isOpen: false, url: '', type: '' })}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                        aria-label="Close file preview modal"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="p-4 sm:p-5">
                      {filePreview.type === 'image' && (
                        <img
                          src={filePreview.url}
                          alt="Material file preview"
                          className="w-full h-auto max-h-[70vh] object-contain rounded"
                        />
                      )}
                      {filePreview.type === 'video' && (
                        <video controls className="w-full h-auto max-h-[70vh] rounded" src={filePreview.url} />
                      )}
                      {filePreview.type === 'audio' && (
                        <div className="py-8 flex justify-center">
                          <audio controls className="w-full max-w-lg" src={filePreview.url} />
                        </div>
                      )}
                      {filePreview.type === 'pdf' && (
                        <iframe
                          title="Material PDF Preview"
                          src={filePreview.url}
                          className="w-full h-[70vh] rounded border border-gray-200"
                        />
                      )}
                      {filePreview.type === 'other' && (
                        <div className="py-10 text-center">
                          <p className="text-sm text-gray-600 mb-3">Preview is not available for this file type.</p>
                          <a
                            href={filePreview.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                          >
                            Open file
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>,
                document.body
              )}

              {/* Add/Edit Material Modal - Rendered via Portal to body */}
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
                            Material Type <span className="text-red-500">*</span>
                          </label>
                          <ResponsiveSelect
                            id="materialType"
                            name="materialType"
                            value={formData.materialType}
                            onChange={handleFormChange}
                            className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                              formErrors.materialType ? 'border-red-500' : 'border-gray-300'
                            }`}
                          >
                            <option value="">Select material type</option>
                            {MATERIAL_TYPE_OPTIONS.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                            {formData.materialType &&
                              !MATERIAL_TYPE_OPTIONS.includes(formData.materialType) && (
                                <option value={formData.materialType}>
                                  {formData.materialType}
                                </option>
                              )}
                          </ResponsiveSelect>
                          {formErrors.materialType && (
                            <p className="mt-1 text-xs sm:text-sm text-red-600">{formErrors.materialType}</p>
                          )}
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
                            
                            {/* Show current file when editing */}
                            {editingMaterial && editingMaterial.file_url && !selectedFileName && (
                              <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <svg
                                    className="w-5 h-5 text-blue-600 flex-shrink-0"
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
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-blue-800 truncate">
                                      Current file: <a 
                                        href={editingMaterial.file_url.startsWith('http') ? editingMaterial.file_url : `${API_BASE_URL.replace('/api', '')}${editingMaterial.file_url}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="underline hover:text-blue-600 font-medium"
                                      >
                                        {editingMaterial.file_url.split('/').pop()}
                                      </a>
                                    </p>
                                    <p className="text-xs text-blue-600 mt-0.5">
                                      Upload a new file to replace it
                                    </p>
                                  </div>
                                </div>
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

export default Materials;
