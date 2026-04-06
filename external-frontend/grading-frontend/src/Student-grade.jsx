import React, { useState, useEffect } from "react";
import axios from "axios";
import { gradingUrl, getAuthHeader, fetchGrading } from "./lib/api";

const StudentGrade = () => {
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("1"); // Default to First Quarter
  const [schoolYears, setSchoolYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState({}); // Track which grades are being edited
  const [editedGrades, setEditedGrades] = useState({}); // Store edited grade values
  const [savingGrades, setSavingGrades] = useState({}); // Track which grades are being saved
  const [successMessage, setSuccessMessage] = useState(""); // Success message for grade updates
  const [isKindergartenClass, setIsKindergartenClass] = useState(false); // Track if selected class is Kindergarten
  const [gwaMap, setGwaMap] = useState({});

  // Fetch school years first
  useEffect(() => {
    const fetchSchoolYears = async () => {
      try {
        setLoading(true);
        const response = await fetchGrading("/api/school-years");
        if (!response.ok) throw new Error("Failed to fetch school years");
        const data = await response.json();
        setSchoolYears(data);

        // Find active school year (assuming is_active field exists)
        const activeYear = data.find((year) => year.is_active);
        if (activeYear) {
          setSelectedYear(activeYear.school_year_id.toString());
          fetchClassesForYear(activeYear.school_year_id);
        }
      } catch (error) {
        console.error("Error:", error);
        setError("Failed to load school years");
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolYears();
  }, []);

  // Fetch classes for selected school year
  const fetchClassesForYear = async (schoolYearId) => {
    if (!schoolYearId) return;

    try {
      setLoading(true);
      console.log("Fetching classes for year ID:", schoolYearId);

      // Use the classes endpoint and filter by school_year_id
      const response = await fetchGrading("/api/classes");

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`Failed to fetch classes: ${response.status}`);
      }

      const allClasses = await response.json();
      // Filter classes for the selected school year
      const filteredClasses = allClasses.filter(
        (c) => c.school_year_id === parseInt(schoolYearId),
      );

      // Fetch student counts for each class
      const classesWithCounts = await Promise.all(
        filteredClasses.map(async (c) => {
          try {
            const studentsResponse = await fetchGrading(
              `/api/classes/${c.class_id}/students`,
            );
            if (!studentsResponse.ok) {
              console.warn(`Could not fetch students for class ${c.class_id}`);
              return { ...c, male_count: 0, female_count: 0 };
            }
            const studentsData = await studentsResponse.json();
            const maleCount = studentsData.filter(
              (s) => s.gender === "M" || s.gender === "Male",
            ).length;
            const femaleCount = studentsData.filter(
              (s) => s.gender === "F" || s.gender === "Female",
            ).length;
            return { ...c, male_count: maleCount, female_count: femaleCount };
          } catch (error) {
            console.error(
              `Error fetching students for class ${c.class_id}:`,
              error,
            );
            return { ...c, male_count: 0, female_count: 0 };
          }
        }),
      );

      console.log("Classes data with counts:", classesWithCounts);
      setClasses(classesWithCounts);
    } catch (error) {
      console.error("Error:", error);
      setError("Failed to load classes");
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleYearChange = (e) => {
    const yearId = e.target.value;
    console.log("Selected year ID:", yearId);
    setSelectedYear(yearId);
    if (yearId) {
      fetchClassesForYear(yearId);
    }
    setSelectedClass("");
  };

  const handleClassChange = (e) => {
    const classId = e.target.value;
    setSelectedClass(classId);

    // Check if this is a Kindergarten class
    if (classId) {
      const selectedClassData = classes.find(
        (c) => c.class_id === parseInt(classId),
      );
      if (selectedClassData) {
        const isKindergarten = selectedClassData.grade_level === "Kindergarten";
        console.log(`Selected class is Kindergarten: ${isKindergarten}`);
        setIsKindergartenClass(isKindergarten);
      }
    } else {
      setIsKindergartenClass(false);
    }
  };

  const handleQuarterChange = (e) => {
    setSelectedQuarter(e.target.value);
    // If we already have a class selected, reload student data with the new quarter
    if (selectedClass) {
      // Reset any edit states to prevent confusion
      setEditMode({});
      setEditedGrades({});
    }
  };

  // Fetch subjects and students when class or quarter changes
  useEffect(() => {
    if (selectedClass) {
      const fetchClassData = async () => {
        try {
          setLoading(true);
          setError(null);

          // Fetch subjects for the class
          const subjectsResponse = await fetchGrading(
            `/api/classes/${selectedClass}/subjects`,
          );
          if (!subjectsResponse.ok) {
            const errorText = await subjectsResponse.text();
            console.error("Subjects error response:", errorText);
            throw new Error(
              `Failed to fetch subjects: ${subjectsResponse.status}`,
            );
          }
          const subjectsData = await subjectsResponse.json();
          setSubjects(subjectsData);

          // Fetch students for the class
          try {
            const studentsResponse = await fetchGrading(
              `/api/classes/${selectedClass}/students`,
            );
            if (!studentsResponse.ok) {
              const errorText = await studentsResponse.text();
              console.error("Students error response:", errorText);
              throw new Error(
                `Failed to fetch students: ${studentsResponse.status}`,
              );
            }
            const studentsData = await studentsResponse.json();

            // Check if we got any students
            if (studentsData.length === 0) {
              console.log("No students found for this class");
              setStudents([]);
              setLoading(false);
              return; // Exit early if no students
            }

            // For each student, fetch their grades for the selected quarter
            const studentsWithGrades = await Promise.all(
              studentsData.map(async (student) => {
                try {
                  const gradesResponse = await fetchGrading(
                    `/api/students/${student.user_id}/grades`,
                  );
                  if (!gradesResponse.ok) {
                    console.warn(
                      `Could not fetch grades for student ${student.user_id}`,
                    );
                    return { ...student, grades: {} };
                  }
                  const gradesData = await gradesResponse.json();

                  // Format grades as an object with subject_name as keys, filtering for the selected quarter
                  const gradesObj = {};
                  gradesData.forEach((grade) => {
                    // Convert both values to strings to ensure consistent comparison
                    // Quarter might be stored as number in DB but handled as string in frontend
                    if (
                      grade.class_id === parseInt(selectedClass) &&
                      grade.quarter.toString() === selectedQuarter.toString()
                    ) {
                      // For Kindergarten, use char_grade field, otherwise use numeric grade
                      gradesObj[grade.subject_name] = {
                        value: isKindergartenClass
                          ? grade.char_grade
                          : grade.grade,
                        subjectId: grade.subject_id,
                        quarter: grade.quarter,
                        gradeId: grade.grade_id, // Store the grade_id for updates
                        isCharGrade: isKindergartenClass, // Flag to indicate if this is a character grade
                      };
                    }
                  });

                  return { ...student, grades: gradesObj };
                } catch (error) {
                  console.error(
                    `Error fetching grades for student ${student.user_id}:`,
                    error,
                  );
                  return { ...student, grades: {} };
                }
              }),
            );

            setStudents(studentsWithGrades);
          } catch (error) {
            console.error("Error fetching students:", error);
            setError(`Failed to load students: ${error.message}`);
            setStudents([]);
          }
        } catch (error) {
          console.error("Error:", error);
          setError(`Failed to load class data: ${error.message}`);
        } finally {
          setLoading(false);
        }
      };

      fetchClassData();
    } else {
      // Reset data when no class is selected
      setSubjects([]);
      setStudents([]);
    }
  }, [selectedClass, selectedQuarter, isKindergartenClass]);

  // Handle edit mode toggle for a specific student and subject
  const toggleEditMode = (studentId, subjectName) => {
    const key = `${studentId}_${subjectName}`;
    setEditMode((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));

    // Initialize edited grade with current value if not already set
    if (!editedGrades[key] && students) {
      const student = students.find((s) => s.user_id === studentId);
      if (student && student.grades[subjectName]) {
        setEditedGrades((prev) => ({
          ...prev,
          [key]: student.grades[subjectName].value,
        }));
      }
    }
  };

  // Handle grade input change
  const handleGradeChange = (studentId, subjectName, value) => {
    const key = `${studentId}_${subjectName}`;

    // For character grades (Kindergarten), just store the value directly
    if (isKindergartenClass) {
      setEditedGrades((prev) => ({
        ...prev,
        [key]: value,
      }));
      return;
    }

    // For numeric grades (other grade levels), validate range 0-100
    const grade = Math.min(Math.max(parseFloat(value) || 0, 0), 100);
    setEditedGrades((prev) => ({
      ...prev,
      [key]: grade,
    }));
  };

  // Save updated grade
  const saveGrade = async (studentId, subjectName) => {
    const key = `${studentId}_${subjectName}`;
    const student = students.find((s) => s.user_id === studentId);

    if (!student || !student.grades[subjectName]) {
      console.error("Cannot find grade information");
      return;
    }

    const gradeInfo = student.grades[subjectName];
    const newGrade = editedGrades[key];

    if (newGrade === undefined || newGrade === gradeInfo.value) {
      // No change, just exit edit mode
      setEditMode((prev) => ({
        ...prev,
        [key]: false,
      }));
      return;
    }

    try {
      setSavingGrades((prev) => ({
        ...prev,
        [key]: true,
      }));

      // Create teacher ID from localStorage (default to 1 if not found)
      const teacherId = parseInt(localStorage.getItem("userId")) || 1;

      // Prepare grade data in the format expected by the backend
      const gradeData = [
        {
          student_id: parseInt(studentId),
          class_id: parseInt(selectedClass),
          subject_id: parseInt(gradeInfo.subjectId),
          teacher_id: teacherId,
          quarter: gradeInfo.quarter.toString(),
          school_year_id: parseInt(selectedYear),
        },
      ];

      // Add either char_grade or grade based on class type
      if (isKindergartenClass) {
        gradeData[0].char_grade = newGrade;
      } else {
        gradeData[0].grade = parseFloat(newGrade);
      }

      // Use the submit endpoint which is designed to replace existing grades
      const response = await axios.post(
        gradingUrl("/api/grades/submit"),
        gradeData,
        { headers: getAuthHeader() },
      );

      // Update local state with new grade
      setStudents((prev) =>
        prev.map((s) => {
          if (s.user_id === studentId) {
            return {
              ...s,
              grades: {
                ...s.grades,
                [subjectName]: {
                  ...s.grades[subjectName],
                  value: newGrade,
                },
              },
            };
          }
          return s;
        }),
      );

      // After updating grade, recalculate quarterly GWA and refresh the table
      if (selectedClass && !isKindergartenClass) {
        try {
          // Recalculate quarterly GWA for the student
          await axios.post(gradingUrl("/api/grades/quarterly-gwa"), {
            student_id: parseInt(studentId),
            class_id: parseInt(selectedClass),
            school_year_id: parseInt(selectedYear),
            quarter: parseInt(selectedQuarter),
          }, { headers: getAuthHeader() });
          console.log(`Quarterly GWA recalculated for student ${studentId}`);
        } catch (gwaError) {
          console.error("Error recalculating quarterly GWA:", gwaError);
          // Don't fail the entire operation if GWA recalculation fails
        }
      }

      // Re-fetch students and grades to refresh the table
      if (selectedClass) {
        // This is the same logic as in the main useEffect for fetching students/grades
        const fetchClassData = async () => {
          try {
            setLoading(true);
            setError(null);
            // Fetch subjects for the class
            const subjectsResponse = await fetchGrading(
              `/api/classes/${selectedClass}/subjects`,
            );
            if (!subjectsResponse.ok)
              throw new Error(
                `Failed to fetch subjects: ${subjectsResponse.status}`,
              );
            const subjectsData = await subjectsResponse.json();
            setSubjects(subjectsData);
            // Fetch students for the class
            const studentsResponse = await fetchGrading(
              `/api/classes/${selectedClass}/students`,
            );
            if (!studentsResponse.ok)
              throw new Error(
                `Failed to fetch students: ${studentsResponse.status}`,
              );
            const studentsData = await studentsResponse.json();
            // For each student, fetch their grades for the selected quarter
            const studentsWithGrades = await Promise.all(
              studentsData.map(async (student) => {
                try {
                  const gradesResponse = await fetchGrading(
                    `/api/students/${student.user_id}/grades`,
                  );
                  if (!gradesResponse.ok) return { ...student, grades: {} };
                  const gradesData = await gradesResponse.json();
                  const gradesObj = {};
                  gradesData.forEach((grade) => {
                    if (
                      grade.class_id === parseInt(selectedClass) &&
                      grade.quarter.toString() === selectedQuarter.toString()
                    ) {
                      gradesObj[grade.subject_name] = {
                        value: isKindergartenClass
                          ? grade.char_grade
                          : grade.grade,
                        subjectId: grade.subject_id,
                        quarter: grade.quarter,
                        gradeId: grade.grade_id,
                        isCharGrade: isKindergartenClass,
                      };
                    }
                  });
                  return { ...student, grades: gradesObj };
                } catch {
                  return { ...student, grades: {} };
                }
              }),
            );
            setStudents(studentsWithGrades);

            // Refresh GWA map after updating students
            if (!isKindergartenClass) {
              const gwaResults = {};
              await Promise.all(
                studentsWithGrades.map(async (student) => {
                  const gwa = await fetchQuarterlyGwa(
                    student.user_id,
                    selectedClass,
                    selectedYear,
                    selectedQuarter,
                  );
                  gwaResults[student.user_id] = gwa;
                }),
              );
              setGwaMap(gwaResults);
            }
          } catch (error) {
            setError(`Failed to load class data: ${error.message}`);
            setStudents([]);
          } finally {
            setLoading(false);
          }
        };
        fetchClassData();
      }

      // Exit edit mode
      setEditMode((prev) => ({
        ...prev,
        [key]: false,
      }));
    } catch (error) {
      console.error("Error updating grade:", error);
      setError(
        `Failed to update grade: ${error.response?.data?.error || error.message}`,
      );
    } finally {
      setSavingGrades((prev) => ({
        ...prev,
        [key]: false,
      }));
    }
  };

  // Helper function to get quarter name
  const getQuarterName = (quarter) => {
    switch (quarter) {
      case "1":
        return "First Quarter";
      case "2":
        return "Second Quarter";
      case "3":
        return "Third Quarter";
      case "4":
        return "Fourth Quarter";
      default:
        return "Unknown Quarter";
    }
  };

  // Helper function to check if a grade is valid
  const isGradeValid = (grade) => {
    if (isKindergartenClass) {
      // For Kindergarten, check if grade is B, C, or D
      return ["B", "C", "D"].includes(grade);
    }
    // For numeric grades, check if it's a number between 0-100
    return !isNaN(grade) && grade !== "-";
  };

  // Add a function to fetch quarterly_gwa for each student
  const fetchQuarterlyGwa = async (
    studentId,
    classId,
    schoolYearId,
    quarter,
  ) => {
    try {
      const res = await axios.get(
        gradingUrl(`/api/students/${studentId}/${classId}/${schoolYearId}/quarterly-gwa/${quarter}`),
        { headers: getAuthHeader() },
      );
      return res.data &&
        res.data.quarterly_gwa !== undefined &&
        res.data.quarterly_gwa !== null
        ? parseFloat(res.data.quarterly_gwa).toFixed(2)
        : "-";
    } catch (err) {
      return "-";
    }
  };

  // Fetch quarterly_gwa for all students when students/subjects/quarter change
  useEffect(() => {
    const fetchAllGwa = async () => {
      if (
        !students.length ||
        !selectedClass ||
        !selectedYear ||
        !selectedQuarter
      )
        return;
      const gwaResults = {};
      await Promise.all(
        students.map(async (student) => {
          const gwa = await fetchQuarterlyGwa(
            student.user_id,
            selectedClass,
            selectedYear,
            selectedQuarter,
          );
          gwaResults[student.user_id] = gwa;
        }),
      );
      setGwaMap(gwaResults);
    };
    fetchAllGwa();
  }, [students, selectedClass, selectedYear, selectedQuarter]);

  // Helper to order subjects: MAPEH and its components at the end, in correct order
  const getOrderedSubjects = (subjects, gradeLevel) => {
    // Helper for robust subject name matching
    const matchName = (name, candidates) =>
      candidates
        .map((n) => n.toLowerCase())
        .includes((name || "").toLowerCase());
    // Acceptable names for each MAPEH component
    const MAPEH_COMPONENTS = {
      Music: ["Music"],
      Arts: ["Arts"],
      "Physical Education": ["Physical Education", "PE", "P.E"],
      Health: ["Health"],
      "Music and Arts": ["Music and Arts"],
      "Physical Education and Health": [
        "Physical Education and Health",
        "PE and Health",
        "P.E and Health",
      ],
    };
    if (!subjects || subjects.length === 0) return [];
    // 1. All other top-level subjects (not MAPEH, no parent_subject_id)
    const otherSubjects = subjects
      .filter((s) => !s.parent_subject_id && s.subject_name !== "MAPEH")
      .sort((a, b) => a.subject_name.localeCompare(b.subject_name));
    // 2. Find MAPEH parent and its children
    const mapehParent = subjects.find(
      (s) => s.subject_name === "MAPEH" && !s.parent_subject_id,
    );
    let mapehGroup = [];
    if (mapehParent) {
      mapehGroup.push(mapehParent);
      const mapehChildren = subjects.filter(
        (s) => s.parent_subject_id === mapehParent.subject_id,
      );
      let componentOrder;
      if ([1, 2, 3, "1", "2", "3"].includes(gradeLevel)) {
        componentOrder = ["Music", "Arts", "Physical Education", "Health"];
      } else if ([4, 5, 6, "4", "5", "6"].includes(gradeLevel)) {
        componentOrder = ["Music and Arts", "Physical Education and Health"];
      } else {
        componentOrder = mapehChildren.map((c) => c.subject_name).sort();
      }
      componentOrder.forEach((key) => {
        const candidates = MAPEH_COMPONENTS[key] || [key];
        const child = mapehChildren.find((c) =>
          matchName(c.subject_name, candidates),
        );
        if (child) mapehGroup.push(child);
      });
    }
    // 3. Return: all other subjects, then MAPEH group (parent + children)
    return [...otherSubjects, ...mapehGroup];
  };

  // Get grade level for ordering
  const selectedClassData = classes.find(
    (c) => c.class_id === parseInt(selectedClass),
  );
  const gradeLevel = selectedClassData?.grade_level;
  const orderedSubjects = getOrderedSubjects(subjects, gradeLevel);

  return (
    <div className="content-container bg-[#F3F3F6]">
      <style>
        {`
          select optgroup {
            font-weight: bold;
            font-size: 0.875rem;
            padding: 4px 8px;
            background-color: #f8f9fa;
            color: #374151;
          }
          select option {
            padding: 6px 12px;
            font-size: 0.875rem;
            line-height: 1.25;
          }
          select option:hover {
            background-color: #e5e7eb;
          }
        `}
      </style>
      <div className="p-8">
        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-12 gap-6">
            {/* Class Filter - Make it wider (6 columns) */}
            <div className="col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Class:
              </label>
              <div className="relative">
                <select
                  value={selectedClass}
                  onChange={handleClassChange}
                  className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:border-transparent"
                  disabled={!selectedYear || loading}
                  style={{
                    maxHeight: "300px",
                    overflowY: "auto",
                  }}
                >
                  <option value="">Select Class</option>
                  {(() => {
                    // Group classes by grade level and adviser
                    const gradeMap = new Map();
                    classes.forEach((cls) => {
                      const grade = cls.grade_level || "Unknown Grade";
                      const adviser =
                        [
                          cls.adviser_fname,
                          cls.adviser_mname,
                          cls.adviser_lname,
                        ]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || "—";
                      if (!gradeMap.has(grade)) gradeMap.set(grade, new Map());
                      const advMap = gradeMap.get(grade);
                      if (!advMap.has(adviser)) advMap.set(adviser, []);
                      advMap.get(adviser).push(cls);
                    });

                    // Render grouped options
                    const gradeLevels = Array.from(gradeMap.keys()).sort(
                      (a, b) => String(a).localeCompare(String(b)),
                    );
                    return gradeLevels.map((grade) => {
                      const advMap = gradeMap.get(grade);
                      const advisers = Array.from(advMap.keys()).sort((a, b) =>
                        a.localeCompare(b),
                      );
                      return (
                        <optgroup
                          key={grade}
                          label={
                            grade === "Kindergarten" || grade === "K"
                              ? "Kindergarten"
                              : `Grade ${grade}`
                          }
                        >
                          {advisers.map((adv) =>
                            advMap
                              .get(adv)
                              .sort((x, y) =>
                                String(x.section).localeCompare(
                                  String(y.section),
                                ),
                              )
                              .map((c) => {
                                // Get class code if available
                                const classCode = c.class_code
                                  ? ` (${c.class_code})`
                                  : "";
                                // Get student counts - we'll need to fetch this data
                                const maleCount = c.male_count || 0;
                                const femaleCount = c.female_count || 0;
                                return (
                                  <option key={c.class_id} value={c.class_id}>
                                    {c.class_id} - {c.section}
                                    {classCode} - {maleCount}M/{femaleCount}F -{" "}
                                    {adv}
                                  </option>
                                );
                              }),
                          )}
                        </optgroup>
                      );
                    });
                  })()}
                </select>
              </div>
            </div>

            {/* School Year Filter - Make it smaller (3 columns) */}
            <div className="col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                School Year:
              </label>
              <select
                value={selectedYear}
                onChange={handleYearChange}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:border-transparent"
              >
                <option value="">Select School Year</option>
                {schoolYears.map((year) => (
                  <option key={year.school_year_id} value={year.school_year_id}>
                    {year.school_year} {year.is_active ? "(Active)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Quarter Filter - Make it smaller (3 columns) */}
            <div className="col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quarter:
              </label>
              <select
                value={selectedQuarter}
                onChange={handleQuarterChange}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#526D82] focus:border-transparent"
              >
                <option value="1">First Quarter</option>
                <option value="2">Second Quarter</option>
                <option value="3">Third Quarter</option>
                <option value="4">Fourth Quarter</option>
              </select>
            </div>
          </div>
        </div>

        {/* Class Type Indicator */}
        {selectedClass && (
          <div
            className={`rounded-lg p-3 mb-6 ${isKindergartenClass ? "bg-amber-50 border border-amber-200" : "bg-blue-50 border border-blue-200"}`}
          >
            <p className="text-sm">
              {isKindergartenClass
                ? "🧸 This is a Kindergarten class. Character grades (A, B, C, D, E) will be used for assessment."
                : "📚 This is a regular class. Numeric grades will be used for assessment."}
            </p>
          </div>
        )}

        {/* Table Section */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {students.length > 0 && subjects.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="bg-[#526D82]">
                  <th className="py-2 px-3 text-left text-white font-medium text-xs">
                    Student ID
                  </th>
                  <th className="py-2 px-3 text-left text-white font-medium text-xs">
                    Student Name
                  </th>
                  {orderedSubjects.map((subject) => (
                    <th
                      key={`header-${subject.subject_id}`}
                      className="py-2 px-3 text-center text-white font-medium text-xs"
                    >
                      {subject.subject_name}
                    </th>
                  ))}
                  {/* Only show Average Grade column for non-Kindergarten classes */}
                  {!isKindergartenClass && (
                    <th className="py-2 px-3 text-center text-white font-medium text-xs">
                      Average Grade
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  return (
                    <tr
                      key={`student-${student.user_id}`}
                      className="border-b border-gray-100"
                    >
                      <td className="py-2 px-3 text-black text-xs">
                        {student.user_id}
                      </td>
                      <td className="py-2 px-3 text-black text-xs">
                        {`${student.lname}, ${student.fname} ${student.mname || ""}`}
                      </td>
                      {orderedSubjects.map((subject) => {
                        const gradeKey = `${student.user_id}_${subject.subject_name}`;
                        const isEditing = editMode[gradeKey];
                        const isSaving = savingGrades[gradeKey];
                        const currentGrade =
                          student.grades[subject.subject_name]?.value || "-";
                        // Disable editing for MAPEH parent subject
                        const isMapehParent =
                          subject.subject_name === "MAPEH" &&
                          !subject.parent_subject_id;
                        return (
                          <td
                            key={`grade-${student.user_id}-${subject.subject_id}`}
                            className="py-2 px-3 text-center"
                          >
                            {isSaving ? (
                              <svg
                                className="animate-spin h-4 w-4 mx-auto text-blue-500"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                            ) : isMapehParent ? (
                              <span className="text-xs">{currentGrade}</span>
                            ) : isEditing ? (
                              <div className="flex items-center justify-center space-x-2">
                                {isKindergartenClass ? (
                                  // Dropdown for Kindergarten character grades
                                  <select
                                    value={editedGrades[gradeKey] || ""}
                                    onChange={(e) =>
                                      handleGradeChange(
                                        student.user_id,
                                        subject.subject_name,
                                        e.target.value,
                                      )
                                    }
                                    className="w-16 p-1 border border-gray-300 rounded-md text-center"
                                    disabled={isSaving}
                                  >
                                    <option value="">Select</option>
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                    <option value="D">D</option>
                                    <option value="E">E</option>
                                  </select>
                                ) : (
                                  // Numeric input for other grade levels
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={editedGrades[gradeKey] || ""}
                                    onChange={(e) =>
                                      handleGradeChange(
                                        student.user_id,
                                        subject.subject_name,
                                        e.target.value,
                                      )
                                    }
                                    className="w-16 p-1 border border-gray-300 rounded-md text-center"
                                    disabled={isSaving}
                                  />
                                )}
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() =>
                                      saveGrade(
                                        student.user_id,
                                        subject.subject_name,
                                      )
                                    }
                                    disabled={isSaving}
                                    className="text-green-600 hover:text-green-800 transition-colors"
                                    title="Save"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-4 w-4"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() =>
                                      toggleEditMode(
                                        student.user_id,
                                        subject.subject_name,
                                      )
                                    }
                                    disabled={isSaving}
                                    className="text-red-600 hover:text-red-800 transition-colors"
                                    title="Cancel"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-4 w-4"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
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
                              </div>
                            ) : (
                              <div className="flex items-center justify-center">
                                <span className="text-xs">{currentGrade}</span>
                                {!isMapehParent && (
                                  <button
                                    onClick={() =>
                                      toggleEditMode(
                                        student.user_id,
                                        subject.subject_name,
                                      )
                                    }
                                    className="ml-2 text-blue-600 hover:text-blue-800 transition-colors opacity-70 hover:opacity-100"
                                    title="Edit grade"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-4 w-4"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                      />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      {/* Only show Average Grade cell for non-Kindergarten classes */}
                      {!isKindergartenClass && (
                        <td className="py-2 px-3 text-center font-medium relative text-xs">
                          {gwaMap[student.user_id] || "-"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            !loading && (
              <div className="text-center py-8 text-gray-500">
                {selectedClass
                  ? `No data available for this class in ${getQuarterName(selectedQuarter)}`
                  : "Select a class to view student grades"}
              </div>
            )
          )}
        </div>

        {/* Only show the global loading message when the whole table is loading */}
        {loading && (
          <div className="text-center py-4">
            <p className="text-gray-600">Loading...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mt-4">
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentGrade;
