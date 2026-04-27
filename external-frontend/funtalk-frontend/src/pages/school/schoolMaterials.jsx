import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { API_BASE_URL } from '@/config/api.js';
import Pagination from '../../components/Pagination.jsx';

const SchoolMaterials = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [formData, setFormData] = useState({ materialName: '', materialType: '', file: null });
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

  useEffect(() => {
    if (user) fetchMaterials();
  }, [user]);

  const fetchMaterials = async () => {
    setIsFetching(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/materials`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && data.data?.materials) setMaterials(data.data.materials);
      else setMaterials([]);
    } catch (error) {
      console.error('Error fetching materials:', error);
      setMaterials([]);
    } finally {
      setIsFetching(false);
    }
  };

  const filteredMaterials = materials.filter((m) =>
    !nameSearch || m.material_name?.toLowerCase().includes(nameSearch.toLowerCase())
  );

  useEffect(() => {
    setPage(1);
  }, [nameSearch]);

  const pageSize = 10;
  const pagedMaterials = filteredMaterials.slice((page - 1) * pageSize, page * pageSize);

  const getResolvedFileUrl = (material) => {
    if (!material?.file_url) return '';
    return material.file_url.startsWith('http')
      ? material.file_url
      : `${API_BASE_URL.replace('/api', '')}${material.file_url}`;
  };

  const openCreateModal = () => {
    setEditingMaterial(null);
    setFormData({ materialName: '', materialType: '', file: null });
    setSelectedFileName('');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (material) => {
    setEditingMaterial(material);
    setFormData({
      materialName: material.material_name || '',
      materialType: material.material_type && material.material_type !== 'student_provided' ? material.material_type : '',
      file: null,
    });
    setSelectedFileName('');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleDeleteMaterial = async (material) => {
    const ok = await window.appConfirm?.(`Delete "${material.material_name}"?`);
    if (!ok) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/materials/${material.material_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.message || 'Failed to delete material');
        return;
      }
      fetchMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
      alert('Network error while deleting material.');
    }
  };

  const handleFormChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'file' && files && files[0]) {
      setFormData((prev) => ({ ...prev, file: files[0] }));
      setSelectedFileName(files[0].name);
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!formData.materialName.trim()) nextErrors.materialName = 'Material name is required';
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    setFormErrors({});
    try {
      const token = localStorage.getItem('token');
      const url = editingMaterial
        ? `${API_BASE_URL}/materials/${editingMaterial.material_id}`
        : `${API_BASE_URL}/materials`;
      const method = editingMaterial ? 'PUT' : 'POST';
      const payload = new FormData();
      payload.append('materialName', formData.materialName.trim());
      payload.append('materialType', formData.materialType?.trim() || 'student_provided');
      if (formData.file) payload.append('file', formData.file);

      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      });
      const data = await response.json();
      if (!response.ok) {
        setFormErrors({ submit: data.message || 'Error saving material. Please try again.' });
        return;
      }
      setIsModalOpen(false);
      fetchMaterials();
    } catch (error) {
      console.error('Error saving material:', error);
      setFormErrors({ submit: 'Network error. Please check your connection and try again.' });
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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />
      <div className="flex">
        <Sidebar userType={user.userType} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 lg:ml-64 p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Materials</h1>
                <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">
                  Manage your teaching materials.
                </p>
              </div>
              <button
                onClick={openCreateModal}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Add Material
              </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Search material..."
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  className="w-full sm:w-80 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              {isFetching ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
                </div>
              ) : filteredMaterials.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-600">No materials found.</div>
              ) : (
                <>
                <div className="overflow-x-auto overflow-hidden">
                  <table className="w-full divide-y divide-gray-200" style={{ minWidth: '800px' }}>
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Material</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">File</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Created</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pagedMaterials.map((material) => (
                        <tr key={material.material_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{material.material_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{material.material_type || 'student_provided'}</td>
                          <td className="px-6 py-4 text-sm">
                            {material.file_url ? (
                              <a
                                href={getResolvedFileUrl(material)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:text-primary-800 underline"
                              >
                                Open file
                              </a>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {material.created_at ? new Date(material.created_at).toLocaleDateString('en-US') : '-'}
                          </td>
                          <td className="px-6 py-4 text-right text-sm">
                            <button onClick={() => openEditModal(material)} className="text-primary-600 hover:text-primary-800 mr-3">
                              Edit
                            </button>
                            <button onClick={() => handleDeleteMaterial(material)} className="text-red-600 hover:text-red-800">
                              Delete
                            </button>
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
          </div>
        </main>
      </div>

      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            style={{ zIndex: 99999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsModalOpen(false);
            }}
          >
            <div className="bg-white rounded-lg shadow-xl max-w-xl w-full">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">{editingMaterial ? 'Edit Material' : 'Add New Material'}</h2>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Material Name *</label>
                    <input
                      name="materialName"
                      type="text"
                      value={formData.materialName}
                      onChange={handleFormChange}
                      placeholder="e.g., Beginner Grammar Guide, Vocabulary List"
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                        formErrors.materialName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.materialName && <p className="mt-1 text-xs text-red-600">{formErrors.materialName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Material Type</label>
                    <input
                      name="materialType"
                      type="text"
                      value={formData.materialType}
                      onChange={handleFormChange}
                      placeholder="e.g., PDF, Video, Worksheet (optional)"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Attach File</label>
                    <input
                      name="file"
                      type="file"
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg bg-gray-50"
                    />
                    {selectedFileName && <p className="mt-1 text-xs text-gray-500">{selectedFileName}</p>}
                    <p className="mt-1 text-xs text-gray-500">
                      Supported formats: PDF, Word, Excel, PowerPoint, Images, Videos, Audio (max 50MB)
                    </p>
                  </div>
                  {formErrors.submit && <p className="text-xs text-red-600">{formErrors.submit}</p>}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Saving...' : editingMaterial ? 'Update Material' : 'Create Material'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}

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

export default SchoolMaterials;
