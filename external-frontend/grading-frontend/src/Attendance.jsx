import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "./contexts/AuthContext";
import axios from "axios";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import AttendancePdfTemplate from "./components/AttendancePdfTemplate";
import { gradingUrl, getAuthHeader, fetchGrading } from "./lib/api";

const Attendance = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [schoolYears, setSchoolYears] = useState([]);
  const [activeSchoolYear, setActiveSchoolYear] = useState(null);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear()); // Current year
  const [advisoryClasses, setAdvisoryClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [daysInMonth, setDaysInMonth] = useState(31); // Default to 31 days
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [totalSchoolDays, setTotalSchoolDays] = useState(0);
  const [summaryData, setSummaryData] = useState({
    male: { present: 0, absent: 0, late: 0 },
    female: { present: 0, absent: 0, late: 0 },
  });
  // Add new state for notification toast
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "info", // 'info', 'success', 'warning', 'error'
  });
  // Add new state for tracking consecutive absences
  const [consecutiveAbsences, setConsecutiveAbsences] = useState({
    male: 0,
    female: 0,
    total: 0,
    students: [],
  });
  // New state for student status tracking
  const [studentStatuses, setStudentStatuses] = useState({});
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusForm, setStatusForm] = useState({
    statusType: "ACTIVE",
    reason: "",
    schoolName: "",
    effectiveDate: new Date().toISOString().split("T")[0],
  });
  // Add new state variables for clearing day functionality
  const [showClearDayModal, setShowClearDayModal] = useState(false);
  const [dayToClear, setDayToClear] = useState(null);

  // Add new state variables for enrollment and attendance calculations
  const [enrollmentStart, setEnrollmentStart] = useState({
    male: 0,
    female: 0,
    total: 0,
  });
  const [registeredLearners, setRegisteredLearners] = useState({
    male: 0,
    female: 0,
    total: 0,
  });
  const [lateEnrollment, setLateEnrollment] = useState({
    male: 0,
    female: 0,
    total: 0,
  });
  const [averageDailyAttendance, setAverageDailyAttendance] = useState({
    male: 0,
    female: 0,
    total: 0,
  });
  const [totalDailyAttendance, setTotalDailyAttendance] = useState({
    male: 0,
    female: 0,
    total: 0,
  });

  // Cache previous-class attendance per student for tooltip
  const [prevAttendanceByStudent, setPrevAttendanceByStudent] = useState({});
  const [prevAttendanceLoading, setPrevAttendanceLoading] = useState({});
  const [openPrevPanelKey, setOpenPrevPanelKey] = useState(null);
  const [hasPrevClassByStudent, setHasPrevClassByStudent] = useState({});

  // Add state for guidelines tooltip
  const [showGuidelines, setShowGuidelines] = useState(false);

  // Add refs for the printable content
  const attendanceTableRef = useRef(null);
  const summaryTableRef = useRef(null);

  // Add state for confirm dialog
  const [confirmDialog, setConfirmDialog] = useState({
    show: false,
    message: "",
    onConfirm: null,
    onCancel: null,
  });

  // Show notification function
  const showNotification = (message, type = "info") => {
    setNotification({
      show: true,
      message,
      type,
    });

    // Auto-hide the notification after 4 seconds
    setTimeout(() => {
      setNotification((prev) => ({
        ...prev,
        show: false,
      }));
    }, 4000);
  };

  // School info (could be fetched from an API or stored in context)
  const schoolInfo = {
    region: "REGION III",
    division: "BULACAN",
    schoolName: "LITTLE CHAMPIONS ACADEMY",
    district: "5th Congressional District",
    schoolId: "411093",
  };

  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  // Add a function to generate month-year options
  const getMonthYearOptions = () => {
    if (!selectedSchoolYear) return [];

    const schoolYearObj = schoolYears.find(
      (sy) => sy.school_year_id.toString() === selectedSchoolYear,
    );
    if (!schoolYearObj) return [];

    const [startYear, endYear] = schoolYearObj.school_year
      .split("-")
      .map(Number);
    const options = [];

    // Get current date
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-based month

    // Function to add a month-year option
    const addOption = (month, year) => {
      options.push({
        value: `${month.value}-${year}`,
        label: `${month.label} - ${year}`,
        monthNum: parseInt(month.value),
        year: year,
      });
    };

    if (schoolYearObj.is_active && schoolYearObj.activation_date) {
      // Use activation_date as the starting point
      const activation = new Date(schoolYearObj.activation_date);
      let year = activation.getFullYear();
      let month = activation.getMonth() + 1; // 1-based
      // Loop from activation month/year up to current month/year
      while (
        year < currentYear ||
        (year === currentYear && month <= currentMonth)
      ) {
        addOption(months[month - 1], year);
        // Increment month/year
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }
    } else if (schoolYearObj.is_active) {
      // Fallback: Show all months from start year up to current month
      for (let year = startYear; year <= currentYear; year++) {
        months.forEach((month) => {
          const monthNum = parseInt(month.value);
          if (year === currentYear && monthNum > currentMonth) return;
          addOption(month, year);
        });
      }
    } else {
      // For inactive school year, show all months in the school year period
      for (let year = startYear; year <= endYear; year++) {
        months.forEach((month) => {
          addOption(month, year);
        });
      }
    }

    // Sort options by chronological order
    options.sort((a, b) => {
      if (a.year === b.year) {
        return a.monthNum - b.monthNum;
      }
      return a.year - b.year;
    });

    return options;
  };

  // Student status options
  const statusOptions = [
    { value: "ACTIVE", label: "Active" },
    { value: "DROPPED_OUT", label: "Dropped Out" },
    { value: "TRANSFERRED_IN", label: "Transferred In" },
    { value: "TRANSFERRED_OUT", label: "Transferred Out" },
  ];

  useEffect(() => {
    if (currentUser) {
      fetchTeacherData();
      fetchSchoolYears();
    }
  }, [currentUser]);

  useEffect(() => {
    if (teacher && selectedSchoolYear) {
      fetchAdvisoryClasses();
    }
  }, [teacher, selectedSchoolYear]);

  useEffect(() => {
    if (selectedClass) {
      fetchStudents();
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedMonth) {
      calculateDaysInMonth();
    }
  }, [selectedMonth, selectedYear, selectedSchoolYear]);

  useEffect(() => {
    if (selectedClass && students.length > 0 && selectedMonth && selectedYear) {
      fetchAttendanceData();
      fetchStudentStatuses();
      fetchEnrollmentStatistics(); // Add this line to fetch enrollment stats
    }
  }, [selectedClass, students, selectedMonth, selectedYear]);

  useEffect(() => {
    if (students.length > 0) {
      // We now get registered learners from the API, so we only need to calculate attendance statistics
      calculateAttendanceStatistics();
    }
  }, [students, studentStatuses, attendance, totalSchoolDays, enrollmentStart]);

  const calculateAttendanceStatistics = () => {
    if (students.length === 0 || totalSchoolDays === 0) {
      return;
    }

    // Calculate total attendance across all days for each gender
    let maleTotalAttendance = 0;
    let femaleTotalAttendance = 0;

    // For each day of the month
    Array.from({ length: daysInMonth }, (_, i) => i + 1).forEach((day) => {
      // Count present students for this day by gender
      const malePresentForDay = students.filter((student) => {
        return (
          student.gender === "M" &&
          attendance[student.user_id] &&
          attendance[student.user_id][day] === "P"
        );
      }).length;

      const femalePresentForDay = students.filter((student) => {
        return (
          student.gender === "F" &&
          attendance[student.user_id] &&
          attendance[student.user_id][day] === "P"
        );
      }).length;

      maleTotalAttendance += malePresentForDay;
      femaleTotalAttendance += femalePresentForDay;
    });

    const totalAttendance = maleTotalAttendance + femaleTotalAttendance;

    // Set total daily attendance
    setTotalDailyAttendance({
      male: maleTotalAttendance,
      female: femaleTotalAttendance,
      total: totalAttendance,
    });

    // Calculate average daily attendance
    // Formula: Average Daily Attendance = Total Daily Attendance / Number of School Days in reporting month
    const maleAverage =
      totalSchoolDays > 0 ? maleTotalAttendance / totalSchoolDays : 0;
    const femaleAverage =
      totalSchoolDays > 0 ? femaleTotalAttendance / totalSchoolDays : 0;
    const totalAverage =
      totalSchoolDays > 0 ? totalAttendance / totalSchoolDays : 0;

    setAverageDailyAttendance({
      male: parseFloat(maleAverage.toFixed(2)),
      female: parseFloat(femaleAverage.toFixed(2)),
      total: parseFloat(totalAverage.toFixed(2)),
    });
  };

  // Calculate percentage of enrollment
  const calculatePercentageOfEnrollment = () => {
    // Formula: Percentage of Enrollment = (Registered Learners as of end of the month / Enrollment as of 1st Friday of the school year) × 100
    const malePercentage =
      enrollmentStart.male > 0
        ? (registeredLearners.male / enrollmentStart.male) * 100
        : 0;
    const femalePercentage =
      enrollmentStart.female > 0
        ? (registeredLearners.female / enrollmentStart.female) * 100
        : 0;
    const totalPercentage =
      enrollmentStart.total > 0
        ? (registeredLearners.total / enrollmentStart.total) * 100
        : 0;

    return {
      male: parseFloat(malePercentage.toFixed(2)),
      female: parseFloat(femalePercentage.toFixed(2)),
      total: parseFloat(totalPercentage.toFixed(2)),
    };
  };

  // Calculate percentage of attendance
  const calculatePercentageOfAttendance = () => {
    // Formula: Percentage of Attendance for the month = (Average daily attendance / Registered Learners as of end of the month) × 100
    const malePercentage =
      registeredLearners.male > 0
        ? (averageDailyAttendance.male / registeredLearners.male) * 100
        : 0;
    const femalePercentage =
      registeredLearners.female > 0
        ? (averageDailyAttendance.female / registeredLearners.female) * 100
        : 0;
    const totalPercentage =
      registeredLearners.total > 0
        ? (averageDailyAttendance.total / registeredLearners.total) * 100
        : 0;

    return {
      male: parseFloat(malePercentage.toFixed(2)),
      female: parseFloat(femalePercentage.toFixed(2)),
      total: parseFloat(totalPercentage.toFixed(2)),
    };
  };

  const fetchTeacherData = async () => {
    try {
      // Get user data by email
      const userResponse = await axios.get(
        gradingUrl(`/users/byEmail/${currentUser.email}`),
        { headers: getAuthHeader() },
      );
      const userData = userResponse.data;

      if (!userData || !userData.user_id) {
        throw new Error("User not found");
      }

      setTeacher(userData);
    } catch (err) {
      console.error("Error fetching teacher data:", err);
      setError(err.message || "Failed to load teacher data");
      setLoading(false);
    }
  };

  const fetchSchoolYears = async () => {
    try {
      const response = await axios.get(gradingUrl("/api/school-years"), { headers: getAuthHeader() });
      const data = response.data;

      // Find active school year
      const active = data.find((year) => year.is_active);
      setActiveSchoolYear(active || null);

      // Set selected school year to active by default
      if (active) {
        setSelectedSchoolYear(active.school_year_id.toString());
      }

      setSchoolYears(data);

      // Set default month to current month
      const currentMonth = (new Date().getMonth() + 1).toString();
      setSelectedMonth(currentMonth);

      setLoading(false);
    } catch (err) {
      console.error("Error fetching school years:", err);
      setError(err.message || "Failed to load school years");
      setLoading(false);
    }
  };

  const fetchAdvisoryClasses = async () => {
    try {
      if (!teacher || !teacher.user_id) return;

      const response = await axios.get(
        gradingUrl(`/api/teachers/${teacher.user_id}/advisory-classes`),
        { params: { schoolYearId: selectedSchoolYear }, headers: getAuthHeader() },
      );

      setAdvisoryClasses(response.data);

      // If there's exactly one class, auto-select it
      if (response.data.length === 1) {
        setSelectedClass(response.data[0]);
      } else {
        setSelectedClass(null);
      }
    } catch (err) {
      console.error("Error fetching advisory classes:", err);
      setError(err.message || "Failed to load advisory classes");
    }
  };

  const fetchStudents = async () => {
    try {
      if (!selectedClass || !selectedClass.class_id) return;

      const response = await axios.get(
        gradingUrl(`/api/classes/${selectedClass.class_id}/students`),
        { headers: getAuthHeader() },
      );

      // Sort students by last name
      const sortedStudents = response.data.sort(
        (a, b) =>
          a.lname.localeCompare(b.lname) || a.fname.localeCompare(b.fname),
      );

      setStudents(sortedStudents);

      // Prefetch which students have previous attendance in another class this SY & grade level
      try {
        const results = await Promise.all(
          sortedStudents.map(async (s) => {
            try {
              const res = await axios.get(
                gradingUrl(`/api/attendance/student/${s.user_id}/has-previous`),
                {
                  params: {
                    schoolYearId: selectedSchoolYear,
                    gradeLevel: selectedClass.grade_level,
                    excludeClassId: selectedClass.class_id,
                  },
                  headers: getAuthHeader(),
                },
              );
              return [s.user_id, Boolean(res.data?.hasPrevious)];
            } catch (_) {
              return [s.user_id, false];
            }
          }),
        );
        const map = {};
        results.forEach(([id, flag]) => {
          map[id] = flag;
        });
        setHasPrevClassByStudent(map);
      } catch (e) {
        // ignore prefetch errors
      }
    } catch (err) {
      console.error("Error fetching students:", err);
      setError(err.message || "Failed to load students");
    }
  };

  const calculateDaysInMonth = () => {
    if (!selectedMonth) return;

    // Find the school year object
    const schoolYearObj = schoolYears.find(
      (sy) => sy.school_year_id.toString() === selectedSchoolYear,
    );
    if (!schoolYearObj) return;

    // Extract the school year range (e.g., "2024-2025")
    const [startYear, endYear] = schoolYearObj.school_year.split("-");

    // Get current date
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-based month

    let yearToUse;
    const selectedMonthNum = parseInt(selectedMonth);

    if (schoolYearObj.is_active) {
      // For active school year, use current year if it matches either start or end year
      if (currentYear === parseInt(startYear)) {
        // We're in the first year of the school year
        yearToUse = parseInt(startYear);
      } else if (currentYear === parseInt(endYear)) {
        // We're in the second year of the school year
        yearToUse = parseInt(endYear);
      } else {
        // Default to start year for past records
        yearToUse = parseInt(startYear);
      }
    } else {
      // For inactive school years, use standard logic
      yearToUse =
        selectedMonthNum >= 6 ? parseInt(startYear) : parseInt(endYear);
    }

    setSelectedYear(yearToUse);

    // Calculate days in the selected month for the appropriate year
    const daysCount = new Date(yearToUse, parseInt(selectedMonth), 0).getDate();
    setDaysInMonth(daysCount);
  };

  const fetchAttendanceData = async () => {
    try {
      if (
        !selectedClass ||
        !selectedSchoolYear ||
        !selectedMonth ||
        !selectedYear
      )
        return;

      setLoading(true);

      // Store current total school days before the fetch
      const currentTotalSchoolDays = totalSchoolDays;

      const response = await axios.get(
        gradingUrl(`/api/attendance/class/${selectedClass.class_id}/month/${selectedMonth}/year/${selectedYear}`),
        { params: { schoolYearId: selectedSchoolYear }, headers: getAuthHeader() },
      );

      // Process attendance data
      const attendanceData = {};

      if (response.data && response.data.students) {
        response.data.students.forEach((studentData) => {
          attendanceData[studentData.student_id] = studentData.attendance || {};
        });

        // Update the days in month from API response if available
        if (response.data.daysInMonth) {
          setDaysInMonth(response.data.daysInMonth);
        }

        // If total school days is returned and non-zero, use it
        // Otherwise preserve the current value if it exists
        if (response.data.totalSchoolDays) {
          setTotalSchoolDays(response.data.totalSchoolDays);
        } else if (currentTotalSchoolDays > 0) {
          // Keep the current value if we're just refreshing data
          setTotalSchoolDays(currentTotalSchoolDays);
        }
      }

      // Set attendance data
      setAttendance(attendanceData);
      setUnsavedChanges(false);

      // Get the attendance summary
      await fetchAttendanceSummary();
    } catch (err) {
      console.error("Error fetching attendance data:", err);
      setError(err.message || "Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  };

  // Lazy fetch previous-class attendance for a student (same SY & grade, exclude current class)
  const fetchPreviousAttendance = async (studentId) => {
    try {
      const cacheKey = `${studentId}|${selectedSchoolYear}|${selectedClass?.class_id}|${selectedMonth}|${selectedYear}`;
      if (prevAttendanceByStudent[cacheKey] || prevAttendanceLoading[cacheKey])
        return;
      setPrevAttendanceLoading((prev) => ({ ...prev, [cacheKey]: true }));

      if (
        !selectedClass ||
        !selectedSchoolYear ||
        !selectedMonth ||
        !selectedYear
      ) {
        setPrevAttendanceByStudent((prev) => ({ ...prev, [cacheKey]: [] }));
        setPrevAttendanceLoading((prev) => ({ ...prev, [cacheKey]: false }));
        return;
      }

      const response = await axios.get(
        gradingUrl(`/api/attendance/student/${studentId}/previous`),
        {
          params: {
            schoolYearId: selectedSchoolYear,
            gradeLevel: selectedClass.grade_level,
            excludeClassId: selectedClass.class_id,
            month: selectedMonth,
            year: selectedYear,
          },
          headers: getAuthHeader(),
        },
      );

      const classes = response.data?.classes || [];
      setPrevAttendanceByStudent((prev) => ({ ...prev, [cacheKey]: classes }));
    } catch (err) {
      console.error("Prev attendance fetch error:", err);
      const cacheKey = `${studentId}|${selectedSchoolYear}|${selectedClass?.class_id}|${selectedMonth}|${selectedYear}`;
      setPrevAttendanceByStudent((prev) => ({ ...prev, [cacheKey]: [] }));
    } finally {
      const cacheKey = `${studentId}|${selectedSchoolYear}|${selectedClass?.class_id}|${selectedMonth}|${selectedYear}`;
      setPrevAttendanceLoading((prev) => ({ ...prev, [cacheKey]: false }));
    }
  };

  // Invalidate previous attendance cache when filters change
  useEffect(() => {
    setPrevAttendanceByStudent({});
    setPrevAttendanceLoading({});
    setOpenPrevPanelKey(null);
  }, [
    selectedMonth,
    selectedYear,
    selectedClass?.class_id,
    selectedSchoolYear,
  ]);

  const togglePrevPanel = (studentId) => {
    const key = `${studentId}|${selectedSchoolYear}|${selectedClass?.class_id}|${selectedMonth}|${selectedYear}`;
    fetchPreviousAttendance(studentId);
    setOpenPrevPanelKey((prev) => (prev === key ? null : key));
  };

  // Close previous-class panel on Escape key only (removed click-outside to avoid conflicts)
  useEffect(() => {
    if (!openPrevPanelKey) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpenPrevPanelKey(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [openPrevPanelKey]);

  const fetchAttendanceSummary = async () => {
    try {
      if (
        !selectedClass ||
        !selectedSchoolYear ||
        !selectedMonth ||
        !selectedYear
      )
        return;

      console.log("Fetching attendance summary for:", {
        classId: selectedClass.class_id,
        month: selectedMonth,
        year: selectedYear,
        schoolYearId: selectedSchoolYear,
      });

      const response = await axios.get(
        gradingUrl(`/api/attendance/summary/${selectedClass.class_id}/${selectedMonth}/${selectedYear}`),
        { params: { schoolYearId: selectedSchoolYear }, headers: getAuthHeader() },
      );

      console.log("Received attendance summary data:", response.data);

      if (response.data) {
        if (response.data.totalDays !== undefined) {
          setTotalSchoolDays(response.data.totalDays);
        }

        // Update the summary data with values from the database
        if (response.data.summary) {
          console.log(
            "Setting summary data from backend:",
            response.data.summary,
          );
          setSummaryData(response.data.summary);
        } else {
          // Reset summary data if no records found
          setSummaryData({
            male: { present: 0, absent: 0, late: 0 },
            female: { present: 0, absent: 0, late: 0 },
          });
        }

        // Update consecutive absences data if available from backend
        if (response.data.consecutiveAbsences) {
          setConsecutiveAbsences(response.data.consecutiveAbsences);
        } else {
          // If not available from backend, calculate it based on current attendance data
          calculateConsecutiveAbsences();
        }
      }
    } catch (err) {
      console.error("Error fetching attendance summary:", err);
      // Reset summary data on error
      setSummaryData({
        male: { present: 0, absent: 0, late: 0 },
        female: { present: 0, absent: 0, late: 0 },
      });
      // Make sure to calculate consecutive absences even if summary fetch fails
      calculateConsecutiveAbsences();
    }
  };

  const fetchStudentStatuses = async () => {
    try {
      if (!selectedClass || !selectedSchoolYear) return;

      const response = await axios.get(
        gradingUrl(`/api/student-status/class/${selectedClass.class_id}`),
        { params: { schoolYearId: selectedSchoolYear }, headers: getAuthHeader() },
      );

      const statusMap = {};
      if (response.data && response.data.data) {
        response.data.data.forEach((status) => {
          statusMap[status.student_id] = status;
        });
      }

      setStudentStatuses(statusMap);
    } catch (err) {
      console.error("Error fetching student statuses:", err);
      // Don't show error UI as this might be new functionality
    }
  };

  const fetchEnrollmentStatistics = async () => {
    try {
      if (
        !selectedClass ||
        !selectedSchoolYear ||
        !selectedMonth ||
        !selectedYear
      )
        return;

      const response = await axios.get(
        gradingUrl(`/api/classes/${selectedClass.class_id}/enrollment-statistics`),
        {
          params: {
            schoolYearId: selectedSchoolYear,
            month: selectedMonth,
            year: selectedYear,
          },
          headers: getAuthHeader(),
        },
      );

      if (response.data) {
        // Update enrollment and late enrollment stats
        setEnrollmentStart({
          male: response.data.enrollment.male,
          female: response.data.enrollment.female,
          total: response.data.enrollment.total,
        });

        setLateEnrollment({
          male: response.data.lateEnrollment.male,
          female: response.data.lateEnrollment.female,
          total: response.data.lateEnrollment.total,
        });

        // Set registered learners from API response
        setRegisteredLearners({
          male: response.data.registeredLearners.male,
          female: response.data.registeredLearners.female,
          total: response.data.registeredLearners.total,
        });
      } else {
        // Fallback to counting current students if API returns no data
        calculateFallbackEnrollmentStats();
      }
    } catch (err) {
      console.error("Error fetching enrollment statistics:", err);
      // Use fallback calculation if API call fails
      calculateFallbackEnrollmentStats();
    }
  };

  // Fallback function to calculate enrollment stats based on available data
  const calculateFallbackEnrollmentStats = () => {
    // Count students by gender
    const maleCount = students.filter((s) => s.gender === "M").length;
    const femaleCount = students.filter((s) => s.gender === "F").length;
    const totalCount = maleCount + femaleCount;

    // Set all students as enrolled by cutoff date (best guess without date_enrolled)
    setEnrollmentStart({
      male: maleCount,
      female: femaleCount,
      total: totalCount,
    });

    // For late enrollment, use transferred-in students as a proxy
    const transferredInMale = Object.values(studentStatuses).filter(
      (s) =>
        s.status_type === "TRANSFERRED_IN" &&
        students.find((st) => st.user_id === s.student_id)?.gender === "M",
    ).length;

    const transferredInFemale = Object.values(studentStatuses).filter(
      (s) =>
        s.status_type === "TRANSFERRED_IN" &&
        students.find((st) => st.user_id === s.student_id)?.gender === "F",
    ).length;

    setLateEnrollment({
      male: transferredInMale,
      female: transferredInFemale,
      total: transferredInMale + transferredInFemale,
    });

    // For registered learners, calculate based on the selected month's end date
    const endOfMonth = new Date(selectedYear, parseInt(selectedMonth), 0);
    const endOfMonthStr = endOfMonth.toISOString().split("T")[0];

    // Count dropped/transferred out students before or on end of month
    const droppedMale = Object.values(studentStatuses).filter(
      (s) =>
        (s.status_type === "DROPPED_OUT" ||
          s.status_type === "TRANSFERRED_OUT") &&
        new Date(s.effective_date) <= endOfMonth &&
        students.find((st) => st.user_id === s.student_id)?.gender === "M",
    ).length;

    const droppedFemale = Object.values(studentStatuses).filter(
      (s) =>
        (s.status_type === "DROPPED_OUT" ||
          s.status_type === "TRANSFERRED_OUT") &&
        new Date(s.effective_date) <= endOfMonth &&
        students.find((st) => st.user_id === s.student_id)?.gender === "F",
    ).length;

    // Calculate registered learners (total enrolled minus dropped/transferred out as of end of month)
    const registeredMale = Math.max(0, maleCount - droppedMale);
    const registeredFemale = Math.max(0, femaleCount - droppedFemale);

    setRegisteredLearners({
      male: registeredMale,
      female: registeredFemale,
      total: registeredMale + registeredFemale,
    });
  };

  const openStatusModal = (student) => {
    setSelectedStudent(student);
    const currentStatus = studentStatuses[student.user_id] || {};
    setStatusForm({
      statusType: currentStatus.status_type || "ACTIVE",
      reason: currentStatus.reason || "",
      schoolName: currentStatus.school_name || "",
      effectiveDate:
        currentStatus.effective_date || new Date().toISOString().split("T")[0],
    });
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedStudent(null);
  };

  const handleStatusFormChange = (e) => {
    const { name, value } = e.target;
    setStatusForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveStudentStatus = async () => {
    try {
      if (!selectedStudent || !selectedClass || !selectedSchoolYear) return;

      const payload = {
        student_id: selectedStudent.user_id,
        class_id: selectedClass.class_id,
        school_year_id: parseInt(selectedSchoolYear),
        status_type: statusForm.statusType,
        reason: statusForm.reason,
        school_name: statusForm.schoolName,
        effective_date: statusForm.effectiveDate,
      };

      const response = await axios.post(
        gradingUrl("/api/student-status"),
        payload,
        { headers: getAuthHeader() },
      );

      // Update local state
      setStudentStatuses((prev) => ({
        ...prev,
        [selectedStudent.user_id]: response.data.data,
      }));

      closeStatusModal();
      showNotification("Student status updated successfully!", "success");
    } catch (err) {
      console.error("Error saving student status:", err);
      showNotification(
        `Failed to update student status: ${err.message}`,
        "error",
      );
    }
  };

  const handleAttendanceClick = (studentId, day) => {
    // Check if the day, month, and year match the current date
    const currentDate = new Date();
    const currentDay = currentDate.getDate();
    const currentMonth = (currentDate.getMonth() + 1).toString(); // JavaScript months are 0-indexed
    const currentYear = currentDate.getFullYear();

    // Only allow attendance marking for the current day
    if (
      day !== currentDay ||
      selectedMonth !== currentMonth ||
      parseInt(selectedYear) !== currentYear
    ) {
      // Replace alert with custom notification
      showNotification(
        `You can only mark attendance for the current day (${currentDay}/${currentMonth}/${currentYear}).`,
        "warning",
      );
      return;
    }

    // Create a copy of the current attendance state
    const newAttendance = { ...attendance };

    // Initialize student's attendance object if it doesn't exist
    if (!newAttendance[studentId]) {
      newAttendance[studentId] = {};
    }

    // Get the student to determine gender for summary update
    const student = students.find((s) => s.user_id === studentId);
    if (!student) return;

    const gender = student.gender === "M" ? "male" : "female";

    // Get old status for summary update
    const oldStatus = newAttendance[studentId][day];

    // Modified to cycle between P (Present) -> A (Absent) -> L (Late) -> P (Present)
    // Removing the empty/null state from the cycle
    let newStatus;

    switch (newAttendance[studentId][day]) {
      case "P":
        newStatus = "A"; // Present -> Absent
        break;
      case "A":
        newStatus = "L"; // Absent -> Late
        break;
      case "L":
        newStatus = "P"; // Late -> Present (instead of null/empty)
        break;
      default:
        newStatus = "P"; // Default/Empty -> Present
    }

    // Update the attendance data
    newAttendance[studentId][day] = newStatus;

    // Update the attendance state
    setAttendance(newAttendance);
    setUnsavedChanges(true);

    // Update the summary data in real-time
    updateSummaryForAttendanceChange(gender, oldStatus, newStatus);
  };

  // Helper function to update summary when attendance changes
  const updateSummaryForAttendanceChange = (gender, oldStatus, newStatus) => {
    // Create a copy of the current summary data
    const newSummary = {
      male: { ...summaryData.male },
      female: { ...summaryData.female },
    };

    // Decrement count for old status if it exists
    if (oldStatus) {
      if (oldStatus === "P")
        newSummary[gender].present = Math.max(
          0,
          newSummary[gender].present - 1,
        );
      else if (oldStatus === "A")
        newSummary[gender].absent = Math.max(0, newSummary[gender].absent - 1);
      else if (oldStatus === "L")
        newSummary[gender].late = Math.max(0, newSummary[gender].late - 1);
    }

    // Increment count for new status if it exists
    if (newStatus) {
      if (newStatus === "P") newSummary[gender].present++;
      else if (newStatus === "A") newSummary[gender].absent++;
      else if (newStatus === "L") newSummary[gender].late++;
    }

    // Update the summary state
    setSummaryData(newSummary);
  };

  const saveAttendance = async () => {
    try {
      if (!selectedClass || !selectedSchoolYear || !selectedMonth) {
        showNotification(
          "Please select class, school year, and month before saving.",
          "warning",
        );
        return;
      }

      setLoading(true);

      // Format records for the batch update API
      const records = [];

      // Add all attendance records
      Object.entries(attendance).forEach(([studentId, days]) => {
        Object.entries(days).forEach(([day, status]) => {
          records.push({
            student_id: parseInt(studentId),
            day: parseInt(day),
            status: status,
          });
        });
      });

      // Send batch update request with consecutive absences data
      await axios.post(gradingUrl("/api/attendance/batch"), {
        class_id: selectedClass.class_id,
        school_year_id: parseInt(selectedSchoolYear),
        month: parseInt(selectedMonth),
        records,
        total_school_days: totalSchoolDays,
        consecutive_absences: {
          male: consecutiveAbsences.male,
          female: consecutiveAbsences.female,
          total: consecutiveAbsences.total,
          students: consecutiveAbsences.students.map((student) => ({
            student_id: parseInt(student.id),
            consecutive_days: student.consecutiveDays,
          })),
        },
      }, { headers: getAuthHeader() });

      showNotification("Attendance records saved successfully!", "success");
      setUnsavedChanges(false);

      // Refresh attendance data and summary
      await fetchAttendanceData();
      // Explicitly fetch summary data again to ensure it's up to date
      await fetchAttendanceSummary();
    } catch (err) {
      console.error("Error saving attendance:", err);
      showNotification(`Failed to save attendance: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSchoolYearChange = (e) => {
    const newSchoolYear = e.target.value;

    if (unsavedChanges) {
      setConfirmDialog({
        show: true,
        message: "You have unsaved changes. Continue anyway?",
        onConfirm: () => {
          setSelectedSchoolYear(newSchoolYear);
          setSelectedClass(null);
          setStudents([]);
          setAttendance({});
          setSummaryData({
            male: { present: 0, absent: 0, late: 0 },
            female: { present: 0, absent: 0, late: 0 },
          });
          setUnsavedChanges(false);
          setConfirmDialog({
            show: false,
            message: "",
            onConfirm: null,
            onCancel: null,
          });
        },
        onCancel: () => {
          setConfirmDialog({
            show: false,
            message: "",
            onConfirm: null,
            onCancel: null,
          });
        },
      });
    } else {
      setSelectedSchoolYear(newSchoolYear);
      setSelectedClass(null);
      setStudents([]);
      setAttendance({});
      setSummaryData({
        male: { present: 0, absent: 0, late: 0 },
        female: { present: 0, absent: 0, late: 0 },
      });
      setUnsavedChanges(false);
    }
  };

  // Modify handleMonthChange to handle the new month-year format
  const handleMonthChange = (e) => {
    const [newMonth, newYear] = e.target.value.split("-");

    if (unsavedChanges) {
      setConfirmDialog({
        show: true,
        message: "You have unsaved changes. Continue anyway?",
        onConfirm: () => {
          setSelectedMonth(newMonth);
          setSelectedYear(parseInt(newYear));
          setAttendance({});
          setSummaryData({
            male: { present: 0, absent: 0, late: 0 },
            female: { present: 0, absent: 0, late: 0 },
          });
          setUnsavedChanges(false);
          setConfirmDialog({
            show: false,
            message: "",
            onConfirm: null,
            onCancel: null,
          });
        },
        onCancel: () => {
          setConfirmDialog({
            show: false,
            message: "",
            onConfirm: null,
            onCancel: null,
          });
        },
      });
    } else {
      setSelectedMonth(newMonth);
      setSelectedYear(parseInt(newYear));
      setAttendance({});
      setSummaryData({
        male: { present: 0, absent: 0, late: 0 },
        female: { present: 0, absent: 0, late: 0 },
      });
      setUnsavedChanges(false);
    }
  };

  const handleClassChange = (e) => {
    const classId = e.target.value;

    if (unsavedChanges) {
      setConfirmDialog({
        show: true,
        message: "You have unsaved changes. Continue anyway?",
        onConfirm: () => {
          const selectedClassObj = advisoryClasses.find(
            (c) => c.class_id.toString() === classId,
          );
          setSelectedClass(selectedClassObj || null);
          setAttendance({});
          setSummaryData({
            male: { present: 0, absent: 0, late: 0 },
            female: { present: 0, absent: 0, late: 0 },
          });
          setUnsavedChanges(false);
          setConfirmDialog({
            show: false,
            message: "",
            onConfirm: null,
            onCancel: null,
          });
        },
        onCancel: () => {
          setConfirmDialog({
            show: false,
            message: "",
            onConfirm: null,
            onCancel: null,
          });
        },
      });
    } else {
      const selectedClassObj = advisoryClasses.find(
        (c) => c.class_id.toString() === classId,
      );
      setSelectedClass(selectedClassObj || null);
      setAttendance({});
      setSummaryData({
        male: { present: 0, absent: 0, late: 0 },
        female: { present: 0, absent: 0, late: 0 },
      });
      setUnsavedChanges(false);
    }
  };

  const handlePrint = async () => {
    try {
      // Set PDF generation flag but don't display any preview
      document.body.classList.add("generating-pdf");

      // Wait for the next render cycle to ensure the PDF template is processed
      setTimeout(async () => {
        // Find the PDF template in the DOM
        const pdfTemplate = document.querySelector(".pdf-template");

        if (!pdfTemplate) {
          throw new Error("PDF template not found");
        }

        // Create a new PDF document in landscape orientation
        const pdf = new jsPDF("l", "mm", "a4");

        // First page - Attendance Table
        const firstPage = pdfTemplate.querySelector(".first-page");
        const firstPageCanvas = await html2canvas(firstPage, {
          scale: 3, // Increased scale for better quality (from 2 to 3)
          useCORS: true,
          logging: false,
          backgroundColor: "#fff",
          // Add additional options to ensure styling is captured correctly
          allowTaint: true,
          foreignObjectRendering: false, // Set to false to ensure CSS is correctly applied
          onclone: (clonedDoc) => {
            // Add extra padding to top to prevent headers from being cut off
            const firstPageEl = clonedDoc.querySelector(".first-page");
            if (firstPageEl) {
              firstPageEl.style.paddingTop = "8mm";
              firstPageEl.style.paddingBottom = "15mm";
            }

            // Find all cells with Late status and ensure their shading is correct
            const lateCells = clonedDoc.querySelectorAll(".diagonal-shade");
            lateCells.forEach((cell) => {
              cell.style.position = "relative";
              cell.style.overflow = "hidden";

              // Create or update diagonal shade
              let overlay = cell.querySelector("div");
              if (!overlay) {
                overlay = document.createElement("div");
                cell.appendChild(overlay);
              }

              // Apply correct styling for diagonal shading
              overlay.style.position = "absolute";
              overlay.style.top = "0";
              overlay.style.left = "0";
              overlay.style.width = "100%";
              overlay.style.height = "100%";
              overlay.style.background =
                "linear-gradient(to bottom right, black 49.5%, transparent 50.5%)";
              overlay.style.zIndex = "2";
            });

            // Ensure all styles are applied in the cloned document
            const style = clonedDoc.createElement("style");
            style.innerHTML = `
              .diagonal-shade {
                position: relative !important;
                overflow: hidden !important;
              }
              
              .diagonal-shade::before {
                content: none !important;
              }
            `;
            clonedDoc.head.appendChild(style);
          },
        });

        // Add first page to PDF
        const firstPageWidth = pdf.internal.pageSize.getWidth();
        const firstPageHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(
          firstPageCanvas.toDataURL("image/png"),
          "PNG",
          0,
          0,
          firstPageWidth,
          firstPageHeight,
        );

        // Second page - Guidelines and Summary
        pdf.addPage();

        const secondPage = pdfTemplate.querySelector(".second-page");
        const secondPageCanvas = await html2canvas(secondPage, {
          scale: 4, // Increased scale for better quality
          useCORS: true,
          logging: false,
          backgroundColor: "#fff",
          allowTaint: true,
          onclone: (clonedDoc) => {
            // Hide "GUIDELINES" label in the PDF
            const guidelinesLabel = clonedDoc.querySelector(".second-page h3");
            if (
              guidelinesLabel &&
              guidelinesLabel.textContent.includes("GUIDELINES")
            ) {
              guidelinesLabel.style.display = "none";
            }

            // Add extra padding to second page
            const secondPageEl = clonedDoc.querySelector(".second-page");
            if (secondPageEl) {
              secondPageEl.style.paddingTop = "8mm";
              secondPageEl.style.paddingBottom = "15mm";
            }

            // Find all cells with Late status and ensure their shading is correct
            const lateCells = clonedDoc.querySelectorAll(".diagonal-shade");
            lateCells.forEach((cell) => {
              cell.style.position = "relative";
              cell.style.overflow = "hidden";

              // Create or update diagonal shade
              let overlay = cell.querySelector("div");
              if (!overlay) {
                overlay = document.createElement("div");
                cell.appendChild(overlay);
              }

              // Apply correct styling for diagonal shading
              overlay.style.position = "absolute";
              overlay.style.top = "0";
              overlay.style.left = "0";
              overlay.style.width = "100%";
              overlay.style.height = "100%";
              overlay.style.background =
                "linear-gradient(to bottom right, black 49.5%, transparent 50.5%)";
              overlay.style.zIndex = "2";
            });

            // Apply any other PDF-specific styling
            const style = clonedDoc.createElement("style");
            style.innerHTML = `
              .pdf-only { display: block !important; }
              .pdf-hide { display: none !important; }
              table { border-collapse: collapse; }
              td, th { border: 1px solid black; }
              
              .diagonal-shade {
                position: relative !important;
                overflow: hidden !important;
              }
              
              .diagonal-shade::before {
                content: none !important;
              }
            `;
            clonedDoc.head.appendChild(style);
          },
        });

        // Add second page to PDF with improved quality
        pdf.addImage(
          secondPageCanvas.toDataURL("image/png", 1.0), // Use highest quality
          "PNG",
          0,
          0,
          firstPageWidth,
          firstPageHeight,
        );

        // Generate filename with class and month information
        const monthName = selectedMonth
          ? months.find((m) => m.value === selectedMonth)?.label || "Month"
          : "Month";
        const className = selectedClass
          ? selectedClass.grade_level === "Kindergarten"
            ? `Kindergarten-${selectedClass.section}`
            : `Grade ${selectedClass.grade_level}-${selectedClass.section}`
          : "Class";
        const filename = `${className} Attendance Report for the Month of ${monthName}.pdf`;

        // Save the PDF
        pdf.save(filename);

        // Remove PDF generation flag
        document.body.classList.remove("generating-pdf");
      }, 100);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
      document.body.classList.remove("generating-pdf");
    }
  };

  // Helper function to get the display character for a status
  const getStatusDisplay = (status) => {
    switch (status) {
      case "P":
        return "✓"; // Changed from empty string to checkmark for present students
      case "A":
        return "X"; // Changed from 'XX' to a single 'X' to match the user's request
      case "L":
        return ""; // For Late, we'll use a CSS styling instead of a character
      default:
        return "";
    }
  };

  const getRemarksText = (studentId) => {
    const status = studentStatuses[studentId];
    if (!status) return "";

    switch (status.status_type) {
      case "DROPPED_OUT":
        return `DROPPED OUT: ${status.reason || "No reason provided"}`;
      case "TRANSFERRED_IN":
        return `TRANSFERRED IN: ${status.school_name || "Unknown school"}`;
      case "TRANSFERRED_OUT":
        return `TRANSFERRED OUT: ${status.school_name || "Unknown school"}`;
      case "ACTIVE":
        return "ACTIVE";
      default:
        return "";
    }
  };

  // Update the getDayOfWeekAbbr function to match the image exactly
  const getDayOfWeekAbbr = (year, month, day) => {
    // Create a date object for the given date
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();

    switch (dayOfWeek) {
      case 0:
        return "Su"; // Sunday
      case 1:
        return "M"; // Monday
      case 2:
        return "T"; // Tuesday
      case 3:
        return "W"; // Wednesday
      case 4:
        return "Th"; // Thursday
      case 5:
        return "F"; // Friday
      case 6:
        return "Sa"; // Saturday
      default:
        return "";
    }
  };

  // Helper function to check if a day should be included in attendance tracking
  const isWeekday = (year, month, day) => {
    // Modified to include all days (including Saturday and Sunday) as requested by client
    return true; // Return true for all days to include weekends
  };

  // Add this new function to handle clearing attendance for a specific day
  const clearAttendanceForDay = async (day) => {
    try {
      if (!selectedClass || !selectedSchoolYear || !selectedMonth || !day) {
        return;
      }

      setLoading(true);

      // Make direct API call to delete records for this day
      await axios.delete(
        gradingUrl(`/api/attendance/class/${selectedClass.class_id}/month/${selectedMonth}/year/${selectedYear}`),
        {
          params: {
            schoolYearId: selectedSchoolYear,
            day: day,
            totalSchoolDays: totalSchoolDays,
          },
          headers: getAuthHeader(),
        },
      );

      // Create a copy of the current attendance state
      const newAttendance = { ...attendance };

      // Track summary changes for updating counts
      const summaryChanges = {
        male: { present: 0, absent: 0, late: 0 },
        female: { present: 0, absent: 0, late: 0 },
      };

      // Remove attendance records for the specific day for all students
      students.forEach((student) => {
        const studentId = student.user_id;
        const gender = student.gender === "M" ? "male" : "female";

        // If student has an attendance record for this day
        if (newAttendance[studentId] && newAttendance[studentId][day]) {
          // Decrement summary count based on the status being removed
          const status = newAttendance[studentId][day];
          if (status === "P") summaryChanges[gender].present--;
          else if (status === "A") summaryChanges[gender].absent--;
          else if (status === "L") summaryChanges[gender].late--;

          // Delete the attendance record for this day
          delete newAttendance[studentId][day];
        }
      });

      // Update attendance state
      setAttendance(newAttendance);

      // Update summary data
      setSummaryData({
        male: {
          present: Math.max(
            0,
            summaryData.male.present + summaryChanges.male.present,
          ),
          absent: Math.max(
            0,
            summaryData.male.absent + summaryChanges.male.absent,
          ),
          late: Math.max(0, summaryData.male.late + summaryChanges.male.late),
        },
        female: {
          present: Math.max(
            0,
            summaryData.female.present + summaryChanges.female.present,
          ),
          absent: Math.max(
            0,
            summaryData.female.absent + summaryChanges.female.absent,
          ),
          late: Math.max(
            0,
            summaryData.female.late + summaryChanges.female.late,
          ),
        },
      });

      showNotification(
        `Attendance records for day ${day} have been cleared successfully!`,
        "success",
      );

      // Refresh attendance data and summary to ensure UI is in sync with server
      await fetchAttendanceData();
      await fetchAttendanceSummary();
    } catch (err) {
      console.error("Error clearing attendance for day:", err);
      showNotification(`Failed to clear attendance: ${err.message}`, "error");
    } finally {
      setLoading(false);
      setShowClearDayModal(false);
      setDayToClear(null);
    }
  };

  const handleClearDay = (day) => {
    setDayToClear(day);
    setShowClearDayModal(true);
  };

  const closeClearDayModal = () => {
    setShowClearDayModal(false);
    setDayToClear(null);
  };

  // Add useEffect to handle consecutive absences calculation when data changes
  useEffect(() => {
    if (students.length > 0 && Object.keys(attendance).length > 0) {
      calculateConsecutiveAbsences();
    }
  }, [students, attendance, daysInMonth]); // Add daysInMonth as dependency

  const calculateConsecutiveAbsences = () => {
    if (!students.length || !Object.keys(attendance).length || !daysInMonth) {
      console.log("Missing required data for consecutive absences calculation");
      return;
    }

    // Track students with 5+ consecutive absences
    const studentsWithConsecutiveAbsences = [];
    let maleCount = 0;
    let femaleCount = 0;

    // For each student
    students.forEach((student) => {
      const studentId = student.user_id;
      const studentAttendance = attendance[studentId] || {};
      let maxConsecutive = 0;
      let currentConsecutive = 0;
      let currentStreak = [];
      let longestStreak = [];

      // Check consecutive absences by scanning through all days
      for (let day = 1; day <= daysInMonth; day++) {
        if (studentAttendance[day] === "A") {
          // Increase consecutive count and add day to current streak
          currentConsecutive++;
          currentStreak.push(day);

          // Update longest streak if current is longer
          if (currentConsecutive > maxConsecutive) {
            maxConsecutive = currentConsecutive;
            longestStreak = [...currentStreak];
          }
        } else {
          // Reset consecutive count and streak
          currentConsecutive = 0;
          currentStreak = [];
        }
      }

      // Check final streak if it ends at the last day of the month
      if (currentConsecutive > maxConsecutive) {
        maxConsecutive = currentConsecutive;
        longestStreak = [...currentStreak];
      }

      // If student has 5 or more consecutive absences
      if (maxConsecutive >= 5) {
        studentsWithConsecutiveAbsences.push({
          id: studentId,
          name: `${student.lname}, ${student.fname} ${student.mname || ""}`,
          gender: student.gender,
          consecutiveDays: maxConsecutive,
          streakDays: longestStreak,
        });

        // Count by gender
        if (student.gender === "M") {
          maleCount++;
        } else if (student.gender === "F") {
          femaleCount++;
        }
      }
    });

    // Update state with consecutive absence information
    setConsecutiveAbsences({
      male: maleCount,
      female: femaleCount,
      total: maleCount + femaleCount,
      students: studentsWithConsecutiveAbsences,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="content-container bg-[#F3F3F6]">
      {/* Toast Notification */}
      {notification.show && (
        <div
          className={`fixed top-2 right-2 p-2 rounded shadow-md z-50 max-w-xs flex items-center text-sm ${
            notification.type === "success"
              ? "bg-white text-green-700 border-l-2 border-green-500"
              : notification.type === "error"
                ? "bg-white text-red-700 border-l-2 border-red-500"
                : notification.type === "warning"
                  ? "bg-white text-yellow-700 border-l-2 border-yellow-500"
                  : "bg-white text-blue-700 border-l-2 border-blue-500"
          }`}
        >
          <div className="flex-shrink-0 mr-2">
            {notification.type === "success" && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {notification.type === "error" && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {notification.type === "warning" && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {notification.type === "info" && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <span className="mr-2">{notification.message}</span>
          <button
            onClick={() =>
              setNotification((prev) => ({ ...prev, show: false }))
            }
            className="text-gray-500 hover:text-gray-700 focus:outline-none ml-auto"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="fixed inset-0 bg-black bg-opacity-40"
            onClick={confirmDialog.onCancel}
          ></div>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative z-10">
            <div className="flex items-center mb-4">
              <div className="bg-yellow-100 p-2.5 rounded-full">
                <svg
                  className="w-6 h-6 text-yellow-700"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-medium text-gray-800">
                Confirmation
              </h3>
            </div>
            <p className="mb-6 text-gray-600">{confirmDialog.message}</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={confirmDialog.onCancel}
                className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 print:p-0">
        <div className="bg-white shadow-sm rounded-lg p-6 print:shadow-none print:rounded-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 print:grid-cols-3">
            {/* School Info - First Row */}
            <div className="flex flex-col">
              <label className="text-sm font-semibold">REGION:</label>
              <input
                type="text"
                value={schoolInfo.region}
                readOnly
                className="border border-gray-300 rounded p-1 bg-gray-50"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold">DIVISION:</label>
              <input
                type="text"
                value={schoolInfo.division}
                readOnly
                className="border border-gray-300 rounded p-1 bg-gray-50"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold">DISTRICT:</label>
              <input
                type="text"
                value={schoolInfo.district}
                readOnly
                className="border border-gray-300 rounded p-1 bg-gray-50"
              />
            </div>

            {/* School Info - Second Row */}
            <div className="flex flex-col">
              <label className="text-sm font-semibold">SCHOOL ID:</label>
              <input
                type="text"
                value={schoolInfo.schoolId}
                readOnly
                className="border border-gray-300 rounded p-1 bg-gray-50"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold">SCHOOL NAME:</label>
              <input
                type="text"
                value={schoolInfo.schoolName}
                readOnly
                className="border border-gray-300 rounded p-1 bg-gray-50"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold">SCHOOL YEAR:</label>
              <select
                value={selectedSchoolYear}
                onChange={handleSchoolYearChange}
                className="border border-gray-300 rounded p-1 print:bg-gray-50"
              >
                <option value="">Select School Year</option>
                {schoolYears.map((year) => (
                  <option key={year.school_year_id} value={year.school_year_id}>
                    {year.school_year} {year.is_active ? "(Active)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* School Info - Third Row */}
            <div className="flex flex-col">
              <label className="text-sm font-semibold">MONTH:</label>
              <select
                value={selectedMonth ? `${selectedMonth}-${selectedYear}` : ""}
                onChange={handleMonthChange}
                className="border border-gray-300 rounded p-1 print:bg-gray-50"
              >
                <option value="">Select Month</option>
                {getMonthYearOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold">GRADE & SECTION:</label>
              {advisoryClasses.length === 0 ? (
                <div className="border border-gray-300 rounded p-1 bg-gray-50 text-gray-500">
                  {selectedSchoolYear
                    ? "No advisory classes found"
                    : "Select a school year first"}
                </div>
              ) : advisoryClasses.length === 1 ? (
                <div className="border border-gray-300 rounded p-1 bg-gray-50">
                  {selectedClass?.grade_level === "Kindergarten"
                    ? "Kindergarten"
                    : `Grade ${selectedClass?.grade_level}`}{" "}
                  - {selectedClass?.section}
                </div>
              ) : (
                <select
                  value={selectedClass?.class_id || ""}
                  onChange={handleClassChange}
                  className="border border-gray-300 rounded p-1 print:bg-gray-50"
                >
                  <option value="">Select Class</option>
                  {advisoryClasses.map((classItem) => (
                    <option key={classItem.class_id} value={classItem.class_id}>
                      {classItem.grade_level === "Kindergarten"
                        ? "Kindergarten"
                        : `Grade ${classItem.grade_level}`}{" "}
                      - {classItem.section}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold">ADVISER:</label>
              <input
                type="text"
                value={
                  teacher
                    ? `${teacher.fname} ${teacher.mname ? teacher.mname + " " : ""}${teacher.lname}`
                    : ""
                }
                readOnly
                className="border border-gray-300 rounded p-1 bg-gray-50"
              />
            </div>
          </div>

          {/* Top Save Changes removed; will render at the bottom */}

          {/* Attendance Table */}
          {selectedClass && students.length > 0 ? (
            <div className="overflow-x-auto mt-4">
              <div className="inline-block min-w-full align-middle">
                <div
                  className="overflow-hidden border border-black rounded-lg"
                  ref={attendanceTableRef}
                >
                  <table className="min-w-full table-fixed divide-y divide-black">
                    <thead>
                      <tr className="bg-white">
                        <th
                          className="py-1 px-3 border-r-2 border-b-2 border-black text-left sticky left-0 bg-white z-10 w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                          rowSpan="2"
                        >
                          Learner's Name
                        </th>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                          .filter((day) =>
                            selectedMonth && selectedYear
                              ? isWeekday(
                                  selectedYear,
                                  parseInt(selectedMonth),
                                  day,
                                )
                              : true,
                          )
                          .map((day) => {
                            // Check if this is the current day
                            const isCurrentDay =
                              day === new Date().getDate() &&
                              selectedMonth ===
                                (new Date().getMonth() + 1).toString() &&
                              parseInt(selectedYear) ===
                                new Date().getFullYear();

                            return (
                              <th
                                key={day}
                                className={`p-0 border-r-2 border-b-2 border-black text-center w-10 h-6 relative group`}
                              >
                                <div
                                  className={`text-xs font-medium ${isCurrentDay ? "text-blue-700" : ""}`}
                                >
                                  {day}
                                </div>
                                {/* Add clear day button that appears on hover */}
                                <button
                                  onClick={() => handleClearDay(day)}
                                  className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 bg-red-100 hover:bg-red-200 
                                        text-red-600 rounded-bl text-xs p-0.5 transition-opacity print:hidden"
                                  title={`Clear all attendance for day ${day}`}
                                >
                                  ×
                                </button>
                              </th>
                            );
                          })}
                        <th
                          className="py-1 px-2 border-r-2 border-b-2 border-black text-center font-medium"
                          colSpan="2"
                        >
                          TOTAL
                        </th>
                        <th
                          className="py-1 px-2 border-b-2 border-black text-center"
                          rowSpan="2"
                        >
                          <div className="text-center">
                            <div className="font-medium text-[12px]">
                              REMARKS
                            </div>
                            <div className="text-[10px] text-gray-500">
                              (If DROPPED OUT, state reason; If TRANSFERRED
                              IN/OUT, write school name)
                            </div>
                          </div>
                        </th>
                      </tr>
                      <tr className="bg-white">
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                          .filter((day) =>
                            selectedMonth && selectedYear
                              ? isWeekday(
                                  selectedYear,
                                  parseInt(selectedMonth),
                                  day,
                                )
                              : true,
                          )
                          .map((day) => {
                            // Check if this is the current day
                            const isCurrentDay =
                              day === new Date().getDate() &&
                              selectedMonth ===
                                (new Date().getMonth() + 1).toString() &&
                              parseInt(selectedYear) ===
                                new Date().getFullYear();

                            return (
                              <th
                                key={`day-${day}`}
                                className={`p-0 border-r-2 border-b-2 border-black text-center text-xs w-10 h-5`}
                              >
                                {selectedMonth && selectedYear ? (
                                  <div
                                    className={`font-medium text-xs ${isCurrentDay ? "text-blue-700" : ""}`}
                                  >
                                    {getDayOfWeekAbbr(
                                      selectedYear,
                                      parseInt(selectedMonth),
                                      day,
                                    )}
                                  </div>
                                ) : (
                                  <div className="font-medium text-xs">-</div>
                                )}
                              </th>
                            );
                          })}
                        <th className="py-0.5 px-2 border-r-2 border-b-2 border-black text-center w-10">
                          <div className="transform -rotate-45 origin-center text-[10.5px] whitespace-nowrap">
                            Absent
                          </div>
                        </th>
                        <th className="py-0.5 px-2 border-r-2 border-b-2 border-black text-center w-10 relative overflow-hidden">
                          <div className="transform -rotate-45 origin-center text-[10.5px] whitespace-nowrap absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                            Late
                          </div>
                          <div
                            className="absolute inset-0 bg-white"
                            style={{
                              clipPath: "polygon(0% 100%, 100% 100%, 100% 0%)",
                            }}
                          ></div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black">
                      {students.map((student, index) => {
                        const studentAttendance =
                          attendance[student.user_id] || {};
                        const absentCount = Object.values(
                          studentAttendance,
                        ).filter((status) => status === "A").length;
                        const lateCount = Object.values(
                          studentAttendance,
                        ).filter((status) => status === "L").length;

                        const key = `${student.user_id}|${selectedSchoolYear}|${selectedClass?.class_id}|${selectedMonth}|${selectedYear}`;
                        const open = openPrevPanelKey === key;

                        return (
                          <React.Fragment key={student.user_id}>
                            <tr className="border-b-2 border-black bg-white relative">
                              <td className="py-1 px-3 border-r-2 border-black text-left sticky left-0 bg-inherit z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-xs relative">
                                <span>
                                  {`${student.lname}, ${student.fname} ${student.mname || ""}`}
                                </span>
                                {/* Previous class button - only for transferred students */}
                                {hasPrevClassByStudent[student.user_id] && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePrevPanel(student.user_id);
                                    }}
                                    className="absolute top-0.5 right-1 p-0.5 text-[#526D82] hover:text-[#3E5367] opacity-80 hover:opacity-100 focus:opacity-100 rounded focus:outline-none focus:ring-1 focus:ring-[#526D82] print:hidden"
                                    title={
                                      open
                                        ? "Hide previous class attendance record"
                                        : "Show previous class attendance record"
                                    }
                                    aria-label={
                                      open
                                        ? "Hide previous class attendance record"
                                        : "Show previous class attendance record"
                                    }
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-3 w-3"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="black"
                                      strokeWidth="3.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      {open ? (
                                        <path d="M18 15l-6-6-6 6" />
                                      ) : (
                                        <path d="M6 9l6 6 6-6" />
                                      )}
                                    </svg>
                                  </button>
                                )}
                              </td>
                              {Array.from(
                                { length: daysInMonth },
                                (_, i) => i + 1,
                              )
                                .filter((day) =>
                                  selectedMonth && selectedYear
                                    ? isWeekday(
                                        selectedYear,
                                        parseInt(selectedMonth),
                                        day,
                                      )
                                    : true,
                                )
                                .map((day) => {
                                  const status = studentAttendance[day];

                                  let cellClass =
                                    "h-6 py-0.5 px-1 border-r-2 border-black text-center cursor-pointer w-10";
                                  let statusDisplay = getStatusDisplay(status);

                                  if (status === "P") cellClass += " bg-white";
                                  else if (status === "A")
                                    cellClass += " bg-white";
                                  else if (status === "L")
                                    cellClass += " relative overflow-hidden";

                                  return (
                                    <td
                                      key={day}
                                      className={cellClass}
                                      onClick={() =>
                                        handleAttendanceClick(
                                          student.user_id,
                                          day,
                                        )
                                      }
                                      title={`${getDayOfWeekAbbr(selectedYear, parseInt(selectedMonth), day)}-${day}, ${student.fname} ${student.lname}`}
                                    >
                                      {statusDisplay}
                                      {status === "L" && (
                                        <>
                                          <div className="absolute inset-0 bg-black"></div>
                                          <div
                                            className="absolute inset-0 bg-white"
                                            style={{
                                              clipPath:
                                                "polygon(0% 100%, 100% 100%, 100% 0%)",
                                            }}
                                          ></div>
                                        </>
                                      )}
                                    </td>
                                  );
                                })}
                              <td className="py-1 px-1 border-r-2 border-black text-center font-medium w-10">
                                {absentCount}
                              </td>
                              <td className="py-1 px-1 border-r-2 border-black text-center font-medium w-10">
                                {lateCount}
                              </td>
                              <td className="py-1 px-4 text-[12px] relative group">
                                <div className="flex justify-between items-center">
                                  <div>{getRemarksText(student.user_id)}</div>
                                  <button
                                    onClick={() => openStatusModal(student)}
                                    className="text-blue-600 hover:text-blue-800 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Previous class row - appears below the student's row when open */}
                            {open && (
                              <tr className="border-b-2 border-black bg-white">
                                <td
                                  data-prev-panel
                                  className="py-1 px-3 border-r-2 border-black text-left sticky left-0 bg-gray-200 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[10px] relative"
                                >
                                  {prevAttendanceLoading[key] ? (
                                    <span className="text-gray-600">
                                      Loading...
                                    </span>
                                  ) : (
                                    (() => {
                                      const classes =
                                        prevAttendanceByStudent[key] || [];
                                      if (!classes.length) {
                                        return (
                                          <span className="text-gray-700">
                                            No previous attendance
                                          </span>
                                        );
                                      }
                                      const cls = classes[0];
                                      const grade =
                                        cls?.grade_level ??
                                        selectedClass?.grade_level;
                                      const gradeText =
                                        grade &&
                                        (grade === "Kindergarten" ||
                                          grade === "K")
                                          ? "Kindergarten"
                                          : grade
                                            ? `Grade ${grade}`
                                            : "Grade";
                                      const rawDesc =
                                        cls?.class_description ||
                                        selectedClass?.class_description ||
                                        cls?.section ||
                                        "";
                                      let cleanDesc = rawDesc || "";
                                      if (cleanDesc) {
                                        if (
                                          grade === "Kindergarten" ||
                                          grade === "K"
                                        ) {
                                          cleanDesc = cleanDesc.replace(
                                            /^\s*Kindergarten\s*[-:–—]?\s*/i,
                                            "",
                                          );
                                        } else if (grade) {
                                          const gl = String(grade).replace(
                                            /[.*+?^${}()|[\]\\]/g,
                                            "\\$&",
                                          );
                                          const re = new RegExp(
                                            `^\\s*Grade\\s*${gl}\\s*[-:–—]?\\s*`,
                                            "i",
                                          );
                                          cleanDesc = cleanDesc.replace(re, "");
                                        }
                                        cleanDesc = cleanDesc.trim();
                                      }
                                      // Format adviser name (first and last name only for compactness)
                                      const adviserName = [
                                        cls.adviser_fname,
                                        cls.adviser_lname,
                                      ]
                                        .filter(Boolean)
                                        .join(" ")
                                        .trim();

                                      return (
                                        <div className="text-gray-800">
                                          <div className="text-[10px] leading-tight truncate">
                                            Grade Level:{" "}
                                            <span className="font-semibold">
                                              {gradeText}
                                            </span>
                                          </div>
                                          <div className="text-[10px] leading-tight truncate">
                                            Section:{" "}
                                            <span className="font-semibold">
                                              {cleanDesc || cls?.section || ""}
                                            </span>
                                          </div>
                                          {adviserName && (
                                            <div className="text-[10px] leading-tight truncate">
                                              Teacher:{" "}
                                              <span className="font-semibold">
                                                {adviserName}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()
                                  )}
                                </td>
                                {Array.from(
                                  { length: daysInMonth },
                                  (_, i) => i + 1,
                                )
                                  .filter((day) =>
                                    selectedMonth && selectedYear
                                      ? isWeekday(
                                          selectedYear,
                                          parseInt(selectedMonth),
                                          day,
                                        )
                                      : true,
                                  )
                                  .map((day) => {
                                    if (prevAttendanceLoading[key]) {
                                      return (
                                        <td
                                          key={day}
                                          className="h-6 py-0.5 px-1 border-r-2 border-black text-center w-10 bg-gray-200"
                                        ></td>
                                      );
                                    }
                                    const classes =
                                      prevAttendanceByStudent[key] || [];
                                    if (!classes.length) {
                                      return (
                                        <td
                                          key={day}
                                          className="h-6 py-0.5 px-1 border-r-2 border-black text-center w-10 bg-gray-200"
                                        ></td>
                                      );
                                    }
                                    const cls = classes[0];
                                    const s = cls.days?.[day];
                                    const statusDisplay =
                                      s === "A" ? "X" : s === "P" ? "✓" : "";
                                    let cellClass =
                                      "h-6 py-0.5 px-1 border-r-2 border-black text-center w-10 bg-gray-200";
                                    if (s === "L")
                                      cellClass += " relative overflow-hidden";

                                    return (
                                      <td key={day} className={cellClass}>
                                        {statusDisplay}
                                        {s === "L" && (
                                          <>
                                            <div className="absolute inset-0 bg-black"></div>
                                            <div
                                              className="absolute inset-0 bg-white"
                                              style={{
                                                clipPath:
                                                  "polygon(0% 100%, 100% 100%, 100% 0%)",
                                              }}
                                            ></div>
                                          </>
                                        )}
                                      </td>
                                    );
                                  })}
                                <td className="py-1 px-1 border-r-2 border-black text-center font-medium w-10 bg-gray-200">
                                  {(() => {
                                    if (prevAttendanceLoading[key]) return "";
                                    const classes =
                                      prevAttendanceByStudent[key] || [];
                                    if (!classes.length) return "";
                                    const cls = classes[0];
                                    return Object.values(cls.days || {}).filter(
                                      (status) => status === "A",
                                    ).length;
                                  })()}
                                </td>
                                <td className="py-1 px-1 border-r-2 border-black text-center font-medium w-10 bg-gray-200">
                                  {(() => {
                                    if (prevAttendanceLoading[key]) return "";
                                    const classes =
                                      prevAttendanceByStudent[key] || [];
                                    if (!classes.length) return "";
                                    const cls = classes[0];
                                    return Object.values(cls.days || {}).filter(
                                      (status) => status === "L",
                                    ).length;
                                  })()}
                                </td>
                                <td className="py-1 px-4 text-[8px] bg-gray-200">
                                  <div className="text-gray-700 font-medium">
                                    Previous Class Attendance Record
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {/* Divider before summary rows */}
                      <tr className="h-0">
                        <td
                          colSpan={
                            // Calculate number of weekday columns + 4 additional columns
                            Array.from(
                              { length: daysInMonth },
                              (_, i) => i + 1,
                            ).filter((day) =>
                              selectedMonth && selectedYear
                                ? isWeekday(
                                    selectedYear,
                                    parseInt(selectedMonth),
                                    day,
                                  )
                                : true,
                            ).length + 4
                          }
                          className="border-b-2 border-black p-0"
                        ></td>
                      </tr>

                      {/* Summary Rows for Attendance Tracking */}
                      {/* Male Total Row */}
                      <tr className="bg-white border-b-2 border-black">
                        <td className="py-1 px-3 border-r-2 border-black text-left sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="text-xs uppercase tracking-wider font-semibold">
                            Male | Total Per Day
                          </div>
                        </td>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                          .filter((day) =>
                            selectedMonth && selectedYear
                              ? isWeekday(
                                  selectedYear,
                                  parseInt(selectedMonth),
                                  day,
                                )
                              : true,
                          )
                          .map((day) => {
                            // Calculate total male students present for this day
                            const maleStudentsPresentCount = students
                              .filter((student) => student.gender === "M")
                              .filter((student) => {
                                const studentAttendance =
                                  attendance[student.user_id] || {};
                                return studentAttendance[day] === "P";
                              }).length;

                            return (
                              <td
                                key={day}
                                className="h-6 py-0.5 px-1 border-r-2 border-black text-center w-10"
                              >
                                {maleStudentsPresentCount > 0
                                  ? maleStudentsPresentCount
                                  : ""}
                              </td>
                            );
                          })}
                        <td
                          className="py-0.5 px-1 border-r-2 border-black text-center w-20"
                          colSpan="2"
                        >
                          {/* Total male students present across all days */}
                          {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                            .filter((day) =>
                              selectedMonth && selectedYear
                                ? isWeekday(
                                    selectedYear,
                                    parseInt(selectedMonth),
                                    day,
                                  )
                                : true,
                            )
                            .reduce((total, day) => {
                              const maleStudentsPresentCount = students
                                .filter((student) => student.gender === "M")
                                .filter((student) => {
                                  const studentAttendance =
                                    attendance[student.user_id] || {};
                                  return studentAttendance[day] === "P";
                                }).length;
                              return total + maleStudentsPresentCount;
                            }, 0)}
                        </td>
                        <td className="py-0.5 px-4 text-center"></td>
                      </tr>

                      {/* Female Total Row */}
                      <tr className="bg-white border-b-2 border-black">
                        <td className="py-1 px-3 border-r-2 border-black text-left sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="text-xs uppercase tracking-wider font-semibold">
                            Female | Total Per Day
                          </div>
                        </td>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                          .filter((day) =>
                            selectedMonth && selectedYear
                              ? isWeekday(
                                  selectedYear,
                                  parseInt(selectedMonth),
                                  day,
                                )
                              : true,
                          )
                          .map((day) => {
                            // Calculate total female students present for this day
                            const femaleStudentsPresentCount = students
                              .filter((student) => student.gender === "F")
                              .filter((student) => {
                                const studentAttendance =
                                  attendance[student.user_id] || {};
                                return studentAttendance[day] === "P";
                              }).length;

                            return (
                              <td
                                key={day}
                                className="h-6 py-0.5 px-1 border-r-2 border-black text-center w-10"
                              >
                                {femaleStudentsPresentCount > 0
                                  ? femaleStudentsPresentCount
                                  : ""}
                              </td>
                            );
                          })}
                        <td
                          className="py-0.5 px-1 border-r-2 border-black text-center w-20"
                          colSpan="2"
                        >
                          {/* Total female students present across all days */}
                          {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                            .filter((day) =>
                              selectedMonth && selectedYear
                                ? isWeekday(
                                    selectedYear,
                                    parseInt(selectedMonth),
                                    day,
                                  )
                                : true,
                            )
                            .reduce((total, day) => {
                              const femaleStudentsPresentCount = students
                                .filter((student) => student.gender === "F")
                                .filter((student) => {
                                  const studentAttendance =
                                    attendance[student.user_id] || {};
                                  return studentAttendance[day] === "P";
                                }).length;
                              return total + femaleStudentsPresentCount;
                            }, 0)}
                        </td>
                        <td className="py-0.5 px-4 text-center"></td>
                      </tr>

                      {/* Combined Total Row */}
                      <tr className="bg-white border-b-2 border-black">
                        <td className="py-1 px-3 border-r-2 border-black text-left sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="text-xs uppercase tracking-wider font-semibold">
                            Combined Total Per Day
                          </div>
                        </td>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                          .filter((day) =>
                            selectedMonth && selectedYear
                              ? isWeekday(
                                  selectedYear,
                                  parseInt(selectedMonth),
                                  day,
                                )
                              : true,
                          )
                          .map((day) => {
                            // Calculate total students present for this day (both genders)
                            const totalStudentsPresentCount = students.filter(
                              (student) => {
                                const studentAttendance =
                                  attendance[student.user_id] || {};
                                return studentAttendance[day] === "P";
                              },
                            ).length;

                            return (
                              <td
                                key={day}
                                className="h-6 py-0.5 px-1 border-r-2 border-black text-center w-10"
                              >
                                {totalStudentsPresentCount > 0
                                  ? totalStudentsPresentCount
                                  : ""}
                              </td>
                            );
                          })}
                        <td
                          className="py-0.5 px-1 border-r-2 border-black text-center w-20"
                          colSpan="2"
                        >
                          {/* Total students present across all days */}
                          {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                            .filter((day) =>
                              selectedMonth && selectedYear
                                ? isWeekday(
                                    selectedYear,
                                    parseInt(selectedMonth),
                                    day,
                                  )
                                : true,
                            )
                            .reduce((total, day) => {
                              const totalStudentsPresentCount = students.filter(
                                (student) => {
                                  const studentAttendance =
                                    attendance[student.user_id] || {};
                                  return studentAttendance[day] === "P";
                                },
                              ).length;
                              return total + totalStudentsPresentCount;
                            }, 0)}
                        </td>
                        <td className="py-0.5 px-4 text-center"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {unsavedChanges && (
                  <div className="mt-3 flex justify-start">
                    <button
                      onClick={saveAttendance}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 print:hidden"
                    >
                      Save Changes
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {!selectedSchoolYear
                ? "Please select a school year"
                : !selectedMonth
                  ? "Please select a month"
                  : advisoryClasses.length === 0
                    ? "No advisory classes found for selected school year"
                    : !selectedClass
                      ? "Please select a class"
                      : students.length === 0
                        ? "No students found in this class"
                        : ""}
            </div>
          )}

          {/* Student Status Modal */}
          {showStatusModal && selectedStudent && (
            <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 print:hidden">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full">
                <h2 className="text-xl font-bold mb-4">
                  Update Status: {selectedStudent.fname} {selectedStudent.lname}
                </h2>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="statusType"
                    className="w-full border border-gray-300 rounded p-2"
                    value={statusForm.statusType}
                    onChange={handleStatusFormChange}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {statusForm.statusType === "DROPPED_OUT" && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason
                    </label>
                    <textarea
                      name="reason"
                      className="w-full border border-gray-300 rounded p-2"
                      value={statusForm.reason}
                      onChange={handleStatusFormChange}
                      rows={3}
                    />
                  </div>
                )}

                {(statusForm.statusType === "TRANSFERRED_IN" ||
                  statusForm.statusType === "TRANSFERRED_OUT") && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      School Name
                    </label>
                    <input
                      type="text"
                      name="schoolName"
                      className="w-full border border-gray-300 rounded p-2"
                      value={statusForm.schoolName}
                      onChange={handleStatusFormChange}
                    />
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Effective Date
                  </label>
                  <input
                    type="date"
                    name="effectiveDate"
                    className="w-full border border-gray-300 rounded p-2"
                    value={statusForm.effectiveDate}
                    onChange={handleStatusFormChange}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    onClick={closeStatusModal}
                    className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveStudentStatus}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedClass && students.length > 0 && (
            <div className="mt-8 grid grid-cols-1 gap-8 print:grid-cols-1">
              <div className="border border-gray-800" ref={summaryTableRef}>
                <table className="w-full">
                  <tbody>
                    <tr>
                      <td className="border-r border-b border-gray-800 p-2 w-1/3">
                        <div className="p-2">
                          <h3 className="font-bold text-sm mb-1">
                            1. CODES FOR CHECKING ATTENDANCE
                          </h3>
                          <p className="text-xs mb-1">
                            (✓) - Present, (X) - Absent, (Half-shaded Upper) -
                            Late.
                          </p>

                          <h3 className="font-bold text-sm mt-3 mb-1">
                            2. REASONS/CAUSES FOR DROPPING OUT
                          </h3>
                          <h4 className="text-xs font-bold mb-1">
                            a. Domestic-Related Factors
                          </h4>
                          <p className="text-xs">
                            a.1 Had to take care of siblings
                          </p>
                          <p className="text-xs">
                            a.2 Early marriage/pregnancy
                          </p>
                          <p className="text-xs">
                            a.3 Parents' attitude toward schooling
                          </p>
                          <p className="text-xs">a.4 Family problems</p>

                          <h4 className="text-xs font-bold mt-2 mb-1">
                            b. Individual-Related Factors
                          </h4>
                          <p className="text-xs">b.1 Illness</p>
                          <p className="text-xs">b.2 Overage</p>
                          <p className="text-xs">b.3 Death</p>
                          <p className="text-xs">b.4 Drug Abuse</p>
                          <p className="text-xs">
                            b.5 Poor academic performance
                          </p>
                          <p className="text-xs">
                            b.6 Lack of interest/Distractions
                          </p>
                          <p className="text-xs">b.7 Hunger/Malnutrition</p>

                          <h4 className="text-xs font-bold mt-2 mb-1">
                            c. School-Related Factors
                          </h4>
                          <p className="text-xs">c.1 Teacher Factor</p>
                          <p className="text-xs">
                            c.2 Physical condition of classroom
                          </p>
                          <p className="text-xs">c.3 Peer influence</p>

                          <h4 className="text-xs font-bold mt-2 mb-1">
                            d. Geographic/Environmental
                          </h4>
                          <p className="text-xs">
                            d.1 Distance between home and school
                          </p>
                          <p className="text-xs">
                            d.2 Armed conflict (incl. Tribal wars & clanfeuds)
                          </p>
                          <p className="text-xs">d.3 Calamities/Disasters</p>

                          <h4 className="text-xs font-bold mt-2 mb-1">
                            e. Financial-Related
                          </h4>
                          <p className="text-xs">e.1 Child labor, work</p>

                          <h4 className="text-xs font-bold mt-2 mb-1">
                            f. Others (Specify)
                          </h4>
                        </div>
                      </td>

                      <td className="p-2 align-top w-2/3">
                        <div className="relative">
                          <h3
                            className="font-bold text-sm mb-2 hover:text-blue-600 cursor-help"
                            onMouseEnter={() => setShowGuidelines(true)}
                            onMouseLeave={() => setShowGuidelines(false)}
                          >
                            GUIDELINES
                          </h3>
                          {showGuidelines && (
                            <div className="absolute z-20 top-6 left-0 bg-white border border-gray-300 shadow-lg p-3 rounded-md w-full text-xs">
                              <p className="font-bold mb-1">GUIDELINES:</p>
                              <ol className="list-decimal pl-5 space-y-1">
                                <li>
                                  The attendance shall be accomplished daily.
                                  Refer to the codes for checking learners'
                                  attendance.
                                </li>
                                <li>
                                  Dates shall be written in the columns after
                                  Learner's Name.
                                </li>
                                <li>
                                  To compute the following:
                                  <ol className="list-[lower-alpha] pl-5 space-y-1 pt-1">
                                    <li className="flex flex-col">
                                      <span>Percentage of Enrollment =</span>
                                      <div className="flex items-center my-1 w-full">
                                        <div className="flex flex-col items-center">
                                          <div className="border-b border-black text-center w-64">
                                            Registered Learners as of end of the
                                            month
                                          </div>
                                          <div className="text-center w-64">
                                            Enrollment as of 1st Friday of the
                                            school year
                                          </div>
                                        </div>
                                        <span className="ml-2">x 100</span>
                                      </div>
                                    </li>
                                    <li className="flex flex-col">
                                      <span>Average Daily Attendance =</span>
                                      <div className="flex items-center my-1 w-full">
                                        <div className="flex flex-col items-center">
                                          <div className="border-b border-black text-center w-64">
                                            Total Daily Attendance
                                          </div>
                                          <div className="text-center w-64">
                                            Number of School Days in reporting
                                            month
                                          </div>
                                        </div>
                                      </div>
                                    </li>
                                    <li className="flex flex-col">
                                      <span>
                                        Percentage of Attendance for the month =
                                      </span>
                                      <div className="flex items-center my-1 w-full">
                                        <div className="flex flex-col items-center">
                                          <div className="border-b border-black text-center w-64">
                                            Average daily attendance
                                          </div>
                                          <div className="text-center w-64">
                                            Registered Learners as of end of the
                                            month
                                          </div>
                                        </div>
                                        <span className="ml-2">x 100</span>
                                      </div>
                                    </li>
                                  </ol>
                                </li>
                                <li>
                                  Every end of the month, the class adviser will
                                  submit this form to the office of the
                                  principal for recording of summary table into
                                  School Form 4. Once signed by the principal,
                                  this form should be returned to the adviser.
                                </li>
                                <li>
                                  The adviser will provide necessary
                                  interventions including but not limited to
                                  home visitation to learners who were absent
                                  for 5 consecutive days and/or those at risk of
                                  dropping out.
                                </li>
                                <li>
                                  Attendance performance of learners will be
                                  reflected in Form 137 and Form 138 every
                                  grading period.
                                </li>
                              </ol>
                              <p className="mt-1">
                                * Beginning of School Year cut-off report is
                                every 1st Friday of the School Year
                              </p>
                            </div>
                          )}
                        </div>
                        <table className="w-full mt-2 border-collapse">
                          <thead>
                            <tr>
                              <th
                                className="border border-black p-1 text-sm font-normal text-center"
                                style={{ width: "40%" }}
                                rowSpan="2"
                              >
                                <div>
                                  Month:{" "}
                                  {selectedMonth
                                    ? months.find(
                                        (m) => m.value === selectedMonth,
                                      )?.label || ""
                                    : ""}
                                </div>
                              </th>
                              <th
                                className="border border-black p-1 text-sm font-normal text-center"
                                style={{ width: "25%" }}
                                rowSpan="2"
                              >
                                <div>
                                  No. of Days of Classes:
                                  <span className="print:inline hidden">
                                    {" "}
                                    {totalSchoolDays}
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="31"
                                    className="ml-1 w-10 border-none bg-transparent text-center print:hidden"
                                    value={totalSchoolDays}
                                    onChange={(e) => {
                                      const value =
                                        parseInt(e.target.value) || 0;
                                      setTotalSchoolDays(value);
                                      setUnsavedChanges(true);
                                    }}
                                  />
                                </div>
                              </th>
                              <th
                                colSpan="3"
                                className="border border-black p-1 text-sm font-normal text-center"
                              >
                                Summary
                              </th>
                            </tr>
                            <tr>
                              <th className="border border-black p-1 text-center text-xs w-8">
                                M
                              </th>
                              <th className="border border-black p-1 text-center text-xs w-8">
                                F
                              </th>
                              <th className="border border-black p-1 text-center text-xs w-12">
                                TOTAL
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td
                                className="border border-black p-1 text-sm font-normal text-center"
                                colSpan="2"
                              >
                                * Enrollment as of (1st Friday of June)
                              </td>
                              <td className="border border-black p-1 text-center">
                                {enrollmentStart.male}
                              </td>
                              <td className="border border-black p-1 text-center">
                                {enrollmentStart.female}
                              </td>
                              <td className="border border-black p-1 text-center">
                                {enrollmentStart.total}
                              </td>
                            </tr>
                            <tr>
                              <td
                                className="border border-black p-1 text-sm font-normal text-center"
                                colSpan="2"
                              >
                                Late Enrollment{" "}
                                <i>during the month (beyond cut-off)</i>
                              </td>
                              <td className="border border-black p-1 text-center">
                                {lateEnrollment.male}
                              </td>
                              <td className="border border-black p-1 text-center">
                                {lateEnrollment.female}
                              </td>
                              <td className="border border-black p-1 text-center">
                                {lateEnrollment.total}
                              </td>
                            </tr>
                            <tr>
                              <td
                                className="border border-black p-1 text-sm font-normal text-center"
                                colSpan="2"
                              >
                                Registered Learners as of end of the month
                              </td>
                              <td className="border border-black p-1 text-center">
                                {registeredLearners.male}
                              </td>
                              <td className="border border-black p-1 text-center">
                                {registeredLearners.female}
                              </td>
                              <td className="border border-black p-1 text-center">
                                {registeredLearners.total}
                              </td>
                            </tr>
                            <tr>
                              <td
                                className="border border-black p-1 text-sm font-normal text-center"
                                colSpan="2"
                              >
                                Percentage of Enrollment as of end of the month
                              </td>
                              <td className="border border-black p-1 text-center">
                                {calculatePercentageOfEnrollment().male}%
                              </td>
                              <td className="border border-black p-1 text-center">
                                {calculatePercentageOfEnrollment().female}%
                              </td>
                              <td className="border border-black p-1 text-center">
                                {calculatePercentageOfEnrollment().total}%
                              </td>
                            </tr>
                            <tr>
                              <td
                                className="border border-black p-1 text-sm font-normal text-center"
                                colSpan="2"
                              >
                                Average Daily Attendance
                              </td>
                              <td className="border border-black p-1 text-center">
                                {averageDailyAttendance.male}
                              </td>
                              <td className="border border-black p-1 text-center">
                                {averageDailyAttendance.female}
                              </td>
                              <td className="border border-black p-1 text-center">
                                {averageDailyAttendance.total}
                              </td>
                            </tr>
                            <tr>
                              <td
                                className="border border-black p-1 text-sm font-normal text-center"
                                colSpan="2"
                              >
                                Percentage of Attendance for the month
                              </td>
                              <td className="border border-black p-1 text-center">
                                {calculatePercentageOfAttendance().male}%
                              </td>
                              <td className="border border-black p-1 text-center">
                                {calculatePercentageOfAttendance().female}%
                              </td>
                              <td className="border border-black p-1 text-center">
                                {calculatePercentageOfAttendance().total}%
                              </td>
                            </tr>
                            <tr>
                              <td
                                className="border border-black p-1 text-sm font-normal text-center"
                                colSpan="2"
                              >
                                Number of students absent for 5 consecutive
                                days:
                              </td>
                              <td className="border border-black p-1 text-center relative group">
                                {consecutiveAbsences.male > 0 ? (
                                  <div className="cursor-help">
                                    {consecutiveAbsences.male}
                                    <div
                                      className="absolute z-10 bg-gray-800 text-white p-2 rounded text-xs w-48 
                                                 bottom-full left-1/2 transform -translate-x-1/2 mb-1
                                                 hidden group-hover:block print:hidden"
                                    >
                                      <p className="font-bold mb-1">
                                        Male students with 5+ consecutive
                                        absences:
                                      </p>
                                      <ul className="list-disc pl-4">
                                        {consecutiveAbsences.students
                                          .filter(
                                            (student) => student.gender === "M",
                                          )
                                          .map((student) => (
                                            <li key={student.id}>
                                              {student.name} (
                                              {student.consecutiveDays} days)
                                            </li>
                                          ))}
                                      </ul>
                                    </div>
                                  </div>
                                ) : (
                                  consecutiveAbsences.male
                                )}
                              </td>
                              <td className="border border-black p-1 text-center relative group">
                                {consecutiveAbsences.female > 0 ? (
                                  <div className="cursor-help">
                                    {consecutiveAbsences.female}
                                    <div
                                      className="absolute z-10 bg-gray-800 text-white p-2 rounded text-xs w-48 
                                                 bottom-full left-1/2 transform -translate-x-1/2 mb-1
                                                 hidden group-hover:block print:hidden"
                                    >
                                      <p className="font-bold mb-1">
                                        Female students with 5+ consecutive
                                        absences:
                                      </p>
                                      <ul className="list-disc pl-4">
                                        {consecutiveAbsences.students
                                          .filter(
                                            (student) => student.gender === "F",
                                          )
                                          .map((student) => (
                                            <li key={student.id}>
                                              {student.name} (
                                              {student.consecutiveDays} days)
                                            </li>
                                          ))}
                                      </ul>
                                    </div>
                                  </div>
                                ) : (
                                  consecutiveAbsences.female
                                )}
                              </td>
                              <td className="border border-black p-1 text-center relative group">
                                {consecutiveAbsences.total > 0 ? (
                                  <div className="cursor-help">
                                    {consecutiveAbsences.total}
                                    <div
                                      className="absolute z-10 bg-gray-800 text-white p-2 rounded text-xs w-48 
                                                 bottom-full left-1/2 transform -translate-x-1/2 mb-1
                                                 hidden group-hover:block print:hidden"
                                    >
                                      <p className="font-bold mb-1">
                                        All students with 5+ consecutive
                                        absences:
                                      </p>
                                      <ul className="list-disc pl-4">
                                        {consecutiveAbsences.students.map(
                                          (student) => (
                                            <li key={student.id}>
                                              {student.name} (
                                              {student.consecutiveDays} days)
                                            </li>
                                          ),
                                        )}
                                      </ul>
                                    </div>
                                  </div>
                                ) : (
                                  consecutiveAbsences.total
                                )}
                              </td>
                            </tr>
                            <tr>
                              <td
                                className="border border-black p-1 text-sm font-normal text-center"
                                colSpan="2"
                              >
                                Drop out
                              </td>
                              <td className="border border-black p-1 text-center">
                                {
                                  Object.values(studentStatuses).filter(
                                    (s) =>
                                      s.status_type === "DROPPED_OUT" &&
                                      students.find(
                                        (st) => st.user_id === s.student_id,
                                      )?.gender === "M",
                                  ).length
                                }
                              </td>
                              <td className="border border-black p-1 text-center">
                                {
                                  Object.values(studentStatuses).filter(
                                    (s) =>
                                      s.status_type === "DROPPED_OUT" &&
                                      students.find(
                                        (st) => st.user_id === s.student_id,
                                      )?.gender === "F",
                                  ).length
                                }
                              </td>
                              <td className="border border-black p-1 text-center">
                                {
                                  Object.values(studentStatuses).filter(
                                    (s) => s.status_type === "DROPPED_OUT",
                                  ).length
                                }
                              </td>
                            </tr>
                            <tr>
                              <td
                                className="border border-black p-1 text-sm font-normal text-center"
                                colSpan="2"
                              >
                                Transferred out
                              </td>
                              <td className="border border-black p-1 text-center">
                                {
                                  Object.values(studentStatuses).filter(
                                    (s) =>
                                      s.status_type === "TRANSFERRED_OUT" &&
                                      students.find(
                                        (st) => st.user_id === s.student_id,
                                      )?.gender === "M",
                                  ).length
                                }
                              </td>
                              <td className="border border-black p-1 text-center">
                                {
                                  Object.values(studentStatuses).filter(
                                    (s) =>
                                      s.status_type === "TRANSFERRED_OUT" &&
                                      students.find(
                                        (st) => st.user_id === s.student_id,
                                      )?.gender === "F",
                                  ).length
                                }
                              </td>
                              <td className="border border-black p-1 text-center">
                                {
                                  Object.values(studentStatuses).filter(
                                    (s) => s.status_type === "TRANSFERRED_OUT",
                                  ).length
                                }
                              </td>
                            </tr>
                            <tr>
                              <td
                                className="border border-black p-1 text-sm font-normal text-center"
                                colSpan="2"
                              >
                                Transferred in
                              </td>
                              <td className="border border-black p-1 text-center">
                                {
                                  Object.values(studentStatuses).filter(
                                    (s) =>
                                      s.status_type === "TRANSFERRED_IN" &&
                                      students.find(
                                        (st) => st.user_id === s.student_id,
                                      )?.gender === "M",
                                  ).length
                                }
                              </td>
                              <td className="border border-black p-1 text-center">
                                {
                                  Object.values(studentStatuses).filter(
                                    (s) =>
                                      s.status_type === "TRANSFERRED_IN" &&
                                      students.find(
                                        (st) => st.user_id === s.student_id,
                                      )?.gender === "F",
                                  ).length
                                }
                              </td>
                              <td className="border border-black p-1 text-center">
                                {
                                  Object.values(studentStatuses).filter(
                                    (s) => s.status_type === "TRANSFERRED_IN",
                                  ).length
                                }
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <div className="mt-4 text-left pl-4 text-sm">
                          I certify that this is a true and correct report.
                        </div>
                        <div className="mt-6 text-center">
                          <div className="font-semibold text-center text-base mb-1">
                            <span className="border-b border-black">
                              {teacher
                                ? `${teacher.fname} ${teacher.mname ? teacher.mname + " " : ""}${teacher.lname}`
                                : ""}
                            </span>
                          </div>
                          <div className="font-medium pt-1">Class Adviser</div>
                        </div>
                        <div className="mt-4 text-left pl-4 text-sm">
                          Attested by:
                        </div>
                        <div className="mt-6 text-center mb-2">
                          <div className="font-semibold text-center text-base mb-1">
                            <span className="border-b border-black">
                              Charmaine Canonizado-Chang
                            </span>
                          </div>
                          <div className="font-medium pt-1">
                            School President
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Add Clear Day Confirmation Modal */}
          {showClearDayModal && dayToClear && (
            <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 print:hidden">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
                <h2 className="text-xl font-bold mb-4 text-gray-800">
                  Clear Attendance Records
                </h2>
                <p className="mb-6 text-gray-600">
                  Are you sure you want to clear all attendance records for day{" "}
                  <strong>{dayToClear}</strong>?
                  {getDayOfWeekAbbr(
                    selectedYear,
                    parseInt(selectedMonth),
                    dayToClear,
                  ) === "Sat" ||
                  getDayOfWeekAbbr(
                    selectedYear,
                    parseInt(selectedMonth),
                    dayToClear,
                  ) === "Sun" ? (
                    <span className="block mt-2 text-blue-600 font-medium">
                      Note: This is a{" "}
                      {getDayOfWeekAbbr(
                        selectedYear,
                        parseInt(selectedMonth),
                        dayToClear,
                      )}
                      . Weekend attendance is now included in tracking.
                    </span>
                  ) : null}
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={closeClearDayModal}
                    className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => clearAttendanceForDay(dayToClear)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Clear Day
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Print Button at the bottom of the page */}
      <div className="mt-6 flex flex-col items-center print:hidden">
        <button
          onClick={handlePrint}
          disabled={!selectedClass || students.length === 0}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-8 rounded-md flex items-center justify-center space-x-3 shadow-md transition-all duration-200 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70"
          title={
            !selectedClass
              ? "No class selected"
              : students.length === 0
                ? "No students to print"
                : "Print attendance report"
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
          <span>Print Attendance Report</span>
        </button>
        <div className="text-gray-500 text-sm mt-2">
          Click to download the attendance report as a PDF file.
        </div>
      </div>

      {/* Hidden PDF Template that will only be shown during PDF generation */}
      {selectedClass && students.length > 0 && (
        <AttendancePdfTemplate
          schoolInfo={schoolInfo}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          selectedClass={selectedClass}
          teacher={teacher}
          students={students}
          attendance={attendance}
          months={months}
          totalSchoolDays={totalSchoolDays}
          enrollmentStart={enrollmentStart}
          lateEnrollment={lateEnrollment}
          registeredLearners={registeredLearners}
          averageDailyAttendance={averageDailyAttendance}
          consecutiveAbsences={consecutiveAbsences}
          studentStatuses={studentStatuses}
          daysInMonth={daysInMonth}
          getStatusDisplay={getStatusDisplay}
          getDayOfWeekAbbr={getDayOfWeekAbbr}
          getRemarksText={getRemarksText}
          calculatePercentageOfEnrollment={calculatePercentageOfEnrollment}
          calculatePercentageOfAttendance={calculatePercentageOfAttendance}
        />
      )}
    </div>
  );
};

export default Attendance;
