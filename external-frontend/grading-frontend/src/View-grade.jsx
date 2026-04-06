import React, { useState, useEffect } from "react";
import axios from "axios";
import { gradingUrl, getAuthHeader } from "./lib/api";

const ViewGrade = () => {
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  const [studentData, setStudentData] = useState(null);
  const [schoolYears, setSchoolYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [classAdviser, setClassAdviser] = useState(null);
  const [quarterAverages, setQuarterAverages] = useState({
    q1: null,
    q2: null,
    q3: null,
    q4: null,
    gwa: null,
  });
  const [isKindergarten, setIsKindergarten] = useState(false);
  const [subjectFinals, setSubjectFinals] = useState({});

  // Define fetchStudentGrades outside any useEffect to make it available to all functions
  const fetchStudentGrades = async (yearId) => {
    try {
      setLoading(true);
      setError(null);

      const userId = localStorage.getItem("userId");
      if (!userId) {
        console.error("User not authenticated");
        setError("User not authenticated");
        setLoading(false);
        return;
      }

      const targetYearId = yearId || selectedYear;
      if (!targetYearId) {
        console.error("No school year selected");
        setError("Please select a school year");
        setLoading(false);
        return;
      }

      console.log(
        `Fetching grades for student ${userId} in school year ${targetYearId}`,
      );

      // Add a timeout to handle stuck requests
      const fetchPromise = axios.get(
        gradingUrl(`/api/students/${userId}/${targetYearId}?onlyAssigned=true`),
        { headers: getAuthHeader() },
      );

      const response = await fetchPromise;
      console.log("Student grades response:", response.data);

      // Check if the response has the expected structure
      if (!response.data) {
        throw new Error("Empty response received");
      }

      // Check if the student is in Kindergarten
      const isKindergartenStudent =
        response.data.grade_level === "Kindergarten";
      setIsKindergarten(isKindergartenStudent);

      // Store response data
      setStudentData(response.data);

      // Fetch class adviser information if student has a class
      if (response.data.enrolled !== false && response.data.class_id) {
        try {
          const classResponse = await axios.get(
            gradingUrl(`/api/classes/${response.data.class_id}`),
            { headers: getAuthHeader() },
          );
          if (classResponse.data && classResponse.data.adviser_fname) {
            setClassAdviser({
              name: `${classResponse.data.adviser_lname}, ${classResponse.data.adviser_fname} ${classResponse.data.adviser_mname || ""}`.trim(),
              id: classResponse.data.class_adviser_id,
            });
          } else {
            setClassAdviser(null);
          }
        } catch (adviserErr) {
          console.error("Error fetching class adviser:", adviserErr);
          setClassAdviser(null);
        }
      } else {
        setClassAdviser(null);
      }

      // Check if student is enrolled
      if (response.data.enrolled === false) {
        console.log("Student is not enrolled in this school year");
        // Clear previous grades data but keep student info
        const userData = localStorage.getItem("userData")
          ? JSON.parse(localStorage.getItem("userData"))
          : {};

        // Create a default student data object with no grades
        const fallbackStudentData = {
          ...response.data,
          fname: response.data.fname || userData.fname || "",
          mname: response.data.mname || userData.mname || "",
          lname: response.data.lname || userData.lname || "",
          grades: [],
          enrolled: false,
        };

        setStudentData(fallbackStudentData);
        setQuarterAverages({
          q1: null,
          q2: null,
          q3: null,
          q4: null,
          gwa: null,
        });
        setLoading(false);
        return;
      }

      // Make sure grades property exists and is an array
      if (!response.data.grades || !Array.isArray(response.data.grades)) {
        console.warn(
          "Student response missing grades array, using empty array",
        );
        response.data.grades = [];
      }

      // Calculate quarter averages from response data only if not Kindergarten
      if (
        !isKindergartenStudent &&
        response.data.grades &&
        response.data.grades.length > 0
      ) {
        // Fetch quarterly GWA from backend for each quarter
        const userId = localStorage.getItem("userId");
        const classId = response.data.class_id;
        const schoolYearId = targetYearId;
        const fetchQuarterlyGwa = async (quarterNum) => {
          try {
            const res = await axios.get(
              gradingUrl(`/api/students/${userId}/${classId}/${schoolYearId}/quarterly-gwa/${quarterNum}`),
              { headers: getAuthHeader() },
            );
            return res.data &&
              res.data.quarterly_gwa !== undefined &&
              res.data.quarterly_gwa !== null
              ? parseFloat(res.data.quarterly_gwa).toFixed(2)
              : null;
          } catch (err) {
            return null;
          }
        };
        // Fetch final GWA from backend
        const fetchFinalGwa = async () => {
          try {
            const res = await axios.get(
              gradingUrl(`/api/students/${userId}/${classId}/${schoolYearId}/gwa`),
              { headers: getAuthHeader() },
            );
            return res.data &&
              res.data.gwa !== undefined &&
              res.data.gwa !== null
              ? parseFloat(res.data.gwa).toFixed(2)
              : null;
          } catch (err) {
            return null;
          }
        };
        const [q1, q2, q3, q4, gwa] = await Promise.all([
          fetchQuarterlyGwa(1),
          fetchQuarterlyGwa(2),
          fetchQuarterlyGwa(3),
          fetchQuarterlyGwa(4),
          fetchFinalGwa(),
        ]);
        setQuarterAverages({
          q1: q1 || "-",
          q2: q2 || "-",
          q3: q3 || "-",
          q4: q4 || "-",
          gwa: gwa || "-",
        });
      } else {
        // For Kindergarten or no grades, reset averages
        setQuarterAverages({
          q1: null,
          q2: null,
          q3: null,
          q4: null,
          gwa: null,
        });
      }
    } catch (err) {
      console.error("Error fetching student grades:", err);

      if (err.response && err.response.status === 404) {
        setError("Student record not found for the selected school year.");
      } else {
        setError("Failed to load student grades. Please try again later.");
      }

      // Keep previous data if applicable, but indicate there was an error
      if (!studentData) {
        // If no previous data, get user data from localStorage as fallback
        try {
          const userData = localStorage.getItem("userData")
            ? JSON.parse(localStorage.getItem("userData"))
            : {};

          const fallbackStudentData = {
            student_id: userData.user_id || localStorage.getItem("userId"),
            fname: userData.fname || "",
            mname: userData.mname || "",
            lname: userData.lname || "",
            grade_level: null,
            section: null,
            average: null,
            grades: [],
            enrolled: false,
            error: true,
          };

          setStudentData(fallbackStudentData);
        } catch (fallbackErr) {
          console.error("Error creating fallback student data:", fallbackErr);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch school years where student is enrolled
    const fetchEnrolledSchoolYears = async () => {
      try {
        setLoading(true);
        setError(null);
        const userId = localStorage.getItem("userId");
        if (!userId) {
          setError("User not authenticated");
          setLoading(false);
          return;
        }

        console.log("Fetching all school years first");
        // First fetch all school years
        const allYearsResponse = await axios.get(gradingUrl('/api/school-years'), { headers: getAuthHeader() });

        if (
          !allYearsResponse.data ||
          !Array.isArray(allYearsResponse.data) ||
          allYearsResponse.data.length === 0
        ) {
          console.error(
            "Invalid response format from school-years endpoint or no school years available",
          );
          setError("Failed to retrieve any school years");
          setLoading(false);
          return;
        }

        console.log(
          `Fetched ${allYearsResponse.data.length} total school years`,
        );

        // Find active school year for reference
        const activeYear = allYearsResponse.data.find(
          (year) => year.is_active === true,
        );
        let activeYearId = activeYear ? activeYear.school_year_id : null;

        // Now check which years the student was enrolled in
        const enrolledYears = [];
        const enrollmentChecks = [];

        // Create array of promises to check enrollment in parallel
        for (const year of allYearsResponse.data) {
          enrollmentChecks.push(
            axios
              .get(gradingUrl(`/api/students/${userId}/${year.school_year_id}`), { headers: getAuthHeader() })
              .then((response) => {
                // If we get a valid response and student is enrolled, add to enrolledYears
                if (response.data && response.data.enrolled !== false) {
                  console.log(
                    `Student ${userId} was enrolled in ${year.school_year}`,
                  );
                  enrolledYears.push({
                    ...year,
                    is_active: activeYearId === year.school_year_id,
                  });
                }
                return null; // Just to handle the promise properly
              })
              .catch((err) => {
                // If we get a 404 or other error, student was likely not enrolled
                console.log(
                  `Student ${userId} was not enrolled in ${year.school_year}`,
                );
                return null; // Suppress the error and continue
              }),
          );
        }

        // Wait for all enrollment checks to complete
        await Promise.all(enrollmentChecks);

        // Sort enrolled years by most recent first
        enrolledYears.sort((a, b) => {
          // Sort by is_active first (active year at the top)
          if (a.is_active && !b.is_active) return -1;
          if (!a.is_active && b.is_active) return 1;
          // Then by school_year_id in descending order (most recent years first)
          return b.school_year_id - a.school_year_id;
        });

        console.log(
          `Found ${enrolledYears.length} enrolled school years for student ${userId}`,
        );

        if (enrolledYears.length > 0) {
          setSchoolYears(enrolledYears);

          // Set the active school year or first enrolled year as default
          const activeEnrolledYear = enrolledYears.find(
            (year) => year.is_active === true,
          );
          if (activeEnrolledYear) {
            console.log(
              `Setting active enrolled year: ${activeEnrolledYear.school_year_id}`,
            );
            setSelectedYear(activeEnrolledYear.school_year_id.toString());
            fetchStudentGrades(activeEnrolledYear.school_year_id.toString());
          } else {
            // No active year found, use the first enrolled year
            console.log(
              `No active enrolled year found, using first year: ${enrolledYears[0].school_year_id}`,
            );
            setSelectedYear(enrolledYears[0].school_year_id.toString());
            fetchStudentGrades(enrolledYears[0].school_year_id.toString());
          }
        } else {
          // If student is not enrolled in any year, fallback to all years
          // This is just to avoid a completely empty dropdown
          console.log(
            `Student ${userId} is not enrolled in any school year, showing all years as fallback`,
          );
          setSchoolYears(allYearsResponse.data);

          if (activeYear) {
            setSelectedYear(activeYear.school_year_id.toString());
            fetchStudentGrades(activeYear.school_year_id.toString());
          } else if (allYearsResponse.data.length > 0) {
            setSelectedYear(allYearsResponse.data[0].school_year_id.toString());
            fetchStudentGrades(
              allYearsResponse.data[0].school_year_id.toString(),
            );
          } else {
            setError("No school years available");
          }
        }
      } catch (err) {
        console.error("Error fetching school years:", err);
        setError("Failed to load school years. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchEnrolledSchoolYears();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchStudentGrades();
    }
  }, [selectedYear]);

  // Fetch subject final grades and remarks from backend
  useEffect(() => {
    if (!studentData || !studentData.student_id || !studentData.class_id)
      return;
    const schoolYearId = selectedYear || studentData.school_year_id;
    if (!schoolYearId) return;
    const fetchSubjectFinals = async () => {
      try {
        const res = await axios.get(gradingUrl('/api/grades/subject-final-grades'), {
          params: {
            student_id: studentData.student_id,
            class_id: studentData.class_id,
            school_year_id: schoolYearId,
          },
          headers: getAuthHeader(),
        });
        const finalsMap = {};
        (res.data || []).forEach((row) => {
          finalsMap[row.subject_id] = {
            subject_final_grade: row.subject_final_grade,
            remarks: row.remarks,
          };
        });
        setSubjectFinals(finalsMap);
      } catch (err) {
        setSubjectFinals({});
      }
    };
    fetchSubjectFinals();
  }, [studentData, selectedYear, isKindergarten]);

  // Helper: Order and group subjects for display
  const getOrderedSubjects = (grades) => {
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
    if (!grades || grades.length === 0) return [];
    const gradeLevel = studentData?.grade_level;

    // 1. Find MAPEH parent and its children
    const mapehParent = grades.find(
      (g) => g.subject_name === "MAPEH" && !g.parent_subject_id,
    );
    const mapehChildren = mapehParent
      ? grades.filter((g) => g.parent_subject_id === mapehParent.subject_id)
      : [];

    // 2. Build the MAPEH group (parent + children in correct order)
    let mapehGroup = [];
    if (mapehParent) {
      mapehGroup.push({ ...mapehParent, _isParent: true });
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
        if (child) mapehGroup.push({ ...child, _isChild: true });
      });
    }

    // 3. All other top-level subjects (not MAPEH, no parent_subject_id)
    const otherSubjects = grades.filter(
      (g) => !g.parent_subject_id && g.subject_name !== "MAPEH",
    );

    // 4. Return: all other subjects, then MAPEH group at the bottom
    return [...otherSubjects, ...mapehGroup];
  };

  if (loading) {
    return (
      <div className="content-container bg-[#F3F3F6] p-8">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-gray-200 rounded mb-8 mx-auto"></div>
            <div className="h-4 w-full bg-gray-200 rounded mb-4"></div>
            <div className="h-4 w-2/3 bg-gray-200 rounded"></div>
          </div>
          <p className="text-lg text-gray-600 mt-4">
            Loading grades, please wait...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content-container bg-[#F3F3F6] p-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Unable to Load Grades
            </h3>
            <p className="text-gray-600 mb-4">
              We encountered an issue while trying to fetch your grades. This
              might be because:
            </p>
            <ul className="text-gray-600 mb-6 list-disc list-inside">
              <li>You're not enrolled for the selected school year</li>
              <li>There might be a connection issue</li>
              <li>The system is temporarily unavailable</li>
            </ul>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                window.location.reload();
              }}
              className="px-4 py-2 bg-[#526D82] text-white rounded-md hover:bg-[#3e5060] transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="content-container bg-[#F3F3F6] p-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <svg
                className="w-8 h-8 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Records Found
            </h3>
            <p className="text-gray-600">
              No data found for this student in this school year
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container bg-[#F3F3F6] p-8">
      {/* Conditional Rendering based on data availability */}
      {!studentData || !studentData.student_id ? (
        // No Data Message
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <p className="text-xl text-gray-600 font-medium">
            No data found for this student in this school year
          </p>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-start mb-6 gap-6">
            {/* Student Information Card - More Compact */}
            <div
              className="bg-white rounded-lg shadow-sm p-4 w-2/3"
              id="student-info-card"
            >
              <h3 className="text-lg font-semibold text-[#526D82] mb-3 border-b pb-2">
                Student Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2">
                    <span className="font-medium text-gray-600 text-xs uppercase">
                      Student Number:
                    </span>{" "}
                    <span className="text-gray-800 font-medium">
                      {studentData.student_id || "-"}
                    </span>
                  </p>
                  <p className="mb-2">
                    <span className="font-medium text-gray-600 text-xs uppercase">
                      Student Name:
                    </span>{" "}
                    <span className="text-gray-800 font-medium">
                      {`${studentData.lname || ""}, ${studentData.fname || ""} ${studentData.mname || ""}`}
                    </span>
                  </p>
                  <p className="mb-2">
                    <span className="font-medium text-gray-600 text-xs uppercase">
                      LRN:
                    </span>{" "}
                    <span className="text-gray-800 font-medium">
                      {studentData.lrn || "-"}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="mb-2">
                    <span className="font-medium text-gray-600 text-xs uppercase">
                      Grade Level:
                    </span>{" "}
                    <span className="text-gray-800 font-medium">
                      {studentData.grade_level || "-"}
                    </span>
                  </p>
                  <p className="mb-2">
                    <span className="font-medium text-gray-600 text-xs uppercase">
                      Section:
                    </span>{" "}
                    <span className="text-gray-800 font-medium">
                      {studentData.section || "-"}
                    </span>
                  </p>
                  <p className="mb-2">
                    <span className="font-medium text-gray-600 text-xs uppercase">
                      Class Adviser:
                    </span>{" "}
                    <span className="text-gray-800 font-medium">
                      {classAdviser ? classAdviser.name : "-"}
                    </span>
                  </p>
                  {/* School Year Selector */}
                  <p className="mb-2">
                    <span className="font-medium text-gray-600 text-xs uppercase">
                      School Year:
                    </span>{" "}
                    <select
                      value={selectedYear}
                      onChange={(e) => {
                        setSelectedYear(e.target.value);
                        setError(null);
                      }}
                      className="border rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#526D82]"
                      size="1"
                      style={{ height: "auto" }}
                    >
                      {schoolYears.map((year) => (
                        <option
                          key={year.school_year_id}
                          value={year.school_year_id}
                          style={{ padding: "2px 6px" }}
                        >
                          {year.school_year} {year.is_active ? "(Active)" : ""}
                        </option>
                      ))}
                    </select>
                  </p>
                </div>
              </div>
            </div>

            {/* Academic Info Card - Hide for Kindergarten students, show guidelines for Kindergarten */}
            {!isKindergarten && (
              <div className="bg-white rounded-lg shadow-sm p-4 w-fit">
                <div className="flex flex-col items-end">
                  <div className="text-right">
                    <p className="text-sm uppercase font-medium text-gray-600 mb-1">
                      QUARTER:
                    </p>
                    <select
                      value={selectedQuarter}
                      onChange={(e) => setSelectedQuarter(e.target.value)}
                      className="border rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#526D82] mb-2"
                    >
                      <option value="Q1">First Quarter</option>
                      <option value="Q2">Second Quarter</option>
                      <option value="Q3">Third Quarter</option>
                      <option value="Q4">Fourth Quarter</option>
                      <option value="GWA">Average GWA</option>
                    </select>
                    <p className="text-sm uppercase font-medium text-gray-600 mb-1">
                      {selectedQuarter === "GWA"
                        ? "AVERAGE"
                        : selectedQuarter === "Q1"
                          ? "AVERAGE"
                          : selectedQuarter === "Q2"
                            ? "AVERAGE"
                            : selectedQuarter === "Q3"
                              ? "AVERAGE"
                              : "AVERAGE"}
                    </p>
                    <p className="text-3xl font-bold text-[#526D82]">
                      {selectedQuarter === "GWA"
                        ? quarterAverages.gwa || "-"
                        : selectedQuarter === "Q1"
                          ? quarterAverages.q1 || "-"
                          : selectedQuarter === "Q2"
                            ? quarterAverages.q2 || "-"
                            : selectedQuarter === "Q3"
                              ? quarterAverages.q3 || "-"
                              : selectedQuarter === "Q4"
                                ? quarterAverages.q4 || "-"
                                : "-"}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {isKindergarten && (
              <div
                className="bg-white rounded-lg shadow-sm p-4 flex flex-col items-center justify-center w-1/3 min-w-[260px] max-w-xs h-full"
                style={{ minHeight: "100%", height: "auto" }}
              >
                <h3 className="text-lg font-semibold text-center mb-2">
                  Guidelines for Grading
                </h3>
                <table className="w-full text-xs border border-gray-200 rounded shadow-sm">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 font-semibold text-gray-800 text-center border-b">
                        Grade
                      </th>
                      <th className="px-2 py-1 font-semibold text-gray-800 text-center border-b">
                        Range
                      </th>
                      <th className="px-2 py-1 font-semibold text-gray-800 text-center border-b">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-2 py-1 text-center font-bold text-black border-b">
                        A
                      </td>
                      <td className="px-2 py-1 text-center text-black border-b">
                        90 - 100
                      </td>
                      <td className="px-2 py-1 text-center text-black border-b">
                        Outstanding
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 text-center font-bold text-black border-b">
                        B
                      </td>
                      <td className="px-2 py-1 text-center text-black border-b">
                        85 - 89
                      </td>
                      <td className="px-2 py-1 text-center text-black border-b">
                        Very Satisfying
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 text-center font-bold text-black border-b">
                        C
                      </td>
                      <td className="px-2 py-1 text-center text-black border-b">
                        80 - 84
                      </td>
                      <td className="px-2 py-1 text-center text-black border-b">
                        Satisfying
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 text-center font-bold text-black border-b">
                        D
                      </td>
                      <td className="px-2 py-1 text-center text-black border-b">
                        75 - 79
                      </td>
                      <td className="px-2 py-1 text-center text-black border-b">
                        Fairly Satisfying
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 text-center font-bold text-black">
                        E
                      </td>
                      <td className="px-2 py-1 text-center text-black">
                        Below 75
                      </td>
                      <td className="px-2 py-1 text-center text-black">
                        Failed
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Grades Table - Different versions for Kindergarten vs other grades */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {isKindergarten ? (
              <>
                {/* Kindergarten Grades Table - No Final Grade or Remarks columns */}
                <div className="bg-[#526D82] text-white px-6 py-3 grid grid-cols-5 gap-4">
                  <div className="col-span-1 font-semibold tracking-wide">
                    Subject
                  </div>
                  <div className="text-center font-semibold tracking-wide">
                    Quarter 1
                  </div>
                  <div className="text-center font-semibold tracking-wide">
                    Quarter 2
                  </div>
                  <div className="text-center font-semibold tracking-wide">
                    Quarter 3
                  </div>
                  <div className="text-center font-semibold tracking-wide">
                    Quarter 4
                  </div>
                </div>

                {studentData.grades?.map((grade, index) => (
                  <div
                    key={grade.subject_id}
                    className={`px-6 py-4 grid grid-cols-5 gap-4 items-center border-b last:border-b-0 border-gray-100
                      ${index % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
                  >
                    <div className="col-span-1 font-medium text-gray-800">
                      {grade.subject_name}
                    </div>
                    <div className="text-center font-medium text-gray-700">
                      {grade.quarter1_char || "-"}
                    </div>
                    <div className="text-center font-medium text-gray-700">
                      {grade.quarter2_char || "-"}
                    </div>
                    <div className="text-center font-medium text-gray-700">
                      {grade.quarter3_char || "-"}
                    </div>
                    <div className="text-center font-medium text-gray-700">
                      {grade.quarter4_char || "-"}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {/* Regular Grades Table with Final Grade and Remarks, now with backend values only */}
                <div className="bg-[#526D82] text-white px-6 py-3 grid grid-cols-7 gap-4">
                  <div className="col-span-1 font-semibold tracking-wide">
                    Subject
                  </div>
                  <div className="text-center font-semibold tracking-wide">
                    Quarter 1
                  </div>
                  <div className="text-center font-semibold tracking-wide">
                    Quarter 2
                  </div>
                  <div className="text-center font-semibold tracking-wide">
                    Quarter 3
                  </div>
                  <div className="text-center font-semibold tracking-wide">
                    Quarter 4
                  </div>
                  <div className="text-center font-semibold tracking-wide">
                    Final Grade
                  </div>
                  <div className="text-center font-semibold tracking-wide">
                    Remarks
                  </div>
                </div>
                {(() => {
                  const rows = [];
                  const ordered = getOrderedSubjects(studentData.grades);
                  for (let i = 0; i < ordered.length; i++) {
                    const g = ordered[i];
                    // If this is MAPEH parent, render it and its children as sub-rows
                    if (g.subject_name === "MAPEH" && !g.parent_subject_id) {
                      // Render MAPEH parent row
                      rows.push(
                        <div
                          key={g.subject_id}
                          className={`px-6 py-4 grid grid-cols-7 gap-4 items-center border-b last:border-b-0 border-gray-100 bg-gray-50`}
                        >
                          <div className="col-span-1 font-medium text-gray-800">
                            {g.subject_name}
                          </div>
                          <div className="text-center font-medium text-gray-700">
                            {g.quarter1 || "-"}
                          </div>
                          <div className="text-center font-medium text-gray-700">
                            {g.quarter2 || "-"}
                          </div>
                          <div className="text-center font-medium text-gray-700">
                            {g.quarter3 || "-"}
                          </div>
                          <div className="text-center font-medium text-gray-700">
                            {g.quarter4 || "-"}
                          </div>
                          <div className="text-center font-semibold text-gray-800">
                            {subjectFinals[g.subject_id]
                              ?.subject_final_grade !== undefined &&
                            subjectFinals[g.subject_id]?.subject_final_grade !==
                              null
                              ? Number(
                                  subjectFinals[g.subject_id]
                                    .subject_final_grade,
                                ).toFixed(2)
                              : "-"}
                          </div>
                          <div
                            className={`text-center font-medium ${subjectFinals[g.subject_id]?.remarks === "PASSED" ? "text-green-600" : subjectFinals[g.subject_id]?.remarks === "FAILED" ? "text-red-600" : "text-gray-500"}`}
                          >
                            {subjectFinals[g.subject_id]?.remarks || "-"}
                          </div>
                        </div>,
                      );
                      // Render MAPEH children as indented sub-rows
                      // Helper for robust subject name matching
                      const matchName = (name, candidates) =>
                        candidates
                          .map((n) => n.toLowerCase())
                          .includes((name || "").toLowerCase());
                      // Acceptable names for each MAPEH component
                      const MAPEH_COMPONENTS = {
                        Music: ["Music"],
                        Arts: ["Arts"],
                        "Physical Education": [
                          "Physical Education",
                          "PE",
                          "P.E",
                        ],
                        Health: ["Health"],
                        "Music and Arts": ["Music and Arts"],
                        "Physical Education and Health": [
                          "Physical Education and Health",
                          "PE and Health",
                          "P.E and Health",
                        ],
                      };
                      let componentOrder;
                      const gradeLevel = studentData?.grade_level;
                      if ([1, 2, 3, "1", "2", "3"].includes(gradeLevel)) {
                        componentOrder = [
                          "Music",
                          "Arts",
                          "Physical Education",
                          "Health",
                        ];
                      } else if (
                        [4, 5, 6, "4", "5", "6"].includes(gradeLevel)
                      ) {
                        componentOrder = [
                          "Music and Arts",
                          "Physical Education and Health",
                        ];
                      } else {
                        componentOrder = ordered
                          .filter((c) => c.parent_subject_id === g.subject_id)
                          .map((c) => c.subject_name)
                          .sort();
                      }
                      componentOrder.forEach((key) => {
                        const candidates = MAPEH_COMPONENTS[key] || [key];
                        const child = ordered.find(
                          (c) =>
                            c.parent_subject_id === g.subject_id &&
                            matchName(c.subject_name, candidates),
                        );
                        if (child) {
                          rows.push(
                            <div
                              key={child.subject_id}
                              className={`px-6 py-4 grid grid-cols-7 gap-4 items-center border-b last:border-b-0 border-gray-100`}
                            >
                              <div
                                className="col-span-1 font-medium text-gray-800"
                                style={{
                                  paddingLeft: "32px",
                                  fontStyle: "italic",
                                  color: "#526D82",
                                }}
                              >
                                ↳ {child.subject_name}
                              </div>
                              <div className="text-center font-medium text-gray-700">
                                {child.quarter1 || "-"}
                              </div>
                              <div className="text-center font-medium text-gray-700">
                                {child.quarter2 || "-"}
                              </div>
                              <div className="text-center font-medium text-gray-700">
                                {child.quarter3 || "-"}
                              </div>
                              <div className="text-center font-medium text-gray-700">
                                {child.quarter4 || "-"}
                              </div>
                              <div className="text-center font-semibold text-gray-800">
                                {subjectFinals[child.subject_id]
                                  ?.subject_final_grade !== undefined &&
                                subjectFinals[child.subject_id]
                                  ?.subject_final_grade !== null
                                  ? Number(
                                      subjectFinals[child.subject_id]
                                        .subject_final_grade,
                                    ).toFixed(2)
                                  : "-"}
                              </div>
                              <div
                                className={`text-center font-medium ${subjectFinals[child.subject_id]?.remarks === "PASSED" ? "text-green-600" : subjectFinals[child.subject_id]?.remarks === "FAILED" ? "text-red-600" : "text-gray-500"}`}
                              >
                                {subjectFinals[child.subject_id]?.remarks ||
                                  "-"}
                              </div>
                            </div>,
                          );
                        }
                      });
                    } else if (!g.parent_subject_id) {
                      // Render all other top-level subjects as normal
                      rows.push(
                        <div
                          key={g.subject_id}
                          className={`px-6 py-4 grid grid-cols-7 gap-4 items-center border-b last:border-b-0 border-gray-100 ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
                        >
                          <div className="col-span-1 font-medium text-gray-800">
                            {g.subject_name}
                          </div>
                          <div className="text-center font-medium text-gray-700">
                            {g.quarter1 || "-"}
                          </div>
                          <div className="text-center font-medium text-gray-700">
                            {g.quarter2 || "-"}
                          </div>
                          <div className="text-center font-medium text-gray-700">
                            {g.quarter3 || "-"}
                          </div>
                          <div className="text-center font-medium text-gray-700">
                            {g.quarter4 || "-"}
                          </div>
                          <div className="text-center font-semibold text-gray-800">
                            {subjectFinals[g.subject_id]
                              ?.subject_final_grade !== undefined &&
                            subjectFinals[g.subject_id]?.subject_final_grade !==
                              null
                              ? Number(
                                  subjectFinals[g.subject_id]
                                    .subject_final_grade,
                                ).toFixed(2)
                              : "-"}
                          </div>
                          <div
                            className={`text-center font-medium ${subjectFinals[g.subject_id]?.remarks === "PASSED" ? "text-green-600" : subjectFinals[g.subject_id]?.remarks === "FAILED" ? "text-red-600" : "text-gray-500"}`}
                          >
                            {subjectFinals[g.subject_id]?.remarks || "-"}
                          </div>
                        </div>,
                      );
                    }
                  }
                  return rows;
                })()}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ViewGrade;
