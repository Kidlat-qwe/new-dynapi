import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { gradingUrl, getAuthHeader, fetchGrading } from './lib/api';

const ManageClassViewStudent = () => {
  const { classId } = useParams();
  const [students, setStudents] = useState([]);
  const [classInfo, setClassInfo] = useState({ class_id: classId, class_description: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [formData, setFormData] = useState({
    student_id: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const navigate = useNavigate();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const searchContainerRef = useRef(null);
  const [assignButtonDisabled, setAssignButtonDisabled] = useState(false);
  const [actionMenuOpenId, setActionMenuOpenId] = useState(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveClasses, setMoveClasses] = useState([]);
  const [selectedMoveClassId, setSelectedMoveClassId] = useState('');
  const [moveClassSearch, setMoveClassSearch] = useState('');
  const [showMoveClassDropdown, setShowMoveClassDropdown] = useState(false);

  useEffect(() => {
    fetchClassInfo();
    fetchClassStudents();
  }, [classId]);

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

  // Close action menu on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (actionMenuOpenId === null) return;
      const withinMenu = e.target.closest('[data-action-menu-container]');
      if (!withinMenu) setActionMenuOpenId(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [actionMenuOpenId]);

  // Close move class dropdown on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!showMoveClassDropdown) return;
      const withinDropdown = e.target.closest('[data-move-class-container]');
      if (!withinDropdown) setShowMoveClassDropdown(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showMoveClassDropdown]);

  useEffect(() => {
    if (isModalOpen) {
      fetchAvailableStudents();
    }
  }, [isModalOpen]);

  useEffect(() => {
    console.log('Current class info:', classInfo);
  }, [classInfo]);

  // Add click outside listener for search dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        // Only clear search when clicking outside the entire search container
        setSearchTerm('');
      }
    };

    // Only add listener when modal is open
    if (isModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModalOpen]);

  const fetchClassInfo = async () => {
    try {
      // Get class info directly from the general classes endpoint
      const response = await fetchGrading('/api/classes');
      if (!response.ok) {
        throw new Error('Failed to fetch classes');
      }
      
      const allClasses = await response.json();
      const currentClass = allClasses.find(c => c.class_id === parseInt(classId));
      
      if (!currentClass) {
        throw new Error('Class not found');
      }
      
      console.log('Found class info:', currentClass);
      setClassInfo(currentClass);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching class info:', error);
      setError('Failed to load class information');
      setLoading(false);
    }
  };

  const fetchClassStudents = async () => {
    try {
      console.log(`Fetching students for class ID: ${classId}`);
      const response = await axios.get(gradingUrl(`/api/classes/${classId}/students`), { headers: getAuthHeader() });
      setStudents(response.data);
    } catch (error) {
      console.error('Error fetching students for class:', error);
      setError('Failed to load class students');
    }
  };

  const fetchAvailableStudents = async () => {
    try {
      const response = await axios.get(gradingUrl(`/api/classes/${classId}/available-students`), {
        params: { classId, schoolYearId: classInfo.school_year_id },
        headers: getAuthHeader()
      });
      setAvailableStudents(response.data);
    } catch (error) {
      console.error('Error fetching available students:', error);
      setError('Failed to load available students');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleStudentSelection = (studentId) => {
    setSelectedStudents(prev => {
      // If student is already selected, remove them
      if (prev.includes(studentId)) {
        return prev.filter(id => id !== studentId);
      } else {
        // Otherwise add them to the selection
        return [...prev, studentId];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // If no students selected, show error
      if (selectedStudents.length === 0) {
        setError('Please select at least one student');
        return;
      }

      // Process each selected student
      const results = await Promise.all(
        selectedStudents.map(async (studentId) => {
          try {
            // First, fetch the student's previous grade level
            const response = await fetchGrading(`/api/students/${studentId}/previous-grade`);
            if (!response.ok) throw new Error('Failed to fetch student history');
            const { previousGradeLevel, isNewStudent } = await response.json();

            // Helper function to convert grade level to a number
            // Kindergarten = 0, Grade 1 = 1, Grade 2 = 2, etc.
            const gradeToNumber = (gradeLevel) => {
              if (!gradeLevel) return 0;
              if (gradeLevel === 'Kindergarten' || gradeLevel === 'K') return 0;
              // Extract number from "Grade X" format
              const match = gradeLevel.match(/Grade (\d+)/);
              return match ? parseInt(match[1]) : 0;
            };

            // Get the current class grade level as a number
            const currentLevel = gradeToNumber(classInfo.grade_level);

            // Skip validation for new students
            if (!isNewStudent) {
              // Convert previous grade level to a number
              const prevLevel = gradeToNumber(previousGradeLevel);

              console.log(`Student ${studentId} - Previous: ${previousGradeLevel} (${prevLevel}), Current: ${classInfo.grade_level} (${currentLevel})`);

              if (currentLevel < prevLevel) {
                return { 
                  studentId, 
                  success: false, 
                  message: 'Cannot be assigned to a lower grade level' 
                };
              }
              if (currentLevel > prevLevel + 1) {
                return { 
                  studentId, 
                  success: false, 
                  message: 'Can only advance one grade level at a time' 
                };
              }
            }

            // If validation passes or student is new, proceed with assignment
            const assignResponse = await fetchGrading(`/api/classes/${classId}/students`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                student_id: studentId
              })
            });

            if (!assignResponse.ok) {
              throw new Error('Failed to assign student');
            }

            return { studentId, success: true };
          } catch (error) {
            console.error(`Error assigning student ${studentId}:`, error);
            return { studentId, success: false, message: error.message };
          }
        })
      );
      
      // Check if all assignments were successful
      const allSuccessful = results.every(result => result.success);
      
      if (allSuccessful) {
        // Success handling
        setSelectedStudents([]);
        setSearchTerm('');
        closeModal();
        fetchClassStudents();
      } else {
        // Some assignments failed
        const failedAssignments = results.filter(result => !result.success);
        setError(`Failed to assign ${failedAssignments.length} student(s). Please try again.`);
      }
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
    }
  };

  // Filter students based on search term
  const filteredStudents = searchTerm
    ? availableStudents.filter(student => 
        `${student.fname} ${student.mname || ''} ${student.lname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.user_id.toString().includes(searchTerm)
      )
    : [];
    
  // Helper function to highlight matching text in student names
  const highlightMatch = (text, query) => {
    if (!query || query === '') return text;
    
    const lcText = text.toLowerCase();
    const lcQuery = query.toLowerCase();
    const index = lcText.indexOf(lcQuery);
    
    if (index === -1) return text;
    
    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);
    
    return (
      <>
        {before}
        <span className="bg-yellow-200">{match}</span>
        {after}
      </>
    );
  };

  const openModal = () => {
    setIsModalOpen(true);
    setError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({
      student_id: ''
    });
    setSearchTerm('');
    setSelectedStudents([]);
    setError(null);
  };

  const handleRemoveStudent = async (studentId, studentName) => {
    setSelectedStudent({ id: studentId, name: studentName });
    setShowConfirmDialog(true);
  };

  const confirmRemoveStudent = async () => {
    try {
      const response = await axios.delete(gradingUrl(`/api/classes/${classId}/students/${selectedStudent.id}`), { headers: getAuthHeader() });
      if (response.status === 200) {
        setShowConfirmDialog(false);
        setShowSuccessDialog(true);
        fetchClassStudents();
        // Auto-hide success message after 2 seconds
        setTimeout(() => {
          setShowSuccessDialog(false);
          // Refresh the page after removing a student
          window.location.reload();
        }, 100);
      }
    } catch (error) {
      console.error('Error removing student:', error);
      setError('Failed to remove student from class');
    }
  };

  // Open move dialog: fetch candidate classes in same SY and same grade level
  const openMoveDialog = async () => {
    try {
      // Fetch all classes for same school year
      const classesRes = await axios.get(gradingUrl('/api/classes'), {
        params: { schoolYearId: classInfo.school_year_id },
        headers: getAuthHeader()
      });
      const all = Array.isArray(classesRes.data) ? classesRes.data : [];
      // Filter to same grade level and exclude current class
      const candidates = all.filter(c => c.grade_level === classInfo.grade_level && c.class_id !== Number(classId));
      // Fetch counts of male/female students for each candidate class
      const withCounts = await Promise.all(candidates.map(async (c) => {
        try {
          const res = await axios.get(gradingUrl(`/api/classes/${c.class_id}/students`), { headers: getAuthHeader() });
          const list = Array.isArray(res.data) ? res.data : [];
          console.log(`Class ${c.class_id} students:`, list); // Debug log
          const male = list.filter(s => s.gender === 'M' || s.gender === 'Male').length;
          const female = list.filter(s => s.gender === 'F' || s.gender === 'Female').length;
          return { ...c, male_count: male, female_count: female };
        } catch (error) {
          console.error(`Error fetching students for class ${c.class_id}:`, error);
          return { ...c, male_count: 0, female_count: 0 };
        }
      }));
      setMoveClasses(withCounts);
      setSelectedMoveClassId('');
      setMoveClassSearch('');
      setShowMoveClassDropdown(false);
      setShowMoveDialog(true);
      setActionMenuOpenId(null);
    } catch (err) {
      console.error('Error loading classes for move:', err);
      setError('Failed to load classes for move');
    }
  };

  // Execute move: remove from current class and add to selected class
  // Helper to get class display label
  const getClassLabel = (c) => {
    const code = c.class_code ? ` (${c.class_code})` : '';
    const maleCount = c.male_count || 0;
    const femaleCount = c.female_count || 0;
    return `${c.class_id} - ${c.section}${code} - ${maleCount}M/${femaleCount}F`;
  };

  // Enhanced search matching logic
  const getFilteredClasses = () => {
    if (!moveClassSearch.trim()) return moveClasses;
    const searchTerms = moveClassSearch.toLowerCase().split(/\s+/).filter(Boolean);
    
    return moveClasses.filter(c => {
      const searchableText = [
        c.class_id.toString(),
        c.section,
        c.class_code || '',
        c.adviser_fname || '',
        c.adviser_mname || '',
        c.adviser_lname || '',
        `${c.male_count || 0}M/${c.female_count || 0}F`,
        `${c.male_count || 0}M`,
        `${c.female_count || 0}F`
      ].join(' ').toLowerCase();
      
      // Match all search terms (AND logic)
      return searchTerms.every(term => searchableText.includes(term));
    });
  };

  // Handle class selection from dropdown
  const handleMoveClassSelect = (classId) => {
    const selectedClass = moveClasses.find(c => c.class_id === classId);
    if (selectedClass) {
      setSelectedMoveClassId(classId);
      setMoveClassSearch(getClassLabel(selectedClass));
      setShowMoveClassDropdown(false);
    }
  };

  // Highlight matching text in search results
  const highlightSearchMatch = (text, searchTerms) => {
    if (!searchTerms || searchTerms.length === 0) return text;
    
    let highlightedText = text;
    searchTerms.forEach(term => {
      if (term.length > 0) {
        const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 px-0">$1</mark>');
      }
    });
    
    return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
  };

  const confirmMoveStudent = async () => {
    try {
      if (!selectedStudent?.id || !selectedMoveClassId) {
        setError('Please select a destination class');
        return;
      }
      // Remove from current class
      await axios.delete(gradingUrl(`/api/classes/${classId}/students/${selectedStudent.id}`), { headers: getAuthHeader() });
      await axios.post(gradingUrl(`/api/classes/${selectedMoveClassId}/students`), { student_id: selectedStudent.id }, { headers: getAuthHeader() });
      setShowMoveDialog(false);
      setSelectedMoveClassId('');
      setMoveClassSearch('');
      setShowMoveClassDropdown(false);
      setSelectedStudent(null);
      fetchClassStudents();
      // quick success toast via existing dialog
      setShowSuccessDialog(true);
      setTimeout(() => setShowSuccessDialog(false), 1500);
    } catch (err) {
      console.error('Error moving student:', err);
      setError('Failed to move student');
    }
  };

  const handleBack = () => {
    navigate('/manage-class');
  };

  return (
    <div className="content-container bg-[#F3F3F6]">
      <div className="p-8">
        {/* Back button */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-[#526D82] hover:text-[#3E5367]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Manage Class
          </button>
        </div>
        {/* Grade description and Assign Student button in one line */}
        <div className="flex items-center gap-4 mb-6">
          <span className="bg-[#DFE4E8] px-3 py-1 rounded text-[#526D82]">
            {classInfo.grade_level && classInfo.section 
              ? `Grade ${classInfo.grade_level}-${classInfo.section}` 
              : (classInfo.class_description || `Class ID: ${classId}`)}
          </span>
          <div className="relative group">
            <button 
              className="px-3 py-1 bg-[#526D82] hover:bg-[#3E5367] text-white rounded 
                transition-colors duration-200 
                flex items-center gap-1 text-sm"
              onClick={() => setIsModalOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Assign Student
            </button>
          </div>
        </div>

        {/* Student List */}
        <div className="bg-white rounded-lg shadow-sm overflow-visible">
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading students...</div>
          ) : error ? (
            <div className="p-6 text-center text-red-500">{error}</div>
          ) : students.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No students assigned to this class.</div>
          ) : (
            <>
              <table className="w-full relative">
                <thead>
                  <tr className="bg-[#526D82]">
                    <th className="py-4 px-6 text-left text-white font-medium">Student ID</th>
                    <th className="py-4 px-6 text-left text-white font-medium">Student Name</th>
                    <th className="py-4 px-6 text-left text-white font-medium">Gender</th>
                    <th className="py-4 px-6 text-center text-white font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => (
                    <tr 
                      key={student.user_id}
                      className={`border-t border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                    >
                      <td className="py-4 px-6 text-gray-600">{student.user_id}</td>
                      <td className="py-4 px-6 text-gray-800 font-medium">
                        {`${student.fname} ${student.mname || ''} ${student.lname}`}
                      </td>
                      <td className="py-4 px-6 text-gray-600">{student.gender}</td>
                      <td className="py-4 px-6 text-center">
                        <div className="inline-block relative" data-action-menu-container>
                          <button
                            onClick={() => setActionMenuOpenId(actionMenuOpenId === student.user_id ? null : student.user_id)}
                            className="inline-flex items-center justify-center h-8 w-9 border border-gray-300 rounded-md bg-white shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#526D82]"
                            aria-haspopup="menu"
                            aria-expanded={actionMenuOpenId === student.user_id}
                            title="More actions"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" viewBox="0 0 20 20" fill="currentColor"><path d="M3 10a2 2 0 114 0 2 2 0 01-4 0zm7 0a2 2 0 114 0 2 2 0 01-4 0zm7 0a2 2 0 114 0 2 2 0 01-4 0z"/></svg>
                            <span className="sr-only">Open actions</span>
                          </button>
                          {actionMenuOpenId === student.user_id && (
                            <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-xl z-50 overflow-hidden">
                              <button
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                                onClick={() => {
                                  handleRemoveStudent(
                                    student.user_id,
                                    `${student.fname} ${student.mname || ''} ${student.lname}`
                                  );
                                  setActionMenuOpenId(null);
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 100 2h.278l.823 9.034A2 2 0 007.093 17h5.814a2 2 0 001.992-1.966L15.722 6H16a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zm-1 6a1 1 0 112 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 112 0v6a1 1 0 11-2 0V8z" clipRule="evenodd"/></svg>
                                Remove student from this class
                              </button>
                              <div className="h-px bg-gray-100" />
                              <button
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2"
                                onClick={() => {
                                  setSelectedStudent({ id: student.user_id, name: `${student.fname} ${student.mname || ''} ${student.lname}` });
                                  openMoveDialog();
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#526D82]" viewBox="0 0 20 20" fill="currentColor"><path d="M10.293 15.707a1 1 0 010-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"/></svg>
                                Move to another class
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* Assign Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 100 }}>
          <div className="bg-white p-0 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            {/* Modal Header with gradient background */}
            <div className="bg-gradient-to-r from-[#3E5367] to-[#526D82] px-6 py-4">
              <h2 className="text-2xl font-bold text-white">Assign Student</h2>
            </div>
            
            <div className="p-6">
              {/* Info Note */}
              <div className="mb-6 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500 flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> Please select a student to assign to this class.
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
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="studentSearch">
                    Student
                  </label>
                  
                  {/* Search input and dropdown container - both wrapped in ref */}
                  <div ref={searchContainerRef}>
                    <div className="relative mb-1">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <svg className="w-4 h-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        id="studentSearch"
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:border-transparent"
                        placeholder="Search students..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        autoComplete="off"
                      />
                    </div>
                  
                    {/* Student list with autocomplete and checkboxes */}
                    {searchTerm && (
                      <div className={`border border-gray-300 rounded-md max-h-60 overflow-y-auto ${searchTerm ? 'shadow-md' : ''}`}>
                        {filteredStudents.length === 0 ? (
                          <div className="p-3 text-gray-500 text-center">No students found</div>
                        ) : (
                          <ul className="divide-y divide-gray-200">
                            {filteredStudents.map(student => (
                              <li 
                                key={student.user_id} 
                                className="flex items-center px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                                onClick={() => handleStudentSelection(student.user_id)}
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 text-[#526D82] rounded border-gray-300 focus:ring-[#526D82] mr-3"
                                  checked={selectedStudents.includes(student.user_id)}
                                  onChange={() => {}} // Handling in parent div onClick
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent double firing
                                    handleStudentSelection(student.user_id); // Also handle selection when clicked directly
                                  }}
                                />
                                <div className="flex-grow">
                                  <div className="font-medium text-gray-800">
                                    {highlightMatch(`${student.fname} ${student.mname || ''} ${student.lname}`.trim(), searchTerm)} 
                                    <span className="font-normal text-gray-500">({student.gender})</span>
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {student.previousGradeLevel 
                                      ? `Previous Grade Level: ${student.previousGradeLevel.replace('Grade ', '')}` 
                                      : 'New Student'}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Selected students preview */}
                  {selectedStudents.length > 0 && (
                    <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded-md">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">Selected students:</span>
                        <button 
                          type="button" 
                          className="text-xs text-gray-500 hover:text-gray-700"
                          onClick={() => setSelectedStudents([])}
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedStudents.map(id => {
                          const student = availableStudents.find(s => s.user_id === id);
                          if (!student) return null;
                          return (
                            <div 
                              key={id}
                              className="flex items-center bg-white px-2 py-1 rounded border border-gray-300 text-sm"
                            >
                              <span className="mr-1">{student.fname.charAt(0)}. {student.lname}</span>
                              <button 
                                type="button"
                                className="text-gray-400 hover:text-gray-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStudentSelection(id);
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Selected count indicator */}
                  <div className="mt-2 text-sm text-gray-600">
                    {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
                  </div>
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
                    className="bg-[#526D82] hover:bg-[#3E5367] text-white font-medium py-2.5 px-5 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:ring-opacity-50"
                  >
                    Assign
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showConfirmDialog && (
        <>
          {/* Create blur overlay */}
          <div id="blur-overlay" className="fixed inset-0" style={{ 
            backdropFilter: 'blur(4px)',
            zIndex: 50,
            pointerEvents: 'none'
          }} />
          
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Remove Student</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Are you sure you want to remove {selectedStudent?.name} from this class?
                </p>
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => setShowConfirmDialog(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmRemoveStudent}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors duration-200"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showSuccessDialog && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 z-50 flex items-center space-x-3 border-l-4 border-green-500 animate-slide-up">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              Student has been successfully removed from the class
            </p>
          </div>
        </div>
      )}

      {/* Move Student Dialog */}
      {showMoveDialog && (
        <div className="fixed inset-0 flex items-start justify-center z-50 pt-16 pb-32 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4 mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Move Student</h3>
            <p className="text-sm text-gray-600 mb-4">
              Select a destination class within the same school year and the same grade level.
            </p>
            <div className="mb-6">
              <label className="block text-sm text-gray-700 mb-2">Destination Class</label>
              <div className="relative" data-move-class-container>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#526D82]"
                  placeholder="Search or select a class..."
                  value={moveClassSearch}
                  onChange={(e) => {
                    setMoveClassSearch(e.target.value);
                    setShowMoveClassDropdown(true);
                    if (!e.target.value.trim()) {
                      setSelectedMoveClassId('');
                    }
                  }}
                  onFocus={() => setShowMoveClassDropdown(true)}
                  autoComplete="off"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                
                {/* Searchable dropdown with optgroup-like styling */}
                {showMoveClassDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-auto">
                    {(() => {
                      const filteredClasses = getFilteredClasses();
                      if (filteredClasses.length === 0) {
                        return (
                          <div className="px-4 py-3 text-sm text-gray-500 italic">
                            {moveClasses.length === 0 ? 'No available classes' : 'No matching classes found'}
                          </div>
                        );
                      }
                      
                      // Build groups from filtered classes
                      const gradeMap = new Map();
                      filteredClasses.forEach(cls => {
                        const grade = cls.grade_level || 'Unknown Grade';
                        const adviser = [cls.adviser_fname, cls.adviser_mname, cls.adviser_lname].filter(Boolean).join(' ').trim() || '—';
                        if (!gradeMap.has(grade)) gradeMap.set(grade, new Map());
                        const advMap = gradeMap.get(grade);
                        if (!advMap.has(adviser)) advMap.set(adviser, []);
                        advMap.get(adviser).push(cls);
                      });
                      
                      // Render groups with optgroup-like styling
                      const gradeLevels = Array.from(gradeMap.keys()).sort((a, b) => String(a).localeCompare(String(b)));
                      return gradeLevels.map((grade, gradeIndex) => {
                        const advMap = gradeMap.get(grade);
                        const advisers = Array.from(advMap.keys()).sort((a, b) => a.localeCompare(b));
                        return (
                          <div key={`gl-${grade}`}>
                            {/* Grade level header - optgroup style */}
                            <div className="px-4 py-2 text-sm font-semibold text-white bg-[#526D82] border-b border-gray-200 sticky top-0 text-center">
                              {grade === 'Kindergarten' || grade === 'K' ? 'Kindergarten' : `Grade ${grade}`}
                            </div>
                            {advisers.map((adv, advIndex) => (
                              <div key={`adv-${grade}-${adv}`}>
                                {/* Adviser subheader */}
                                <div className="px-6 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border-b border-gray-100 text-center">
                                  {adv}
                                </div>
                                {/* Class options under this adviser */}
                                {advMap.get(adv)
                                  .sort((x, y) => String(x.section).localeCompare(String(y.section)))
                                  .map((c, classIndex) => (
                                    <div
                                      key={c.class_id}
                                      className="px-8 py-2.5 text-sm hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-b-0 transition-colors"
                                      onClick={() => handleMoveClassSelect(c.class_id)}
                                    >
                                      <div className="font-medium text-gray-900 text-center">
                                        {moveClassSearch.trim() 
                                          ? highlightSearchMatch(getClassLabel(c), moveClassSearch.toLowerCase().split(/\s+/).filter(Boolean))
                                          : getClassLabel(c)
                                        }
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            ))}
                            {/* Add spacing between grade groups */}
                            {gradeIndex < gradeLevels.length - 1 && (
                              <div className="border-b-2 border-gray-200"></div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded"
                onClick={() => { 
                  setShowMoveDialog(false); 
                  setSelectedMoveClassId(''); 
                  setMoveClassSearch(''); 
                  setShowMoveClassDropdown(false); 
                  setActionMenuOpenId(null); 
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-[#526D82] hover:bg-[#3E5367] text-white rounded"
                onClick={confirmMoveStudent}
                disabled={!selectedMoveClassId}
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageClassViewStudent;
