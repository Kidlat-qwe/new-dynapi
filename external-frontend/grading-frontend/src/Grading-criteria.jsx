import React, { useState, useEffect } from 'react';
import { fetchGrading } from './lib/api';

const GradingCriteria = () => {
  const [subjects, setSubjects] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
  const [activeSchoolYear, setActiveSchoolYear] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalAction, setModalAction] = useState(null);
  const [criteria, setCriteria] = useState({
    writtenWorks: { percentage: '' },
    performanceTasks: { percentage: '' },
    quarterlyAssessment: { percentage: '' }
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [criteriaExists, setCriteriaExists] = useState(false);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState('');

  // Remove the fetchSubjects call from useEffect
  useEffect(() => {
    fetchSchoolYears();
  }, []);

  // Update handleSubjectChange to fetch criteria when subject changes
  const handleSubjectChange = (e) => {
    const newSubjectId = e.target.value;
    setSelectedSubject(newSubjectId);
    setCriteriaExists(false);
    
    // Reset criteria when changing subject
    setCriteria({
      writtenWorks: { percentage: '' },
      performanceTasks: { percentage: '' },
      quarterlyAssessment: { percentage: '' }
    });
    
    if (newSubjectId && selectedSchoolYear) {
      fetchCriteria(newSubjectId, selectedSchoolYear);
    }
  };

  // Update fetchSchoolYears to set active school year
  const fetchSchoolYears = async () => {
    try {
      const response = await fetchGrading('/api/school-years');
      if (!response.ok) throw new Error('Failed to fetch school years');
      const data = await response.json();
      setSchoolYears(data);
      
      // Find and set the active school year
      const active = data.find(year => year.is_active);
      if (active) {
        setActiveSchoolYear(active.school_year_id);
        setSelectedSchoolYear(active.school_year_id);
        // Fetch subjects for the active school year
        fetchSubjectsForSchoolYear(active.school_year_id);
      }
    } catch (error) {
      setError('Failed to load school years');
      console.error('Error:', error);
    }
  };

  // Add new function to fetch subjects for a specific school year
  const fetchSubjectsForSchoolYear = async (schoolYearId) => {
    try {
      const response = await fetchGrading(`/api/subjects?schoolYearId=${schoolYearId}`);
      if (!response.ok) throw new Error('Failed to fetch subjects');
      const data = await response.json();
      setSubjects(data);
    } catch (error) {
      setError('Failed to load subjects');
      console.error('Error:', error);
    }
  };

  // Update fetchCriteria to handle the response correctly
  const fetchCriteria = async (subjectId, schoolYearId) => {
    if (!subjectId || !schoolYearId) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Convert IDs to numbers for consistency
      const numericSubjectId = parseInt(subjectId, 10);
      const numericSchoolYearId = parseInt(schoolYearId, 10);
      
      if (isNaN(numericSubjectId) || isNaN(numericSchoolYearId)) {
        console.error('Invalid subject or school year ID');
        return;
      }
      
      const response = await fetchGrading(`/api/grading-criteria/${numericSubjectId}/${numericSchoolYearId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        console.log('Fetched criteria data:', data);
        
        // Set criteriaExists based on the exists flag from the backend
        setCriteriaExists(data.exists);
        
        if (data.exists) {
          // Ensure numeric types for the percentages
          const writtenWorks = parseInt(data.written_works_percentage, 10) || 0;
          const performanceTasks = parseInt(data.performance_tasks_percentage, 10) || 0;
          const quarterlyAssessment = parseInt(data.quarterly_assessment_percentage, 10) || 0;
          
          setCriteria({
            writtenWorks: { percentage: writtenWorks.toString() },
            performanceTasks: { percentage: performanceTasks.toString() },
            quarterlyAssessment: { percentage: quarterlyAssessment.toString() }
          });
        } else {
          // No criteria found, reset the form
          setCriteria({
            writtenWorks: { percentage: '' },
            performanceTasks: { percentage: '' },
            quarterlyAssessment: { percentage: '' }
          });
        }
      } else {
        // Reset criteria and criteriaExists on any error
        setCriteriaExists(false);
        setCriteria({
          writtenWorks: { percentage: '' },
          performanceTasks: { percentage: '' },
          quarterlyAssessment: { percentage: '' }
        });
        console.error('Failed to fetch criteria');
      }
    } catch (error) {
      console.error('Error fetching criteria:', error);
      // Reset criteria and criteriaExists on any error
      setCriteriaExists(false);
      setCriteria({
        writtenWorks: { percentage: '' },
        performanceTasks: { percentage: '' },
        quarterlyAssessment: { percentage: '' }
      });
    } finally {
      setLoading(false);
    }
  };

  // Update handleSchoolYearChange
  const handleSchoolYearChange = (e) => {
    const newSchoolYearId = e.target.value;
    setSelectedSchoolYear(newSchoolYearId);
    setCriteriaExists(false);
    
    // Reset criteria when changing school year
    setCriteria({
      writtenWorks: { percentage: '' },
      performanceTasks: { percentage: '' },
      quarterlyAssessment: { percentage: '' }
    });
    
    if (selectedSubject && newSchoolYearId) {
      fetchCriteria(selectedSubject, newSchoolYearId);
    }
    
    // Fetch subjects for this school year
    if (newSchoolYearId) {
      fetchSubjectsForSchoolYear(newSchoolYearId);
    }
  };

  const handleCriteriaChange = (component, value) => {
    // Ensure value is a non-negative number
    let numericValue = value.replace(/[^0-9]/g, '');
    
    // Prevent values greater than 100
    if (parseInt(numericValue, 10) > 100) {
      numericValue = '100';
    }
    
    setCriteria(prev => ({
      ...prev,
      [component]: {
        percentage: numericValue
      }
    }));
  };

  const validateCriteria = () => {
    // Convert empty strings to 0 for calculation
    const writtenWorks = Number(criteria.writtenWorks.percentage) || 0;
    const performanceTasks = Number(criteria.performanceTasks.percentage) || 0;
    const quarterlyAssessment = Number(criteria.quarterlyAssessment.percentage) || 0;
    
    // Check for valid numeric values
    if (isNaN(writtenWorks) || isNaN(performanceTasks) || isNaN(quarterlyAssessment)) {
      setError('All percentages must be valid numbers');
      return false;
    }
    
    // Check for negative values
    if (writtenWorks < 0 || performanceTasks < 0 || quarterlyAssessment < 0) {
      setError('Percentages cannot be negative');
      return false;
    }
    
    const total = writtenWorks + performanceTasks + quarterlyAssessment;
    
    if (total < 100) {
      setError('Total percentage must equal 100%. Current total is ' + total + '%');
      return false;
    }
    if (total > 100) {
      setError('Total percentage cannot exceed 100%. Current total is ' + total + '%');
      return false;
    }
    return true;
  };

  // Add function to calculate and display remaining percentage
  const getRemainingPercentage = () => {
    const writtenWorks = Number(criteria.writtenWorks.percentage) || 0;
    const performanceTasks = Number(criteria.performanceTasks.percentage) || 0;
    const quarterlyAssessment = Number(criteria.quarterlyAssessment.percentage) || 0;
    
    const total = writtenWorks + performanceTasks + quarterlyAssessment;
    const remaining = 100 - total;
    
    return remaining;
  };

  // Function to handle the confirmation modal action
  const handleConfirmAction = async () => {
    setIsModalOpen(false);
    
    if (!modalAction) return;
    
    try {
      await modalAction();
    } catch (error) {
      console.error('Error executing confirmed action:', error);
      setError(`Failed to save grading criteria: ${error.message}`);
    }
  };

  // Function to open the confirmation modal
  const openConfirmationModal = (message, action) => {
    setModalMessage(message);
    setModalAction(() => action);
    setIsModalOpen(true);
  };

  // Update handleSubmit to use the custom modal instead of window.confirm
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateCriteria()) return;
    if (!selectedSubject || !selectedSchoolYear) {
      setError('Please select both subject and school year');
      return;
    }

    try {
      // Convert IDs to numbers right at the beginning for consistency
      const subjectId = parseInt(selectedSubject, 10);
      const schoolYearId = parseInt(selectedSchoolYear, 10);
      
      if (isNaN(subjectId) || isNaN(schoolYearId)) {
        setError('Invalid subject or school year selected');
        return;
      }
      
      // First check if criteria already exists - use numeric IDs
      const checkResponse = await fetchGrading(`/api/grading-criteria/${subjectId}/${schoolYearId}`);
      const checkData = await checkResponse.json();
      const isUpdate = checkData.exists;
      
      // Define the save action to be executed after confirmation
      const saveAction = async () => {
        // Convert percentage values to numbers to ensure they are sent as numbers, not strings
        const writtenWorksPercentage = parseInt(criteria.writtenWorks.percentage, 10);
        const performanceTasksPercentage = parseInt(criteria.performanceTasks.percentage, 10);
        const quarterlyAssessmentPercentage = parseInt(criteria.quarterlyAssessment.percentage, 10);
        
        // Validate one more time to ensure we have valid numbers
        if (isNaN(writtenWorksPercentage) || isNaN(performanceTasksPercentage) || isNaN(quarterlyAssessmentPercentage) ||
            isNaN(subjectId) || isNaN(schoolYearId)) {
          setError('Please ensure all fields contain valid numeric values');
          return;
        }

        // Double-check percentages sum to exactly 100
        const total = writtenWorksPercentage + performanceTasksPercentage + quarterlyAssessmentPercentage;
        
        if (total !== 100) {
          setError(`Percentages must sum to exactly 100%. Current total is ${total}%`);
          return;
        }
        
        // Ensure we have positive values
        if (writtenWorksPercentage <= 0 || performanceTasksPercentage <= 0 || quarterlyAssessmentPercentage <= 0) {
          setError('All percentages must be greater than zero');
          return;
        }

        // Log the data being sent to help debug
        console.log('Sending grading criteria data:', {
          subject_id: subjectId,
          school_year_id: schoolYearId,
          written_works_percentage: writtenWorksPercentage,
          performance_tasks_percentage: performanceTasksPercentage,
          quarterly_assessment_percentage: quarterlyAssessmentPercentage
        });

        const response = await fetchGrading('/api/grading-criteria', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject_id: subjectId,
            school_year_id: schoolYearId,
            written_works_percentage: writtenWorksPercentage,
            performance_tasks_percentage: performanceTasksPercentage,
            quarterly_assessment_percentage: quarterlyAssessmentPercentage
          }),
        });

        if (!response.ok) {
          // Try to get more detailed error information
          let errorDetail = '';
          try {
            const errorData = await response.json();
            console.error('Server error details:', errorData);
            if (errorData && errorData.message) {
              errorDetail = `: ${errorData.message}`;
            }
          } catch (parseError) {
            console.error('Could not parse error response as JSON', parseError);
            // Try to get the response text instead
            try {
              const errorText = await response.text();
              console.error('Server error text:', errorText);
              if (errorText) {
                errorDetail = `: ${errorText}`;
              }
            } catch (textError) {
              console.error('Could not get response text', textError);
            }
          }
          
          throw new Error(`Failed to save criteria: ${response.status} ${response.statusText}${errorDetail}`);
        }
        
        setError('');
        setSuccessMessage(isUpdate 
          ? 'Grading criteria updated successfully!' 
          : 'Grading criteria set successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      };

      // Different confirmation messages for save and update
      if (isUpdate) {
        // Criteria exists, ask for update confirmation using our custom modal
        openConfirmationModal('Updating the Grading Criteria will affect the Grading of the students. Do you want to update it?', saveAction);
      } else {
        // New criteria, ask for save confirmation using our custom modal
        openConfirmationModal('Are you sure you want to save the Grading Criteria?', saveAction);
      }
    } catch (error) {
      setError(`Failed to save grading criteria: ${error.message}`);
      console.error('Error:', error);
    }
  };

  // Custom Confirmation Modal Component
  const ConfirmationModal = ({ isOpen, message, onCancel, onConfirm }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirmation</h3>
            <p className="text-gray-700">{message}</p>
          </div>
          <div className="flex justify-end space-x-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-[#526D82] text-white rounded-md hover:bg-[#3E5367]"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Filter subjects based on selected grade level
  const filteredSubjects = selectedGradeLevel
    ? subjects.filter(subject => subject.grade_level === selectedGradeLevel)
    : subjects;

  // Helper: find parent subjects (those with at least one child)
  const parentSubjectIds = new Set(subjects.filter(s => s.parent_subject_id).map(s => s.parent_subject_id));

  return (
    <div className="content-container bg-[#F3F3F6]">
      <div className="p-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* Selection Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* School Year Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select School Year
              </label>
              <select
                value={selectedSchoolYear}
                onChange={handleSchoolYearChange}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select a school year</option>
                {schoolYears.map(year => (
                  <option 
                    key={year.school_year_id} 
                    value={year.school_year_id}
                  >
                    {year.school_year} {year.is_active ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Grade Level Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Grade Level
              </label>
              <select
                value={selectedGradeLevel}
                onChange={e => {
                  setSelectedGradeLevel(e.target.value);
                  setSelectedSubject(''); // Reset subject when grade level changes
                }}
                className="w-full px-3 py-2 border rounded-md"
                disabled={!selectedSchoolYear}
              >
                <option value="">Select a grade level</option>
                <option value="Kindergarten">Kindergarten</option>
                <option value="1">Grade 1</option>
                <option value="2">Grade 2</option>
                <option value="3">Grade 3</option>
                <option value="4">Grade 4</option>
                <option value="5">Grade 5</option>
                <option value="6">Grade 6</option>
              </select>
            </div>

            {/* Subject Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Subject
              </label>
              <select
                value={selectedSubject}
                onChange={handleSubjectChange}
                className="w-full px-3 py-2 border rounded-md"
                disabled={!selectedSchoolYear || !selectedGradeLevel}
              >
                <option value="">Select a subject</option>
                {filteredSubjects.map(subject => (
                  <option
                    key={subject.subject_id}
                    value={subject.subject_id}
                    disabled={parentSubjectIds.has(subject.subject_id)}
                  >
                    {subject.subject_name}
                    {parentSubjectIds.has(subject.subject_id) ? ' (Composite/Parent Subject - cannot set criteria)' : ''}
                  </option>
                ))}
              </select>
              {(!selectedSchoolYear || !selectedGradeLevel) && (
                <p className="mt-1 text-xs text-amber-600">
                  Please select both a school year and a grade level to enable subject selection.
                </p>
              )}
              {selectedSubject && parentSubjectIds.has(Number(selectedSubject)) && (
                <div className="mt-2 p-2 bg-amber-50 border-l-4 border-amber-500 text-amber-700 rounded">
                  This is a parent subject. Setting grading criteria is not required and will be disregarded. Please set criteria for the component subjects instead.
                </div>
              )}
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700">
              {successMessage}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
              {error}
            </div>
          )}

          {selectedSubject && !parentSubjectIds.has(Number(selectedSubject)) && (
            <div className="space-y-6">
              {/* Display remaining percentage */}
              <div className="mb-4 p-4 bg-blue-50 border-l-4 border-blue-500 text-blue-700">
                Remaining percentage to allocate: {getRemainingPercentage()}%
              </div>
              <form onSubmit={handleSubmit}>
                {/* Written Works */}
                <div className="mb-6 p-4 border rounded-lg">
                  <h3 className="text-lg font-medium mb-4">Written Works</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Percentage (%)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={criteria.writtenWorks.percentage}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        handleCriteriaChange('writtenWorks', value);
                      }}
                      className="w-full md:w-1/3 px-3 py-2 border rounded-md"
                      required
                      placeholder="Enter percentage"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                {/* Performance Tasks */}
                <div className="mb-6 p-4 border rounded-lg">
                  <h3 className="text-lg font-medium mb-4">Performance Tasks</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Percentage (%)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={criteria.performanceTasks.percentage}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        handleCriteriaChange('performanceTasks', value);
                      }}
                      className="w-full md:w-1/3 px-3 py-2 border rounded-md"
                      required
                      placeholder="Enter percentage"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                {/* Quarterly Assessment */}
                <div className="mb-6 p-4 border rounded-lg">
                  <h3 className="text-lg font-medium mb-4">Quarterly Assessment</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Percentage (%)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={criteria.quarterlyAssessment.percentage}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        handleCriteriaChange('quarterlyAssessment', value);
                      }}
                      className="w-full md:w-1/3 px-3 py-2 border rounded-md"
                      required
                      placeholder="Enter percentage"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#526D82] text-white rounded-md hover:bg-[#3E5367]"
                  >
                    {criteriaExists ? 'Update Criteria' : 'Save Criteria'}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {/* Render the Custom Confirmation Modal */}
          <ConfirmationModal 
            isOpen={isModalOpen}
            message={modalMessage}
            onCancel={() => setIsModalOpen(false)}
            onConfirm={handleConfirmAction}
          />
        </div>
      </div>
    </div>
  );
};

export default GradingCriteria;
