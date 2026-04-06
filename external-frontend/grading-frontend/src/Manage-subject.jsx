import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Pagination from './components/Pagination';
import { fetchGrading } from './lib/api';

const ManageSubject = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [formData, setFormData] = useState({
    subjectName: '',
    gradeLevel: '',
    parentSubjectId: ''
  });
  const [subjects, setSubjects] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [gradeLevelFilter, setGradeLevelFilter] = useState('all');

  const fetchSubjects = async () => {
    console.log('Fetching subjects...');
    try {
      const response = await fetchGrading('/api/subjects');
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Fetched subjects:', data);
      // Sort subjects alphabetically by subject_name
      const sortedSubjects = data.sort((a, b) => 
        a.subject_name.localeCompare(b.subject_name)
      );
      setSubjects(sortedSubjects);
    } catch (error) {
      console.error('\n Error fetching subjects:', error);
      alert('Error loading subjects. Please try again.');
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double submit
    setIsSubmitting(true);
    try {
      console.log('Sending data:', { subjectName: formData.subjectName, gradeLevel: formData.gradeLevel, parentSubjectId: formData.parentSubjectId });
      const response = await fetchGrading('/api/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subjectName: formData.subjectName,
          gradeLevel: formData.gradeLevel,
          parentSubjectId: formData.parentSubjectId || null
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      console.log('Success:', result);
      // Refresh the subjects list
      await fetchSubjects();
      // Close modal and reset form
      setIsModalOpen(false);
      setFormData({ subjectName: '', gradeLevel: '', parentSubjectId: '' });
    } catch (error) {
      console.error('Error adding subject:', error);
      alert('Failed to add subject. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (subject) => {
    setSelectedSubject(subject);
    setFormData({
      subjectName: subject.subject_name,
      gradeLevel: subject.grade_level || '',
      parentSubjectId: subject.parent_subject_id || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError(null);
    setIsEditSaving(true);
    try {
      const response = await fetchGrading(`/api/subjects/${selectedSubject.subject_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subjectName: formData.subjectName, gradeLevel: formData.gradeLevel, parentSubjectId: formData.parentSubjectId || null }),
      });
      if (!response.ok) {
        throw new Error('Failed to update subject');
      }
      await fetchSubjects();
      setIsEditModalOpen(false);
      setSelectedSubject(null);
      setFormData({ subjectName: '', gradeLevel: '', parentSubjectId: '' });
      setEditError(null);
    } catch (error) {
      console.error('Error updating subject:', error);
      setEditError('Failed to update subject. Please try again.');
    } finally {
      setIsEditSaving(false);
    }
  };

  // Filter subjects based on grade level filter
  const filteredSubjects = gradeLevelFilter === 'all'
    ? subjects
    : subjects.filter(subject => subject.grade_level === gradeLevelFilter);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredSubjects.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredSubjects.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Filter parent subjects by current grade level
  const availableParentSubjects = subjects.filter(s => 
    !s.parent_subject_id && 
    s.grade_level === formData.gradeLevel && 
    (!selectedSubject || s.subject_id !== selectedSubject.subject_id)
  );

  return (
    <div className="content-container bg-[#F3F3F6]">
      <div className="p-8">
        {/* Add Subject button moved to top right */}
        <div className="flex justify-end mb-6">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#526D82] text-white rounded-md font-medium
              hover:bg-[#3E5367] transition-colors duration-200"
          >
            + ADD SUBJECT
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full table-fixed">
            <thead>
              <tr className="bg-[#526D82]">
                <th className="w-1/6 py-4 px-6 text-left text-white font-medium">Subject ID</th>
                <th className="w-2/6 py-4 px-6 text-left text-white font-medium">Subject Name</th>
                <th className="w-2/6 py-4 px-6 text-left text-white font-medium">
                  <select
                    value={gradeLevelFilter}
                    onChange={e => setGradeLevelFilter(e.target.value)}
                    className="p-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#526D82] focus:border-[#526D82] w-full text-gray-800 bg-white shadow-sm text-sm"
                    style={{ backgroundColor: 'white', color: '#334155' }}
                  >
                    <option value="all">Grade Level</option>
                    <option value="Kindergarten">Kindergarten</option>
                    <option value="1">Grade 1</option>
                    <option value="2">Grade 2</option>
                    <option value="3">Grade 3</option>
                    <option value="4">Grade 4</option>
                    <option value="5">Grade 5</option>
                    <option value="6">Grade 6</option>
                  </select>
                </th>
                <th className="w-2/6 py-4 px-6 text-left text-white font-medium ml-4">Parent Subject</th>
                <th className="w-2/6 py-4 px-6 text-center text-white font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    {gradeLevelFilter === 'all'
                      ? 'No subjects found.'
                      : 'No subjects found for the selected grade level.'}
                  </td>
                </tr>
              ) : (
                currentItems.map((subject) => (
                  <tr key={subject.subject_id} className="border-b border-gray-100">
                    <td className="w-1/6 py-4 px-6 text-black">{subject.subject_id}</td>
                    <td className="w-2/6 py-4 px-6 text-black">
                      <div className="truncate" title={subject.subject_name}>
                        {subject.subject_name}
                      </div>
                    </td>
                    <td className="w-2/6 py-4 px-6 text-black">
                      {subject.grade_level === 'Kindergarten' ? 'Kindergarten' : subject.grade_level ? `Grade ${subject.grade_level}` : ''}
                    </td>
                    <td className="w-2/6 py-4 px-6 text-black ml-4">
                      {subject.parent_subject_id ? (subjects.find(s => s.subject_id === subject.parent_subject_id)?.subject_name || '-') : '-'}
                    </td>
                    <td className="w-2/6 py-4 px-6 text-center">
                      <button 
                        onClick={() => handleEditClick(subject)}
                        className="w-24 px-3 py-1 text-[#526D82] hover:bg-[#526D82] hover:text-white rounded border border-[#526D82]"
                      >
                        EDIT
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {filteredSubjects.length > 0 && (
            <div className="border-t border-gray-200">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
            <div className="bg-white rounded-lg p-6 w-96 relative z-50">
              <h3 className="text-xl text-[#526D82] mb-4">Add New Subject</h3>
              
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Subject Name:</label>
                    <input
                      type="text"
                      name="subjectName"
                      value={formData.subjectName}
                      onChange={handleInputChange}
                      placeholder="Enter subject name"
                      maxLength={50}
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Grade Level:</label>
                    <select
                      name="gradeLevel"
                      value={formData.gradeLevel}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                      required
                    >
                      <option value="">Select grade level</option>
                      <option value="Kindergarten">Kindergarten</option>
                    <option value="1">Grade 1</option>
                    <option value="2">Grade 2</option>
                    <option value="3">Grade 3</option>
                    <option value="4">Grade 4</option>
                    <option value="5">Grade 5</option>
                    <option value="6">Grade 6</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Parent Subject (Optional):</label>
                    <select
                      name="parentSubjectId"
                      value={formData.parentSubjectId}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                      disabled={!formData.gradeLevel}
                    >
                      <option value="">None</option>
                      {formData.gradeLevel ? (
                        availableParentSubjects.length > 0 ? (
                          availableParentSubjects.map(subject => (
                            <option key={subject.subject_id} value={subject.subject_id}>
                              {subject.subject_name}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>No available parent subjects at this grade level</option>
                        )
                      ) : (
                        <option value="" disabled>Select a grade level first</option>
                      )}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      For MAPEH components (e.g., Music, Arts, PE, Health), select <span className="font-semibold">MAPEH</span> as the parent subject. For regular subjects, leave as <span className="font-semibold">None</span>.
                    </p>
                    {!formData.gradeLevel && (
                      <p className="mt-1 text-xs text-amber-600">
                        Please select a grade level first to view available parent subjects.
                      </p>
                    )}
                  </div>
                </div>

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
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Adding...' : 'Add Subject'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isEditModalOpen && (  
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => {
              setIsEditModalOpen(false);
              setSelectedSubject(null);
              setFormData({ subjectName: '', gradeLevel: '', parentSubjectId: '' });
              setEditError(null);
            }}></div>
            <div className="bg-white rounded-lg p-6 w-96 relative z-50">
              <h3 className="text-xl text-[#526D82] mb-4">Edit Subject</h3>
              
              {editError && (
                <div className="mb-4 bg-red-50 p-3 rounded-md border border-red-200 text-red-700 text-sm">
                  {editError}
                </div>
              )}
              
              <form onSubmit={handleEditSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Subject Name:</label>
                    <input
                      type="text"
                      name="subjectName"
                      value={formData.subjectName}
                      onChange={handleInputChange}
                      placeholder="Enter subject name"
                      maxLength={30}
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Grade Level:</label>
                    <select
                      name="gradeLevel"
                      value={formData.gradeLevel}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                      required
                    >
                      <option value="">Select grade level</option>
                      <option value="Kindergarten">Kindergarten</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                      <option value="6">6</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Parent Subject (optional):</label>
                    <select
                      name="parentSubjectId"
                      value={formData.parentSubjectId}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded focus:outline-none focus:border-[#526D82]"
                      disabled={!formData.gradeLevel}
                    >
                      <option value="">None (This is a parent subject)</option>
                      {formData.gradeLevel ? (
                        availableParentSubjects.length > 0 ? (
                          availableParentSubjects.map(subject => (
                            <option key={subject.subject_id} value={subject.subject_id}>
                              {subject.subject_name}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>No available parent subjects at this grade level</option>
                        )
                      ) : (
                        <option value="" disabled>Select a grade level first</option>
                      )}
                    </select>
                    {!formData.gradeLevel && (
                      <p className="mt-1 text-xs text-amber-600">
                        Please select a grade level first to view available parent subjects.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-4 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setSelectedSubject(null);
                      setFormData({ subjectName: '', gradeLevel: '', parentSubjectId: '' });
                      setEditError(null);
                    }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#526D82] text-white rounded hover:bg-[#3E5367] transition-colors duration-200"
                    disabled={isEditSaving}
                  >
                    {isEditSaving ? 'Saving...' : 'Save Changes'}
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

export default ManageSubject;
