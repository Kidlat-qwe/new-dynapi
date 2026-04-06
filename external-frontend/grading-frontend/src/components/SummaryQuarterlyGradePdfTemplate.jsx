import React from "react";

const SummaryQuarterlyGradePdfTemplate = ({
  classInfo = {},
  subjects = [],
  students = [],
  males = [],
  females = [],
  orderedSubjects = [],
  studentGrades = {},
  studentGwa = {},
  isKindergarten = false,
  quarter = "1",
  teacherName = "",
}) => {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        color: "#222",
        padding: 12,
      }}
    >
      {/* Custom Header Block */}
      <div id="pdf-summary-header" style={{ marginBottom: 40 }}>
        <div
          style={{
            fontWeight: "bold",
            fontSize: "18px",
            marginBottom: 4,
            textAlign: "center",
          }}
        >
          Summary of Quarterly Grade
        </div>
        <div style={{ fontSize: "13px", marginBottom: 2, textAlign: "center" }}>
          {classInfo.gradeLevel ? `Grade ${classInfo.gradeLevel}` : ""}
          {classInfo.section ? ` - ${classInfo.section}` : ""}
        </div>
        <div style={{ fontSize: "12px", marginBottom: 2, textAlign: "center" }}>
          {classInfo.schoolYear ? `School Year: ${classInfo.schoolYear}` : ""}
          {quarter ? ` | Quarter: ${quarter}` : ""}
        </div>
        <div style={{ fontSize: "12px", marginBottom: 7, textAlign: "center" }}>
          {teacherName ? `Class Adviser: ${teacherName}` : ""}
        </div>
        <div style={{ height: "40px", background: "#fff" }}></div>
      </div>
      {/* End Custom Header Block */}
      <div style={{ height: "40px" }}></div>
      <table
        style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}
      >
        <thead>
          <tr>
            <th
              style={{
                border: "1px solid #222",
                padding: "4px",
                textAlign: "left",
                fontWeight: "bold",
                background: "#f3f3f3",
              }}
            >
              LEARNER'S NAME
            </th>
            {orderedSubjects.map((subject) => (
              <th
                key={subject.subject_id}
                style={{
                  border: "1px solid #222",
                  padding: "4px",
                  textAlign: "center",
                  fontWeight: "bold",
                  background: "#f3f3f3",
                }}
              >
                {subject.subject_name}
              </th>
            ))}
            {!isKindergarten && (
              <th
                style={{
                  border: "1px solid #222",
                  padding: "4px",
                  textAlign: "center",
                  fontWeight: "bold",
                  background: "#f3f3f3",
                }}
              >
                AVERAGE
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {/* MALE group */}
          {males.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={orderedSubjects.length + (isKindergarten ? 1 : 2)}
                  style={{
                    background: "#e5e7eb",
                    fontWeight: "bold",
                    padding: "4px",
                    border: "1px solid #222",
                  }}
                >
                  MALE
                </td>
              </tr>
              {males.map((student) => (
                <tr key={student.user_id}>
                  <td
                    style={{
                      border: "1px solid #222",
                      padding: "4px",
                      verticalAlign: "top",
                      minWidth: 90,
                    }}
                  >
                    <span>{student.lname},</span>
                    <br />
                    <span>
                      {student.fname} {student.mname || ""}
                    </span>
                  </td>
                  {orderedSubjects.map((subject) => {
                    let grade =
                      studentGrades[student.user_id]?.[subject.subject_id] ??
                      "-";
                    let gradeDisplay = isKindergarten
                      ? grade
                      : typeof grade === "number"
                        ? grade.toFixed(2)
                        : grade;
                    return (
                      <td
                        key={subject.subject_id}
                        style={{
                          border: "1px solid #222",
                          padding: "4px",
                          textAlign: "center",
                        }}
                      >
                        {gradeDisplay}
                      </td>
                    );
                  })}
                  {!isKindergarten && (
                    <td
                      style={{
                        border: "1px solid #222",
                        padding: "4px",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      {studentGwa[student.user_id] ?? "-"}
                    </td>
                  )}
                </tr>
              ))}
            </>
          )}
          {/* FEMALE group */}
          {females.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={orderedSubjects.length + (isKindergarten ? 1 : 2)}
                  style={{
                    background: "#e5e7eb",
                    fontWeight: "bold",
                    padding: "4px",
                    border: "1px solid #222",
                  }}
                >
                  FEMALE
                </td>
              </tr>
              {females.map((student) => (
                <tr key={student.user_id}>
                  <td
                    style={{
                      border: "1px solid #222",
                      padding: "4px",
                      verticalAlign: "top",
                      minWidth: 90,
                    }}
                  >
                    <span>{student.lname},</span>
                    <br />
                    <span>
                      {student.fname} {student.mname || ""}
                    </span>
                  </td>
                  {orderedSubjects.map((subject) => {
                    let grade =
                      studentGrades[student.user_id]?.[subject.subject_id] ??
                      "-";
                    let gradeDisplay = isKindergarten
                      ? grade
                      : typeof grade === "number"
                        ? grade.toFixed(2)
                        : grade;
                    return (
                      <td
                        key={subject.subject_id}
                        style={{
                          border: "1px solid #222",
                          padding: "4px",
                          textAlign: "center",
                        }}
                      >
                        {gradeDisplay}
                      </td>
                    );
                  })}
                  {!isKindergarten && (
                    <td
                      style={{
                        border: "1px solid #222",
                        padding: "4px",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      {studentGwa[student.user_id] ?? "-"}
                    </td>
                  )}
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
      <div style={{ marginTop: 18, fontSize: "11px" }}>
        <div>
          I certify that this is a true and correct report of the performance of
          the students in this class.
        </div>
        <div style={{ marginTop: 18, fontWeight: "bold" }}>{teacherName}</div>
        <div style={{ fontSize: "10px" }}>Class Adviser</div>
      </div>
    </div>
  );
};

export default SummaryQuarterlyGradePdfTemplate;
