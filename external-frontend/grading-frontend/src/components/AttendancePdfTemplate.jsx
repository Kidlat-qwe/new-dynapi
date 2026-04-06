import React from "react";

const AttendancePdfTemplate = ({
  schoolInfo,
  selectedMonth,
  selectedYear,
  selectedClass,
  teacher,
  students,
  attendance,
  months,
  totalSchoolDays,
  enrollmentStart,
  lateEnrollment,
  registeredLearners,
  averageDailyAttendance,
  consecutiveAbsences,
  studentStatuses,
  daysInMonth,
  getStatusDisplay,
  getDayOfWeekAbbr,
  getRemarksText,
  calculatePercentageOfEnrollment,
  calculatePercentageOfAttendance,
}) => {
  // Helper functions for the template
  const getAbsentCount = (studentId) => {
    const studentAttendance = attendance[studentId] || {};
    return Object.values(studentAttendance).filter((status) => status === "A")
      .length;
  };

  const getLateCount = (studentId) => {
    const studentAttendance = attendance[studentId] || {};
    return Object.values(studentAttendance).filter((status) => status === "L")
      .length;
  };

  const getPresentCountForDay = (day, gender) => {
    return students
      .filter((student) => (gender ? student.gender === gender : true))
      .filter((student) => {
        const studentAttendance = attendance[student.user_id] || {};
        return studentAttendance[day] === "P";
      }).length;
  };

  const getTotalPresent = (gender) => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1).reduce(
      (total, day) => {
        return total + getPresentCountForDay(day, gender);
      },
      0,
    );
  };

  const monthName = selectedMonth
    ? months.find((m) => m.value === selectedMonth)?.label || ""
    : "";

  // Custom function to render the attendance status value
  const renderAttendanceValue = (status) => {
    if (status === "P") return ""; // Changed from 'P' to empty string for present
    if (status === "A") return "X"; // Changed from 'XX' to 'X' for absent to match the user's request
    return ""; // Empty for late (will use diagonal shading)
  };

  const isWeekday = (year, month, day) => {
    // Modified to include all days (including Saturday and Sunday) as requested by client
    return true; // Return true for all days to include weekends
  };

  return (
    <div className="pdf-template">
      {/* First Page - Attendance Table */}
      <div className="first-page">
        {/* Header Section */}
        <div
          className="header-grid"
          style={{ marginTop: "5px", marginBottom: "12px" }}
        >
          <div className="header-item">
            <div className="header-label" style={{ marginBottom: "2px" }}>
              REGION:
            </div>
            <div
              className="header-value"
              style={{
                padding: "4px 8px",
                minHeight: "22px",
                display: "inline-block",
                width: "auto",
                fontSize: "1.1rem",
              }}
            >
              {schoolInfo.region}
            </div>
          </div>
          <div className="header-item">
            <div className="header-label" style={{ marginBottom: "2px" }}>
              DIVISION:
            </div>
            <div
              className="header-value"
              style={{
                padding: "4px 8px",
                minHeight: "22px",
                display: "inline-block",
                width: "auto",
                fontSize: "1.1rem",
              }}
            >
              {schoolInfo.division}
            </div>
          </div>
          <div className="header-item">
            <div className="header-label" style={{ marginBottom: "2px" }}>
              DISTRICT:
            </div>
            <div
              className="header-value"
              style={{
                padding: "4px 8px",
                minHeight: "22px",
                display: "inline-block",
                width: "auto",
                fontSize: "1.1rem",
              }}
            >
              {schoolInfo.district}
            </div>
          </div>
          <div className="header-item">
            <div className="header-label" style={{ marginBottom: "2px" }}>
              SCHOOL ID:
            </div>
            <div
              className="header-value"
              style={{
                padding: "4px 8px",
                minHeight: "22px",
                display: "inline-block",
                width: "auto",
                fontSize: "1.1rem",
              }}
            >
              {schoolInfo.schoolId}
            </div>
          </div>
          <div className="header-item">
            <div className="header-label" style={{ marginBottom: "2px" }}>
              SCHOOL NAME:
            </div>
            <div
              className="header-value"
              style={{
                padding: "4px 8px",
                minHeight: "22px",
                display: "inline-block",
                width: "auto",
                fontSize: "1.1rem",
              }}
            >
              {schoolInfo.schoolName}
            </div>
          </div>
          <div className="header-item">
            <div className="header-label" style={{ marginBottom: "2px" }}>
              SCHOOL YEAR:
            </div>
            <div
              className="header-value"
              style={{
                padding: "4px 8px",
                minHeight: "22px",
                display: "inline-block",
                width: "auto",
                fontSize: "1.1rem",
              }}
            >
              {selectedClass && selectedClass.school_year}
            </div>
          </div>
          <div className="header-item">
            <div className="header-label" style={{ marginBottom: "2px" }}>
              MONTH:
            </div>
            <div
              className="header-value"
              style={{
                padding: "4px 8px",
                minHeight: "22px",
                display: "inline-block",
                width: "auto",
                fontSize: "1.1rem",
              }}
            >
              {monthName}
            </div>
          </div>
          <div className="header-item">
            <div className="header-label" style={{ marginBottom: "2px" }}>
              GRADE & SECTION:
            </div>
            <div
              className="header-value"
              style={{
                padding: "4px 8px",
                minHeight: "22px",
                display: "inline-block",
                width: "auto",
                fontSize: "1.1rem",
              }}
            >
              {selectedClass &&
                `Grade ${selectedClass.grade_level} - ${selectedClass.section}`}
            </div>
          </div>
          <div className="header-item">
            <div className="header-label" style={{ marginBottom: "2px" }}>
              ADVISER:
            </div>
            <div
              className="header-value"
              style={{
                padding: "4px 8px",
                minHeight: "22px",
                display: "inline-block",
                width: "auto",
                fontSize: "1.1rem",
              }}
            >
              {teacher &&
                `${teacher.fname} ${teacher.mname ? teacher.mname + " " : ""}${teacher.lname}`}
            </div>
          </div>
        </div>

        {/* Attendance Table */}
        <table className="attendance-table">
          <thead>
            <tr>
              <th
                rowSpan="2"
                className="name-column"
                style={{ width: "15%", fontSize: "1.1rem" }}
              >
                Learner's Name
              </th>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                .filter((day) =>
                  selectedMonth && selectedYear
                    ? isWeekday(selectedYear, parseInt(selectedMonth), day)
                    : true,
                )
                .map((day) => (
                  <th key={day} className="day-column">
                    {day}
                  </th>
                ))}
              <th colSpan="2" className="total-header">
                TOTAL
              </th>
              <th
                rowSpan="2"
                className="remarks-column"
                style={{ width: "18%" }}
              >
                <div>REMARKS</div>
                <div className="remarks-subtext">
                  (If DROPPED OUT, state reason; If TRANSFERRED IN/OUT, write
                  school name)
                </div>
              </th>
            </tr>
            <tr>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                .filter((day) =>
                  selectedMonth && selectedYear
                    ? isWeekday(selectedYear, parseInt(selectedMonth), day)
                    : true,
                )
                .map((day) => (
                  <th key={`day-${day}`} className="day-abbr">
                    {selectedMonth && selectedYear
                      ? getDayOfWeekAbbr(
                          selectedYear,
                          parseInt(selectedMonth),
                          day,
                        )
                      : "-"}
                  </th>
                ))}
              <th className="total-column absent-column">Absent</th>
              <th className="total-column late-column">Late</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const absentCount = getAbsentCount(student.user_id);
              const lateCount = getLateCount(student.user_id);

              return (
                <tr key={student.user_id} className="student-row">
                  <td
                    className="student-name"
                    style={{
                      textAlign: "left",
                      paddingLeft: "10px",
                      fontSize: "1.1rem",
                      paddingBottom: "5px",
                      paddingTop: "5px",
                    }}
                  >
                    {student.lname}, {student.fname}{" "}
                    {student.mname ? student.mname : ""}
                  </td>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                    .filter((day) =>
                      selectedMonth && selectedYear
                        ? isWeekday(selectedYear, parseInt(selectedMonth), day)
                        : true,
                    )
                    .map((day) => {
                      const status = (attendance[student.user_id] || {})[day];
                      const displayValue = renderAttendanceValue(status);

                      let cellClassName = "day-cell";
                      if (status === "L") cellClassName += " diagonal-shade";

                      return (
                        <td
                          key={day}
                          className={cellClassName}
                          style={
                            status === "L"
                              ? { position: "relative", overflow: "hidden" }
                              : {}
                          }
                        >
                          {displayValue}
                          {status === "L" && (
                            <div
                              style={{
                                position: "absolute",
                                top: "0",
                                left: "0",
                                width: "100%",
                                height: "100%",
                                background:
                                  "linear-gradient(to bottom right, black 49.5%, transparent 50.5%)",
                                zIndex: "2",
                              }}
                            ></div>
                          )}
                        </td>
                      );
                    })}
                  <td className="total-value">{absentCount}</td>
                  <td className="total-value">{lateCount}</td>
                  <td className="remarks-cell">
                    {getRemarksText(student.user_id)}
                  </td>
                </tr>
              );
            })}

            {/* Male Total Row */}
            <tr className="summary-row male-row">
              <td
                className="summary-label"
                style={{
                  fontSize: "0.95rem",
                  paddingBottom: "5px",
                  paddingTop: "5px",
                }}
              >
                MALE | TOTAL PER DAY
              </td>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                .filter((day) =>
                  selectedMonth && selectedYear
                    ? isWeekday(selectedYear, parseInt(selectedMonth), day)
                    : true,
                )
                .map((day) => (
                  <td key={day} className="summary-cell">
                    {getPresentCountForDay(day, "M") > 0
                      ? getPresentCountForDay(day, "M")
                      : ""}
                  </td>
                ))}
              <td colSpan="2" className="total-summary">
                {getTotalPresent("M")}
              </td>
              <td></td>
            </tr>

            {/* Female Total Row */}
            <tr className="summary-row female-row">
              <td
                className="summary-label"
                style={{
                  fontSize: "0.95rem",
                  paddingBottom: "5px",
                  paddingTop: "5px",
                }}
              >
                FEMALE | TOTAL PER DAY
              </td>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                .filter((day) =>
                  selectedMonth && selectedYear
                    ? isWeekday(selectedYear, parseInt(selectedMonth), day)
                    : true,
                )
                .map((day) => (
                  <td key={day} className="summary-cell">
                    {getPresentCountForDay(day, "F") > 0
                      ? getPresentCountForDay(day, "F")
                      : ""}
                  </td>
                ))}
              <td colSpan="2" className="total-summary">
                {getTotalPresent("F")}
              </td>
              <td></td>
            </tr>

            {/* Combined Total Row */}
            <tr className="summary-row combined-row">
              <td
                className="summary-label"
                style={{
                  fontSize: "0.95rem",
                  paddingBottom: "5px",
                  paddingTop: "5px",
                }}
              >
                COMBINED TOTAL PER DAY
              </td>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                .filter((day) =>
                  selectedMonth && selectedYear
                    ? isWeekday(selectedYear, parseInt(selectedMonth), day)
                    : true,
                )
                .map((day) => (
                  <td key={day} className="summary-cell">
                    {getPresentCountForDay(day) > 0
                      ? getPresentCountForDay(day)
                      : ""}
                  </td>
                ))}
              <td colSpan="2" className="total-summary">
                {getTotalPresent()}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Second Page - Guidelines and Summary */}
      <div className="second-page">
        <table className="guidelines-table">
          <tbody>
            <tr>
              <td className="guidelines-section">
                <div
                  className="guidelines-content"
                  style={{ fontSize: "1.1rem" }}
                >
                  <h3 className="section-title" style={{ fontSize: "1.2rem" }}>
                    1. CODES FOR CHECKING ATTENDANCE
                  </h3>
                  <p className="code-definition">
                    (Blank) - Present, (X) - Absent, (Half-shaded Upper) - Late.
                  </p>

                  <h3 className="section-title" style={{ fontSize: "1.2rem" }}>
                    2. REASONS/CAUSES FOR DROPPING OUT
                  </h3>
                  <h4
                    className="subsection-title"
                    style={{ fontSize: "1.15rem" }}
                  >
                    a. Domestic-Related Factors
                  </h4>
                  <p className="reason-item">
                    a.1 Had to take care of siblings
                  </p>
                  <p className="reason-item">a.2 Early marriage/pregnancy</p>
                  <p className="reason-item">
                    a.3 Parents' attitude toward schooling
                  </p>
                  <p className="reason-item">a.4 Family problems</p>

                  <h4
                    className="subsection-title"
                    style={{ fontSize: "1.15rem" }}
                  >
                    b. Individual-Related Factors
                  </h4>
                  <p className="reason-item">b.1 Illness</p>
                  <p className="reason-item">b.2 Overage</p>
                  <p className="reason-item">b.3 Death</p>
                  <p className="reason-item">b.4 Drug Abuse</p>
                  <p className="reason-item">b.5 Poor academic performance</p>
                  <p className="reason-item">
                    b.6 Lack of interest/Distractions
                  </p>
                  <p className="reason-item">b.7 Hunger/Malnutrition</p>

                  <h4
                    className="subsection-title"
                    style={{ fontSize: "1.15rem" }}
                  >
                    c. School-Related Factors
                  </h4>
                  <p className="reason-item">c.1 Teacher Factor</p>
                  <p className="reason-item">
                    c.2 Physical condition of classroom
                  </p>
                  <p className="reason-item">c.3 Peer influence</p>

                  <h4
                    className="subsection-title"
                    style={{ fontSize: "1.15rem" }}
                  >
                    d. Geographic/Environmental
                  </h4>
                  <p className="reason-item">
                    d.1 Distance between home and school
                  </p>
                  <p className="reason-item">
                    d.2 Armed conflict (incl. Tribal wars & clanfeuds)
                  </p>
                  <p className="reason-item">d.3 Calamities/Disasters</p>

                  <h4
                    className="subsection-title"
                    style={{ fontSize: "1.15rem" }}
                  >
                    e. Financial-Related
                  </h4>
                  <p className="reason-item">e.1 Child labor, work</p>

                  <h4
                    className="subsection-title"
                    style={{ fontSize: "1.15rem" }}
                  >
                    f. Others (Specify)
                  </h4>
                </div>
              </td>
              <td className="stats-section">
                <h3
                  className="section-title pdf-hide"
                  style={{ fontSize: "1.2rem" }}
                >
                  GUIDELINES
                </h3>

                <table className="stats-table" style={{ fontSize: "1.1rem" }}>
                  <thead>
                    <tr>
                      <th
                        className="stats-header"
                        style={{ width: "40%", fontSize: "1.1rem" }}
                        rowSpan="2"
                      >
                        Month: {monthName}
                      </th>
                      <th
                        className="stats-header"
                        style={{ width: "25%", fontSize: "1.1rem" }}
                        rowSpan="2"
                      >
                        No. of Days of Classes: {totalSchoolDays}
                      </th>
                      <th
                        colSpan="3"
                        className="stats-header"
                        style={{ fontSize: "1.1rem" }}
                      >
                        Summary
                      </th>
                    </tr>
                    <tr>
                      <th
                        className="gender-header"
                        style={{ fontSize: "1.1rem" }}
                      >
                        M
                      </th>
                      <th
                        className="gender-header"
                        style={{ fontSize: "1.1rem" }}
                      >
                        F
                      </th>
                      <th
                        className="gender-header"
                        style={{ fontSize: "1.1rem" }}
                      >
                        TOTAL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td
                        className="stats-label"
                        colSpan="2"
                        style={{ fontSize: "1.1rem" }}
                      >
                        * Enrollment as of (1st Friday of June)
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {enrollmentStart.male}
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {enrollmentStart.female}
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {enrollmentStart.total}
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="stats-label"
                        colSpan="2"
                        style={{ fontSize: "1.1rem" }}
                      >
                        Late Enrollment <i>during the month (beyond cut-off)</i>
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {lateEnrollment.male}
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {lateEnrollment.female}
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {lateEnrollment.total}
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="stats-label"
                        colSpan="2"
                        style={{ fontSize: "1.1rem" }}
                      >
                        Registered Learners as of end of the month
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {registeredLearners.male}
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {registeredLearners.female}
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {registeredLearners.total}
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="stats-label"
                        colSpan="2"
                        style={{ fontSize: "1.1rem" }}
                      >
                        Percentage of Enrollment as of end of the month
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {calculatePercentageOfEnrollment().male}%
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {calculatePercentageOfEnrollment().female}%
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {calculatePercentageOfEnrollment().total}%
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="stats-label"
                        colSpan="2"
                        style={{ fontSize: "1.1rem" }}
                      >
                        Average Daily Attendance
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {averageDailyAttendance.male}
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {averageDailyAttendance.female}
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {averageDailyAttendance.total}
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="stats-label"
                        colSpan="2"
                        style={{ fontSize: "1.1rem" }}
                      >
                        Percentage of Attendance for the month
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {calculatePercentageOfAttendance().male}%
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {calculatePercentageOfAttendance().female}%
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {calculatePercentageOfAttendance().total}%
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="stats-label"
                        colSpan="2"
                        style={{ fontSize: "1.1rem" }}
                      >
                        Number of students absent for 5 consecutive days:
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {consecutiveAbsences.male}
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {consecutiveAbsences.female}
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {consecutiveAbsences.total}
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="stats-label"
                        colSpan="2"
                        style={{ fontSize: "1.1rem" }}
                      >
                        Drop out
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {
                          Object.values(studentStatuses).filter(
                            (s) =>
                              s.status_type === "DROPPED_OUT" &&
                              students.find((st) => st.user_id === s.student_id)
                                ?.gender === "M",
                          ).length
                        }
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {
                          Object.values(studentStatuses).filter(
                            (s) =>
                              s.status_type === "DROPPED_OUT" &&
                              students.find((st) => st.user_id === s.student_id)
                                ?.gender === "F",
                          ).length
                        }
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {
                          Object.values(studentStatuses).filter(
                            (s) => s.status_type === "DROPPED_OUT",
                          ).length
                        }
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="stats-label"
                        colSpan="2"
                        style={{ fontSize: "1.1rem" }}
                      >
                        Transferred out
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {
                          Object.values(studentStatuses).filter(
                            (s) =>
                              s.status_type === "TRANSFERRED_OUT" &&
                              students.find((st) => st.user_id === s.student_id)
                                ?.gender === "M",
                          ).length
                        }
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {
                          Object.values(studentStatuses).filter(
                            (s) =>
                              s.status_type === "TRANSFERRED_OUT" &&
                              students.find((st) => st.user_id === s.student_id)
                                ?.gender === "F",
                          ).length
                        }
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {
                          Object.values(studentStatuses).filter(
                            (s) => s.status_type === "TRANSFERRED_OUT",
                          ).length
                        }
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="stats-label"
                        colSpan="2"
                        style={{ fontSize: "1.1rem" }}
                      >
                        Transferred in
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {
                          Object.values(studentStatuses).filter(
                            (s) =>
                              s.status_type === "TRANSFERRED_IN" &&
                              students.find((st) => st.user_id === s.student_id)
                                ?.gender === "M",
                          ).length
                        }
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {
                          Object.values(studentStatuses).filter(
                            (s) =>
                              s.status_type === "TRANSFERRED_IN" &&
                              students.find((st) => st.user_id === s.student_id)
                                ?.gender === "F",
                          ).length
                        }
                      </td>
                      <td
                        className="stats-value"
                        style={{ fontSize: "1.1rem" }}
                      >
                        {
                          Object.values(studentStatuses).filter(
                            (s) => s.status_type === "TRANSFERRED_IN",
                          ).length
                        }
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="certification" style={{ fontSize: "1.1rem" }}>
                  <p className="certification-text">
                    I certify that this is a true and correct report.
                  </p>

                  <div className="signature-block">
                    <div
                      className="signature-name"
                      style={{ fontSize: "1.15rem" }}
                    >
                      {teacher
                        ? `${teacher.fname} ${teacher.mname ? teacher.mname + " " : ""}${teacher.lname}`
                        : ""}
                    </div>
                    <div
                      className="signature-title"
                      style={{ fontSize: "1.1rem" }}
                    >
                      Class Adviser
                    </div>
                  </div>

                  <p className="attestation-text">Attested by:</p>

                  <div className="signature-block">
                    <div
                      className="signature-name"
                      style={{ fontSize: "1.15rem" }}
                    >
                      Charmaine Canonizado-Chang
                    </div>
                    <div
                      className="signature-title"
                      style={{ fontSize: "1.1rem" }}
                    >
                      School Head
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendancePdfTemplate;
