import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchGrading } from './lib/api';

const ManageClassViewSubject = () => {
  const { classId } = useParams();
  const [subjects, setSubjects] = useState([]);
  const [classInfo, setClassInfo] = useState({ class_id: classId, class_description: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAdviserSubjectWarning, setShowAdviserSubjectWarning] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [formData, setFormData] = useState({
    subject_id: '',
    teacher_id: ''
  });
  const [showSuccessMessage, setShowSuccessMessage] = useState(null);
  const [inactiveTeachers, setInactiveTeachers] = useState({});
  const [adviserInfo, setAdviserInfo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchClassInfo();
    fetchClassSubjects();
    fetchInactiveTeacherStatus();
  }, [classId]);

  useEffect(() => {
    if (isModalOpen || isUpdateModalOpen) {
      fetchAvailableTeachers();
      if (isModalOpen) {
        fetchAvailableSubjects();
      }
    }
  }, [isModalOpen, isUpdateModalOpen]);

  useEffect(() => {
    // Update adviser info when subjects or class info changes
    if (classInfo && classInfo.class_adviser_id) {
      const isTeaching = isAdviserTeachingSubject();
      const subjectCount = countAdviserSubjects();
      
      setAdviserInfo({
        isTeaching,
        subjectCount,
        name: `${classInfo.adviser_fname || ''} ${classInfo.adviser_mname || ''} ${classInfo.adviser_lname || ''}`.trim()
      });
    }
  }, [subjects, classInfo]);

  // Add a new useEffect to keep the adviser selection updated
  useEffect(() => {
    // If it's grades 4-6, no subjects yet, and there's a class adviser, make sure adviser is selected
    if (isModalOpen && 
        classInfo && 
        classInfo.grade_level && 
        ['4', '5', '6'].includes(classInfo.grade_level.toString()) && 
        classInfo.class_adviser_id && 
        subjects.length === 0) {
      setFormData(prev => ({
        ...prev,
        teacher_id: classInfo.class_adviser_id.toString()
      }));
    }
  }, [isModalOpen, subjects, classInfo]);

  const fetchAvailableSubjects = async () => {
    try {
      // Get all subjects
      const allSubjectsResponse = await fetchGrading('/api/subjects');
      if (!allSubjectsResponse.ok) {
        throw new Error('Failed to fetch available subjects');
      }
      const allSubjects = await allSubjectsResponse.json();

      // Get already assigned subjects for this class - FIXED ENDPOINT
      const assignedSubjectsResponse = await fetchGrading(`/api/classes/${classId}/subjects`);
      if (!assignedSubjectsResponse.ok) {
        throw new Error('Failed to fetch assigned subjects');
      }
      const assignedSubjects = await assignedSubjectsResponse.json();

      // Filter out already assigned subjects
      const assignedSubjectIds = assignedSubjects.map(subject => subject.subject_id);
      let availableSubjects = allSubjects.filter(subject => 
        !assignedSubjectIds.includes(subject.subject_id)
      );

      // Hide all subjects that have a parent_subject_id (i.e., only show parent subjects)
      availableSubjects = availableSubjects.filter(subject => !subject.parent_subject_id);

      // Filter by class grade level
      if (classInfo && classInfo.grade_level) {
        availableSubjects = availableSubjects.filter(subject => subject.grade_level === classInfo.grade_level.toString());
      }

      setAvailableSubjects(availableSubjects);
    } catch (error) {
      console.error('Error fetching available subjects:', error);
      setError('Failed to load available subjects');
    }
  };

  const fetchAvailableTeachers = async () => {
    try {
      const response = await fetchGrading('/api/teachers');
      if (!response.ok) {
        throw new Error('Failed to fetch available teachers');
      }
      const data = await response.json();
      // Filter out inactive teachers
      const activeTeachers = data.filter(teacher => teacher.teacher_status === true);
      setAvailableTeachers(activeTeachers);
    } catch (error) {
      console.error('Error fetching available teachers:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // If this is a grade 1-3 class with a class adviser, and the field is teacher_id, don't update
    if (name === 'teacher_id' && 
        classInfo.grade_level && 
        ['1', '2', '3', 'Kindergarten'].includes(classInfo.grade_level.toString()) && 
        classInfo.class_adviser_id) {
      return; // Don't allow changing the teacher for grades 1-3
    }
    
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.subject_id) {
        setError('Please select a subject');
        return;
      }
      
      // For grades 1-3, use the class adviser as teacher if available
      let teacherId = formData.teacher_id;
      if (classInfo.grade_level && 
          ['1', '2', '3', 'Kindergarten'].includes(classInfo.grade_level.toString()) && 
          classInfo.class_adviser_id) {
        teacherId = classInfo.class_adviser_id.toString();
      } else if (classInfo.grade_level && 
          ['4', '5', '6'].includes(classInfo.grade_level.toString()) && 
          classInfo.class_adviser_id && 
          subjects.length === 0) {
        // For grades 4-6 first subject, automatically use the class adviser
        teacherId = classInfo.class_adviser_id.toString();
      } else if (!teacherId) {
        // More descriptive error message
        setError('Please select a teacher to teach this subject');
        return;
      }

      // For grades 4-6, enforce that the first subject must be assigned to the class adviser
      if (classInfo.grade_level && 
          ['4', '5', '6'].includes(classInfo.grade_level.toString()) && 
          classInfo.class_adviser_id) {
        // If this is the first subject (no subjects assigned yet), it must be assigned to the adviser
        if (subjects.length === 0) {
          const adviserName = `${classInfo.adviser_fname || ''} ${classInfo.adviser_mname || ''} ${classInfo.adviser_lname || ''}`.trim();
          if (teacherId !== classInfo.class_adviser_id.toString()) {
            setError(`The first subject for grades 4-6 must be assigned to the class adviser (${adviserName}). The class adviser must teach at least one subject to handle attendance.`);
            return;
          }
        }
        // If adviser is not teaching any subjects yet, suggest using the adviser
        else if (!isAdviserTeachingSubject() && teacherId !== classInfo.class_adviser_id.toString()) {
          const adviserId = classInfo.class_adviser_id.toString();
          const adviserName = `${classInfo.adviser_fname || ''} ${classInfo.adviser_mname || ''} ${classInfo.adviser_lname || ''}`.trim();
          // Show confirmation dialog
          if (!window.confirm(`The class adviser (${adviserName}) must teach at least one subject in grades 4-6 to handle attendance.\n\nDo you want to assign this subject to the class adviser instead?`)) {
            // User chose not to use the adviser
            // Continue with their selection, but they'll see the warning in the UI
          } else {
            // User chose to use the adviser
            teacherId = adviserId;
          }
        }
      }

      // --- NEW LOGIC: Assign all children if parent subject selected ---
      const selectedSubjectId = parseInt(formData.subject_id);
      // Use availableSubjects if you want only assignable, or allSubjects if you want all
      const allSubjectsResponse = await fetchGrading('/api/subjects');
      const allSubjects = await allSubjectsResponse.json();
      const children = allSubjects.filter(s => s.parent_subject_id === selectedSubjectId);
      // Helper to assign a subject (now accepts teacherId as parameter)
      const assignSubject = async (subjectId, teacherIdParam) => {
        const response = await fetchGrading(`/api/classes/${classId}/subjects`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject_id: subjectId,
            teacher_id: parseInt(teacherIdParam),
            class_id: parseInt(classId)
          }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage;
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorData.message || 'Failed to assign subject';
          } catch (e) {
            errorMessage = errorText || 'Failed to assign subject';
          }
          throw new Error(errorMessage);
        }
      };
      // Determine if this is the first subject for grades 4-6
      const isFirstSubjectForGrades4to6 = (
        classInfo.grade_level &&
        ['4', '5', '6'].includes(classInfo.grade_level.toString()) &&
        classInfo.class_adviser_id &&
        subjects.length === 0
      );
      const forcedTeacherId = isFirstSubjectForGrades4to6
        ? classInfo.class_adviser_id.toString()
        : teacherId;
      if (children.length > 0) {
        // Assign parent subject first
        await assignSubject(selectedSubjectId, forcedTeacherId);
        // Assign all children in parallel
        await Promise.all(children.map(child => assignSubject(child.subject_id, forcedTeacherId)));
      } else {
        // Just assign the selected subject
        await assignSubject(selectedSubjectId, forcedTeacherId);
      }
      // Refresh the subjects list
      fetchClassSubjects();
      setIsModalOpen(false);
      setFormData({
        subject_id: '',
        teacher_id: ''
      });
      setError(null);
    } catch (error) {
      console.error('Error assigning subject:', error);
      setError(`Failed to assign subject: ${error.message}`);
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    try {
      // For grades 1-3, don't allow changing the teacher
      if (classInfo.grade_level && 
          ['1', '2', '3', 'Kindergarten'].includes(classInfo.grade_level.toString()) && 
          classInfo.class_adviser_id) {
        setShowSuccessMessage({
          type: 'info',
          message: 'For grades 1-3, the class adviser is automatically assigned to teach all subjects'
        });
        setTimeout(() => setShowSuccessMessage(null), 3000);
        setIsUpdateModalOpen(false);
        return;
      }
      
      if (!formData.teacher_id) {
        setError('Please select a teacher');
        return;
      }

      // Check if this would remove the adviser's only subject for grades 4-6
      if (classInfo.grade_level && 
          ['4', '5', '6'].includes(classInfo.grade_level.toString()) && 
          classInfo.class_adviser_id &&
          selectedSubject.teacher_id === classInfo.class_adviser_id &&
          countAdviserSubjects() === 1 &&
          formData.teacher_id !== classInfo.class_adviser_id.toString()) {
        setError(`The class adviser must teach at least one subject in grades 4-6. Please assign the adviser to another subject before changing this one.`);
        return;
      }
      
      // Update the teacher assigned to the subject using the correct endpoint
      const response = await fetchGrading(`/api/classes/${classId}/subjects/${selectedSubject.subject_id}/teacher`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teacher_id: parseInt(formData.teacher_id)
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || 'Failed to update subject teacher';
        } catch (e) {
          errorMessage = errorText || 'Failed to update subject teacher';
        }
        throw new Error(errorMessage);
      }

      // Show success message
      setShowSuccessMessage({
        type: 'success',
        message: 'Subject teacher updated successfully'
      });
      setTimeout(() => setShowSuccessMessage(null), 3000);

      // Refresh the subjects list
      fetchClassSubjects();
      setIsUpdateModalOpen(false);
      setFormData({
        subject_id: '',
        teacher_id: ''
      });
      setSelectedSubject(null);
      setError(null);
    } catch (error) {
      console.error('Error updating subject teacher:', error);
      setError(`Failed to update subject teacher: ${error.message}`);
    }
  };

  const handleDeleteSubject = async () => {
    try {
      if (!selectedSubject) {
        setError('No subject selected for deletion');
        return;
      }
      
      // Check if this would remove the adviser's only subject for grades 4-6
      if (classInfo.grade_level && 
          ['4', '5', '6'].includes(classInfo.grade_level.toString()) && 
          classInfo.class_adviser_id &&
          selectedSubject.teacher_id === classInfo.class_adviser_id &&
          countAdviserSubjects() === 1) {
        
        // Instead of blocking completely, show a special warning
        setShowAdviserSubjectWarning(true);
        setShowDeleteConfirm(false);
        return;
      }
      
      // Delete the subject assignment
      const response = await fetchGrading(`/api/classes/${classId}/subjects/${selectedSubject.subject_id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || 'Failed to delete subject assignment';
        } catch (e) {
          errorMessage = errorText || 'Failed to delete subject assignment';
        }
        throw new Error(errorMessage);
      }

      // Parse the response
      const result = await response.json();
      
      // Do not show any success message after deleting/removing a subject

      // Refresh the subjects list
      fetchClassSubjects();
      setShowDeleteConfirm(false);
      setShowAdviserSubjectWarning(false);
      setSelectedSubject(null);
    } catch (error) {
      console.error('Error deleting subject assignment:', error);
      setError(`Failed to delete subject assignment: ${error.message}`);
      setShowDeleteConfirm(false);
      setShowAdviserSubjectWarning(false);
    }
  };

  // New function to force delete the adviser's only subject
  const handleForceDeleteSubject = async () => {
    try {
      if (!selectedSubject) {
        setError('No subject selected for deletion');
        return;
      }
      
      // Delete the subject assignment
      const response = await fetchGrading(`/api/classes/${classId}/subjects/${selectedSubject.subject_id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || 'Failed to delete subject assignment';
        } catch (e) {
          errorMessage = errorText || 'Failed to delete subject assignment';
        }
        throw new Error(errorMessage);
      }

      // Parse the response
      const result = await response.json();
      
      // Show special success message for forced deletion
      let successMessage = result.message || 'Subject removed from class successfully';
      if (result.gradesAffected > 0) {
        successMessage += ` (Note: ${result.gradesAffected} grade entries were affected)`;
      }
      
      successMessage += ' NOTE: The class adviser no longer has any subjects assigned. Attendance handling may be affected.';
      
      setShowSuccessMessage({
        type: 'warning',
        message: successMessage
      });
      setTimeout(() => setShowSuccessMessage(null), 5000); // Longer timeout for important message

      // Refresh the subjects list
      fetchClassSubjects();
      setShowAdviserSubjectWarning(false);
      setSelectedSubject(null);
    } catch (error) {
      console.error('Error deleting subject assignment:', error);
      setError(`Failed to delete subject assignment: ${error.message}`);
      setShowAdviserSubjectWarning(false);
    }
  };

  const closeAdviserSubjectWarning = () => {
    setShowAdviserSubjectWarning(false);
    setSelectedSubject(null);
  };

  const fetchClassInfo = async () => {
    try {
      const response = await fetchGrading(`/api/classes/${classId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch class information');
      }
      const data = await response.json();
      setClassInfo(data);
      
      // If grade level is 1-3 and has class adviser, pre-select the class adviser as teacher
      if (data.grade_level && ['1', '2', '3', 'Kindergarten'].includes(data.grade_level.toString()) && data.class_adviser_id) {
        setFormData(prev => ({
          ...prev,
          teacher_id: data.class_adviser_id.toString()
        }));
      }
    } catch (error) {
      console.error('Error fetching class info:', error);
      // Don't set error state here to avoid blocking subject display
      
      // Try to get class info from the classes endpoint as a fallback
      try {
        const allClassesResponse = await fetchGrading('/api/classes');
        if (allClassesResponse.ok) {
          const allClasses = await allClassesResponse.json();
          const currentClass = allClasses.find(c => c.class_id === parseInt(classId));
          if (currentClass) {
            setClassInfo(currentClass);
          }
        }
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError);
      }
    }
  };

  const fetchClassSubjects = async () => {
    setLoading(true);
    try {
      const response = await fetchGrading(`/api/classes/${classId}/subjects`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch subjects: ${response.status}`);
      }
      const data = await response.json();
      
      // More detailed logging
      console.log('Subjects data with teacher info:', data);
      data.forEach(subject => {
        console.log(`Subject ${subject.subject_name} - Teacher: ${subject.fname} ${subject.lname}, Gender: ${subject.gender}`);
      });
      
      setSubjects(data);
    } catch (error) {
      console.error('Error fetching class subjects:', error);
      setError('Error loading subjects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setIsModalOpen(true);
    setError(null);
    
    // Reset form data first
    setFormData({
      subject_id: '',
      teacher_id: ''
    });

    // For grades 4-6, if this is the first subject, pre-select class adviser
    if (classInfo.grade_level && 
        ['4', '5', '6'].includes(classInfo.grade_level.toString()) && 
        classInfo.class_adviser_id && 
        subjects.length === 0) {
      console.log('Pre-selecting adviser for first subject in grades 4-6'); // Debug log
      setFormData(prev => ({
        ...prev,
        teacher_id: classInfo.class_adviser_id.toString()
      }));
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({
      subject_id: '',
      teacher_id: ''
    });
    setError(null);
  };

  const openUpdateModal = (subject) => {
    setSelectedSubject(subject);
    setFormData({
      subject_id: subject.subject_id,
      teacher_id: subject.teacher_id || ''
    });
    setIsUpdateModalOpen(true);
    setError(null);
  };

  const closeUpdateModal = () => {
    setIsUpdateModalOpen(false);
    setSelectedSubject(null);
    setFormData({
      subject_id: '',
      teacher_id: ''
    });
    setError(null);
  };

  const openDeleteConfirm = (subject) => {
    setSelectedSubject(subject);
    setShowDeleteConfirm(true);
  };

  const closeDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setSelectedSubject(null);
  };

  useEffect(() => {
    // Instead of targeting specific elements, let's create a blur overlay
    if (isModalOpen || isUpdateModalOpen || showDeleteConfirm || showAdviserSubjectWarning) {
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
  }, [isModalOpen, isUpdateModalOpen, showDeleteConfirm, showAdviserSubjectWarning]);

  const handleBack = () => {
    navigate('/manage-class');
  };

  // Fetch status of inactive teachers
  const fetchInactiveTeacherStatus = async () => {
    try {
      await fetchInactiveTeacherStatusFallback();
    } catch (error) {
      console.warn('Error checking inactive teachers:', error);
    }
  };

  // Fallback approach to get inactive teachers
  const fetchInactiveTeacherStatusFallback = async () => {
    try {
      // Get all teachers
      const teachersResponse = await fetchGrading('/api/teachers');
      if (!teachersResponse.ok) return;
      
      const teachers = await teachersResponse.json();
      
      // Filter to just inactive teachers
      const inactiveTeacherList = teachers.filter(teacher => teacher.teacher_status === false);
      
      // Convert to a lookup object for easier checking
      const inactiveTeachersMap = {};
      inactiveTeacherList.forEach(teacher => {
        inactiveTeachersMap[teacher.user_id] = teacher;
      });
      
      setInactiveTeachers(inactiveTeachersMap);
    } catch (error) {
      console.warn('Error in fallback approach for fetching inactive teachers:', error);
    }
  };

  const isTeacherInactive = (teacherId) => {
    // If we can't determine teacher status, don't mark as inactive
    if (!teacherId || !inactiveTeachers) return false;
    return !!inactiveTeachers[teacherId];
  };

  // Add function to check if adviser is teaching at least one subject
  const isAdviserTeachingSubject = () => {
    if (!classInfo || !classInfo.class_adviser_id || !subjects.length) return false;
    
    // For grades 1-3, adviser teaches all subjects automatically
    if (classInfo.grade_level && ['1', '2', '3', 'Kindergarten'].includes(classInfo.grade_level.toString())) {
      return true;
    }
    
    // For grades 4-6, check if adviser teaches at least one subject
    return subjects.some(subject => subject.teacher_id === classInfo.class_adviser_id);
  };

  // Add function to count subjects taught by the adviser
  const countAdviserSubjects = () => {
    if (!classInfo || !classInfo.class_adviser_id || !subjects.length) return 0;
    return subjects.filter(subject => subject.teacher_id === classInfo.class_adviser_id).length;
  };

  return (
    <div className="content-container bg-[#F3F3F6]">
      <div className="p-8">
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
        <div className="flex items-center gap-4 mb-6">
          <span className="bg-[#DFE4E8] px-3 py-1 rounded text-[#526D82]">
            {classInfo.grade_level && classInfo.section 
              ? (classInfo.grade_level === 'Kindergarten'
                ? `Kindergarten-${classInfo.section}`
                : `Grade ${classInfo.grade_level}-${classInfo.section}`)
              : (classInfo.class_description || `Class ID: ${classId}`)}
          </span>
          <button 
            className="px-3 py-1 bg-[#526D82] text-white rounded
              hover:bg-[#3E5367] transition-colors duration-200 
              flex items-center gap-1 text-sm"
            onClick={() => setIsModalOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Assign Subject
          </button>
        </div>

        {/* Inactive teacher warning */}
        {subjects.some(subject => isTeacherInactive(subject.teacher_id)) && (
          <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-md">
            <div className="flex items-start">
              <svg className="h-6 w-6 text-amber-500 mr-3 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-amber-800 font-semibold">Attention Required</h3>
                <p className="text-amber-700">
                  This class has subjects assigned to inactive teachers. Please update these assignments.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success message */}
        {showSuccessMessage && (
          <div className={`mb-6 p-4 rounded-lg flex items-start ${
            showSuccessMessage.type === 'success' 
              ? 'bg-green-50 border-l-4 border-green-500 text-green-700'
              : showSuccessMessage.type === 'warning'
                ? 'bg-amber-50 border-l-4 border-amber-500 text-amber-700'
                : 'bg-red-50 border-l-4 border-red-500 text-red-700'
          }`}>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-5 w-5 mr-2 mt-0.5 flex-shrink-0 ${
                showSuccessMessage.type === 'success' 
                  ? 'text-green-500' 
                  : showSuccessMessage.type === 'warning'
                    ? 'text-amber-500'
                    : 'text-red-500'
              }`}
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              {showSuccessMessage.type === 'success' ? (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              ) : showSuccessMessage.type === 'warning' ? (
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              )}
            </svg>
            <p className="text-sm">{showSuccessMessage.message}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading subjects...</div>
          ) : error ? (
            <div className="p-6 text-center text-red-500">{error}</div>
          ) : subjects.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No subjects assigned to this class.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#526D82]">
                  <th className="py-4 px-6 text-left text-white font-medium">Subject Name</th>
                  <th className="py-4 px-6 text-left text-white font-medium">Subject Teacher</th>
                  <th className="py-4 px-6 text-left text-white font-medium">Gender</th>
                  <th className="py-4 px-6 text-center text-white font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject, index) => {
                  const isInactive = isTeacherInactive(subject.teacher_id);
                  
                  return (
                    <tr 
                      key={subject.subject_id}
                      className={`border-t border-gray-100 hover:bg-gray-50 transition-colors duration-150
                        ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                        ${isInactive ? 'bg-amber-50' : ''}`}
                    >
                      <td className="py-4 px-6 text-gray-800">{subject.subject_name}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <span className={`${isInactive ? 'text-amber-800' : 'text-gray-800'}`}>
                            {subject.fname && subject.lname 
                              ? `${subject.fname} ${subject.mname || ''} ${subject.lname}`
                              : 'Not Assigned'}
                          </span>
                          {isInactive && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                              Inactive
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-800">
                        {subject.gender || 'N/A'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => openUpdateModal(subject)}
                            className={`px-4 py-1.5 border rounded-md transition-colors duration-200
                              ${isInactive 
                                ? 'text-amber-600 border-amber-600 hover:bg-amber-600 hover:text-white' 
                                : 'text-[#526D82] border-[#526D82] hover:bg-[#526D82] hover:text-white'}`}
                          >
                            Update
                          </button>
                          <button 
                            onClick={() => openDeleteConfirm(subject)}
                            className="px-4 py-1.5 text-red-500 border border-red-500 rounded-md
                              hover:bg-red-500 hover:text-white transition-colors duration-200"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Assign Subject Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 100 }}>
          <div className="bg-white p-0 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            {/* Modal Header with gradient background */}
            <div className="bg-gradient-to-r from-[#3E5367] to-[#526D82] px-6 py-4">
              <h2 className="text-2xl font-bold text-white">Assign Subject</h2>
            </div>
            
            <div className="max-h-[70vh] overflow-y-auto p-6">
              {error && (
                <div className="mb-4 bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              
              {classInfo.grade_level && ['1', '2', '3', 'Kindergarten'].includes(classInfo.grade_level.toString()) && classInfo.class_adviser_id && (
                <div className="mb-4 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500 flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-blue-700">
                    <strong>Note:</strong> For grades 1-3, the class adviser is automatically assigned to teach all subjects. The class adviser for this class is: <strong>{`${classInfo.adviser_fname || ''} ${classInfo.adviser_mname || ''} ${classInfo.adviser_lname || ''}`}</strong>
                  </p>
                </div>
              )}

              {classInfo.grade_level && 
               ['4', '5', '6'].includes(classInfo.grade_level.toString()) && 
               classInfo.class_adviser_id && 
               subjects.length === 0 && (
                <div className="mb-4 bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500 flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="font-bold text-yellow-800 mb-1">Important Requirement</h3>
                    <p className="text-sm text-yellow-700">
                      <strong>For grades 4-6, the first subject must be assigned to the class adviser.</strong> Additional subjects may be assigned to other teachers. The adviser must teach at least one subject to handle attendance.
                    </p>
                  </div>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <select
                    name="subject_id"
                    value={formData.subject_id}
                    onChange={handleInputChange}
                    className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:border-transparent"
                  >
                    <option value="">Select a subject</option>
                    {availableSubjects.map(subject => (
                      <option key={subject.subject_id} value={subject.subject_id}>
                        {subject.subject_name}
                      </option>
                    ))}
                  </select>
                  {availableSubjects.length === 0 && (
                    <div className="mt-2 p-2 bg-amber-50 border-l-4 border-amber-500 text-amber-700 rounded">
                      No available subjects found for this grade level, or all subjects have been assigned already to this class.
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                  {classInfo.grade_level && 
                   ['1', '2', '3', 'Kindergarten'].includes(classInfo.grade_level.toString()) && 
                   classInfo.class_adviser_id ? (
                    <>
                      <div className="shadow-sm border border-gray-300 bg-gray-100 rounded-lg w-full py-2 px-3 text-gray-700">
                        {classInfo.adviser_fname || ''} {classInfo.adviser_mname || ''} {classInfo.adviser_lname || ''}
                      </div>
                      <p className="mt-1 text-xs text-gray-500 italic">
                        For grades 1-3, the teacher is automatically set to the class adviser
                      </p>
                    </>
                  ) : classInfo.grade_level && 
                     ['4', '5', '6'].includes(classInfo.grade_level.toString()) && 
                     classInfo.class_adviser_id && 
                     subjects.length === 0 ? (
                    <>
                      <div className="shadow-sm border border-gray-300 bg-gray-100 rounded-lg w-full py-2 px-3 text-gray-700">
                        {classInfo.adviser_fname || ''} {classInfo.adviser_mname || ''} {classInfo.adviser_lname || ''} <span className="text-gray-600">(Class Adviser)</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">
                        The first subject must be assigned to the class adviser for grades 4-6
                      </p>
                    </>
                  ) : (
                    <>
                      <select
                        name="teacher_id"
                        value={formData.teacher_id}
                        onChange={handleInputChange}
                        className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:border-transparent"
                      >
                        <option value="">Select a teacher</option>
                        {availableTeachers.map(teacher => (
                          <option key={teacher.user_id} value={teacher.user_id}>
                            {teacher.fname} {teacher.mname || ''} {teacher.lname} {classInfo.class_adviser_id && teacher.user_id === classInfo.class_adviser_id.toString() ? '(Class Adviser)' : ''}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
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

      {/* Update Subject Teacher Modal */}
      {isUpdateModalOpen && selectedSubject && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 100 }}>
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-[#3E5367] to-[#526D82] px-6 py-4">
              <h2 className="text-xl font-bold text-white">Update Subject Teacher</h2>
            </div>
            
            <div className="max-h-[70vh] overflow-y-auto p-6">
              {error && (
                <div className="mb-4 bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              
              {classInfo.grade_level && ['1', '2', '3', 'Kindergarten'].includes(classInfo.grade_level.toString()) && classInfo.class_adviser_id && (
                <div className="mb-4 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500 flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-blue-700">
                    <strong>Note:</strong> For grades 1-3, the class adviser is automatically assigned to teach all subjects. The teacher for this subject cannot be changed.
                  </p>
                </div>
              )}
              
              <form onSubmit={handleUpdateSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <div className="shadow-sm border border-gray-300 bg-gray-100 rounded-lg w-full py-2 px-3 text-gray-700">
                    {selectedSubject?.subject_name || 'Subject not found'}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                  {classInfo.grade_level && 
                   ['1', '2', '3', 'Kindergarten'].includes(classInfo.grade_level.toString()) && 
                   classInfo.class_adviser_id ? (
                    <>
                      <div className="shadow-sm border border-gray-300 bg-gray-100 rounded-lg w-full py-2 px-3 text-gray-700">
                        {classInfo.adviser_fname || ''} {classInfo.adviser_mname || ''} {classInfo.adviser_lname || ''}
                      </div>
                      <p className="mt-1 text-xs text-gray-500 italic">
                        For grades 1-3, the teacher is automatically set to the class adviser
                      </p>
                    </>
                  ) : (
                    <>
                      <select
                        name="teacher_id"
                        value={formData.teacher_id}
                        onChange={handleInputChange}
                        className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:border-transparent"
                      >
                        <option value="">Select a teacher</option>
                        {availableTeachers.map(teacher => (
                          <option key={teacher.user_id} value={teacher.user_id}>
                            {teacher.fname} {teacher.mname || ''} {teacher.lname} {classInfo.class_adviser_id && teacher.user_id === classInfo.class_adviser_id.toString() ? '(Class Adviser)' : ''}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={closeUpdateModal}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2.5 px-5 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-[#526D82] hover:bg-[#3E5367] text-white font-medium py-2.5 px-5 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:ring-opacity-50"
                  >
                    Update Teacher
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && selectedSubject && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 100 }}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Remove Subject</h3>
              <p className="text-sm text-gray-500 mb-2">
                Are you sure you want to remove <span className="font-semibold">{selectedSubject.subject_name}</span> from this class?
              </p>
              <p className="text-xs text-red-600">
                Warning: This will remove the subject from this class, and any student grades for this subject in this class will not be accessible.
              </p>
            </div>
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={closeDeleteConfirm}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSubject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Special Warning Dialog for Adviser's Only Subject */}
      {showAdviserSubjectWarning && selectedSubject && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 100 }}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 mb-4">
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Important Attendance Warning</h3>
              <p className="text-sm text-red-600 mb-4">
                <strong>This is the only subject taught by the class adviser.</strong> For grades 4-6, the class adviser must teach at least one subject to properly handle attendance.
              </p>
              <div className="bg-blue-50 p-4 rounded-md text-left w-full mb-4 border border-blue-100">
                <p className="text-sm font-medium text-blue-700">
                  Recommended Action:
                </p>
                <div className="mt-2 pl-3">
                  <p className="text-sm text-blue-600 mb-1.5 flex items-start">
                    <span className="inline-block mr-1.5 font-medium">1.</span> Assign another subject to the class adviser first
                  </p>
                  <p className="text-sm text-blue-600 flex items-start">
                    <span className="inline-block mr-1.5 font-medium">2.</span> Then remove this subject if needed
                  </p>
                </div>
              </div>
              <p className="text-xs text-red-600 text-left w-full">
                Removing this subject anyway will create an attendance handling issue that needs to be fixed. The adviser won't be able to mark attendance until they are assigned another subject.
              </p>
            </div>
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={closeAdviserSubjectWarning}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200"
              >
                Go Back & Fix
              </button>
              <button
                onClick={handleForceDeleteSubject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors duration-200"
              >
                Remove Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageClassViewSubject;
