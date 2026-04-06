import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './contexts/AuthContext';
import { gradingUrl, getAuthHeader } from './lib/api';

const MyClass = () => {
  const [classes, setClasses] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [schoolYears, setSchoolYears] = useState([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      fetchTeacherData();
      fetchSchoolYears();
    }
  }, [currentUser]);

  useEffect(() => {
    if (teacher && selectedSchoolYear) {
      fetchTeacherClasses();
    }
  }, [teacher, selectedSchoolYear]);

  const fetchTeacherData = async () => {
    try {
      if (!currentUser?.email) {
        throw new Error('No authenticated user found');
      }

      // Get user data by email
      const userResponse = await axios.get(gradingUrl(`/users/byEmail/${currentUser.email}`), { headers: getAuthHeader() });
      console.log('Teacher data:', userResponse.data);
      const userData = userResponse.data;

      if (!userData || !userData.user_id) {
        throw new Error('User not found');
      }

      setTeacher(userData);
    } catch (err) {
      console.error('Error fetching teacher data:', err);
      setError(err.message || 'Failed to load teacher data');
      setLoading(false);
    }
  };

  const fetchSchoolYears = async () => {
    try {
      const response = await axios.get(gradingUrl('/api/school-years'), { headers: getAuthHeader() });
      setSchoolYears(response.data);
      
      // Find active school year
      const activeYear = response.data.find(year => year.is_active);
      if (activeYear) {
        setSelectedSchoolYear(activeYear.school_year_id);
      } else if (response.data.length > 0) {
        // If no active year, use the most recent one
        const sortedYears = [...response.data].sort((a, b) => 
          b.school_year.localeCompare(a.school_year)
        );
        setSelectedSchoolYear(sortedYears[0].school_year_id);
      }
    } catch (err) {
      console.error('Error fetching school years:', err);
      setError(err.message || 'Failed to load school years');
    }
  };

  const fetchTeacherClasses = async () => {
    try {
      if (!teacher || !selectedSchoolYear) return;
      
      // Get teacher's classes and subjects with school year filter
      const classesResponse = await axios.get(
        gradingUrl(`/api/teachers/${teacher.user_id}/class-subjects`),
        { params: { schoolYearId: selectedSchoolYear }, headers: getAuthHeader() }
      );
      console.log('Raw classes data:', classesResponse.data);

      if (!Array.isArray(classesResponse.data)) {
        throw new Error('Invalid data format received from server');
      }

      // Group classes by class_id with their subjects
      const groupedClasses = {};
      classesResponse.data.forEach(item => {
        if (!groupedClasses[item.class_id]) {
          groupedClasses[item.class_id] = {
            class_id: item.class_id,
            grade_level: item.grade_level,
            section: item.section,
            school_year_id: item.school_year_id,
            school_year: item.school_year,
            program_name: item.program_name,
            class_code: item.class_code,
            subjects: []
          };
        }
        groupedClasses[item.class_id].subjects.push({
          subject_id: item.subject_id,
          subject_name: item.subject,
          parent_subject_id: item.parent_subject_id
        });
      });

      const finalClasses = Object.values(groupedClasses);
      console.log('Processed classes data:', finalClasses);
      setClasses(finalClasses);
      setLoading(false);
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data');
      setLoading(false);
    }
  };

  const handleSchoolYearChange = (e) => {
    setSelectedSchoolYear(parseInt(e.target.value));
    setLoading(true);
  };

  // Helper function to order subjects with MAPEH components in the correct order
  const getOrderedSubjects = (subjects, gradeLevel) => {
    // Helper for robust subject name matching
    const matchName = (name, candidates) => candidates.map(n => n.toLowerCase()).includes((name || '').toLowerCase());
    // Acceptable names for each MAPEH component
    const MAPEH_COMPONENTS = {
      'Music': ['Music'],
      'Arts': ['Arts'],
      'Physical Education': ['Physical Education', 'PE', 'P.E'],
      'Health': ['Health'],
      'Music and Arts': ['Music and Arts'],
      'Physical Education and Health': ['Physical Education and Health', 'PE and Health', 'P.E and Health']
    };
    
    if (!subjects || subjects.length === 0) return [];
    
    // 1. All other top-level subjects (not MAPEH, no parent_subject_id)
    const otherSubjects = subjects.filter(s => !s.parent_subject_id && s.subject_name !== 'MAPEH')
      .sort((a, b) => a.subject_name.localeCompare(b.subject_name));
    
    // 2. Find MAPEH parent and its children
    const mapehParent = subjects.find(s => s.subject_name === 'MAPEH' && !s.parent_subject_id);
    let mapehGroup = [];
    
    if (mapehParent) {
      mapehGroup.push(mapehParent);
      const mapehChildren = subjects.filter(s => s.parent_subject_id === mapehParent.subject_id);
      
      let componentOrder;
      if ([1, 2, 3, '1', '2', '3'].includes(gradeLevel)) {
        componentOrder = ['Music', 'Arts', 'Physical Education', 'Health'];
      } else if ([4, 5, 6, '4', '5', '6'].includes(gradeLevel)) {
        componentOrder = ['Music and Arts', 'Physical Education and Health'];
      } else {
        componentOrder = mapehChildren.map(c => c.subject_name).sort();
      }
      
      componentOrder.forEach(key => {
        const candidates = MAPEH_COMPONENTS[key] || [key];
        const child = mapehChildren.find(c => matchName(c.subject_name, candidates));
        if (child) mapehGroup.push(child);
      });
    }
    
    // 3. Return: all other subjects, then MAPEH group (parent + children)
    return [...otherSubjects, ...mapehGroup];
  };

  const handleViewClass = (classItem, subject) => {
    console.log('Viewing class:', classItem, 'with subject:', subject);
    navigate('/my-class-view', { 
      state: {
        userId: teacher.user_id,
        classId: classItem.class_id,
        subjectId: subject.subject_id,
        schoolYearId: classItem.school_year_id,
        gradeLevel: classItem.grade_level,
        section: classItem.section,
        subject: subject.subject_name,
        schoolYear: classItem.school_year
      }
    });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="bg-[#F3F3F6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section with School Year Filter */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex-shrink-0">
            <div className="bg-white shadow-md rounded-md p-2">
              <label htmlFor="schoolYear" className="block text-sm font-medium text-gray-700 mb-1">
                School Year
              </label>
              <div className="relative w-48">
                <select
                  id="schoolYear"
                  value={selectedSchoolYear || ''}
                  onChange={handleSchoolYearChange}
                  className="w-full pl-3 pr-10 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md appearance-none focus:outline-none focus:ring-1 focus:ring-[#7D9164] focus:border-[#7D9164]"
                >
                  {schoolYears.map(year => (
                    <option key={year.school_year_id} value={year.school_year_id}>
                      {year.school_year} {year.is_active ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-grow">
            <p className="text-lg text-gray-600">View your assigned classes and manage your student records.</p>
          </div>
        </div>

        {/* Classes Grid */}
        {classes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="flex flex-col items-center justify-center">
              <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4M12 4v16m8-8l-4 4m0-8l4 4"/>
              </svg>
              <h3 className="text-xl font-medium text-gray-900">No Classes Assigned</h3>
              <p className="mt-2 text-gray-500">
                {selectedSchoolYear ? 
                  "You don't have any classes assigned for this school year." : 
                  "Please select a school year to view your classes."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {classes.map((classItem) => (
              <div 
                key={classItem.class_id} 
                className="bg-white rounded-lg shadow-[0_4px_10px_rgba(0,0,0,0.15)] hover:shadow-[0_10px_20px_rgba(0,0,0,0.2)] 
                           hover:-translate-y-1 transition-all duration-300 ease-in-out overflow-hidden"
              >
                {/* Class Header - Match the header background color */}
                <div className="bg-[#B8BEA7] px-6 py-5">
                  <h3 className="text-xs font-bold tracking-wide text-[#1E293B]" style={{ fontFamily: '"Century Gothic", CenturyGothic, AppleGothic, sans-serif' }}>
                    {classItem.grade_level === 'Kindergarten' ? 'Kindergarten' : `Grade ${classItem.grade_level}`} - {classItem.section}
                  </h3>
                  {classItem.program_name && (
                    <p className="text-xs text-[#1E293B] mt-1 font-bold opacity-80" style={{ fontFamily: '"Century Gothic", CenturyGothic, AppleGothic, sans-serif' }}>
                      Program Name: {classItem.program_name}
                    </p>
                  )}
                  {classItem.class_code && (
                    <p className="text-xs text-[#1E293B] mt-1 font-bold opacity-80" style={{ fontFamily: '"Century Gothic", CenturyGothic, AppleGothic, sans-serif' }}>
                      Class Code: {classItem.class_code}
                    </p>
                  )}
                </div>

                {/* Subjects List */}
                <div className="p-0">
                  {(() => {
                    // Get ordered subjects using the helper function
                    const orderedSubjects = getOrderedSubjects(classItem.subjects || [], classItem.grade_level);
                    
                    return orderedSubjects.map((subject) => {
                      // Determine if this subject is a parent (has children in this class)
                      const isParent = classItem.subjects.some(s => s.parent_subject_id === subject.subject_id);
                      return (
                        <div 
                          key={`${classItem.class_id}-${subject.subject_id}`} 
                          className="px-6 py-5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors duration-200"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-[#1E293B] font-semibold">
                                {subject.subject_name}
                              </h4>
                              <p className="text-sm text-[#1E293B] mt-1">
                                Subject Code: {subject.subject_id}
                              </p>
                            </div>
                            <button
                              onClick={() => handleViewClass(classItem, subject)}
                              className={`flex items-center px-4 py-2 bg-[#7D9164] text-white text-sm font-medium rounded-md transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 ${isParent ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                              disabled={isParent}
                              title={isParent ? 'This is a parent subject. Please manage its components instead.' : 'View Class'}
                            >
                              <span>View Class</span>
                              <svg 
                                className="ml-2 w-4 h-4" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round" 
                                  strokeWidth="2" 
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyClass;
