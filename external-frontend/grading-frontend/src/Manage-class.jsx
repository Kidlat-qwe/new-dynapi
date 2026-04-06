import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Pagination from './components/Pagination';
import { fetchGrading, gradingUrl, getAuthHeader } from './lib/api';

const ManageClass = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [classList, setClassList] = useState([]);
  const [filteredClasses, setFilteredClasses] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    grade_level: '',
    section: '',
    school_year: '',
    class_adviser_id: '',
    program_name: '',
    class_code: ''
  });
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // You can adjust this number
  const [inactiveTeacherWarning, setInactiveTeacherWarning] = useState([]);
  const [activeTeachers, setActiveTeachers] = useState([]);
  const [activeSchoolYear, setActiveSchoolYear] = useState(null);
  const [inactiveAdviserWarning, setInactiveAdviserWarning] = useState([]);
  const [showAdviserSuggestions, setShowAdviserSuggestions] = useState(false);
  const [showEditAdviserSuggestions, setShowEditAdviserSuggestions] = useState(false);
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [isReassigningAdviser, setIsReassigningAdviser] = useState(false);

  const navigate = useNavigate();

  // Add new state for edit adviser modal
  const [editAdviserModal, setEditAdviserModal] = useState({
    isOpen: false,
    classItem: null
  });
  const [editAdviserFormData, setEditAdviserFormData] = useState({
    class_adviser_id: ''
  });

  // Add state for delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [classToDelete, setClassToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Instead of targeting specific elements, let's create a blur overlay
    if (isModalOpen) {
      // Create a blur overlay div
      const blurOverlay = document.createElement('div');
      blurOverlay.id = 'blur-overlay';
      blurOverlay.style.position = 'fixed';
      blurOverlay.style.top = '0';
      blurOverlay.style.left = '0';
      blurOverlay.style.width = '100%';
      blurOverlay.style.height = '100%';
      blurOverlay.style.backdropFilter = 'blur(4px)';
      blurOverlay.style.zIndex = '50';
      blurOverlay.style.pointerEvents = 'none'; // Allow clicks to pass through
      document.body.appendChild(blurOverlay);
    } else {
      // Remove the blur overlay when modal is closed
      const existingOverlay = document.getElementById('blur-overlay');
      if (existingOverlay) {
        document.body.removeChild(existingOverlay);
      }
    }
    
    // Cleanup function
    return () => {
      const existingOverlay = document.getElementById('blur-overlay');
      if (existingOverlay) {
        document.body.removeChild(existingOverlay);
      }
    };
  }, [isModalOpen]);

  useEffect(() => {
    fetchSchoolYears();
    fetchClasses();
    checkInactiveTeachers();
    checkInactiveAdvisers();
  }, []);

  // Refresh available teachers when school year changes
  useEffect(() => {
    if (formData.school_year) {
      fetchActiveTeachers();
    }
  }, [formData.school_year]);

  // Reset program_name when grade_level changes
  useEffect(() => {
    // Reset program_name when grade_level changes
    setFormData(prev => ({
      ...prev,
      program_name: '',
      class_code: ''
    }));
  }, [formData.grade_level]);

  // Filter and sort classes when classList or selectedSchoolYear changes
  useEffect(() => {
    filterAndSortClasses();
  }, [classList, selectedSchoolYear]);

  // Check for inactive teachers with assigned classes
  const checkInactiveTeachers = async () => {
    try {
      await checkInactiveTeachersFallback();
    } catch (error) {
      // Silently handle the error instead of logging to console
      // This prevents cluttering the console with errors
      setInactiveTeacherWarning([]); // Reset warning state on error
    }
  };
  
  // Fallback approach to check for inactive teachers with assigned classes
  const checkInactiveTeachersFallback = async () => {
    try {
      // First fetch all classes and their subjects with teachers
      const classesResponse = await fetchGrading('/api/classes');
      if (!classesResponse.ok) return;
      const classes = await classesResponse.json();
      
      // Get active school year
      const schoolYearsResponse = await fetchGrading('/api/school-years');
      if (!schoolYearsResponse.ok) return;
      const schoolYears = await schoolYearsResponse.json();
      const activeSchoolYear = schoolYears.find(year => year.is_active);
      
      if (!activeSchoolYear) return;
      
      // For each class in the active school year, fetch subjects and teachers
      const activeClasses = classes.filter(c => c.school_year_id === activeSchoolYear.school_year_id);
      
      // Get all teachers
      const teachersResponse = await fetchGrading('/api/teachers');
      if (!teachersResponse.ok) return;
      const teachers = await teachersResponse.json();
      
      // Filter to just inactive teachers
      const inactiveTeachers = teachers.filter(teacher => teacher.teacher_status === false);
      
      // If no inactive teachers, no need to continue
      if (inactiveTeachers.length === 0) return;
      
      // Create a map of inactive teacher IDs for quick lookup
      const inactiveTeacherIds = new Set(inactiveTeachers.map(t => t.user_id));
      
      // Object to store inactive teachers with their assigned classes
      const inactiveTeachersWithClasses = [];
      
      // Check each class for inactive teachers
      for (const classItem of activeClasses) {
        try {
          const subjectsResponse = await fetchGrading(`/api/classes/${classItem.class_id}/subjects`);
          if (!subjectsResponse.ok) continue;
          
          const subjects = await subjectsResponse.json();
          
          // Check if any subject has an inactive teacher
          for (const subject of subjects) {
            if (inactiveTeacherIds.has(subject.teacher_id)) {
              // Find the inactive teacher
              const teacher = inactiveTeachers.find(t => t.user_id === subject.teacher_id);
              
              // Check if teacher already in the list
              let teacherEntry = inactiveTeachersWithClasses.find(t => t.user_id === teacher.user_id);
              
              if (!teacherEntry) {
                // Add new teacher entry if not exists
                teacherEntry = {
                  ...teacher,
                  assignedClasses: []
                };
                inactiveTeachersWithClasses.push(teacherEntry);
              }
              
              // Add class info if not already present
              const existingClassEntry = teacherEntry.assignedClasses.find(c => 
                c.class_id === classItem.class_id && c.subject === subject.subject_name
              );
              
              if (!existingClassEntry) {
                teacherEntry.assignedClasses.push({
                  class_id: classItem.class_id,
                  grade_level: classItem.grade_level,
                  section: classItem.section,
                  subject: subject.subject_name
                });
              }
            }
          }
        } catch (e) {
          // Skip classes that have issues instead of logging warnings
          continue;
        }
      }
      
      // Set the warning state
      if (inactiveTeachersWithClasses.length > 0) {
        setInactiveTeacherWarning(inactiveTeachersWithClasses);
      }
    } catch (error) {
      // Silently handle errors
      setInactiveTeacherWarning([]);
    }
  };

  // Check for inactive class advisers with assigned classes
  const checkInactiveAdvisers = async () => {
    try {
      // Get active school year
      const schoolYearsResponse = await fetchGrading('/api/school-years');
      if (!schoolYearsResponse.ok) return;
      const schoolYears = await schoolYearsResponse.json();
      const activeSchoolYear = schoolYears.find(year => year.is_active);
      
      if (!activeSchoolYear) return;
      
      // Get all classes for the active school year
      const classesResponse = await fetchGrading(`/api/classes?schoolYearId=${activeSchoolYear.school_year_id}`);
      if (!classesResponse.ok) return;
      const classes = await classesResponse.json();
      
      // Get all teachers
      const teachersResponse = await fetchGrading('/api/teachers');
      if (!teachersResponse.ok) return;
      const teachers = await teachersResponse.json();
      
      // Filter to just inactive teachers
      const inactiveTeachers = teachers.filter(teacher => teacher.teacher_status === false);
      
      // If no inactive teachers, no need to continue
      if (inactiveTeachers.length === 0) {
        setInactiveAdviserWarning([]);
        return;
      }
      
      // Find classes with inactive advisers
      const classesWithInactiveAdvisers = classes.filter(classItem =>
        classItem.class_adviser_id && 
        inactiveTeachers.some(teacher => teacher.user_id === classItem.class_adviser_id)
      );
      
      if (classesWithInactiveAdvisers.length === 0) {
        setInactiveAdviserWarning([]);
        return;
      }
      
      // Format warning data
      const warnings = classesWithInactiveAdvisers.map(classItem => {
        const adviser = inactiveTeachers.find(t => t.user_id === classItem.class_adviser_id);
        return {
          class_id: classItem.class_id,
          grade_level: classItem.grade_level,
          section: classItem.section,
          adviser_name: `${adviser.fname} ${adviser.mname || ''} ${adviser.lname}`.trim()
        };
      });
      
      setInactiveAdviserWarning(warnings);
    } catch (error) {
      console.error('Error checking inactive advisers:', error);
      setInactiveAdviserWarning([]);
    }
  };

  const filterAndSortClasses = () => {
    let result = [...classList];
    
    // Apply school year filter if not 'all'
    if (selectedSchoolYear !== 'all') {
      result = result.filter(classItem => 
        classItem.school_year_id.toString() === selectedSchoolYear
      );
    }
    
    // Sort by grade level (numeric) and then by section (alphabetic)
    result.sort((a, b) => {
      // First extract numeric grade level
      let gradeA = 0;
      let gradeB = 0;
      
      if (a.grade_level === 'Kindergarten') {
        gradeA = 0;
      } else {
        gradeA = parseInt(a.grade_level.toString().replace('Grade ', ''));
      }
      
      if (b.grade_level === 'Kindergarten') {
        gradeB = 0;
      } else {
        gradeB = parseInt(b.grade_level.toString().replace('Grade ', ''));
      }
      
      // Primary sort by grade level
      if (gradeA !== gradeB) {
        return gradeA - gradeB;
      }
      
      // Secondary sort by section
      return a.section.localeCompare(b.section);
    });
    
    setFilteredClasses(result);
    // Reset to first page when filter changes
    setCurrentPage(1);
  };

  const fetchClasses = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all classes without filtering by school year
      const response = await fetchGrading('/api/classes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch classes');
      }

      const data = await response.json();
      setClassList(data);
    } catch (error) {
      console.error('Error fetching classes:', error);
      setError('Error loading classes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchoolYears = async () => {
    try {
      setLoading(true);
      const response = await fetchGrading('/api/school-years');
      
      if (!response.ok) {
        throw new Error('Failed to fetch school years');
      }
      
      const data = await response.json();
      
      // Find the active school year
      const active = data.find(year => year.is_active);
      setActiveSchoolYear(active || null);
      
      // If active school year exists, set it in the form data and as the selected filter
      if (active) {
        setFormData(prev => ({
          ...prev,
          school_year: active.school_year
        }));
        
        // Set the active school year as the default filter
        setSelectedSchoolYear(active.school_year_id.toString());
      }
      
      setSchoolYears(data);
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to load school years');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveTeachers = async () => {
    try {
      // Get the active school year ID
      const selectedYear = schoolYears.find(year => year.school_year === formData.school_year);
      if (!selectedYear) {
        setActiveTeachers([]);
        return;
      }

      const response = await fetchGrading(`/api/teachers/available-advisers?schoolYearId=${selectedYear.school_year_id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Failed to fetch available teachers');
      }
      
      const data = await response.json();
      console.log('Available teachers:', data); // Debug log
      setActiveTeachers(data);
      setError(null); // Clear any previous errors
    } catch (error) {
      console.error('Error fetching active teachers:', error);
      setError(error.message || 'Failed to load available teachers');
      setActiveTeachers([]); // Reset the teachers list on error
    }
  };

  const handleSchoolYearFilterChange = (e) => {
    setSelectedSchoolYear(e.target.value);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsAddingClass(true);
    try {
      if (!formData.grade_level || !formData.section || !formData.school_year || !formData.class_adviser_id || !formData.program_name) {
        setError('Please fill in all required fields');
        setIsAddingClass(false);
        return;
      }
      
      // Find the selected school year
      const selectedYear = schoolYears.find(year => year.school_year === formData.school_year);
      
      // Create class description from grade level and section
      const class_description = formData.grade_level === 'Kindergarten' 
        ? `Kindergarten-${formData.section}`
        : `Grade ${formData.grade_level}-${formData.section}`;
      
      const requestData = {
        grade_level: formData.grade_level,
        section: formData.section,
        class_description: class_description,
        school_year_id: selectedYear ? selectedYear.school_year_id : null,
        class_adviser_id: formData.class_adviser_id || null,
        program_name: formData.program_name,
        class_code: formData.class_code
      };

      const response = await fetchGrading('/api/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || 'Unknown server error';
        } catch (e) {
          errorMessage = errorText || `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const newClass = await response.json();

      // Reset form but keep the school year
      setFormData({
        grade_level: '',
        section: '',
        school_year: selectedYear.school_year, // Keep the current school year
        class_adviser_id: '',
        program_name: '',
        class_code: ''
      });
      
      setError(null);
      await fetchClasses(); // Refresh the class list
      await fetchActiveTeachers(); // Refresh the available teachers list
      setIsModalOpen(false);
      setIsAddingClass(false);

    } catch (error) {
      console.error('Error adding class:', error);
      setError('Failed to add class. Please try again.');
      setIsAddingClass(false);
    }
  };

  const handleViewSubjects = (classId) => {
    navigate(`/manage-class-view-subject/${classId}`);
  };

  const handleViewStudents = (classId) => {
    navigate(`/manage-class-view-student/${classId}`);
  };

  const openModal = () => {
    setIsModalOpen(true);
    setError(null);
    
    // Reset form data first
    setFormData({
      subject_id: '',
      teacher_id: '',
      grade_level: '',
      section: '',
      school_year: activeSchoolYear ? activeSchoolYear.school_year : '',
      class_adviser_id: '',
      program_name: '',
      class_code: ''
    });

    // Refresh available teachers list when opening modal
    fetchActiveTeachers();
  };

  const closeModal = () => {
    // Reset form but keep the current school year
    setFormData({
      grade_level: '',
      section: '',
      school_year: activeSchoolYear ? activeSchoolYear.school_year : '',
      class_adviser_id: '',
      program_name: '',
      class_code: ''
    });
    setError(null);
    setIsModalOpen(false);
  };

  // Add pagination calculation
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredClasses.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredClasses.length / itemsPerPage);

  // Add page change handler
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Function to handle opening the edit adviser modal
  const handleEditAdviser = (classItem) => {
    setEditAdviserModal({
      isOpen: true,
      classItem
    });
    setEditAdviserFormData({
      class_adviser_id: classItem.class_adviser_id || ''
    });
    fetchActiveTeachers();
  };

  // Function to close the edit adviser modal
  const closeEditAdviserModal = () => {
    setEditAdviserModal({
      isOpen: false,
      classItem: null
    });
    setEditAdviserFormData({
      class_adviser_id: ''
    });
    setError(null);
  };

  // Function to handle updating the class adviser
  const handleUpdateAdviser = async (e) => {
    e.preventDefault();
    setIsReassigningAdviser(true);
    if (!editAdviserFormData.class_adviser_id) {
      setError('Please select a class adviser');
      setIsReassigningAdviser(false);
      return;
    }
    try {
      // Create the request data
      const requestData = {
        class_id: editAdviserModal.classItem.class_id,
        class_adviser_id: editAdviserFormData.class_adviser_id
      };
      
      console.log('Updating adviser with data:', requestData);
      
      // Try using a custom endpoint for class advisers
      const response = await fetchGrading('/api/classes/update-adviser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || 'Unknown server error';
        } catch (e) {
          errorMessage = errorText || `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      // Close modal and refresh classes
      closeEditAdviserModal();
      await fetchClasses();
      
      // Refresh the page to show updated data and reflect any subject teacher changes
      window.location.reload();
      setIsReassigningAdviser(false);
    } catch (error) {
      console.error('Error updating class adviser:', error);
      setError('Failed to update class adviser. Please try again.');
      setIsReassigningAdviser(false);
    }
  };

  // Handle input change for edit adviser form
  const handleEditAdviserInputChange = (e) => {
    const { name, value } = e.target;
    setEditAdviserFormData({
      ...editAdviserFormData,
      [name]: value
    });
  };

  // Add a useEffect to automatically set class_code based on program_name
  useEffect(() => {
    if (formData.program_name) {
      let classCode = '';
      
      // Set class code based on program name
      switch (formData.program_name) {
        case 'Kindergarten Group':
          classCode = 'kg';
          break;
        case 'Kindergarten one-on-one':
          classCode = 'k1';
          break;
        case 'Grade 1':
          classCode = 'gs';
          break;
        case 'Grade 1 one-on-one':
          classCode = 'ga';
          break;
        case 'Grade 2':
          classCode = 'g2';
          break;
        case 'Grade 2 one-on-one':
          classCode = 'gb';
          break;
        case 'Grade 3':
          classCode = 'g3';
          break;
        case 'Grade 3 one-on-one':
          classCode = 'gc';
          break;
        case 'Grade 4':
          classCode = 'g4';
          break;
        case 'Grade 4 one-on-one':
          classCode = 'gd';
          break;
        case 'Grade 5':
          classCode = 'g5';
          break;
        case 'Grade 5 one-on-one':
          classCode = 'ge';
          break;
        case 'Grade 6':
          classCode = 'g6';
          break;
        case 'Grade 6 one-on-one':
          classCode = 'gf';
          break;
        default:
          classCode = '';
      }
      
      setFormData(prev => ({
        ...prev,
        class_code: classCode
      }));
    }
  }, [formData.program_name]);

  // Update handleDeleteClass to show modal instead of window.confirm
  const handleDeleteClass = (classId) => {
    const classItem = filteredClasses.find(c => c.class_id === classId);
    setClassToDelete(classItem);
    setShowDeleteModal(true);
  };

  // Function to actually delete the class after confirmation
  const confirmDeleteClass = async () => {
    if (!classToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetchGrading(`/api/classes/${classToDelete.class_id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to delete class');
      }
      setShowDeleteModal(false);
      setClassToDelete(null);
      setIsDeleting(false);
      await fetchClasses();
    } catch (error) {
      console.error('Error deleting class:', error);
      setError('Failed to delete class. Please try again.');
      setShowDeleteModal(false);
      setClassToDelete(null);
      setIsDeleting(false);
    }
  };

  // Add or update useEffect to handle blur overlay for delete modal
  useEffect(() => {
    if (showDeleteModal) {
      const blurOverlay = document.createElement('div');
      blurOverlay.id = 'blur-overlay';
      blurOverlay.style.position = 'fixed';
      blurOverlay.style.top = '0';
      blurOverlay.style.left = '0';
      blurOverlay.style.width = '100%';
      blurOverlay.style.height = '100%';
      blurOverlay.style.backdropFilter = 'blur(4px)';
      blurOverlay.style.zIndex = '50';
      blurOverlay.style.pointerEvents = 'none';
      document.body.appendChild(blurOverlay);
    } else {
      const existingOverlay = document.getElementById('blur-overlay');
      if (existingOverlay) {
        document.body.removeChild(existingOverlay);
      }
    }
    return () => {
      const existingOverlay = document.getElementById('blur-overlay');
      if (existingOverlay) {
        document.body.removeChild(existingOverlay);
      }
    };
  }, [showDeleteModal]);

  return (
    <div className="content-container bg-[#F3F3F6]">
      <div className="p-8">
        {/* Inactive teacher warning banner - Minimalist design */}
        {inactiveTeacherWarning.length > 0 && (
          <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 rounded-md shadow-sm overflow-hidden">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-medium text-amber-800">
                      There {inactiveTeacherWarning.length === 1 
                        ? 'is 1 inactive teacher' 
                        : `are ${inactiveTeacherWarning.length} inactive teachers`} still assigned to classes. Please have an exchange teacher/s for the affected classes.
                      <button 
                        id="toggle-details-btn"
                        className="ml-3 text-amber-700 underline text-sm hover:text-amber-900 focus:outline-none"
                        onClick={() => {
                          const detailsElem = document.getElementById('inactive-teacher-details');
                          const btn = document.getElementById('toggle-details-btn');
                          if (detailsElem.classList.contains('hidden')) {
                            detailsElem.classList.remove('hidden');
                            btn.textContent = 'Hide details';
                          } else {
                            detailsElem.classList.add('hidden');
                            btn.textContent = 'Show details';
                          }
                        }}
                      >
                        Show details
                      </button>
                    </p>
                  </div>
                </div>
              </div>
              
              <div id="inactive-teacher-details" className="hidden mt-2">
                {inactiveTeacherWarning.map((teacher) => (
                  <div key={teacher.user_id} className="mt-2 pl-7 border-t border-amber-200 pt-2">
                    <div className="font-medium text-amber-800">
                      {teacher.fname} {teacher.lname}:
                    </div>
                    {teacher.assignedClasses && teacher.assignedClasses.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {teacher.assignedClasses.map((classInfo, index) => (
                          <span key={index} className="inline-flex items-center px-2 py-1 bg-white text-xs font-medium text-amber-700 rounded border border-amber-300">
                            Grade {classInfo.grade_level}-{classInfo.section} 
                            <span className="mx-1 text-amber-400">•</span>
                            {classInfo.subject}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Inactive class adviser warning banner */}
        {inactiveAdviserWarning.length > 0 && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-md shadow-sm overflow-hidden">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-medium text-red-800">
                      <span className="font-bold">URGENT:</span> There {inactiveAdviserWarning.length === 1 
                        ? 'is 1 class with an inactive class adviser' 
                        : `are ${inactiveAdviserWarning.length} classes with inactive class advisers`}.
                      Please reassign class advisers immediately.
                      <button 
                        id="toggle-adviser-details-btn"
                        className="ml-3 text-red-700 underline text-sm hover:text-red-900 focus:outline-none"
                        onClick={() => {
                          const detailsElem = document.getElementById('inactive-adviser-details');
                          const btn = document.getElementById('toggle-adviser-details-btn');
                          if (detailsElem.classList.contains('hidden')) {
                            detailsElem.classList.remove('hidden');
                            btn.textContent = 'Hide details';
                          } else {
                            detailsElem.classList.add('hidden');
                            btn.textContent = 'Show details';
                          }
                        }}
                      >
                        Show details
                      </button>
                    </p>
                  </div>
                </div>
              </div>
              
              <div id="inactive-adviser-details" className="hidden mt-2">
                <div className="flex flex-wrap gap-1 mt-1">
                  {inactiveAdviserWarning.map((classInfo) => (
                    <span key={classInfo.class_id} className="inline-flex items-center px-3 py-1.5 bg-white text-sm font-medium text-red-700 rounded border border-red-300">
                      Grade {classInfo.grade_level}-{classInfo.section} 
                      <span className="mx-1 text-red-400">•</span>
                      Adviser: {classInfo.adviser_name}
                      <button
                        onClick={() => handleEditAdviser({
                          class_id: classInfo.class_id,
                          grade_level: classInfo.grade_level,
                          section: classInfo.section,
                          adviser_fname: classInfo.adviser_name.split(' ')[0],
                          adviser_lname: classInfo.adviser_name.split(' ').slice(-1)[0]
                        })}
                        className="ml-2 text-red-600 hover:text-red-800"
                        title="Reassign class adviser"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-sm text-red-700">
                  <p>➡️ Click the edit icon on any class to reassign the class adviser.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add school year filter and ADD CLASS button in the same row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <label htmlFor="schoolYearFilter" className="mr-3 font-medium text-gray-700">
              School Year:
            </label>
            <select
              id="schoolYearFilter"
              value={selectedSchoolYear}
              onChange={handleSchoolYearFilterChange}
              className="border border-gray-300 rounded-md py-2 px-3 text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:border-transparent"
            >
              <option value="all">All School Years</option>
              {schoolYears.map(year => (
                <option key={year.school_year_id} value={year.school_year_id.toString()}>
                  {year.school_year} {year.is_active ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>
          
          {/* ADD CLASS button moved to top right */}
          <button
            onClick={openModal}
            className="px-4 py-2 bg-[#526D82] text-white rounded-md font-medium
              hover:bg-[#3E5367] transition-colors duration-200"
          >
            + ADD CLASS
          </button>
        </div>

        <div className="bg-white rounded shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
              <thead>
                <tr className="bg-[#526D82]">
                  <th className="py-4 px-6 text-left text-white font-medium">Class ID</th>
                  <th className="py-4 px-6 text-left text-white font-medium">Grade Level</th>
                  <th className="py-4 px-6 text-left text-white font-medium">Section</th>
                  <th className="py-4 px-6 text-left text-white font-medium">Program Name</th>
                  <th className="py-4 px-6 text-left text-white font-medium">Class Code</th>
                  {selectedSchoolYear === 'all' && (
                    <th className="py-4 px-6 text-left text-white font-medium">School Year</th>
                  )}
                  <th className="py-4 px-6 text-left text-white font-medium">Class Adviser</th>
                  <th className="py-4 px-6 text-center text-white font-medium">Subjects</th>
                  <th className="py-4 px-6 text-center text-white font-medium">Students</th>
                  <th className="py-4 px-6 text-center text-white font-medium">Delete</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={selectedSchoolYear === 'all' ? 10 : 9} className="py-8 px-6 text-center text-gray-500">
                      <div className="flex justify-center items-center">
                        <svg className="animate-spin h-5 w-5 mr-3 text-[#526D82]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading...
                      </div>
                    </td>
                  </tr>
                ) : filteredClasses.length === 0 ? (
                  <tr>
                    <td colSpan={selectedSchoolYear === 'all' ? 10 : 9} className="py-8 px-6 text-center text-gray-500">
                      No classes found for the selected school year.
                    </td>
                  </tr>
                ) : (
                  currentItems.map((classItem) => (
                    <tr key={classItem.class_id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-6">{classItem.class_id}</td>
                      <td className="py-4 px-6">
                        {classItem.grade_level === 'Kindergarten' 
                          ? 'Kindergarten'
                          : classItem.grade_level.toString().startsWith('Grade') 
                            ? classItem.grade_level 
                            : `Grade ${classItem.grade_level}`}
                      </td>
                      <td className="py-4 px-6">{classItem.section}</td>
                      <td className="py-4 px-6">{classItem.program_name || '-'}</td>
                      <td className="py-4 px-6">{classItem.class_code || '-'}</td>
                      {selectedSchoolYear === 'all' && (
                        <td className="py-4 px-6">{classItem.school_year}</td>
                      )}
                      <td className="py-4 px-6">
                        {classItem.adviser_fname 
                          ? (
                            <div className="flex items-center justify-between">
                              <span>{`${classItem.adviser_fname} ${classItem.adviser_mname ? classItem.adviser_mname + ' ' : ''}${classItem.adviser_lname}`}</span>
                              <button
                                onClick={() => handleEditAdviser(classItem)}
                                className="ml-2 text-blue-600 hover:text-blue-800"
                                title="Edit class adviser"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                          )
                          : (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 italic">Not assigned</span>
                              <button
                                onClick={() => handleEditAdviser(classItem)}
                                className="ml-2 text-blue-600 hover:text-blue-800"
                                title="Assign class adviser"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                          )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleViewSubjects(classItem.class_id)}
                          className="px-3 py-1 text-[#526D82] hover:bg-[#526D82] hover:text-white rounded transition-colors duration-200 border border-[#526D82]"
                        >
                          View
                        </button>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleViewStudents(classItem.class_id)}
                          className="px-3 py-1 text-[#526D82] hover:bg-[#526D82] hover:text-white rounded transition-colors duration-200 border border-[#526D82]"
                        >
                          View
                        </button>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="inline-block relative group">
                          <button
                            onClick={() => handleDeleteClass(classItem.class_id)}
                            className="text-red-500 hover:text-red-700 transition-colors duration-200 font-bold"
                            aria-label="Remove class"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 font-bold"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              strokeWidth="2"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                          {/* Updated tooltip positioning - always to the left */}
                          <div className="absolute hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap z-10 shadow-lg">
                            Remove this class
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Add Pagination component */}
          {filteredClasses.length > 0 && (
            <div className="border-t border-gray-200">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
        
        {error && (
          <div className="text-center mt-6 text-red-600 bg-red-50 p-3 rounded border border-red-200">
            <p>{error}</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 100 }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeModal}></div>
          <div className="bg-white p-0 rounded-lg shadow-xl w-full max-w-md overflow-hidden relative z-10">
            {/* Modal Header with gradient background */}
            <div className="bg-gradient-to-r from-[#3E5367] to-[#526D82] px-6 py-4 sticky top-0 z-10">
              <h2 className="text-2xl font-bold text-white">Add New Class</h2>
            </div>
            
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {/* Info Note */}
              <div className="mb-6 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500 flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> Class ID will be automatically generated.
                  The Class Description will be set as: <span className="font-mono bg-blue-100 px-1 py-0.5 rounded">
                    {formData.grade_level === 'Kindergarten' 
                      ? `Kindergarten-${formData.section || 'Y'}`
                      : `Grade ${formData.grade_level || 'X'}-${formData.section || 'Y'}`}
                  </span>
                </p>
              </div>
              
              {error && (
                <div className="mb-4 bg-red-50 p-4 rounded-lg border-l-4 border-red-500 flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="grade_level">
                    Grade Level
                  </label>
                  <select
                    id="grade_level"
                    name="grade_level"
                    value={formData.grade_level}
                    onChange={handleInputChange}
                    className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:border-transparent transition-all duration-200"
                  >
                    <option value="">Select Grade Level</option>
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
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="section">
                    Section
                  </label>
                  <input
                    type="text"
                    id="section"
                    name="section"
                    value={formData.section}
                    onChange={handleInputChange}
                    className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:border-transparent transition-all duration-200"
                    placeholder="Enter Section"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="program_name">
                    Program Name <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="program_name"
                    name="program_name"
                    value={formData.program_name}
                    onChange={handleInputChange}
                    disabled={!formData.grade_level}
                    className={`shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:border-transparent transition-all duration-200 ${!formData.grade_level ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Select Program</option>
                    {formData.grade_level === 'Kindergarten' && (
                      <>
                        <option value="Kindergarten Group">Kindergarten Group</option>
                        <option value="Kindergarten one-on-one">Kindergarten one-on-one</option>
                      </>
                    )}
                    {formData.grade_level === '1' && (
                      <>
                        <option value="Grade 1">Grade 1</option>
                        <option value="Grade 1 one-on-one">Grade 1 one-on-one</option>
                      </>
                    )}
                    {formData.grade_level === '2' && (
                      <>
                        <option value="Grade 2">Grade 2</option>
                        <option value="Grade 2 one-on-one">Grade 2 one-on-one</option>
                      </>
                    )}
                    {formData.grade_level === '3' && (
                      <>
                        <option value="Grade 3">Grade 3</option>
                        <option value="Grade 3 one-on-one">Grade 3 one-on-one</option>
                      </>
                    )}
                    {formData.grade_level === '4' && (
                      <>
                        <option value="Grade 4">Grade 4</option>
                        <option value="Grade 4 one-on-one">Grade 4 one-on-one</option>
                      </>
                    )}
                    {formData.grade_level === '5' && (
                      <>
                        <option value="Grade 5">Grade 5</option>
                        <option value="Grade 5 one-on-one">Grade 5 one-on-one</option>
                      </>
                    )}
                    {formData.grade_level === '6' && (
                      <>
                        <option value="Grade 6">Grade 6</option>
                        <option value="Grade 6 one-on-one">Grade 6 one-on-one</option>
                      </>
                    )}
                  </select>
                  {!formData.grade_level && (
                    <p className="mt-1 text-xs text-amber-600">
                      Please select a Grade Level first.
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="class_code">
                    Class Code
                  </label>
                  <input
                    type="text"
                    id="class_code"
                    name="class_code"
                    value={formData.class_code}
                    readOnly
                    className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-3 text-gray-700 bg-gray-50 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Class code is automatically set based on the selected program.
                  </p>
                </div>
                
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    School Year
                  </label>
                  <div className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-3 text-gray-700 bg-gray-50">
                    {activeSchoolYear ? `${activeSchoolYear.school_year} (Active)` : 'No active school year found'}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Classes can only be added for the active school year.
                  </p>
                </div>
                
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="class_adviser_id">
                    Class Adviser <span className="text-red-500">*</span>
                  </label>
                  {/* Autocomplete input for class adviser */}
                  <div className="relative">
                    <input
                      type="text"
                      id="class_adviser_autocomplete"
                      name="class_adviser_autocomplete"
                      autoComplete="off"
                      value={formData.class_adviser_name || ''}
                      onChange={e => {
                        const value = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          class_adviser_name: value,
                          class_adviser_id: '' // Reset id until selected
                        }));
                        setShowAdviserSuggestions(true);
                      }}
                      onFocus={() => setShowAdviserSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowAdviserSuggestions(false), 100)}
                      placeholder="Type to search adviser..."
                      className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:border-transparent transition-all duration-200"
                    />
                    {/* Suggestions dropdown */}
                    {showAdviserSuggestions && formData.class_adviser_name && (
                      <ul className="absolute z-20 left-0 right-0 bg-white border border-gray-200 rounded shadow max-h-48 overflow-y-auto mt-1">
                        {activeTeachers.filter(t =>
                          (`${t.fname} ${t.mname ? t.mname + ' ' : ''}${t.lname}`.toLowerCase().includes(formData.class_adviser_name.toLowerCase()))
                        ).length === 0 ? (
                          <li className="px-3 py-2 text-gray-400">No adviser found</li>
                        ) : (
                          activeTeachers.filter(t =>
                            (`${t.fname} ${t.mname ? t.mname + ' ' : ''}${t.lname}`.toLowerCase().includes(formData.class_adviser_name.toLowerCase()))
                          ).map(t => (
                            <li
                              key={t.user_id}
                              className="px-3 py-2 hover:bg-[#F3F3F6] cursor-pointer"
                              onMouseDown={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  class_adviser_name: `${t.fname} ${t.mname ? t.mname + ' ' : ''}${t.lname}`,
                                  class_adviser_id: t.user_id
                                }));
                                setShowAdviserSuggestions(false);
                              }}
                            >
                              {t.fname} {t.mname ? t.mname + ' ' : ''}{t.lname}
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                  {formData.grade_level && ['1', '2', '3', 'Kindergarten'].includes(formData.grade_level) && (
                    <p className="mt-1 text-sm text-blue-600 italic">
                      For Kindergarten and grades 1-3, the class adviser will teach all subjects in this class.
                    </p>
                  )}
                  {formData.grade_level && ['4', '5', '6'].includes(formData.grade_level) && (
                    <p className="mt-1 text-sm text-blue-600 italic">
                      For grades 4-6, the class adviser must teach at least one subject in this class to handle attendance.
                    </p>
                  )}
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2.5 px-5 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`bg-[#526D82] hover:bg-[#3E5367] text-white font-medium py-2.5 px-5 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:ring-opacity-50 flex items-center justify-center ${isAddingClass ? 'opacity-70 cursor-not-allowed' : ''}`}
                    disabled={isAddingClass}
                  >
                    {isAddingClass ? (
                      <>
                        <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Adding Class...
                      </>
                    ) : 'Add Class'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Edit Adviser Modal */}
      {editAdviserModal.isOpen && editAdviserModal.classItem && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 100 }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeEditAdviserModal}></div>
          <div className="bg-white p-0 rounded-lg shadow-xl w-full max-w-md overflow-hidden relative z-10">
            {/* Modal Header with gradient background */}
            <div className="bg-gradient-to-r from-[#3E5367] to-[#526D82] px-6 py-4 sticky top-0 z-10">
              <h2 className="text-2xl font-bold text-white">
                {editAdviserModal.classItem.adviser_fname
                  ? 'Reassign Class Adviser'
                  : 'Assign Class Adviser'}
              </h2>
            </div>
            
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {/* Class Info */}
              <div className="mb-4">
                <h3 className="font-medium text-gray-700">Class:</h3>
                <p className="text-gray-900">
                  {editAdviserModal.classItem.grade_level === 'Kindergarten' 
                    ? 'Kindergarten' 
                    : `Grade ${editAdviserModal.classItem.grade_level}`}-{editAdviserModal.classItem.section}
                  {editAdviserModal.classItem.school_year && ` (${editAdviserModal.classItem.school_year})`}
                </p>
              </div>
              
              {/* Current Adviser */}
              {editAdviserModal.classItem.adviser_fname && (
                <div className="mb-4">
                  <h3 className="font-medium text-gray-700">Current Adviser:</h3>
                  <p className="text-gray-900">
                    {`${editAdviserModal.classItem.adviser_fname} ${editAdviserModal.classItem.adviser_mname ? editAdviserModal.classItem.adviser_mname + ' ' : ''}${editAdviserModal.classItem.adviser_lname}`}
                  </p>
                </div>
              )}
              
              {/* Error display */}
              {error && (
                <div className="mb-4 bg-red-50 p-4 rounded-lg border-l-4 border-red-500 flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              
              <form onSubmit={handleUpdateAdviser} className="mt-2">
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="edit_class_adviser_id">
                    New Class Adviser <span className="text-red-500">*</span>
                  </label>
                  {/* Autocomplete input for edit adviser */}
                  <div className="relative">
                    <input
                      type="text"
                      id="edit_class_adviser_autocomplete"
                      name="edit_class_adviser_autocomplete"
                      autoComplete="off"
                      value={editAdviserFormData.class_adviser_name || ''}
                      onChange={e => {
                        const value = e.target.value;
                        setEditAdviserFormData(prev => ({
                          ...prev,
                          class_adviser_name: value,
                          class_adviser_id: '' // Reset id until selected
                        }));
                        setShowEditAdviserSuggestions(true);
                      }}
                      onFocus={() => setShowEditAdviserSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowEditAdviserSuggestions(false), 100)}
                      placeholder="Type to search adviser..."
                      className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:border-transparent transition-all duration-200"
                      required
                    />
                    {/* Suggestions dropdown */}
                    {showEditAdviserSuggestions && editAdviserFormData.class_adviser_name && (
                      <ul className="absolute z-20 left-0 right-0 bg-white border border-gray-200 rounded shadow max-h-48 overflow-y-auto mt-1">
                        {activeTeachers.filter(t =>
                          (`${t.fname} ${t.mname ? t.mname + ' ' : ''}${t.lname}`.toLowerCase().includes(editAdviserFormData.class_adviser_name.toLowerCase()))
                        ).length === 0 ? (
                          <li className="px-3 py-2 text-gray-400">No adviser found</li>
                        ) : (
                          activeTeachers.filter(t =>
                            (`${t.fname} ${t.mname ? t.mname + ' ' : ''}${t.lname}`.toLowerCase().includes(editAdviserFormData.class_adviser_name.toLowerCase()))
                          ).map(t => (
                            <li
                              key={t.user_id}
                              className="px-3 py-2 hover:bg-[#F3F3F6] cursor-pointer"
                              onMouseDown={() => {
                                setEditAdviserFormData(prev => ({
                                  ...prev,
                                  class_adviser_name: `${t.fname} ${t.mname ? t.mname + ' ' : ''}${t.lname}`,
                                  class_adviser_id: t.user_id
                                }));
                                setShowEditAdviserSuggestions(false);
                              }}
                            >
                              {t.fname} {t.mname ? t.mname + ' ' : ''}{t.lname}
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeEditAdviserModal}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2.5 px-5 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`bg-[#526D82] hover:bg-[#3E5367] text-white font-medium py-2.5 px-5 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:ring-opacity-50 flex items-center justify-center ${isReassigningAdviser ? 'opacity-70 cursor-not-allowed' : ''}`}
                    disabled={isReassigningAdviser}
                  >
                    {isReassigningAdviser ? (
                      <>
                        <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Reassigning Adviser...
                      </>
                    ) : (editAdviserModal.classItem.adviser_fname ? 'Reassign Adviser' : 'Assign Adviser')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && classToDelete && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 100 }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => {
            setShowDeleteModal(false);
            setClassToDelete(null);
          }}></div>
          <div className="bg-white rounded-lg shadow-2xl p-0 max-w-md w-full border border-red-200 relative z-10">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-400 px-6 py-4 rounded-t-lg">
              <h2 className="text-xl font-bold text-white flex items-center">
                <svg className="h-6 w-6 mr-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                Confirm Delete Class
              </h2>
            </div>
            {/* Modal Body */}
            <div className="px-8 py-6 bg-red-50">
              <p className="mb-4 text-red-800 font-medium">
                Are you sure you want to <span className="font-bold">delete</span> the following class? This action <span className="underline">cannot be undone</span>.
              </p>
              <div className="mb-4 p-3 bg-white rounded border border-red-200 text-sm">
                <div><b>Class ID:</b> {classToDelete.class_id}</div>
                <div><b>Grade Level:</b> {classToDelete.grade_level}</div>
                <div><b>Section:</b> {classToDelete.section}</div>
                <div><b>Program:</b> {classToDelete.program_name}</div>
                <div><b>School Year:</b> {classToDelete.school_year}</div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { setShowDeleteModal(false); setClassToDelete(null); }}
                  className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 font-medium transition-colors duration-150"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteClass}
                  className={`px-4 py-2 rounded bg-red-600 text-white font-bold border border-red-700 shadow-sm flex items-center justify-center transition-colors duration-150 ${isDeleting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-red-700'}`}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Deleting...
                    </>
                  ) : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageClass;
