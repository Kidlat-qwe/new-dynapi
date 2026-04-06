import React from "react";

const GradesPdfTemplate = ({
  schoolInfo = {},
  classData = {},
  students = [],
  activities = {},
  gradingCriteria = {},
  quarter = "1",
  getTransmutedGrade = () => {},
}) => {
  // Set default values to prevent errors
  const safeSchoolInfo = schoolInfo || {};
  const safeClassData = classData || {};
  const safeStudents = students || [];
  const safeActivities = activities || {
    written: [],
    performance: [],
    assessment: [],
  };
  const safeGradingCriteria = gradingCriteria || {
    written_works_percentage: 0,
    performance_tasks_percentage: 0,
    quarterly_assessment_percentage: 0,
  };

  // Helper functions
  const renderActivityColumns = (type) => {
    const activityList = safeActivities[type] || [];
    if (activityList.length === 0) return null;

    return activityList.map((activity, index) => (
      <th
        key={activity.activity_id || index}
        className="border border-black p-2 font-medium text-center bg-gray-200 whitespace-nowrap"
      >
        {activity.title || `Activity ${index + 1}`}
      </th>
    ));
  };

  const renderHighestPossibleScores = (type) => {
    const activityList = safeActivities[type] || [];
    if (activityList.length === 0) return null;

    return activityList.map((activity, index) => (
      <td
        key={activity.activity_id || index}
        className="border border-black p-2 text-center bg-gray-200 font-bold"
      >
        {activity.max_score ? parseInt(activity.max_score, 10) : 0}
      </td>
    ));
  };

  const renderActivityScores = (type, student) => {
    const activityList = safeActivities[type] || [];
    if (activityList.length === 0) return null;

    return activityList.map((activity, index) => {
      const score = (student.scores || {})[activity.activity_id];
      const displayValue = score !== undefined && score !== null ? score : "";

      return (
        <td
          key={activity.activity_id || index}
          className="border border-black p-2 text-center"
        >
          {displayValue}
        </td>
      );
    });
  };

  const calculateTotalMaxScores = () => {
    const maxScores = {
      written: 0,
      performance: 0,
      assessment: 0,
    };

    if (safeActivities.written && Array.isArray(safeActivities.written)) {
      safeActivities.written.forEach((activity) => {
        maxScores.written += parseFloat(activity.max_score || 0);
      });
    }

    if (
      safeActivities.performance &&
      Array.isArray(safeActivities.performance)
    ) {
      safeActivities.performance.forEach((activity) => {
        maxScores.performance += parseFloat(activity.max_score || 0);
      });
    }

    if (safeActivities.assessment && Array.isArray(safeActivities.assessment)) {
      safeActivities.assessment.forEach((activity) => {
        maxScores.assessment += parseFloat(activity.max_score || 0);
      });
    }

    return maxScores;
  };

  // Calculate column counts for each section
  const writtenColCount = safeActivities.written
    ? safeActivities.written.length
    : 0;
  const performanceColCount = safeActivities.performance
    ? safeActivities.performance.length
    : 0;
  const assessmentColCount = safeActivities.assessment
    ? safeActivities.assessment.length
    : 0;

  const quarterNames = {
    1: "First Quarter",
    2: "Second Quarter",
    3: "Third Quarter",
    4: "Fourth Quarter",
  };

  return (
    <div
      className="grades-pdf-template"
      style={{ marginTop: "5px", marginBottom: "5px" }}
    >
      <div className="first-page">
        {/* Header Section */}
        <div className="header-grid">
          <div className="header-item">
            <div className="header-label">REGION:</div>
            <div className="header-value">{safeSchoolInfo.region || ""}</div>
          </div>
          <div className="header-item">
            <div className="header-label">DIVISION:</div>
            <div className="header-value">{safeSchoolInfo.division || ""}</div>
          </div>
          <div className="header-item">
            <div className="header-label">DISTRICT:</div>
            <div className="header-value">{safeSchoolInfo.district || ""}</div>
          </div>
          <div className="header-item">
            <div className="header-label">SCHOOL ID:</div>
            <div className="header-value">{safeSchoolInfo.schoolId || ""}</div>
          </div>
          <div className="header-item">
            <div className="header-label">SCHOOL NAME:</div>
            <div className="header-value">
              {safeSchoolInfo.schoolName || ""}
            </div>
          </div>
          <div className="header-item">
            <div className="header-label">SCHOOL YEAR:</div>
            <div className="header-value">{safeClassData.schoolYear || ""}</div>
          </div>
          <div className="header-item">
            <div className="header-label">TEACHER:</div>
            <div className="header-value">
              {safeClassData.teacherName || ""}
            </div>
          </div>
          <div className="header-item">
            <div className="header-label">GRADE & SECTION:</div>
            <div className="header-value">
              {safeClassData.gradeLevel && safeClassData.section
                ? `Grade ${safeClassData.gradeLevel} - ${safeClassData.section}`
                : ""}
            </div>
          </div>
          <div className="header-item">
            <div className="header-label">SUBJECT:</div>
            <div className="header-value">{safeClassData.subject || ""}</div>
          </div>
        </div>

        {/* Grades Table */}
        <table className="grades-table">
          <thead>
            <tr>
              <th className="border border-black p-2 font-bold text-center">
                LEARNERS' NAMES
              </th>
              <th
                className="border border-black p-2 font-bold text-center"
                colSpan={3 + writtenColCount}
              >
                WRITTEN WORKS (
                {safeGradingCriteria.written_works_percentage || 0}%)
              </th>
              <th
                className="border border-black p-2 font-bold text-center"
                colSpan={3 + performanceColCount}
              >
                PERFORMANCE TASKS (
                {safeGradingCriteria.performance_tasks_percentage || 0}%)
              </th>
              <th
                className="border border-black p-2 font-bold text-center"
                colSpan={3 + assessmentColCount}
              >
                QUARTERLY ASSESSMENT (
                {safeGradingCriteria.quarterly_assessment_percentage || 0}%)
              </th>
              <th
                className="p-2 font-bold text-center"
                style={{
                  borderLeft: "1px solid black",
                  borderRight: "1px solid black",
                  borderTop: "1px solid black",
                  borderBottom: "none",
                }}
              >
                Initial
                <br />
                Grade
              </th>
              <th
                className="p-2 font-bold text-center"
                style={{
                  borderLeft: "1px solid black",
                  borderRight: "1px solid black",
                  borderTop: "1px solid black",
                  borderBottom: "none",
                }}
              >
                Quarterly
                <br />
                Grade
              </th>
            </tr>

            {/* Sub-header row */}
            <tr>
              <th className="border border-black p-2 font-bold text-center">
                {quarterNames[quarter] || `Quarter ${quarter}`}
              </th>
              {/* Activities for Written Works */}
              {renderActivityColumns("written")}
              <th className="border border-black p-2 font-medium text-center">
                Total
              </th>
              <th className="border border-black p-2 font-medium text-center">
                PS
              </th>
              <th className="border border-black p-2 font-medium text-center">
                WS
              </th>

              {/* Activities for Performance Tasks */}
              {renderActivityColumns("performance")}
              <th className="border border-black p-2 font-medium text-center">
                Total
              </th>
              <th className="border border-black p-2 font-medium text-center">
                PS
              </th>
              <th className="border border-black p-2 font-medium text-center">
                WS
              </th>

              {/* Activities for Quarterly Assessment */}
              {renderActivityColumns("assessment")}
              <th className="border border-black p-2 font-medium text-center">
                Total
              </th>
              <th className="border border-black p-2 font-medium text-center">
                PS
              </th>
              <th className="border border-black p-2 font-medium text-center">
                WS
              </th>

              <th
                className="p-2 font-medium text-center"
                style={{
                  borderLeft: "1px solid black",
                  borderRight: "1px solid black",
                  borderTop: "none",
                  borderBottom: "1px solid black",
                }}
              ></th>
              <th
                className="p-2 font-medium text-center"
                style={{
                  borderLeft: "1px solid black",
                  borderRight: "1px solid black",
                  borderTop: "none",
                  borderBottom: "1px solid black",
                }}
              ></th>
            </tr>
          </thead>

          <tbody>
            {/* Highest possible score row */}
            <tr>
              <td className="border border-black p-2 font-bold">
                HIGHEST POSSIBLE SCORE
              </td>

              {/* Highest scores for Written Works activities */}
              {renderHighestPossibleScores("written")}
              <td className="border border-black p-2 text-center">
                {calculateTotalMaxScores().written}
              </td>
              <td className="border border-black p-2 text-center">100.00</td>
              <td className="border border-black p-2 text-center">
                {safeGradingCriteria.written_works_percentage || 0}%
              </td>

              {/* Highest scores for Performance Tasks activities */}
              {renderHighestPossibleScores("performance")}
              <td className="border border-black p-2 text-center">
                {calculateTotalMaxScores().performance}
              </td>
              <td className="border border-black p-2 text-center">100.00</td>
              <td className="border border-black p-2 text-center">
                {safeGradingCriteria.performance_tasks_percentage || 0}%
              </td>

              {/* Highest scores for Quarterly Assessment activities */}
              {renderHighestPossibleScores("assessment")}
              <td className="border border-black p-2 text-center">
                {calculateTotalMaxScores().assessment}
              </td>
              <td className="border border-black p-2 text-center">100.00</td>
              <td className="border border-black p-2 text-center">
                {safeGradingCriteria.quarterly_assessment_percentage || 0}%
              </td>

              <td className="border border-black p-2 text-center"></td>
              <td className="border border-black p-2 text-center"></td>
            </tr>

            {/* Student rows - Add check for empty students array */}
            {safeStudents.length > 0 ? (
              safeStudents.map((student, index) => {
                // Ensure student has all required properties
                const safeStudent = {
                  ...student,
                  written: student.written || { total: 0, ps: 0, ws: 0 },
                  performance: student.performance || {
                    total: 0,
                    ps: 0,
                    ws: 0,
                  },
                  quarterly: student.quarterly || { total: 0, ps: 0, ws: 0 },
                  scores: student.scores || {},
                  initialGrade: student.initialGrade || 0,
                  quarterlyGrade: student.quarterlyGrade || 0,
                };

                return (
                  <tr key={safeStudent.id || index}>
                    <td className="border border-black p-2 text-left">
                      {safeStudent.name || `Student ${index + 1}`}
                    </td>

                    {/* Scores for Written Works activities */}
                    {renderActivityScores("written", safeStudent)}
                    <td className="border border-black p-2 text-center">
                      {safeStudent.written.total}
                    </td>
                    <td className="border border-black p-2 text-center">
                      {safeStudent.written.ps}
                    </td>
                    <td className="border border-black p-2 text-center">
                      {safeStudent.written.ws}
                    </td>

                    {/* Scores for Performance Tasks activities */}
                    {renderActivityScores("performance", safeStudent)}
                    <td className="border border-black p-2 text-center">
                      {safeStudent.performance.total}
                    </td>
                    <td className="border border-black p-2 text-center">
                      {safeStudent.performance.ps !== undefined &&
                      safeStudent.performance.ps !== null
                        ? Number(safeStudent.performance.ps).toFixed(2)
                        : ""}
                    </td>
                    <td className="border border-black p-2 text-center">
                      {safeStudent.performance.ws !== undefined &&
                      safeStudent.performance.ws !== null
                        ? Number(safeStudent.performance.ws).toFixed(2)
                        : ""}
                    </td>

                    {/* Scores for Quarterly Assessment activities */}
                    {renderActivityScores("assessment", safeStudent)}
                    <td className="border border-black p-2 text-center">
                      {safeStudent.quarterly.total}
                    </td>
                    <td className="border border-black p-2 text-center">
                      {safeStudent.quarterly.ps !== undefined &&
                      safeStudent.quarterly.ps !== null
                        ? Number(safeStudent.quarterly.ps).toFixed(2)
                        : ""}
                    </td>
                    <td className="border border-black p-2 text-center">
                      {safeStudent.quarterly.ws !== undefined &&
                      safeStudent.quarterly.ws !== null
                        ? Number(safeStudent.quarterly.ws).toFixed(2)
                        : ""}
                    </td>

                    <td className="border border-black p-2 text-center">
                      {safeStudent.initialGrade}
                    </td>
                    <td className="border border-black p-2 text-center font-bold">
                      {safeStudent.quarterlyGrade}
                    </td>
                  </tr>
                );
              })
            ) : (
              // Display an empty row if there are no students
              <tr>
                <td
                  colSpan={
                    12 +
                    writtenColCount +
                    performanceColCount +
                    assessmentColCount
                  }
                  className="text-center p-4"
                >
                  No student data available
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Signature Section */}
        <div className="signature-section">
          <div className="certification-text" style={{ marginBottom: "0.5px" }}>
            <p>
              I certify that this is a true and correct report of the
              performance of the students in this class.
            </p>
          </div>

          <div className="signature-blocks">
            <div className="signature-block">
              <div className="signature-name">
                {safeClassData.teacherName || ""}
              </div>
              <div className="signature-title">Subject Teacher</div>
            </div>

            <div className="signature-block">
              <div className="signature-name">Charmaine Canonizado-Chang</div>
              <div className="signature-title">School Head</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradesPdfTemplate;
