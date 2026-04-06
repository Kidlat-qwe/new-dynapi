import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "./contexts/AuthContext";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import SummaryQuarterlyGradePdfTemplate from "./components/SummaryQuarterlyGradePdfTemplate";
import { gradingUrl, getAuthHeader } from "./lib/api";

const SummaryQuarterlyGrade = () => {
  const [schoolYears, setSchoolYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [advisoryClasses, setAdvisoryClasses] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const { currentUser } = useAuth();
  const [studentGrades, setStudentGrades] = useState({});
  const [studentGwa, setStudentGwa] = useState({});
  const [orderedSubjects, setOrderedSubjects] = useState([]);
  const [noAdvisoryMessage, setNoAdvisoryMessage] = useState("");
  const [showPdfRender, setShowPdfRender] = useState(false);
  const pdfRef = React.useRef();
  const [pdfClassInfo, setPdfClassInfo] = useState(null);

  // Fetch school years on mount
  useEffect(() => {
    const fetchSchoolYears = async () => {
      try {
        setLoading(true);
        const res = await axios.get(gradingUrl("/api/school-years"), { headers: getAuthHeader() });
        setSchoolYears(res.data || []);
        // Set default to active school year if available
        const activeYear = (res.data || []).find((year) => year.is_active);
        if (activeYear) {
          setSelectedYear(activeYear.school_year_id.toString());
        }
      } catch (err) {
        setError("Failed to load school years");
      } finally {
        setLoading(false);
      }
    };
    fetchSchoolYears();
  }, []);

  // Fetch teacher data by email (from currentUser)
  useEffect(() => {
    const fetchTeacherData = async () => {
      try {
        if (!currentUser?.email) return;
        setLoading(true);
        const userResponse = await axios.get(
          gradingUrl(`/users/byEmail/${currentUser.email}`),
          { headers: getAuthHeader() },
        );
        setTeacher(userResponse.data);
      } catch (err) {
        setError("Failed to load teacher data");
      } finally {
        setLoading(false);
      }
    };
    fetchTeacherData();
  }, [currentUser]);

  // Fetch advisory classes for the teacher
  useEffect(() => {
    const fetchAdvisoryClasses = async () => {
      if (!teacher?.user_id || !selectedYear) {
        setAdvisoryClasses([]);
        setNoAdvisoryMessage("");
        return;
      }
      try {
        setLoading(true);
        setNoAdvisoryMessage(""); // Reset on new fetch
        const response = await axios.get(
          gradingUrl(`/api/teachers/${teacher.user_id}/advisory-classes`),
          { params: { schoolYearId: selectedYear }, headers: getAuthHeader() },
        );
        const data = response.data || [];
        setAdvisoryClasses(data);
        if (data.length === 0) {
          setNoAdvisoryMessage(
            "No advisory class assigned for this school year.",
          );
        }
      } catch (err) {
        setError("Failed to load advisory classes");
      } finally {
        setLoading(false);
      }
    };
    fetchAdvisoryClasses();
  }, [teacher, selectedYear]);

  // Create the final, ordered list of subjects for columns
  useEffect(() => {
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
      const finalColumnOrder = [];
      const otherSubjects = subjects
        .filter((s) => !s.parent_subject_id && s.subject_name !== "MAPEH")
        .sort((a, b) => a.subject_name.localeCompare(b.subject_name));
      finalColumnOrder.push(...otherSubjects);

      const mapehParent = subjects.find(
        (s) => s.subject_name === "MAPEH" && !s.parent_subject_id,
      );
      if (mapehParent) {
        finalColumnOrder.push(mapehParent);
        const mapehChildren = subjects.filter(
          (s) => s.parent_subject_id === mapehParent.subject_id,
        );
        let componentOrder;
        if (["1", "2", "3", 1, 2, 3].includes(gradeLevel)) {
          componentOrder = ["Music", "Arts", "Physical Education", "Health"];
        } else if (["4", "5", "6", 4, 5, 6].includes(gradeLevel)) {
          componentOrder = ["Music and Arts", "Physical Education and Health"];
        } else {
          componentOrder = mapehChildren.map((c) => c.subject_name).sort();
        }
        const orderedChildren = [];
        componentOrder.forEach((key) => {
          const candidates = MAPEH_COMPONENTS[key] || [key];
          const child = mapehChildren.find((c) =>
            matchName(c.subject_name, candidates),
          );
          if (child) orderedChildren.push(child);
        });
        finalColumnOrder.push(...orderedChildren);
      }
      return finalColumnOrder;
    };

    if (subjects.length > 0 && advisoryClasses.length > 0 && selectedClass) {
      const currentClass = advisoryClasses.find(
        (c) => c.class_id.toString() === selectedClass,
      );
      const gradeLevel = currentClass?.grade_level;
      setOrderedSubjects(getOrderedSubjects(subjects, gradeLevel));
    } else {
      setOrderedSubjects([]);
    }
  }, [subjects, advisoryClasses, selectedClass]);

  // Fetch subjects and students when class changes
  useEffect(() => {
    if (!selectedClass) {
      setSubjects([]);
      setStudents([]);
      return;
    }
    const fetchSubjectsAndStudents = async () => {
      try {
        setLoading(true);
        // Fetch subjects for the class
        const subjectsRes = await axios.get(
          gradingUrl(`/api/classes/${selectedClass}/subjects`),
          { headers: getAuthHeader() },
        );
        setSubjects(subjectsRes.data || []);
        const studentsRes = await axios.get(
          gradingUrl(`/api/classes/${selectedClass}/students`),
          { headers: getAuthHeader() },
        );
        setStudents(studentsRes.data || []);
      } catch (err) {
        setError("Failed to load subjects or students");
      } finally {
        setLoading(false);
      }
    };
    fetchSubjectsAndStudents();
  }, [selectedClass]);

  // Fetch grades and GWA when students are loaded
  useEffect(() => {
    if (
      !selectedClass ||
      !selectedYear ||
      !selectedQuarter ||
      students.length === 0
    )
      return;
    const fetchGradesAndGwa = async () => {
      try {
        setLoading(true);
        // Fetch grades
        const gradesRes = await axios.get(gradingUrl("/api/grades"), {
          params: {
            schoolYearId: selectedYear,
            quarter: selectedQuarter,
            classId: selectedClass,
          },
          headers: getAuthHeader(),
        });

        console.log("Fetched grades:", gradesRes.data); // Debug log

        const gradesMap = {};
        gradesRes.data.forEach((gradeData) => {
          const studentId = gradeData.student_id;
          const subjectId = gradeData.subject_id;

          if (!gradesMap[studentId]) {
            gradesMap[studentId] = {};
          }

          // For kindergarten students, use char_grade, otherwise use numeric grade
          const gradeValue = gradeData.char_grade || gradeData.grade;
          if (gradeValue !== null && gradeValue !== undefined) {
            gradesMap[studentId][subjectId] = gradeValue;
          }
        });

        console.log("Processed grades map:", gradesMap); // Debug log
        setStudentGrades(gradesMap);

        // Initialize GWA map with "-" for all students
        const initialGwaMap = {};
        students.forEach((student) => {
          initialGwaMap[student.user_id] = "-";
        });
        setStudentGwa(initialGwaMap);

        // Then fetch and update GWA only if available
        const gwaPromises = students.map(async (student) => {
          try {
            const res = await axios.get(
              gradingUrl(`/api/students/${student.user_id}/${selectedClass}/${selectedYear}/quarterly-gwa/${selectedQuarter}`),
              { headers: getAuthHeader() },
            );
            // Only update if we have a valid GWA
            if (
              res.data &&
              res.data.quarterly_gwa !== undefined &&
              res.data.quarterly_gwa !== null
            ) {
              return {
                studentId: student.user_id,
                gwa: parseFloat(res.data.quarterly_gwa).toFixed(2),
              };
            }
            return { studentId: student.user_id, gwa: "-" };
          } catch (err) {
            console.log(`No GWA found for student ${student.user_id}`);
            return { studentId: student.user_id, gwa: "-" };
          }
        });

        const gwaResults = await Promise.all(gwaPromises);
        const updatedGwaMap = { ...initialGwaMap };
        gwaResults.forEach((result) => {
          if (result.gwa !== "-") {
            updatedGwaMap[result.studentId] = result.gwa;
          }
        });
        setStudentGwa(updatedGwaMap);
      } catch (err) {
        console.error("Error fetching grades:", err);
        setError("Failed to load grades");
      } finally {
        setLoading(false);
      }
    };
    fetchGradesAndGwa();
  }, [selectedClass, selectedYear, selectedQuarter, students]);

  // Group students by gender
  const males = students.filter((s) => (s.gender || "").toUpperCase() === "M");
  const females = students.filter(
    (s) => (s.gender || "").toUpperCase() === "F",
  );

  // Determine if the selected class is Kindergarten
  const isKindergarten = (() => {
    if (!selectedClass || advisoryClasses.length === 0) return false;
    const currentClass = advisoryClasses.find(
      (c) => c.class_id.toString() === selectedClass,
    );
    return currentClass?.grade_level === "Kindergarten";
  })();

  const handleExportPdf = async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      // Fetch full class info for selected class
      const res = await axios.get(gradingUrl(`/api/classes/${selectedClass}`), { headers: getAuthHeader() });
      setPdfClassInfo(res.data || {});
      setShowPdfRender(true);
    } catch (err) {
      setPdfClassInfo(null);
      setShowPdfRender(true); // fallback to old behavior if fetch fails
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!showPdfRender || !pdfClassInfo) return;
    setTimeout(async () => {
      const input = pdfRef.current;
      if (!input) return;
      // Render header block as image
      const headerBlock = input.querySelector("#pdf-summary-header");
      let headerImgData = null;
      let headerHeight = 0;
      if (headerBlock) {
        const headerCanvas = await html2canvas(headerBlock, {
          scale: 2,
          useCORS: true,
        });
        headerImgData = headerCanvas.toDataURL("image/png");
        headerHeight = (headerCanvas.height * 842) / headerCanvas.width; // 842pt = A4 landscape width
      }
      // Render thead separately for table header
      const thead = input.querySelector("thead");
      let theadImgData = null;
      let theadHeight = 0;
      if (thead) {
        const theadCanvas = await html2canvas(thead, {
          scale: 2,
          useCORS: true,
        });
        theadImgData = theadCanvas.toDataURL("image/png");
        theadHeight = (theadCanvas.height * 842) / theadCanvas.width;
      }
      // Prepare PDF
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let y = 0;
      // Add header block (class info)
      if (headerImgData) {
        pdf.addImage(headerImgData, "PNG", 0, y, pageWidth, headerHeight);
        y += headerHeight;
      }
      // Add table header
      if (theadImgData) {
        pdf.addImage(theadImgData, "PNG", 0, y, pageWidth, theadHeight);
        y += theadHeight;
      }
      // Render each row and add to PDF
      const rows = input.querySelectorAll("tr");
      for (let i = 0; i < rows.length; i++) {
        // Skip header row (already rendered)
        if (thead && thead.contains(rows[i])) continue;
        const rowCanvas = await html2canvas(rows[i], {
          scale: 2,
          useCORS: true,
        });
        const rowImgData = rowCanvas.toDataURL("image/png");
        const rowHeight = (rowCanvas.height * pageWidth) / rowCanvas.width;
        if (y + rowHeight > pageHeight) {
          pdf.addPage();
          y = 0;
          // Do NOT repeat header block or table header on new page
        }
        pdf.addImage(rowImgData, "PNG", 0, y, pageWidth, rowHeight);
        y += rowHeight;
      }
      const schoolYear =
        pdfClassInfo.school_year || pdfClassInfo.school_year_name || "";
      const gradeLevel = pdfClassInfo.grade_level || "";
      const section = pdfClassInfo.section || "";
      const adviserName = pdfClassInfo.adviser_fname
        ? `${pdfClassInfo.adviser_fname} ${pdfClassInfo.adviser_mname || ""} ${pdfClassInfo.adviser_lname || ""}`.trim()
        : "";
      const fileName = `Summary of Quarterly Grade ${schoolYear} - Quarter ${selectedQuarter}, Grade ${gradeLevel} ${section} - ${adviserName}.pdf`;
      pdf.save(fileName);
      setShowPdfRender(false);
      setPdfClassInfo(null);
    }, 200);
  }, [showPdfRender, pdfClassInfo]);

  return (
    <div className="content-container bg-[#F3F3F6]">
      <div className="p-8">
        {/* Filtering Section */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              School Year:
            </label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setSelectedClass("");
                setSubjects([]);
                setStudents([]);
              }}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="">Select School Year</option>
              {schoolYears.map((year) => (
                <option key={year.school_year_id} value={year.school_year_id}>
                  {year.school_year} {year.is_active ? "(Active)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Class:
            </label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSubjects([]);
                setStudents([]);
              }}
              className="w-full border rounded-md px-3 py-2"
              disabled={!selectedYear || advisoryClasses.length === 0}
            >
              <option value="">Select Class</option>
              {advisoryClasses.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.grade_level === "Kindergarten"
                    ? `Kindergarten-${c.section}`
                    : `Grade ${c.grade_level}-${c.section}`}{" "}
                  {c.adviser_fname} {c.adviser_lname}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quarter:
            </label>
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              disabled={!selectedClass}
            >
              <option value="1">First Quarter</option>
              <option value="2">Second Quarter</option>
              <option value="3">Third Quarter</option>
              <option value="4">Fourth Quarter</option>
            </select>
          </div>
        </div>

        {/* PDF Export Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleExportPdf}
            className={`bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow text-xs font-semibold ${!selectedClass || students.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={!selectedClass || students.length === 0}
          >
            Export as PDF
          </button>
        </div>
        {/* Hidden PDF Render for export */}
        {showPdfRender && pdfClassInfo && (
          <div style={{ position: "fixed", left: -9999, top: 0, zIndex: -1 }}>
            <div ref={pdfRef}>
              {(() => {
                const classInfo = {
                  gradeLevel: pdfClassInfo.grade_level,
                  section: pdfClassInfo.section,
                  schoolYear:
                    pdfClassInfo.school_year ||
                    pdfClassInfo.school_year_name ||
                    "",
                };
                const adviserName = pdfClassInfo.adviser_fname
                  ? `${pdfClassInfo.adviser_fname} ${pdfClassInfo.adviser_mname || ""} ${pdfClassInfo.adviser_lname || ""}`.trim()
                  : "";
                return (
                  <SummaryQuarterlyGradePdfTemplate
                    classInfo={classInfo}
                    subjects={subjects}
                    students={students}
                    males={males}
                    females={females}
                    orderedSubjects={orderedSubjects}
                    studentGrades={studentGrades}
                    studentGwa={studentGwa}
                    isKindergarten={isKindergarten}
                    quarter={selectedQuarter}
                    teacherName={adviserName}
                  />
                );
              })()}
            </div>
          </div>
        )}

        {/* Table Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden border border-black">
          {selectedClass ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-white">
                  <tr>
                    <th
                      scope="col"
                      className="px-2 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                    >
                      Learner's Name
                    </th>
                    {orderedSubjects.map((subject) => (
                      <th
                        key={subject.subject_id}
                        scope="col"
                        className="px-2 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider"
                      >
                        {subject.subject_name}
                      </th>
                    ))}
                    {!isKindergarten && (
                      <th
                        scope="col"
                        className="px-2 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider"
                      >
                        Average
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Male group */}
                  {males.length > 0 && (
                    <>
                      <tr>
                        <td
                          colSpan={
                            orderedSubjects.length + (isKindergarten ? 1 : 2)
                          }
                          className="px-2 py-2 bg-gray-100 text-sm font-semibold text-gray-700"
                        >
                          MALE
                        </td>
                      </tr>
                      {males.map((student) => {
                        const gwa = studentGwa[student.user_id] ?? "-";
                        return (
                          <tr
                            key={student.user_id}
                            className="hover:bg-indigo-50 transition-colors"
                          >
                            <td className="px-2 py-3 whitespace-nowrap text-xs font-medium text-gray-900">
                              {student.lname},<br />
                              {student.fname} {student.mname || ""}
                            </td>
                            {orderedSubjects.map((subject) => {
                              let grade;
                              if (isKindergarten) {
                                grade =
                                  studentGrades[student.user_id]?.[
                                    subject.subject_id
                                  ] ?? "-";
                              } else {
                                grade =
                                  studentGrades[student.user_id]?.[
                                    subject.subject_id
                                  ] ?? "-";
                              }
                              const gradeDisplay = isKindergarten
                                ? grade
                                : typeof grade === "number"
                                  ? grade.toFixed(2)
                                  : grade;
                              return (
                                <td
                                  key={subject.subject_id}
                                  className={`px-2 py-3 whitespace-nowrap text-sm text-center ${grade === "-" ? "text-gray-400" : "text-gray-800"}`}
                                >
                                  {gradeDisplay}
                                </td>
                              );
                            })}
                            {!isKindergarten && (
                              <td
                                className={`px-2 py-3 whitespace-nowrap text-sm text-center font-semibold ${gwa === "-" ? "text-gray-400" : "text-gray-800"}`}
                              >
                                {gwa}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </>
                  )}
                  {/* Female group */}
                  {females.length > 0 && (
                    <>
                      <tr>
                        <td
                          colSpan={
                            orderedSubjects.length + (isKindergarten ? 1 : 2)
                          }
                          className="px-2 py-2 bg-gray-100 text-sm font-semibold text-gray-700"
                        >
                          FEMALE
                        </td>
                      </tr>
                      {females.map((student) => {
                        const gwa = studentGwa[student.user_id] ?? "-";
                        return (
                          <tr
                            key={student.user_id}
                            className="hover:bg-indigo-50 transition-colors"
                          >
                            <td className="px-2 py-3 whitespace-nowrap text-xs font-medium text-gray-900">
                              {student.lname},<br />
                              {student.fname} {student.mname || ""}
                            </td>
                            {orderedSubjects.map((subject) => {
                              let grade;
                              if (isKindergarten) {
                                grade =
                                  studentGrades[student.user_id]?.[
                                    subject.subject_id
                                  ] ?? "-";
                              } else {
                                grade =
                                  studentGrades[student.user_id]?.[
                                    subject.subject_id
                                  ] ?? "-";
                              }
                              const gradeDisplay = isKindergarten
                                ? grade
                                : typeof grade === "number"
                                  ? grade.toFixed(2)
                                  : grade;
                              return (
                                <td
                                  key={subject.subject_id}
                                  className={`px-2 py-3 whitespace-nowrap text-sm text-center ${grade === "-" ? "text-gray-400" : "text-gray-800"}`}
                                >
                                  {gradeDisplay}
                                </td>
                              );
                            })}
                            {!isKindergarten && (
                              <td
                                className={`px-2 py-3 whitespace-nowrap text-sm text-center font-semibold ${gwa === "-" ? "text-gray-400" : "text-gray-800"}`}
                              >
                                {gwa}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </>
                  )}
                  {/* Empty state if no students */}
                  {students.length === 0 && !loading && (
                    <tr>
                      <td
                        colSpan={
                          orderedSubjects.length > 0
                            ? orderedSubjects.length + 2
                            : 2
                        }
                        className="px-2 py-24 text-center text-gray-500"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-12 w-12 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1}
                              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-4.134a4.002 4.002 0 00-3-3.866M9 21v-4.134a4.002 4.002 0 013-3.866m0 0a4.002 4.002 0 013 3.866M12 4.354v5.292"
                            />
                          </svg>
                          <span className="font-semibold mt-2">
                            No Students Found
                          </span>
                          <span className="text-sm">
                            There are no students assigned to this class yet.
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-24 text-gray-500">
              {noAdvisoryMessage ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                  <span className="mt-2 block font-semibold">
                    No Advisory Class Found
                  </span>
                  <span className="text-sm">{noAdvisoryMessage}</span>
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="mt-2 block font-semibold">
                    Select a class to begin
                  </span>
                  <span className="text-sm">
                    Choose a school year and a class from the dropdowns above.
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SummaryQuarterlyGrade;
