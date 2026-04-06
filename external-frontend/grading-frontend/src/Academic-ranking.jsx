import React, { useState, useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import { fetchGrading } from "./lib/api";

// Update the tooltip styles at the top of the file
const tooltipStyles = `
  [data-tooltip] {
    position: relative;
  }
  [data-tooltip]::before {
    content: attr(data-tooltip-content);
    position: absolute;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    white-space: pre;
    z-index: 100;
    width: max-content;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s;
  }
  [data-tooltip]:hover::before {
    opacity: 1;
    visibility: visible;
  }
  [data-tooltip="right"]::before {
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-left: 10px;
  }
  [data-tooltip="left"]::before {
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-right: 10px;
  }
`;

// Add style tag to document head
if (!document.getElementById("tooltip-styles")) {
  const style = document.createElement("style");
  style.id = "tooltip-styles";
  style.textContent = tooltipStyles;
  document.head.appendChild(style);
}

// Add these SVG medal icons at the top of the file after the tooltipStyles
const medalIcons = {
  gold: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="inline-block ml-2 text-yellow-500"
    >
      <circle cx="12" cy="9" r="6" fill="#FFC107" stroke="#FFC107" />
      <path
        d="M12 15L8.5 20.5L9.5 21.5L12 20L14.5 21.5L15.5 20.5L12 15Z"
        fill="#FFC107"
        stroke="#FFC107"
      />
      <path d="M11 7H13V11H11V7Z" fill="#fff" />
      <path d="M11 12H13V13H11V12Z" fill="#fff" />
    </svg>
  ),
  silver: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="inline-block ml-2 text-gray-400"
    >
      <circle cx="12" cy="9" r="6" fill="#C0C0C0" stroke="#C0C0C0" />
      <path
        d="M12 15L8.5 20.5L9.5 21.5L12 20L14.5 21.5L15.5 20.5L12 15Z"
        fill="#C0C0C0"
        stroke="#C0C0C0"
      />
      <path d="M11 7H13V11H11V7Z" fill="#fff" />
      <path d="M11 12H13V13H11V12Z" fill="#fff" />
    </svg>
  ),
  bronze: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="inline-block ml-2 text-amber-700"
    >
      <circle cx="12" cy="9" r="6" fill="#CD7F32" stroke="#CD7F32" />
      <path
        d="M12 15L8.5 20.5L9.5 21.5L12 20L14.5 21.5L15.5 20.5L12 15Z"
        fill="#CD7F32"
        stroke="#CD7F32"
      />
      <path d="M11 7H13V11H11V7Z" fill="#fff" />
      <path d="M11 12H13V13H11V12Z" fill="#fff" />
    </svg>
  ),
};

// Add a helper function to render medal based on rank
const getMedalIcon = (rank) => {
  // Convert rank to number to ensure comparison works properly
  const rankNum = Number(rank);
  if (rankNum === 1) return medalIcons.gold;
  if (rankNum === 2) return medalIcons.silver;
  if (rankNum === 3) return medalIcons.bronze;
  return null;
};

// Add error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-4 text-red-500">
          Something went wrong. Please try refreshing the page.
        </div>
      );
    }

    return this.props.children;
  }
}

const AcademicRanking = () => {
  // State variables
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedClass, setSelectedClass] = useState(
    "All Classes (Campus-wide)",
  );
  const [selectedQuarter, setSelectedQuarter] = useState("1");
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [schoolYears, setSchoolYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);
  const [userType, setUserType] = useState(null);
  const [studentEnrolledClasses, setStudentEnrolledClasses] = useState([]);

  const { currentUser } = useAuth();

  // Fetch user information and student classes on mount and when school year changes
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!currentUser || !currentUser.email) return;
      try {
        const response = await fetchGrading(
          `/users/byEmail/${currentUser.email}`,
        );
        if (!response.ok)
          throw new Error(`Server responded with status: ${response.status}`);
        const userData = await response.json();
        setUserType(userData.user_type);
        if (userData.user_type === "student") {
          // Always fetch student classes for the selected year
          if (selectedYear && !isNaN(parseInt(selectedYear))) {
            fetchStudentClasses(userData.user_id, parseInt(selectedYear));
          }
        }
      } catch (error) {
        console.error("Error fetching user info:", error);
      }
    };
    fetchUserInfo();
  }, [currentUser, selectedYear]);

  // Fetch student's enrolled classes
  const fetchStudentClasses = async (studentId, schoolYearId = null) => {
    if (!studentId) return;

    try {
      let path = `/api/students/${studentId}/classes`;
      if (schoolYearId) {
        path += `?schoolYearId=${schoolYearId}`;
      }
      const response = await fetchGrading(path);

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Student enrolled classes:", data);
      setStudentEnrolledClasses(data || []);
    } catch (error) {
      console.error("Error fetching student classes:", error);
      setStudentEnrolledClasses([]);
    }
  };

  // Fetch school years and set active year as default
  useEffect(() => {
    const fetchSchoolYears = async () => {
      try {
        setLoading(true);
        const response = await fetchGrading("/api/school-years");
        if (!response.ok)
          throw new Error(`Server responded with status: ${response.status}`);
        const data = await response.json();
        setSchoolYears(data);
        // Set active school year as default
        const activeYear = data.find((year) => year.is_active);
        if (activeYear) {
          setSelectedYear(activeYear.school_year_id.toString());
          fetchClasses(activeYear.school_year_id);
        }
      } catch (error) {
        console.error("Error fetching school years:", error);
        setError("Failed to fetch school years");
      } finally {
        setLoading(false);
      }
    };
    fetchSchoolYears();
  }, []);

  // Fetch classes when school year changes
  const fetchClasses = async (schoolYearId) => {
    if (!schoolYearId) return;

    try {
      setLoading(true);
      console.log("Fetching classes for year ID:", schoolYearId);

      const response = await fetchGrading(
        `/api/classes?schoolYearId=${schoolYearId}`,
      );

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Classes data:", data);
      setClasses(data || []);

      // Reset selected class when school year changes
      setSelectedClass("All Classes (Campus-wide)");
    } catch (error) {
      console.error("Error fetching classes:", error);
      setError(error.message || "Failed to load classes");
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch rankings
  const fetchRankings = async () => {
    if (!selectedYear || !selectedQuarter) return;
    try {
      setLoading(true);
      setError(null);
      const isCampusWide = selectedClass === "All Classes (Campus-wide)";
      const endpoint = isCampusWide
        ? `/api/grades/campus-wide-ranking?schoolYearId=${selectedYear}&quarter=${selectedQuarter}`
        : `/api/classes/${selectedClass}/student-average/${selectedQuarter}?quarter=${selectedQuarter}`;
      const response = await fetchGrading(endpoint);
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      let data = await response.json();

      // The backend now provides ranked and sorted data, so we can use it directly.
      setRankings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching rankings:", error);
      setError(error.message || "Failed to load rankings");
      setRankings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedYear && selectedQuarter) {
      fetchRankings();
    }
  }, [selectedYear, selectedClass, selectedQuarter]);

  // Handle school year change
  const handleYearChange = (e) => {
    const yearId = e.target.value;
    setSelectedYear(yearId);
    setSelectedClass("All Classes (Campus-wide)");
    fetchClasses(yearId);
  };

  // Add handler for class changes
  const handleClassChange = (e) => {
    setSelectedClass(e.target.value);
  };

  // Add handler for quarter changes
  const handleQuarterChange = (e) => {
    setSelectedQuarter(e.target.value);
  };

  // Get available classes for dropdown based on user type
  const getAvailableClasses = () => {
    // Always filter out kindergarten classes and classes with "one-on-one" in program_name
    const filteredClasses = classes.filter(
      (c) =>
        c.grade_level !== "Kindergarten" &&
        !c.program_name?.toLowerCase().includes("one-on-one"),
    );
    if (userType === "student") {
      // Only show classes the student is enrolled in for the selected year (excluding kindergarten and one on one)
      const enrolledClassIds = studentEnrolledClasses.map((c) => c.class_id);
      return filteredClasses.filter((c) =>
        enrolledClassIds.includes(c.class_id),
      );
    }
    // For admin, teacher, or other users, show all filtered classes
    return filteredClasses;
  };

  // Wrap the return JSX with ErrorBoundary
  return (
    <ErrorBoundary>
      <div className="content-container bg-[#F3F3F6]">
        {/* Information Message */}
        <div className="p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> Kindergarten classes are not included in
                academic rankings due to their character-based grading system.
                Grade school one-on-one classes are not filtered by specific
                class, but their students are still part of the overall campus
                ranking.
              </p>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="px-8 pb-8">
          <div className="grid grid-cols-3 gap-6 mb-6">
            {/* School Year Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                School Year:
              </label>
              <select
                value={selectedYear}
                onChange={handleYearChange}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">Select School Year</option>
                {schoolYears &&
                  schoolYears.map((year) => (
                    <option
                      key={year.school_year_id}
                      value={year.school_year_id.toString()}
                    >
                      {year.school_year} {year.is_active ? "(Active)" : ""}
                    </option>
                  ))}
              </select>
            </div>

            {/* Class Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Class:
              </label>
              <select
                value={selectedClass}
                onChange={handleClassChange}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="All Classes (Campus-wide)">
                  Campus Overall Ranking
                </option>
                {getAvailableClasses().map((classItem) => {
                  // Combine adviser's name from fname, mname, lname
                  let adviser = "";
                  if (classItem.adviser_fname || classItem.adviser_lname) {
                    adviser =
                      `${classItem.adviser_fname || ""}${classItem.adviser_mname ? " " + classItem.adviser_mname : ""} ${classItem.adviser_lname || ""}`
                        .replace(/  +/g, " ")
                        .trim();
                  }
                  let label =
                    classItem.grade_level === "Kindergarten"
                      ? `Kindergarten-${classItem.section}`
                      : `Grade ${classItem.grade_level}-${classItem.section}`;
                  if (adviser) {
                    label += ` - ${adviser}`;
                  }
                  return (
                    <option key={classItem.class_id} value={classItem.class_id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quarter Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quarter:
              </label>
              <select
                value={selectedQuarter}
                onChange={handleQuarterChange}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="1">First Quarter</option>
                <option value="2">Second Quarter</option>
                <option value="3">Third Quarter</option>
                <option value="4">Fourth Quarter</option>
                <option value="final">Final Average</option>
              </select>
            </div>
          </div>

          {/* Top 3 Rankings Table */}
          {loading ? (
            <div className="text-center py-4">Loading rankings...</div>
          ) : error ? (
            <div className="text-red-500 text-center py-4">{error}</div>
          ) : rankings.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No ranking data available for the selected filters.
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold px-6 pt-4 text-[#526D82]">
                    Academic Excellence Spotlight
                  </h2>
                  <p className="text-sm text-gray-500 px-6 pb-4">
                    Celebrating dedication to learning and inspiring others to
                    reach their potential
                  </p>
                </div>
                <div className="pr-6 flex items-center">
                  <div className="flex flex-col items-center mr-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      width="30"
                      height="30"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-yellow-500"
                    >
                      <circle
                        cx="12"
                        cy="9"
                        r="6"
                        fill="#FFC107"
                        stroke="#FFC107"
                      />
                      <path
                        d="M12 15L8.5 20.5L9.5 21.5L12 20L14.5 21.5L15.5 20.5L12 15Z"
                        fill="#FFC107"
                        stroke="#FFC107"
                      />
                      <path d="M11 7H13V11H11V7Z" fill="#fff" />
                      <path d="M11 12H13V13H11V12Z" fill="#fff" />
                    </svg>
                    <span className="text-xs font-semibold mt-1">1st</span>
                  </div>
                  <div className="flex flex-col items-center mr-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      width="30"
                      height="30"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-gray-400"
                    >
                      <circle
                        cx="12"
                        cy="9"
                        r="6"
                        fill="#C0C0C0"
                        stroke="#C0C0C0"
                      />
                      <path
                        d="M12 15L8.5 20.5L9.5 21.5L12 20L14.5 21.5L15.5 20.5L12 15Z"
                        fill="#C0C0C0"
                        stroke="#C0C0C0"
                      />
                      <path d="M11 7H13V11H11V7Z" fill="#fff" />
                      <path d="M11 12H13V13H11V12Z" fill="#fff" />
                    </svg>
                    <span className="text-xs font-semibold mt-1">2nd</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      width="30"
                      height="30"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-amber-700"
                    >
                      <circle
                        cx="12"
                        cy="9"
                        r="6"
                        fill="#CD7F32"
                        stroke="#CD7F32"
                      />
                      <path
                        d="M12 15L8.5 20.5L9.5 21.5L12 20L14.5 21.5L15.5 20.5L12 15Z"
                        fill="#CD7F32"
                        stroke="#CD7F32"
                      />
                      <path d="M11 7H13V11H11V7Z" fill="#fff" />
                      <path d="M11 12H13V13H11V12Z" fill="#fff" />
                    </svg>
                    <span className="text-xs font-semibold mt-1">3rd</span>
                  </div>
                </div>
              </div>
              <table className="min-w-full table-fixed">
                <thead>
                  <tr className="bg-[#526D82] text-white">
                    <th className="px-6 py-4 text-center w-1/6">Rank</th>
                    <th className="px-6 py-4 text-left w-1/6">Student ID</th>
                    <th className="px-6 py-4 text-left w-2/6">Student Name</th>
                    {/* Always keep the Grade & Section column structure for consistency */}
                    <th className="px-6 py-4 text-left w-2/6">
                      {(!selectedClass ||
                        selectedClass === "All Classes (Campus-wide)") &&
                        "Grade & Section"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rankings
                    // Filter out kindergarten students
                    .filter((student) => student.grade_level !== "Kindergarten")
                    // Filter to only include students with ranks 1, 2, or 3
                    .filter((student) => student.rank_number <= 3)
                    .map((student, index) => (
                      <tr
                        key={`student-${student.student_id}-${index}`}
                        className="border-b border-gray-200 hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 text-center">
                          <span className="flex items-center justify-center">
                            <span className="font-bold text-lg text-[#526D82]">
                              {student.rank_number}
                            </span>
                            {getMedalIcon(student.rank_number)}
                          </span>
                        </td>
                        <td className="px-6 py-4">{student.student_id}</td>
                        <td className="px-6 py-4">
                          {`${student.lname}, ${student.fname}${student.mname ? " " + student.mname : ""}`}
                        </td>
                        {/* Always keep the cell for Grade & Section, but only show content when appropriate */}
                        <td className="px-6 py-4 text-left">
                          {(!selectedClass ||
                            selectedClass === "All Classes (Campus-wide)") &&
                            (student.grade_level === "Kindergarten"
                              ? `Kindergarten-${student.section}`
                              : `Grade ${student.grade_level}-${student.section}`)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default AcademicRanking;
