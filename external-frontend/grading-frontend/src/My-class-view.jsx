import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "./contexts/AuthContext";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import GradesPdfTemplate from "./components/GradesPdfTemplate";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { gradingUrl, getAuthHeader, fetchGrading } from "./lib/api";

const MyClassView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [classData, setClassData] = useState(null);
  const [quarter, setQuarter] = useState("1");
  const [gradingCriteria, setGradingCriteria] = useState(null);
  const [hasCriteria, setHasCriteria] = useState(false);

  // Student state
  const [students, setStudents] = useState([]);

  // Certificate student selections
  const [selectedForCertificate, setSelectedForCertificate] = useState({});
  const [showGenerateCertificates, setShowGenerateCertificates] =
    useState(false);

  // Scores state
  const [scores, setScores] = useState([]);
  const [scoreMessage, setScoreMessage] = useState(null);

  // Activities state
  const [activities, setActivities] = useState({
    written: [],
    performance: [],
    assessment: [],
  });
  const [activitySuccess, setActivitySuccess] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [activityName, setActivityName] = useState("");
  const [highestPossibleScore, setHighestPossibleScore] = useState("");
  const [activityType, setActivityType] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // School info (this could be fetched from an API or stored in context)
  const schoolInfo = {
    region: "REGION III",
    division: "BULACAN",
    schoolName: "LITTLE CHAMPIONS ACADEMY",
    district: "5th Congressional District",
    schoolId: "411093",
  };

  // Define a transmutation table for quarterly grades
  // This will be used to convert initial grades to quarterly grades
  const TRANSMUTATION_TABLE = [
    { min: 0, max: 15.99, grade: 60 },
    { min: 16.0, max: 19.99, grade: 64 },
    { min: 20.0, max: 23.99, grade: 65 },
    { min: 24.0, max: 27.99, grade: 66 },
    { min: 28.0, max: 31.99, grade: 67 },
    { min: 32.0, max: 35.99, grade: 68 },
    { min: 36.0, max: 39.99, grade: 69 },
    { min: 40.0, max: 43.99, grade: 70 },
    { min: 44.0, max: 47.99, grade: 71 },
    { min: 48.0, max: 51.99, grade: 72 },
    { min: 52.0, max: 55.99, grade: 73 },
    { min: 56.0, max: 59.99, grade: 74 },
    { min: 60.0, max: 61.59, grade: 75 },
    { min: 61.6, max: 63.19, grade: 76 },
    { min: 63.2, max: 64.79, grade: 77 },
    { min: 64.8, max: 66.39, grade: 78 },
    { min: 66.4, max: 67.99, grade: 79 },
    { min: 68.0, max: 69.59, grade: 80 },
    { min: 69.6, max: 71.19, grade: 81 },
    { min: 71.2, max: 72.79, grade: 82 },
    { min: 72.8, max: 74.39, grade: 83 },
    { min: 74.4, max: 75.99, grade: 84 },
    { min: 76.0, max: 77.59, grade: 85 },
    { min: 77.6, max: 79.19, grade: 86 },
    { min: 79.2, max: 80.79, grade: 87 },
    { min: 80.8, max: 82.39, grade: 88 },
    { min: 82.4, max: 83.99, grade: 89 },
    { min: 84.0, max: 85.59, grade: 90 },
    { min: 85.6, max: 87.19, grade: 91 },
    { min: 87.2, max: 88.79, grade: 92 },
    { min: 88.8, max: 90.39, grade: 93 },
    { min: 90.4, max: 91.99, grade: 94 },
    { min: 92.0, max: 93.59, grade: 95 },
    { min: 93.6, max: 95.19, grade: 96 },
    { min: 95.2, max: 96.79, grade: 97 },
    { min: 96.8, max: 98.39, grade: 98 },
    { min: 98.4, max: 99.99, grade: 99 },
    { min: 100, max: 100, grade: 100 },
  ];

  // Helper function for the VLOOKUP-like functionality
  const getTransmutedGrade = (initialGrade) => {
    if (
      initialGrade === null ||
      initialGrade === undefined ||
      initialGrade === ""
    )
      return "";

    const numericGrade = parseFloat(initialGrade);
    if (isNaN(numericGrade)) return "";

    // Find the appropriate grade in the transmutation table
    const gradeEntry = TRANSMUTATION_TABLE.find(
      (entry) => numericGrade >= entry.min && numericGrade <= entry.max,
    );

    return gradeEntry ? gradeEntry.grade : "";
  };

  // Helper function to calculate totals, PS, WS and grades
  const calculateStudentGrades = (student, allActivities, gradingCriteria) => {
    // Deep copy of student object
    const updatedStudent = { ...student };

    // Initialize or reset grade components
    updatedStudent.written = { total: 0, ps: 0, ws: 0 };
    updatedStudent.performance = { total: 0, ps: 0, ws: 0 };
    updatedStudent.quarterly = { total: 0, ps: 0, ws: 0 };

    // Calculate Written Works
    if (allActivities.written && Array.isArray(allActivities.written)) {
      let writtenScores = [];
      let writtenMaxTotal = 0;

      // Collect all non-empty scores
      allActivities.written.forEach((activity) => {
        const score = updatedStudent.scores[activity.activity_id];
        if (score !== undefined && score !== null && score !== "") {
          const numericScore = parseFloat(score);
          if (!isNaN(numericScore)) {
            writtenScores.push(numericScore);
            writtenMaxTotal += parseFloat(activity.max_score || 0);
          }
        }
      });

      // Calculate total (sum of all scores)
      const writtenTotal =
        writtenScores.length > 0
          ? writtenScores.reduce((sum, score) => sum + score, 0)
          : 0;
      updatedStudent.written.total = writtenTotal;

      // Calculate PS (Percentage Score)
      updatedStudent.written.ps =
        writtenMaxTotal > 0
          ? parseFloat(((writtenTotal / writtenMaxTotal) * 100).toFixed(2))
          : 0;

      // Calculate WS (Weighted Score)
      if (gradingCriteria && updatedStudent.written.ps !== "") {
        updatedStudent.written.ws =
          Math.round(
            ((updatedStudent.written.ps *
              gradingCriteria.written_works_percentage) /
              100) *
              100,
          ) / 100;
      }
    }

    // Calculate Performance Tasks
    if (allActivities.performance && Array.isArray(allActivities.performance)) {
      let perfScores = [];
      let perfMaxTotal = 0;

      // Collect all non-empty scores
      allActivities.performance.forEach((activity) => {
        const score = updatedStudent.scores[activity.activity_id];
        if (score !== undefined && score !== null && score !== "") {
          const numericScore = parseFloat(score);
          if (!isNaN(numericScore)) {
            perfScores.push(numericScore);
            perfMaxTotal += parseFloat(activity.max_score || 0);
          }
        }
      });

      // Calculate total
      const perfTotal =
        perfScores.length > 0
          ? perfScores.reduce((sum, score) => sum + score, 0)
          : 0;
      updatedStudent.performance.total = perfTotal;

      // Calculate PS
      updatedStudent.performance.ps =
        perfMaxTotal > 0
          ? parseFloat(((perfTotal / perfMaxTotal) * 100).toFixed(2))
          : 0;

      // Calculate WS
      if (gradingCriteria && updatedStudent.performance.ps !== "") {
        updatedStudent.performance.ws =
          Math.round(
            ((updatedStudent.performance.ps *
              gradingCriteria.performance_tasks_percentage) /
              100) *
              100,
          ) / 100;
      }
    }

    // Calculate Quarterly Assessment
    if (allActivities.assessment && Array.isArray(allActivities.assessment)) {
      let assessScores = [];
      let assessMaxTotal = 0;

      // Collect scores (usually just one)
      allActivities.assessment.forEach((activity) => {
        const score = updatedStudent.scores[activity.activity_id];
        if (score !== undefined && score !== null && score !== "") {
          const numericScore = parseFloat(score);
          if (!isNaN(numericScore)) {
            assessScores.push(numericScore);
            assessMaxTotal += parseFloat(activity.max_score || 0);
          }
        }
      });

      // Calculate total (usually just the one score)
      const assessTotal =
        assessScores.length > 0
          ? assessScores.reduce((sum, score) => sum + score, 0)
          : 0;
      updatedStudent.quarterly.total = assessTotal;

      // Calculate PS
      updatedStudent.quarterly.ps =
        assessMaxTotal > 0
          ? parseFloat(((assessTotal / assessMaxTotal) * 100).toFixed(2))
          : 0;

      // Calculate WS
      if (gradingCriteria && updatedStudent.quarterly.ps !== "") {
        updatedStudent.quarterly.ws =
          Math.round(
            ((updatedStudent.quarterly.ps *
              gradingCriteria.quarterly_assessment_percentage) /
              100) *
              100,
          ) / 100;
      }
    }

    // Calculate Initial Grade (sum of all weighted scores)
    const wsWritten = parseFloat(updatedStudent.written.ws) || 0;
    const wsPerformance = parseFloat(updatedStudent.performance.ws) || 0;
    const wsQuarterly = parseFloat(updatedStudent.quarterly.ws) || 0;

    updatedStudent.initialGrade = parseFloat(
      (wsWritten + wsPerformance + wsQuarterly).toFixed(2),
    );

    // Calculate Quarterly Grade (using transmutation table)
    if (allActivities.assessment && allActivities.assessment.length > 0) {
      updatedStudent.quarterlyGrade = getTransmutedGrade(
        updatedStudent.initialGrade,
      );
    } else {
      updatedStudent.quarterlyGrade = "";
    }

    return updatedStudent;
  };

  // Function to save calculated grades to the computed_grades table
  const saveComputedGrades = async (student) => {
    if (!classData || !student || !gradingCriteria) {
      console.error("Cannot save computed grades: missing required data");
      return;
    }

    try {
      const { classId, subjectId, schoolYearId } = classData;
      const currentQuarter = parseInt(quarter);

      // Ensure we have valid values for all grades before saving - parse everything as numbers
      const writtenTotal = parseFloat(student.written.total) || 0;
      const writtenPs = parseFloat(student.written.ps) || 0;
      const writtenWs = parseFloat(student.written.ws) || 0;

      const perfTotal = parseFloat(student.performance.total) || 0;
      const perfPs = parseFloat(student.performance.ps) || 0;
      const perfWs = parseFloat(student.performance.ws) || 0;

      const quarterlyTotal = parseFloat(student.quarterly.total) || 0;
      const quarterlyPs = parseFloat(student.quarterly.ps) || 0;
      const quarterlyWs = parseFloat(student.quarterly.ws) || 0;

      const initialGrade = parseFloat(student.initialGrade) || 0;
      const quarterlyGrade = parseFloat(student.quarterlyGrade) || 0;

      // Prepare the data for the computed_grades table - ensure all values are proper types
      const computedGradeData = {
        class_id: parseInt(classId, 10),
        subject_id: parseInt(subjectId, 10),
        school_year_id: parseInt(schoolYearId, 10),
        student_id: parseInt(student.id, 10),
        quarter: currentQuarter,
        written_works_total: writtenTotal,
        written_works_percentage: writtenPs,
        performance_tasks_total: perfTotal,
        performance_tasks_percentage: perfPs,
        quarterly_assessment_total: quarterlyTotal,
        quarterly_assessment_percentage: quarterlyPs,
        final_grade: quarterlyGrade,
      };

      // Log the data to make sure it's correctly formatted
      console.log(
        "Saving computed grades:",
        JSON.stringify(computedGradeData, null, 2),
      );

      // Validate that we have non-zero values to save and that all required fields are present
      if (
        !computedGradeData.class_id ||
        !computedGradeData.subject_id ||
        !computedGradeData.student_id ||
        !computedGradeData.quarter
      ) {
        console.error("Missing required ID fields:", {
          class_id: computedGradeData.class_id,
          subject_id: computedGradeData.subject_id,
          student_id: computedGradeData.student_id,
          quarter: computedGradeData.quarter,
        });
        return;
      }

      const hasGradeData =
        writtenTotal > 0 || perfTotal > 0 || quarterlyTotal > 0;
      if (!hasGradeData) {
        console.log(
          "No meaningful grade data to save - student has no scores yet",
        );
        return;
      }

      // Function to attempt saving grades with retry logic
      const saveWithRetry = async (retryCount = 0, maxRetries = 2) => {
        try {
          // Call API to save the computed grades
          console.log("Sending computed grades to API...");
          const response = await axios.post(
            gradingUrl("/api/grades/computed"),
            computedGradeData,
            { headers: getAuthHeader() },
          );
          console.log("Computed grades saved successfully:", response.data);
          return response;
        } catch (error) {
          if (retryCount < maxRetries) {
            console.log(`Retry attempt ${retryCount + 1} of ${maxRetries}`);
            // Wait a brief moment before retrying
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return saveWithRetry(retryCount + 1, maxRetries);
          }
          throw error; // Re-throw after max retries
        }
      };

      // Use the retry function
      await saveWithRetry();
    } catch (err) {
      console.error("Error saving computed grades:", err);
      if (err.response) {
        console.error("Error status:", err.response.status);
        console.error("Error details:", err.response.data);
        console.error("Request payload:", err.config?.data);

        // Show a user-friendly error message
        setScoreMessage({
          type: "error",
          text: `Failed to save grade calculations: ${err.response.data?.message || "Server error"}`,
        });
        setTimeout(() => setScoreMessage(null), 3000);
      } else if (err.request) {
        // The request was made but no response was received
        console.error("No response received:", err.request);
        setScoreMessage({
          type: "error",
          text: "Network error - please check your connection",
        });
        setTimeout(() => setScoreMessage(null), 3000);
      } else {
        // Something happened in setting up the request
        console.error("Error message:", err.message);
        setScoreMessage({
          type: "error",
          text: `Error: ${err.message}`,
        });
        setTimeout(() => setScoreMessage(null), 3000);
      }
    }
  };

  // Add to the existing state variables
  const [pendingChanges, setPendingChanges] = useState({});
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);

  // Function to track changes instead of saving immediately
  const handleScoreChange = (
    student,
    activityId,
    newScoreValue,
    rawInput = false,
  ) => {
    // Find the activity to get its max_score
    let maxScore = null;
    for (const type of Object.keys(activities)) {
      const found = activities[type].find((a) => a.activity_id === activityId);
      if (found) {
        maxScore = parseFloat(found.max_score);
        break;
      }
    }
    // If rawInput is true, just update pendingChanges and UI with the string value
    if (rawInput) {
      const changeKey = `${student.id}-${activityId}`;
      setPendingChanges((prev) => ({
        ...prev,
        [changeKey]: {
          student,
          activityId,
          newValue: newScoreValue,
          oldValue: student.scores[activityId] || "",
        },
      }));
      setStudents((prevStudents) => {
        return prevStudents.map((s) => {
          if (s.id === student.id) {
            const updatedStudent = {
              ...s,
              scores: { ...s.scores },
            };
            updatedStudent.scores[activityId] = newScoreValue;
            return calculateStudentGrades(
              updatedStudent,
              activities,
              gradingCriteria,
            );
          }
          return s;
        });
      });
      setSelectedStudent(student);
      setSelectedActivity(activityId);
      return;
    }
    let parsedScore = parseFloat(newScoreValue);
    let displayValue = newScoreValue;
    if (!isNaN(parsedScore)) {
      // Format to 2 decimal places if it has a decimal
      if (newScoreValue.includes(".")) {
        displayValue = parsedScore.toFixed(2);
      }
      if (parsedScore < 0) {
        parsedScore = 0;
        displayValue = "0.00";
        setScoreMessage({
          type: "error",
          text: "Score cannot be negative.",
        });
        setTimeout(() => setScoreMessage(null), 2000);
      } else if (maxScore !== null && parsedScore > maxScore) {
        parsedScore = maxScore;
        displayValue = maxScore.toFixed(2);
        // Do not show any error message for exceeding max score
        // setScoreMessage({
        //   type: 'error',
        //   text: `Score cannot exceed maximum score of ${maxScore}.`
        // });
        // setTimeout(() => setScoreMessage(null), 2000);
      }
    }
    // Create a unique key for this score
    const changeKey = `${student.id}-${activityId}`;
    // Update the pending changes
    setPendingChanges((prev) => ({
      ...prev,
      [changeKey]: {
        student,
        activityId,
        newValue: displayValue,
        oldValue: student.scores[activityId] || "",
      },
    }));
    // Update the UI immediately (but don't save to DB yet)
    setStudents((prevStudents) => {
      return prevStudents.map((s) => {
        if (s.id === student.id) {
          // Create a deep copy
          const updatedStudent = {
            ...s,
            scores: { ...s.scores },
          };
          updatedStudent.scores[activityId] = isNaN(parsedScore)
            ? displayValue
            : parsedScore;
          // Recalculate the grades
          return calculateStudentGrades(
            updatedStudent,
            activities,
            gradingCriteria,
          );
        }
        return s;
      });
    });
    // Set the selected student and activity
    setSelectedStudent(student);
    setSelectedActivity(activityId);
  };

  // Function to save a pending score change
  const saveScoreChange = async (studentId, activityId) => {
    // No longer preventing saving scores for students with uploaded grades

    const changeKey = `${studentId}-${activityId}`;
    const change = pendingChanges[changeKey];

    if (!change) return;

    try {
      // Parse and validate the score
      const newScore = parseFloat(change.newValue);
      if (isNaN(newScore)) {
        setScoreMessage({
          type: "error",
          text: "Score must be a valid number.",
        });
        setTimeout(() => setScoreMessage(null), 3000);
        return;
      }

      // Find the activity
      const activityType = Object.keys(activities).find((type) =>
        activities[type].some((act) => act.activity_id === activityId),
      );

      if (!activityType) {
        console.error("Activity not found:", activityId);
        return;
      }

      const activity = activities[activityType].find(
        (a) => a.activity_id === activityId,
      );

      // Validate max score
      if (newScore > parseFloat(activity.max_score)) {
        // Do not show any error message for exceeding max score
        // setScoreMessage({
        //   type: 'error',
        //   text: `Score cannot exceed maximum score of ${activity.max_score}.`
        // });
        // setTimeout(() => setScoreMessage(null), 3000);
        return;
      }

      // Display saving indicator
      // Do not show any info message

      // Prepare the score data
      const scoreData = {
        student_id: change.student.id,
        activity_id: activityId,
        score: newScore,
        quarter: parseInt(quarter),
        user_id: classData.userId,
      };

      // Call the API to save the score
      const response = await axios.post(
        gradingUrl("/api/activities/scores"),
        scoreData,
        { headers: getAuthHeader() },
      );
      console.log("Score saved:", response.data);

      // Find the updated student
      const updatedStudent = students.find((s) => s.id === change.student.id);

      // Save computed grades
      if (updatedStudent) {
        await saveComputedGrades(updatedStudent);
      }

      // Remove from pending changes
      setPendingChanges((prev) => {
        const updated = { ...prev };
        delete updated[changeKey];
        return updated;
      });

      // Display success message
      // Do not show any success message
    } catch (err) {
      console.error("Error saving score:", err);
      setScoreMessage({
        type: "error",
        text: "Failed to save score. Please try again.",
      });
      setTimeout(() => setScoreMessage(null), 3000);
    }
  };

  // Function to remove a score
  const removeScore = async (student, activityId) => {
    // No longer preventing removing scores for students with uploaded grades

    try {
      setScoreMessage({
        type: "info",
        text: "Removing score...",
      });

      // Call the API to remove the score
      const response = await axios.delete(
        gradingUrl(`/api/activities/${activityId}`),
        {
          data: {
            student_id: student.id,
            activity_id: activityId,
            quarter: parseInt(quarter),
          },
          headers: getAuthHeader(),
        },
      );

      console.log("Score removed:", response.data);

      // Update the local state
      setStudents((prevStudents) => {
        return prevStudents.map((s) => {
          if (s.id === student.id) {
            // Create a deep copy
            const updatedStudent = {
              ...s,
              scores: { ...s.scores },
            };

            // Remove the score
            delete updatedStudent.scores[activityId];

            // Recalculate the grades
            return calculateStudentGrades(
              updatedStudent,
              activities,
              gradingCriteria,
            );
          }
          return s;
        });
      });

      // Find the updated student
      const updatedStudent = students.find((s) => s.id === student.id);

      // Save computed grades
      if (updatedStudent) {
        await saveComputedGrades(updatedStudent);
      }

      // Remove from pending changes
      const changeKey = `${student.id}-${activityId}`;
      setPendingChanges((prev) => {
        const updated = { ...prev };
        delete updated[changeKey];
        return updated;
      });

      // Display success message
      setScoreMessage({
        type: "success",
        text: "Score removed successfully!",
      });
      setTimeout(() => setScoreMessage(null), 2000);
    } catch (err) {
      console.error("Error removing score:", err);
      setScoreMessage({
        type: "error",
        text: "Failed to remove score. Please try again.",
      });
      setTimeout(() => setScoreMessage(null), 3000);
    }
  };

  // Function to discard changes
  const discardChanges = (studentId, activityId) => {
    const changeKey = `${studentId}-${activityId}`;
    const change = pendingChanges[changeKey];

    if (!change) return;

    // Update the UI to revert the change
    setStudents((prevStudents) => {
      return prevStudents.map((s) => {
        if (s.id === studentId) {
          // Create a deep copy
          const updatedStudent = {
            ...s,
            scores: { ...s.scores },
          };

          // Revert to the old value
          if (change.oldValue === "") {
            delete updatedStudent.scores[activityId];
          } else {
            updatedStudent.scores[activityId] = parseFloat(change.oldValue);
          }

          // Recalculate the grades
          return calculateStudentGrades(
            updatedStudent,
            activities,
            gradingCriteria,
          );
        }
        return s;
      });
    });

    // Remove from pending changes
    setPendingChanges((prev) => {
      const updated = { ...prev };
      delete updated[changeKey];
      return updated;
    });

    // Display message
    setScoreMessage({
      type: "info",
      text: "Changes discarded.",
    });
    setTimeout(() => setScoreMessage(null), 2000);
  };

  // Function to handle opening the modal
  const handleOpenModal = (type) => {
    setActivityType(type);
    setActivityName("");
    setHighestPossibleScore("");
    setSaveError(null);
    setShowModal(true);
  };

  // Function to handle closing the modal
  const handleCloseModal = () => {
    setShowModal(false);
  };

  // Function to save a new activity
  const handleSaveActivity = async (name, score) => {
    try {
      setIsSaving(true);
      setSaveError(null);

      console.log("Activity data received:", { name, score });

      // Ensure values are correct before creating the activity data
      if (
        !classData ||
        !classData.classId ||
        !classData.subjectId ||
        !classData.schoolYearId
      ) {
        setSaveError("Missing class data. Please reload the page.");
        setIsSaving(false);
        return;
      }

      // Validate name and score first
      if (!name || !name.trim()) {
        setSaveError("Activity Name is required");
        setIsSaving(false);
        return;
      }

      const parsedScore = parseFloat(score);
      if (isNaN(parsedScore) || parsedScore <= 0) {
        setSaveError("Highest Possible Score must be a positive number");
        setIsSaving(false);
        return;
      }

      // Prepare activity data - ensuring all fields have correct types
      const activityData = {
        class_id: parseInt(classData.classId, 10),
        subject_id: parseInt(classData.subjectId, 10),
        school_year_id: parseInt(classData.schoolYearId, 10),
        teachers_name: classData.teacherName || "",
        activity_type: activityType, // 'written', 'performance', or 'assessment'
        title: name.trim(),
        max_score: parsedScore,
        quarter: parseInt(quarter, 10),
        user_id: parseInt(classData.userId, 10), // Add user_id to the activity data
      };

      // Additional validation on the client side
      const missingFields = [];
      if (!activityData.class_id) missingFields.push("class_id");
      if (!activityData.subject_id) missingFields.push("subject_id");
      if (!activityData.school_year_id) missingFields.push("school_year_id");
      if (!activityData.activity_type) missingFields.push("activity_type");
      if (!activityData.title) missingFields.push("title");
      if (isNaN(activityData.max_score) || activityData.max_score <= 0)
        missingFields.push("max_score");
      if (!activityData.quarter) missingFields.push("quarter");

      if (missingFields.length > 0) {
        console.error("Missing required fields:", missingFields);
        setSaveError(`Missing required fields: ${missingFields.join(", ")}`);
        setIsSaving(false);
        return;
      }

      console.log(
        "Sending activity data to server:",
        JSON.stringify(activityData, null, 2),
      );

      // Make API call to save activity
      const response = await axios.post(
        gradingUrl("/api/activities"),
        activityData,
        { headers: getAuthHeader() },
      );

      console.log("Activity saved - server response:", response.data);

      // Update the activities state directly with the new activity
      const newActivity = response.data;

      // Ensure the activity has title property for consistency with how we display activities
      const processedActivity = {
        ...newActivity,
        // Set both title and activity_name to ensure consistency
        title: newActivity.title || name.trim(),
        activity_name: newActivity.title || name.trim(),
        // Make sure we have the correct activity_id for score tracking
        activity_id: newActivity.activity_id,
      };

      console.log("Adding new activity to state:", processedActivity);

      // Add the new activity to the appropriate array
      setActivities((prevActivities) => {
        const updatedActivities = { ...prevActivities };

        if (activityType === "written") {
          updatedActivities.written = [
            ...updatedActivities.written,
            processedActivity,
          ];
        } else if (activityType === "performance") {
          updatedActivities.performance = [
            ...updatedActivities.performance,
            processedActivity,
          ];
        } else if (activityType === "assessment") {
          updatedActivities.assessment = [
            ...updatedActivities.assessment,
            processedActivity,
          ];
        }

        return updatedActivities;
      });

      // Close modal
      setShowModal(false);

      // Load scores to update grades when a new activity is added
      await loadScores();
    } catch (err) {
      console.error("Error saving activity:", err);
      if (err.response) {
        console.error(
          "Server response error:",
          err.response.status,
          err.response.data,
        );

        // Log the request that was sent
        console.error(
          "Request config that caused error:",
          err.config?.data ? JSON.parse(err.config.data) : "No data available",
        );

        // Show more detailed error to the user
        if (err.response.status === 400) {
          setSaveError(
            `Bad request: ${err.response.data.error || "Missing required fields"}`,
          );
        } else {
          setSaveError(
            err.response?.data?.message ||
              err.response?.data?.error ||
              "Failed to save activity. Please try again.",
          );
        }
      } else if (err.request) {
        // The request was made but no response was received
        console.error("No response received:", err.request);
        setSaveError(
          "No response from server. Please check your connection and try again.",
        );
      } else {
        // Something happened in setting up the request
        console.error("Error setting up request:", err.message);
        setSaveError("An error occurred while saving. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Function to load scores from the API
  const loadScores = async () => {
    if (!classData) return;

    try {
      // Still load activity scores to ensure we have the latest data
      const response = await axios.get(
        gradingUrl("/api/activities/activities-and-grades"),
        {
          params: {
            class_id: classData.classId,
            subject_id: classData.subjectId,
            quarter: parseInt(quarter),
          },
          headers: getAuthHeader(),
        },
      );

      console.log("Scores loaded from API:", response.data);

      // Create a master scores lookup organized by activity_id and student_id
      const scoreData = response.data;

      // Update student scores in state
      const updatedStudents = [];
      setStudents((prevStudents) => {
        const newStudents = prevStudents.map((student) => {
          // Create a copy of the student object
          const updatedStudent = { ...student };
          updatedStudent.scores = {};

          // Process written works
          if (scoreData.written && Array.isArray(scoreData.written)) {
            scoreData.written.forEach((activity) => {
              const studentScore = activity.scores.find(
                (s) => s.student_id === student.id,
              );
              if (studentScore) {
                updatedStudent.scores[activity.activity_id] =
                  studentScore.score;
              }
            });
          }

          // Process performance tasks
          if (scoreData.performance && Array.isArray(scoreData.performance)) {
            scoreData.performance.forEach((activity) => {
              const studentScore = activity.scores.find(
                (s) => s.student_id === student.id,
              );
              if (studentScore) {
                updatedStudent.scores[activity.activity_id] =
                  studentScore.score;
              }
            });
          }

          // Process quarterly assessment
          if (scoreData.assessment && Array.isArray(scoreData.assessment)) {
            scoreData.assessment.forEach((activity) => {
              const studentScore = activity.scores.find(
                (s) => s.student_id === student.id,
              );
              if (studentScore) {
                updatedStudent.scores[activity.activity_id] =
                  studentScore.score;
              }
            });
          }

          // Calculate all grades using the helper function
          const calculatedStudent = calculateStudentGrades(
            updatedStudent,
            activities,
            gradingCriteria,
          );
          updatedStudents.push(calculatedStudent);
          return calculatedStudent;
        });

        return newStudents;
      });

      // Save computed grades for all students
      for (const student of updatedStudents) {
        await saveComputedGrades(student);
      }

      console.log("Student scores updated and computed grades saved");

      // Clear any pending changes as they've been loaded from the server
      setPendingChanges({});
    } catch (err) {
      console.error("Error loading scores:", err);
      if (err.response) {
        console.error("Error status:", err.response.status);
        console.error("Error details:", err.response.data);
      }
    }
  };

  // Function to save all pending changes
  const saveAllChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) {
      // Do not show any info message
      return;
    }

    // Do not show any info message

    let errorCount = 0;

    // Save each pending change one by one
    for (const changeKey of Object.keys(pendingChanges)) {
      const [studentId, activityId] = changeKey.split("-");
      try {
        await saveScoreChange(studentId, parseInt(activityId));
      } catch (err) {
        console.error(`Error saving change for ${changeKey}:`, err);
        errorCount++;
      }
    }

    if (errorCount > 0) {
      setScoreMessage({
        type: "error",
        text: `Failed to save ${errorCount} changes. Please try again.`,
      });
    } else {
      // Do not show any success message
    }

    setTimeout(() => setScoreMessage(null), 3000);
  };

  // Function to discard all pending changes
  const discardAllChanges = () => {
    if (Object.keys(pendingChanges).length === 0) {
      setScoreMessage({
        type: "info",
        text: "No changes to discard.",
      });
      setTimeout(() => setScoreMessage(null), 2000);
      return;
    }

    // Reload scores to reset to server state
    loadScores();

    // Clear pending changes
    setPendingChanges({});
  };

  // Check if we have the required state data
  useEffect(() => {
    let isMounted = true;
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!location.state) {
          setError("No class data provided");
          setLoading(false);
          return;
        }
        // 1. Set classData from location.state
        const {
          userId,
          classId,
          subjectId,
          schoolYearId,
          gradeLevel,
          section,
          subject,
          schoolYear,
        } = location.state;
        setClassData({
          userId,
          classId,
          subjectId,
          schoolYearId,
          gradeLevel,
          section,
          subject,
          schoolYear,
          teacherName: "",
        });
        // 2. Fetch teacher and grading criteria in parallel
        const teacherPromise = axios.get(gradingUrl(`/users/${userId}`), { headers: getAuthHeader() });
        const criteriaPromise = (async () => {
          try {
            let criteriaData = null;
            try {
              const res = await axios.get(
                gradingUrl(`/api/grading-criteria/${subjectId}/${schoolYearId}`),
                { headers: getAuthHeader() },
              );
              criteriaData = res.data;
            } catch {
              try {
                const res = await axios.get(gradingUrl("/api/grading-criteria"), {
                  params: { subject_id: subjectId, school_year_id: schoolYearId },
                  headers: getAuthHeader(),
                });
                criteriaData = res.data;
              } catch {
                const res = await axios.get(
                  gradingUrl(`/api/grading-criteria/subject/${subjectId}/schoolYear/${schoolYearId}`),
                  { headers: getAuthHeader() },
                );
                criteriaData = res.data;
              }
            }
            return criteriaData;
          } catch (err) {
            return null;
          }
        })();
        const [teacherResponse, criteriaData] = await Promise.all([
          teacherPromise,
          criteriaPromise,
        ]);
        if (!isMounted) return;
        // Set teacher name
        setClassData((prev) => ({
          ...prev,
          teacherName: `${teacherResponse.data.fname} ${teacherResponse.data.mname ? teacherResponse.data.mname + " " : ""}${teacherResponse.data.lname}`,
        }));
        // Set grading criteria and hasCriteria
        const isValidCriteria = (criteria) => {
          return (
            criteria &&
            criteria.written_works_percentage !== undefined &&
            criteria.performance_tasks_percentage !== undefined &&
            criteria.quarterly_assessment_percentage !== undefined &&
            criteria.written_works_percentage > 0 &&
            criteria.performance_tasks_percentage > 0 &&
            criteria.quarterly_assessment_percentage > 0 &&
            criteria.written_works_percentage +
              criteria.performance_tasks_percentage +
              criteria.quarterly_assessment_percentage ===
              100
          );
        };
        if (criteriaData && isValidCriteria(criteriaData)) {
          setGradingCriteria({
            written_works_percentage: criteriaData.written_works_percentage,
            performance_tasks_percentage:
              criteriaData.performance_tasks_percentage,
            quarterly_assessment_percentage:
              criteriaData.quarterly_assessment_percentage,
          });
          setHasCriteria(true);
        } else if (
          criteriaData &&
          Array.isArray(criteriaData) &&
          criteriaData.length > 0 &&
          isValidCriteria(criteriaData[0])
        ) {
          setGradingCriteria({
            written_works_percentage: criteriaData[0].written_works_percentage,
            performance_tasks_percentage:
              criteriaData[0].performance_tasks_percentage,
            quarterly_assessment_percentage:
              criteriaData[0].quarterly_assessment_percentage,
          });
          setHasCriteria(true);
        } else {
          setGradingCriteria({
            written_works_percentage: 0,
            performance_tasks_percentage: 0,
            quarterly_assessment_percentage: 0,
          });
          setHasCriteria(false);
        }
        // 3. Fetch students and activities in parallel
        const studentsPromise = axios.get(
          gradingUrl(`/api/classes/students-by-class/${classId}`),
          { headers: getAuthHeader() },
        );
        const activitiesPromise = axios.get(
          gradingUrl(`/api/activities/class/${classId}/subject/${subjectId}/quarter/${parseInt(quarter)}`),
          { headers: getAuthHeader() },
        );
        const [studentsResponse, activitiesResponse] = await Promise.all([
          studentsPromise,
          activitiesPromise,
        ]);
        if (!isMounted) return;
        // Set students
        const formattedStudents = studentsResponse.data.map((student) => ({
          id: student.student_id,
          name: `${student.lname}, ${student.fname} ${student.mname || ""}`.trim(),
          lrn: student.lrn || null,
          written: { total: 0, ps: 0, ws: 0 },
          performance: { total: 0, ps: 0, ws: 0 },
          quarterly: { total: 0, ps: 0, ws: 0 },
          initialGrade: 0,
          quarterlyGrade: 0,
          scores: {},
        }));
        setStudents(formattedStudents);
        // Set activities
        let activitiesData = activitiesResponse.data.map((activity) => ({
          ...activity,
          title: activity.title || activity.activity_name,
        }));
        setActivities({
          written:
            activitiesData.filter((act) => act.activity_type === "written") ||
            [],
          performance:
            activitiesData.filter(
              (act) => act.activity_type === "performance",
            ) || [],
          assessment:
            activitiesData.filter(
              (act) => act.activity_type === "assessment",
            ) || [],
        });
        // 4. Fetch scores and uploaded grades in parallel
        const scoresPromise = axios.get(
          gradingUrl("/api/activities/activities-and-grades"),
          {
            params: { class_id: classId, subject_id: subjectId, quarter: parseInt(quarter) },
            headers: getAuthHeader(),
          },
        );
        const uploadedGradesPromise = axios.get(
          gradingUrl("/api/grades/check-existing"),
          { params: { classId, subjectId, quarter: parseInt(quarter) }, headers: getAuthHeader() },
        );
        const [scoresResponse, uploadedGradesResponse] = await Promise.all([
          scoresPromise,
          uploadedGradesPromise,
        ]);
        if (!isMounted) return;
        // Set scores
        const scoreData = scoresResponse.data;
        setStudents((prevStudents) => {
          return prevStudents.map((student) => {
            const updatedStudent = { ...student, scores: {} };
            if (scoreData.written && Array.isArray(scoreData.written)) {
              scoreData.written.forEach((activity) => {
                const studentScore = activity.scores.find(
                  (s) => s.student_id === student.id,
                );
                if (studentScore) {
                  updatedStudent.scores[activity.activity_id] =
                    studentScore.score;
                }
              });
            }
            if (scoreData.performance && Array.isArray(scoreData.performance)) {
              scoreData.performance.forEach((activity) => {
                const studentScore = activity.scores.find(
                  (s) => s.student_id === student.id,
                );
                if (studentScore) {
                  updatedStudent.scores[activity.activity_id] =
                    studentScore.score;
                }
              });
            }
            if (scoreData.assessment && Array.isArray(scoreData.assessment)) {
              scoreData.assessment.forEach((activity) => {
                const studentScore = activity.scores.find(
                  (s) => s.student_id === student.id,
                );
                if (studentScore) {
                  updatedStudent.scores[activity.activity_id] =
                    studentScore.score;
                }
              });
            }
            return calculateStudentGrades(
              updatedStudent,
              {
                written:
                  activitiesData.filter(
                    (act) => act.activity_type === "written",
                  ) || [],
                performance:
                  activitiesData.filter(
                    (act) => act.activity_type === "performance",
                  ) || [],
                assessment:
                  activitiesData.filter(
                    (act) => act.activity_type === "assessment",
                  ) || [],
              },
              criteriaData && isValidCriteria(criteriaData)
                ? criteriaData
                : gradingCriteria,
            );
          });
        });
        // Set uploaded grades
        const uploadedGradesMap = {};
        uploadedGradesResponse.data.forEach((grade) => {
          uploadedGradesMap[grade.student_id] = grade.grade;
        });
        setUploadedGrades(uploadedGradesMap);
        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        setError("Failed to load class data.");
        setLoading(false);
      }
    };
    fetchAllData();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line
  }, [location, quarter]);

  const loadTeacherData = async (userId) => {
    try {
      setLoading(true);

      // Get teacher details
      const teacherResponse = await axios.get(gradingUrl(`/users/${userId}`), { headers: getAuthHeader() });
      const teacherData = teacherResponse.data;

      console.log("Teacher data from API:", teacherData);

      // Update class data with teacher name
      setClassData((prev) => ({
        ...prev,
        teacherName: `${teacherData.fname} ${teacherData.mname ? teacherData.mname + " " : ""}${teacherData.lname}`,
      }));

      setLoading(false);
    } catch (err) {
      console.error("Error loading teacher data:", err);
      setError(err.message || "Failed to load teacher data");
      setLoading(false);
    }
  };

  const loadGradingCriteria = async (subjectId, schoolYearId) => {
    try {
      // Get grading criteria for the specific subject and school year
      console.log(
        `Fetching criteria for subject ID: ${subjectId} and school year ID: ${schoolYearId}`,
      );

      // Try different possible API endpoint formats one by one
      let criteriaData = null;
      let criteriaResponse = null;

      try {
        // Try format 1: /api/grading-criteria/{criteria_id}
        criteriaResponse = await axios.get(
          gradingUrl(`/api/grading-criteria/${subjectId}/${schoolYearId}`),
          { headers: getAuthHeader() },
        );
        criteriaData = criteriaResponse.data;
      } catch (endpointErr1) {
        console.log("Endpoint format 1 failed, trying format 2...");

        try {
          // Try format 2: /api/grading-criteria?subject_id=X&school_year_id=Y
          criteriaResponse = await axios.get(
            gradingUrl("/api/grading-criteria"),
            {
              params: { subject_id: subjectId, school_year_id: schoolYearId },
              headers: getAuthHeader(),
            },
          );
          criteriaData = criteriaResponse.data;
        } catch (endpointErr2) {
          console.log("Endpoint format 2 failed, trying format 3...");

          // Try format 3: /api/grading-criteria/subject/{subject_id}/schoolYear/{school_year_id}
          criteriaResponse = await axios.get(
            gradingUrl(`/api/grading-criteria/subject/${subjectId}/schoolYear/${schoolYearId}`),
            { headers: getAuthHeader() },
          );
          criteriaData = criteriaResponse.data;
        }
      }

      console.log("API Response:", criteriaResponse);
      console.log("Grading criteria from API:", criteriaData);

      // Function to check if criteria is valid
      const isValidCriteria = (criteria) => {
        return (
          criteria &&
          criteria.written_works_percentage !== undefined &&
          criteria.performance_tasks_percentage !== undefined &&
          criteria.quarterly_assessment_percentage !== undefined &&
          // Check that all percentages are greater than 0
          criteria.written_works_percentage > 0 &&
          criteria.performance_tasks_percentage > 0 &&
          criteria.quarterly_assessment_percentage > 0 &&
          // Check that percentages sum to 100%
          criteria.written_works_percentage +
            criteria.performance_tasks_percentage +
            criteria.quarterly_assessment_percentage ===
            100
        );
      };

      // Check if we have a non-empty response and it has the required fields
      if (
        criteriaData &&
        typeof criteriaData === "object" &&
        isValidCriteria(criteriaData)
      ) {
        console.log("Valid criteria found, setting hasCriteria to true");

        setGradingCriteria({
          written_works_percentage: criteriaData.written_works_percentage,
          performance_tasks_percentage:
            criteriaData.performance_tasks_percentage,
          quarterly_assessment_percentage:
            criteriaData.quarterly_assessment_percentage,
        });
        setHasCriteria(true);
      } else if (
        criteriaData &&
        Array.isArray(criteriaData) &&
        criteriaData.length > 0
      ) {
        // Handle if the API returns an array with criteria object inside
        const firstCriteria = criteriaData[0];

        console.log("Array criteria found, using first item:", firstCriteria);

        if (isValidCriteria(firstCriteria)) {
          setGradingCriteria({
            written_works_percentage: firstCriteria.written_works_percentage,
            performance_tasks_percentage:
              firstCriteria.performance_tasks_percentage,
            quarterly_assessment_percentage:
              firstCriteria.quarterly_assessment_percentage,
          });
          setHasCriteria(true);
        } else {
          // Criteria found but not valid, preserve their values but mark as not having criteria
          setGradingCriteria({
            written_works_percentage:
              firstCriteria.written_works_percentage || 0,
            performance_tasks_percentage:
              firstCriteria.performance_tasks_percentage || 0,
            quarterly_assessment_percentage:
              firstCriteria.quarterly_assessment_percentage || 0,
          });
          setHasCriteria(false);
        }
      } else {
        // No valid criteria found, preserve whatever was returned from the API without logging an error
        if (criteriaData && criteriaData.exists === false) {
          // This is the expected response format when no criteria exists
          setGradingCriteria({
            written_works_percentage:
              criteriaData.written_works_percentage || 0,
            performance_tasks_percentage:
              criteriaData.performance_tasks_percentage || 0,
            quarterly_assessment_percentage:
              criteriaData.quarterly_assessment_percentage || 0,
          });
        } else {
          // Reset to zeros if no data at all
          setGradingCriteria({
            written_works_percentage: 0,
            performance_tasks_percentage: 0,
            quarterly_assessment_percentage: 0,
          });
        }
        setHasCriteria(false);
      }
    } catch (err) {
      console.error("Error loading grading criteria:", err);
      if (err.response) {
        console.error("Error status:", err.response.status);
        console.error("Error details:", err.response.data);
      } else {
        console.error("No response from server");
      }

      // Reset to zeros on error
      setGradingCriteria({
        written_works_percentage: 0,
        performance_tasks_percentage: 0,
        quarterly_assessment_percentage: 0,
      });
      setHasCriteria(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleQuarterChange = (e) => {
    setQuarter(e.target.value);
  };

  // Function to handle printing grades
  const handlePrint = async () => {
    try {
      // Validate required data before proceeding
      if (!classData) {
        alert("Cannot generate PDF: Class data is missing");
        return;
      }

      if (!gradingCriteria || !hasCriteria) {
        alert("Cannot generate PDF: Grading criteria is not set");
        return;
      }

      if (students.length === 0) {
        alert("Cannot generate PDF: No students to display");
        return;
      }

      // Set PDF generation flag
      document.body.classList.add("generating-grades-pdf");

      // Wait for the next render cycle to ensure the PDF template is processed
      setTimeout(async () => {
        try {
          // Find the PDF template in the DOM
          const pdfTemplate = document.querySelector(".grades-pdf-template");

          if (!pdfTemplate) {
            throw new Error("PDF template not found in the DOM");
          }

          // Create a new PDF document in landscape orientation
          const pdf = new jsPDF("l", "mm", "a4");

          // Render the first page with the grades table
          const firstPage = pdfTemplate.querySelector(".first-page");

          if (!firstPage) {
            throw new Error("First page element not found in the template");
          }

          const firstPageCanvas = await html2canvas(firstPage, {
            scale: 3, // Higher scale for better quality (increased from 2 to 3)
            useCORS: true,
            logging: false, // Disable logging for better performance
            backgroundColor: "#fff",
            allowTaint: true,
            foreignObjectRendering: false, // Set to false to ensure CSS is correctly applied
            onclone: (clonedDoc) => {
              // Add inline styles to ensure proper rendering
              const style = clonedDoc.createElement("style");
              style.innerHTML = `
                .grades-pdf-template {
                  display: block !important;
                  font-family: Arial, sans-serif;
                }
                .grades-table {
                  width: 100%;
                  border-collapse: collapse;
                  border: 1px solid #000;
                }
                .grades-table th, .grades-table td {
                  border: 1px solid #000;
                  padding: 4px;
                  text-align: center;
                  font-size: 12px;
                }
                /* Override border styles for grade headers - explicitly define each border */
                .grades-table thead tr:first-child th:nth-last-child(1),
                .grades-table thead tr:first-child th:nth-last-child(2) {
                  border-left: 1px solid black !important;
                  border-right: 1px solid black !important;
                  border-top: 1px solid black !important;
                  border-bottom: none !important;
                }

                /* Override border styles for cells below grade headers */
                .grades-table thead tr:nth-child(2) th:nth-last-child(1),
                .grades-table thead tr:nth-child(2) th:nth-last-child(2) {
                  border-left: 1px solid black !important;
                  border-right: 1px solid black !important;
                  border-top: none !important;
                  border-bottom: 1px solid black !important;
                }
              `;
              clonedDoc.head.appendChild(style);

              // Add extra padding to prevent headers from being cut off
              const firstPageEl = clonedDoc.querySelector(".first-page");
              if (firstPageEl) {
                firstPageEl.style.paddingTop = "8mm";
              }

              // Apply specific styles for the grade headers
              try {
                // Get the table headers from the first row
                const headerRow = clonedDoc.querySelector(
                  ".grades-table thead tr:first-child",
                );
                if (headerRow) {
                  const allHeaderCells = headerRow.querySelectorAll("th");
                  const initialGradeHeader =
                    allHeaderCells[allHeaderCells.length - 2];
                  const quarterlyGradeHeader =
                    allHeaderCells[allHeaderCells.length - 1];

                  // Set the explicit border styles for the grade headers
                  if (initialGradeHeader) {
                    initialGradeHeader.style.borderLeft = "1px solid black";
                    initialGradeHeader.style.borderRight = "1px solid black";
                    initialGradeHeader.style.borderTop = "1px solid black";
                    initialGradeHeader.style.borderBottom = "none";
                    // Remove the border class to prevent default styling
                    initialGradeHeader.classList.remove("border");
                    initialGradeHeader.classList.remove("border-black");
                  }

                  if (quarterlyGradeHeader) {
                    quarterlyGradeHeader.style.borderLeft = "1px solid black";
                    quarterlyGradeHeader.style.borderRight = "1px solid black";
                    quarterlyGradeHeader.style.borderTop = "1px solid black";
                    quarterlyGradeHeader.style.borderBottom = "none";
                    // Remove the border class to prevent default styling
                    quarterlyGradeHeader.classList.remove("border");
                    quarterlyGradeHeader.classList.remove("border-black");
                  }
                }

                // Get the cells from the second row
                const subHeaderRow = clonedDoc.querySelector(
                  ".grades-table thead tr:nth-child(2)",
                );
                if (subHeaderRow) {
                  const allSubHeaderCells = subHeaderRow.querySelectorAll("th");
                  const initialGradeSubHeader =
                    allSubHeaderCells[allSubHeaderCells.length - 2];
                  const quarterlyGradeSubHeader =
                    allSubHeaderCells[allSubHeaderCells.length - 1];

                  // Set the explicit border styles for the sub-header cells
                  if (initialGradeSubHeader) {
                    initialGradeSubHeader.style.borderLeft = "1px solid black";
                    initialGradeSubHeader.style.borderRight = "1px solid black";
                    initialGradeSubHeader.style.borderTop = "none";
                    initialGradeSubHeader.style.borderBottom =
                      "1px solid black";
                    // Remove the border class to prevent default styling
                    initialGradeSubHeader.classList.remove("border");
                    initialGradeSubHeader.classList.remove("border-black");
                  }

                  if (quarterlyGradeSubHeader) {
                    quarterlyGradeSubHeader.style.borderLeft =
                      "1px solid black";
                    quarterlyGradeSubHeader.style.borderRight =
                      "1px solid black";
                    quarterlyGradeSubHeader.style.borderTop = "none";
                    quarterlyGradeSubHeader.style.borderBottom =
                      "1px solid black";
                    // Remove the border class to prevent default styling
                    quarterlyGradeSubHeader.classList.remove("border");
                    quarterlyGradeSubHeader.classList.remove("border-black");
                  }
                }
              } catch (err) {
                console.error("Error applying custom header styles:", err);
              }
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

          // Generate filename with class and quarter information
          const quarterName = quarter ? `Q${quarter}` : "Quarter";
          const className = classData
            ? classData.gradeLevel === "Kindergarten"
              ? `Kindergarten-${classData.section}`
              : `Grade ${classData.gradeLevel}-${classData.section}`
            : "Class";
          const subjectName = classData
            ? classData.subject.replace(/\s+/g, "_")
            : "Subject";
          const filename = `${className} Class Record on ${subjectName} - ${quarterName}.pdf`;

          // Save the PDF directly without showing a preview
          pdf.save(filename);

          // Remove PDF generation flag
          document.body.classList.remove("generating-grades-pdf");
        } catch (innerError) {
          console.error("Error during PDF generation:", innerError);
          alert(`Error generating PDF: ${innerError.message}`);
          document.body.classList.remove("generating-grades-pdf");
        }
      }, 300); // Increased timeout to ensure DOM is ready
    } catch (error) {
      console.error("Error in handlePrint function:", error);
      alert(`Error preparing PDF: ${error.message}`);
      document.body.classList.remove("generating-grades-pdf");
    }
  };

  // Function to render dynamic activity columns - 2 lines max, ellipsis if overflow
  const renderActivityColumns = (type) => {
    const activityList = activities[type] || [];
    if (activityList.length === 0) return null;
    return activityList.map((activity, index) => (
      <th
        key={activity.activity_id || index}
        className="border border-black px-0.5 py-0.5 font-medium text-center bg-white text-[9px] leading-tight group relative align-top"
        title={`${activity.title} (Max: ${activity.max_score})`}
      >
        <span
          className="block px-0.5 py-0.5 text-center line-clamp-2 break-words"
          title={activity.title}
        >
          {activity.title || `Activity ${index + 1}`}
        </span>
        {/* Delete button - top right */}
        <button
          onClick={() =>
            setConfirmDelete({
              open: true,
              activityId: activity.activity_id,
              type,
            })
          }
          disabled={deletingActivityId === activity.activity_id}
          className="absolute top-0 right-0 p-0.5 hover:bg-red-100 z-10"
          style={{ lineHeight: 0 }}
          title="Delete activity"
        >
          {deletingActivityId === activity.activity_id ? (
            <svg
              className="animate-spin h-2.5 w-2.5 text-red-500"
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
          ) : (
            <svg
              className="h-2.5 w-2.5 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
        </button>
      </th>
    ));
  };

  // Updated function to render activity scores with action buttons
  const renderActivityScores = (type, student) => {
    // Check if student has uploaded grades - only used for visual indicator, not disabling
    const isUploaded = uploadedGrades[student.id] !== undefined;

    return (
      <>
        {activities[type].map((activity) => {
          const currentValue = student.scores[activity.activity_id] || "";
          const changeKey = `${student.id}-${activity.activity_id}`;
          const hasChanges = pendingChanges[changeKey] !== undefined;
          const inputKey = `${student.id}-${activity.activity_id}`;
          return (
            <td
              key={activity.activity_id}
              className="border border-black px-0.5 py-0.5 text-center bg-white relative align-middle"
            >
              <input
                ref={(el) => {
                  if (el) inputRefs.current[inputKey] = el;
                }}
                type="text"
                value={currentValue}
                onChange={(e) => {
                  let val = e.target.value;
                  // Allow any value that matches /^\d*\.?\d{0,2}$/ or is just '.'
                  if (/^\d*\.?\d{0,2}$/.test(val) || val === ".") {
                    handleScoreChange(student, activity.activity_id, val, true);
                  }
                }}
                onBlur={(e) => {
                  let val = e.target.value;
                  // If only a decimal point, clear the input
                  if (val === ".") {
                    handleScoreChange(student, activity.activity_id, "", true);
                    return;
                  }
                  // If valid number, format to 2 decimals
                  if (/^\d*\.?\d+$/.test(val)) {
                    val = parseFloat(val).toFixed(2);
                    handleScoreChange(student, activity.activity_id, val, true);
                  }
                }}
                className={`w-full min-w-[24px] text-center text-xs p-0.5 border ${
                  hasChanges
                    ? "border-yellow-400 bg-yellow-50"
                    : "border-transparent"
                } focus:border-blue-400 focus:outline-none`}
                placeholder="-"
              />
              {/* Edit (pencil) button - smaller, shows on hover */}
              <button
                type="button"
                className="absolute top-0 left-0 p-0.5 hover:bg-blue-100 z-10 opacity-80 hover:opacity-100"
                style={{ lineHeight: 0 }}
                title="Edit score"
                onClick={() => {
                  const ref = inputRefs.current[inputKey];
                  if (ref) ref.focus();
                }}
              >
                <svg
                  className="h-2.5 w-2.5 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13zm-6 6h12"
                  />
                </svg>
              </button>
              {hasChanges && (
                <div className="absolute -top-0.5 -right-0.5 bg-yellow-400 text-white rounded-full w-2 h-2"></div>
              )}
            </td>
          );
        })}
      </>
    );
  };

  // Function to calculate total max scores for each category
  const calculateTotalMaxScores = () => {
    const maxScores = {
      written: 0,
      performance: 0,
      assessment: 0,
    };

    if (activities.written && Array.isArray(activities.written)) {
      activities.written.forEach((activity) => {
        maxScores.written += parseFloat(activity.max_score || 0);
      });
    }

    if (activities.performance && Array.isArray(activities.performance)) {
      activities.performance.forEach((activity) => {
        maxScores.performance += parseFloat(activity.max_score || 0);
      });
    }

    if (activities.assessment && Array.isArray(activities.assessment)) {
      activities.assessment.forEach((activity) => {
        maxScores.assessment += parseFloat(activity.max_score || 0);
      });
    }

    return maxScores;
  };

  // Function to render highest possible score cells for activities - compact
  const renderHighestPossibleScores = (type) => {
    const activityList = activities[type] || [];
    if (activityList.length === 0) return null;
    return activityList.map((activity, index) => (
      <td
        key={activity.activity_id || index}
        className="border border-black px-0.5 py-0.5 text-center bg-gray-200 font-bold text-[10px]"
      >
        {activity.max_score ? parseInt(activity.max_score, 10) : 0}
      </td>
    ));
  };

  // Add Activity button - compact
  const AddActivityButton = ({ type }) => (
    <span
      className="ml-0.5 inline-flex items-center justify-center w-4 h-4 bg-green-500 rounded-full text-white text-[10px] cursor-pointer hover:bg-green-600 leading-none"
      title="Add new activity"
      onClick={() => handleOpenModal(type)}
    >
      +
    </span>
  );

  // Modal Component - Simplified for reliable typing
  const ActivityModal = () => {
    if (!showModal) return null;

    // Local state for modal inputs to avoid state conflicts
    const [localActivityName, setLocalActivityName] = useState("");
    const [localScore, setLocalScore] = useState("");

    // Set initial values when modal opens
    useEffect(() => {
      setLocalActivityName(activityName);
      setLocalScore(highestPossibleScore);

      // Focus after a short delay to ensure render is complete
      setTimeout(() => {
        document.getElementById("activityName")?.focus();
      }, 100);
    }, [showModal]);

    // Handle form submission
    const handleSubmit = (e) => {
      e.preventDefault();

      // Validate inputs using local state variables
      if (!localActivityName.trim()) {
        setSaveError("Activity Name is required");
        return;
      }

      const score = parseFloat(localScore);
      if (isNaN(score) || score <= 0) {
        setSaveError("Highest Possible Score must be a positive number");
        return;
      }

      // Update parent state directly before calling handleSaveActivity
      setActivityName(localActivityName);
      setHighestPossibleScore(localScore);

      // Use the local values directly to avoid state update timing issues
      handleSaveActivity(localActivityName, score);
    };

    return (
      <div className="fixed inset-0 z-50">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
          onClick={handleCloseModal}
        ></div>

        {/* Modal dialog */}
        <div className="flex items-center justify-center h-full">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-5 relative z-10">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#3E5367] to-[#526D82] px-6 py-4 rounded-t-lg flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">
                Add New{" "}
                {activityType === "written"
                  ? "Written Work"
                  : activityType === "performance"
                    ? "Performance Task"
                    : "Quarterly Assessment"}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-white hover:text-gray-200"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6">
              {saveError && (
                <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 text-red-700">
                  {saveError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    htmlFor="activityName"
                  >
                    Activity Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="activityName"
                    type="text"
                    value={localActivityName}
                    onChange={(e) => setLocalActivityName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter activity name"
                    required
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    htmlFor="highestScore"
                  >
                    Highest Possible Score{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="highestScore"
                    type="number"
                    value={localScore}
                    onChange={(e) => setLocalScore(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter highest possible score"
                    min="1"
                    step="1"
                    required
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-[#526D82] text-white rounded-md hover:bg-[#3E5367] disabled:bg-gray-400"
                >
                  {isSaving ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                      Saving...
                    </span>
                  ) : (
                    "Save Activity"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  // Certificate template ref
  const certificateTemplateRef = useRef(null);

  // Function to generate a certificate for selected students
  const handleGenerateCertificate = async () => {
    if (!classData || !students || students.length === 0) {
      alert("No students or class data available for certificate generation");
      return;
    }

    // Get selected student IDs
    const selectedIds = Object.keys(selectedForCertificate);

    if (selectedIds.length === 0) {
      alert("Please select at least one student to generate a certificate.");
      return;
    }

    // Find the selected students
    const selectedStudents = students.filter(
      (student) => selectedForCertificate[student.id],
    );

    console.log("Selected student IDs:", selectedIds);
    console.log("Found students for certificates:", selectedStudents);

    if (selectedStudents.length === 0) {
      alert("Could not find selected students. Please try again.");
      return;
    }

    try {
      // Generate certificates for each selected student
      for (const student of selectedStudents) {
        // Format the student's name
        const studentName = student.name;

        // Get grade level and section with safety checks
        const gradeLevel = classData.grade_level || classData.gradeLevel || "";
        const section = classData.section || "";
        // Format as "Grade X - Y" without the word "Section"
        const classDescription =
          gradeLevel === "Kindergarten" || gradeLevel === "K"
            ? `Kindergarten - ${section}`
            : `Grade ${gradeLevel} - ${section}`;

        // Get subject name and teacher name with safety checks
        const subjectName = classData.subject_name || classData.subject || "";
        const teacherName =
          classData.teacher_name || classData.teacherName || "";

        // Determine which template to use based on grade level
        let templateFileName;

        if (
          gradeLevel === "K" ||
          gradeLevel.toLowerCase() === "kindergarten" ||
          gradeLevel === "0"
        ) {
          templateFileName = "Best in Subject Template - Kindergarten.pdf";
        } else if (gradeLevel === "1") {
          templateFileName = "Best in Subject Template - Grade 1.pdf";
        } else if (gradeLevel === "2") {
          templateFileName = "Best in Subject Template - Grade 2.pdf";
        } else if (gradeLevel === "3") {
          templateFileName = "Best in Subject Template - Grade 3.pdf";
        } else if (gradeLevel === "4") {
          templateFileName = "Best in Subject Template - Grade 4.pdf";
        } else {
          // Default template if grade level doesn't match any specific template
          templateFileName = "Best in Subject Template - Grade 1.pdf";
        }

        console.log(`Using template: ${templateFileName}`);

        // Formulate the path to the PDF template file
        const templateUrl = `${window.location.origin}/templates/best-in-subject/${templateFileName}`;

        // Fetch the template PDF
        const templateBytes = await fetch(templateUrl).then((res) => {
          if (!res.ok) {
            throw new Error(
              `Failed to fetch template: ${res.status} ${res.statusText}`,
            );
          }
          return res.arrayBuffer();
        });

        // Load the PDF document
        const pdfDoc = await PDFDocument.load(templateBytes);

        // Register fontkit
        pdfDoc.registerFontkit(fontkit);

        // Get the first page of the PDF
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];

        // Get page dimensions
        const { width, height } = firstPage.getSize();

        // Embed the standard font as fallback
        const helveticaBold = await pdfDoc.embedFont(
          StandardFonts.HelveticaBold,
        );
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Try to load and embed the Rockwell Extra Bold font if possible
        let customFont;
        let regularBookmanFont; // For the teacher's name (non-bold version)
        try {
          // Fetch the Bookman Old Style font file
          const fontUrl = `${window.location.origin}/fonts/bookman-old-style.ttf`;
          console.log("Attempting to load font from:", fontUrl);

          const fontResponse = await fetch(fontUrl);
          if (!fontResponse.ok) {
            throw new Error(
              `Failed to fetch font: ${fontResponse.status} ${fontResponse.statusText}`,
            );
          }

          const fontBytes = await fontResponse.arrayBuffer();
          console.log(
            "Font file fetched successfully, file size:",
            fontBytes.byteLength,
            "bytes",
          );

          // Embed the font with fontkit
          customFont = await pdfDoc.embedFont(fontBytes);
          console.log(
            "Successfully embedded Bookman Old Style font with fontkit",
          );

          // Also load the regular (non-bold) Bookman Old Style font for teacher name
          const regularFontUrl = `${window.location.origin}/fonts/bookman-old-style-regular.ttf`;
          console.log("Attempting to load regular font from:", regularFontUrl);

          const regularFontResponse = await fetch(regularFontUrl);
          if (!regularFontResponse.ok) {
            throw new Error(
              `Failed to fetch regular font: ${regularFontResponse.status} ${regularFontResponse.statusText}`,
            );
          }

          const regularFontBytes = await regularFontResponse.arrayBuffer();
          console.log(
            "Regular font file fetched successfully, file size:",
            regularFontBytes.byteLength,
            "bytes",
          );

          // Embed the regular font
          regularBookmanFont = await pdfDoc.embedFont(regularFontBytes);
          console.log("Successfully embedded Regular Bookman Old Style font");
        } catch (fontError) {
          console.error("Error loading Bookman Old Style font:", fontError);
          console.warn("Falling back to Helvetica Bold");
          // We'll fall back to helveticaBold if the custom font fails to load
          customFont = helveticaBold;
          regularBookmanFont = helvetica; // Fall back to regular Helvetica for teacher name
        }

        // Define colors more closely matching the placeholder
        const darkBrown = rgb(0.353, 0.251, 0); // #5a4000 - dark brown for subject
        // Darker gold color that better matches the image
        const gold = rgb(0.427, 0.325, 0.039); // #6D5310 - richer gold/brown color
        // Slightly darker gold for outline
        const goldOutline = rgb(0.39, 0.29, 0.03); // Slightly darker than main gold
        const black = rgb(0, 0, 0);

        // Set to false to disable the outline/shadow effect
        const useFauxBoldOutlines = false;

        // For the subject name, calculate appropriate font size based on length
        // Start with maximum font size and adjust down if text is too wide
        let subjectFontSize = 40; // Starting font size
        let subjectTextWidth = customFont.widthOfTextAtSize(
          subjectName.toUpperCase(),
          subjectFontSize,
        );
        const maxTextWidth = width * 0.8; // Use 80% of page width as maximum allowed width

        // Automatically reduce font size if text is too wide for the page
        while (subjectTextWidth > maxTextWidth && subjectFontSize > 20) {
          subjectFontSize -= 2; // Reduce by 2pt each time
          subjectTextWidth = customFont.widthOfTextAtSize(
            subjectName.toUpperCase(),
            subjectFontSize,
          );
        }

        // Calculate positions
        const subjectXCenter = (width - subjectTextWidth) / 2;
        const subjectY = height * 0.53;

        if (useFauxBoldOutlines) {
          // Alternative "outline" technique - create thicker text by drawing outline + fill
          // 1. First draw a slightly larger version in dark gold (outline)
          const outlineScale = 1.015; // 1.5% larger for outline
          const outlineSize = subjectFontSize * outlineScale;
          const outlineWidth = customFont.widthOfTextAtSize(
            subjectName.toUpperCase(),
            outlineSize,
          );
          const outlineX = (width - outlineWidth) / 2;

          // Draw the outline text first (slightly larger)
          firstPage.drawText(subjectName.toUpperCase(), {
            x: outlineX,
            y: subjectY,
            size: outlineSize,
            font: customFont,
            color: goldOutline,
            opacity: 1,
          });

          // 2. Then draw the fill text on top (this creates a subtle outline effect)
          firstPage.drawText(subjectName.toUpperCase(), {
            x: subjectXCenter,
            y: subjectY,
            size: subjectFontSize,
            font: customFont,
            color: gold,
            opacity: 1,
          });
        } else {
          // Simple, direct rendering (no effects)
          // Draw text once with no special effects
          // Check if this is Kindergarten template for special styling
          const isKinderTemplate =
            gradeLevel === "K" ||
            gradeLevel.toLowerCase() === "kindergarten" ||
            gradeLevel === "0";

          firstPage.drawText(subjectName.toUpperCase(), {
            x: subjectXCenter,
            y: subjectY,
            size: subjectFontSize,
            font: customFont,
            color: isKinderTemplate ? black : gold, // Black for Kindergarten, Gold for regular grades
            opacity: 1,
          });
        }

        // For the student name, manually center with auto-sizing if needed
        let studentFontSize = 30; // Starting font size
        let studentTextWidth = customFont.widthOfTextAtSize(
          studentName,
          studentFontSize,
        );

        // Reduce student name font size if too wide
        while (studentTextWidth > maxTextWidth && studentFontSize > 18) {
          studentFontSize -= 2;
          studentTextWidth = customFont.widthOfTextAtSize(
            studentName,
            studentFontSize,
          );
        }

        // Calculate positions
        const studentXCenter = (width - studentTextWidth) / 2;

        // Check if this is Kindergarten template for special positioning of student name
        const isKinderTemplate =
          gradeLevel === "K" ||
          gradeLevel.toLowerCase() === "kindergarten" ||
          gradeLevel === "0";
        // Use different position for Kindergarten vs regular grade levels
        const studentY = isKinderTemplate ? height * 0.425 : height * 0.42; // Move Kindergarten student name up by 0.5

        if (useFauxBoldOutlines) {
          // Alternative "outline" technique for student name
          const outlineScale = 1.015; // 1.5% larger for outline
          const outlineSize = studentFontSize * outlineScale;
          const outlineWidth = customFont.widthOfTextAtSize(
            studentName,
            outlineSize,
          );
          const outlineX = (width - outlineWidth) / 2;

          // Draw the outline text first (slightly larger)
          firstPage.drawText(studentName, {
            x: outlineX,
            y: studentY,
            size: outlineSize,
            font: customFont,
            color: goldOutline,
            opacity: 1,
          });

          // Draw the fill text on top
          firstPage.drawText(studentName, {
            x: studentXCenter,
            y: studentY,
            size: studentFontSize,
            font: customFont,
            color: gold,
            opacity: 1,
          });
        } else {
          // Simple, direct rendering (no effects)
          firstPage.drawText(studentName, {
            x: studentXCenter,
            y: studentY,
            size: studentFontSize,
            font: customFont,
            color: isKinderTemplate ? black : gold, // Black for Kindergarten, Gold for regular grades
            opacity: 1,
          });
        }

        // For the class description, manually center with auto-sizing if needed
        let classFontSize = 16; // Starting font size (reduced from 20)
        let classTextWidth = regularBookmanFont.widthOfTextAtSize(
          classDescription,
          classFontSize,
        );

        // Reduce class description font size if too wide
        while (classTextWidth > maxTextWidth && classFontSize > 12) {
          // Minimum size reduced from 14 to 12
          classFontSize -= 1;
          classTextWidth = regularBookmanFont.widthOfTextAtSize(
            classDescription,
            classFontSize,
          );
        }

        // Calculate positions
        const classXCenter = (width - classTextWidth) / 2;
        const classY = height * 0.36;

        if (useFauxBoldOutlines) {
          // Alternative "outline" technique for class description
          const outlineScale = 1.015; // 1.5% larger for outline
          const outlineSize = classFontSize * outlineScale;
          const outlineWidth = regularBookmanFont.widthOfTextAtSize(
            classDescription,
            outlineSize,
          );
          const outlineX = (width - outlineWidth) / 2;

          // Draw the outline text first (slightly larger)
          firstPage.drawText(classDescription, {
            x: outlineX,
            y: classY,
            size: outlineSize,
            font: regularBookmanFont,
            color: goldOutline,
            opacity: 1,
          });

          // Draw the fill text on top
          firstPage.drawText(classDescription, {
            x: classXCenter,
            y: classY,
            size: classFontSize,
            font: regularBookmanFont,
            color: gold,
            opacity: 1,
          });
        } else {
          // Simple, direct rendering (no effects)
          // Create the specific color for Kindergarten class description - #584910
          const darkGold = rgb(0.345, 0.286, 0.063); // #584910 in RGB format

          firstPage.drawText(classDescription, {
            x: classXCenter,
            y: classY,
            size: classFontSize,
            font: regularBookmanFont, // Changed from customFont to regularBookmanFont
            color: isKinderTemplate ? darkGold : gold, // #584910 for Kindergarten, Gold for regular grades
            opacity: 1,
          });

          // Add school year and date text for Kindergarten Best in Subject template only
          if (isKinderTemplate) {
            // Format current date for certificate
            const currentDate = new Date();

            // Format day with ordinal suffix (1st, 2nd, 3rd, etc.)
            const day = currentDate.getDate();
            const dayWithSuffix =
              day +
              (day === 1 || day === 21 || day === 31
                ? "st"
                : day === 2 || day === 22
                  ? "nd"
                  : day === 3 || day === 23
                    ? "rd"
                    : "th");

            // Format month name and year
            const month = currentDate.toLocaleString("en-US", {
              month: "long",
            });
            const year = currentDate.getFullYear();

            // Get the current school year (assuming June to March academic calendar)
            const currentMonth = currentDate.getMonth(); // 0-11
            let academicYear;
            // If we're between January and May, school year is previous year to current year
            if (currentMonth >= 0 && currentMonth <= 4) {
              academicYear = `${year - 1}-${year}`;
            } else {
              // Otherwise it's current year to next year
              academicYear = `${year}-${year + 1}`;
            }

            // Create the messages
            const schoolYearText = `during the School Year ${academicYear}.`;
            const dateText = `Given this ${dayWithSuffix} day of ${month} ${year} at Little Champions Academy Inc., Guiguinto, Bulacan.`;

            // Measure text width to center it
            const schoolYearWidth = regularBookmanFont.widthOfTextAtSize(
              schoolYearText,
              12,
            );
            const dateWidth = regularBookmanFont.widthOfTextAtSize(
              dateText,
              12,
            );

            // Position text below class description
            const schoolYearY = classY - 30; // 30 units below class description
            const dateY = schoolYearY - 20; // 20 units below school year text

            // Draw the text centered
            firstPage.drawText(schoolYearText, {
              x: (width - schoolYearWidth) / 2,
              y: schoolYearY,
              size: 12,
              font: regularBookmanFont,
              color: black,
              opacity: 1,
            });

            firstPage.drawText(dateText, {
              x: (width - dateWidth) / 2,
              y: dateY,
              size: 12,
              font: regularBookmanFont,
              color: black,
              opacity: 1,
            });
          }
        }

        // Draw text for teacher name at bottom left using the regular (non-bold) font
        let teacherFontSize = 8.8; // Set to 9px as requested

        // Check if we're using Kindergarten template (which requires different positioning)
        const isKindergartenTemplate =
          gradeLevel === "K" ||
          gradeLevel.toLowerCase() === "kindergarten" ||
          gradeLevel === "0";

        if (isKindergartenTemplate) {
          // Kindergarten template - special positioning
          // Use the regular Bookman Old Style font loaded earlier
          const teacherTextWidth = regularBookmanFont.widthOfTextAtSize(
            teacherName.toUpperCase(),
            teacherFontSize,
          );

          // Special positioning for Kindergarten certificate
          // Based on the provided image, adjust to properly center over "TEACHER" label and underline
          const kindergartenTeacherX = width * 0.286; // Adjusted based on the image to center over the "TEACHER" text
          const kindergartenTeacherY = height * 0.195;

          // Calculate proper position to center text over the underline
          const kindergartenCenteredX =
            kindergartenTeacherX - teacherTextWidth / 2;

          firstPage.drawText(teacherName.toUpperCase(), {
            x: kindergartenCenteredX,
            y: kindergartenTeacherY - 26, // Position adjusted for Kindergarten template
            size: teacherFontSize,
            font: regularBookmanFont,
            color: black,
            opacity: 1,
          });
        } else {
          // Regular grade templates - existing logic
          // Use the regular Bookman Old Style font loaded earlier
          const teacherTextWidth = regularBookmanFont.widthOfTextAtSize(
            teacherName.toUpperCase(),
            teacherFontSize,
          );

          // Position teacher name directly ON the underline itself
          // Calculate the centered x-position relative to the left underline width
          const underlineStartX = width * 0.13; // Left edge of the underline (estimate)
          const underlineEndX = width * 0.34; // Right edge of the underline (estimate)
          const underlineWidth = underlineEndX - underlineStartX;
          const underlineCenter = underlineStartX + underlineWidth / 2;

          // Calculate x-position to center the text on the underline
          // Adding a small offset (5px) to move slightly to the right for better centering
          const teacherNameX = underlineCenter - teacherTextWidth / 2 + 5;

          // The underline's y-position
          const underlineY = height * 0.22;
          const teacherY = height * 0.22 - 29.5; // Using the exact original position

          // Position the text so the bottom of the text touches the line
          // No vertical offset, so the text sits on the line
          firstPage.drawText(teacherName.toUpperCase(), {
            // Convert to UPPERCASE
            x: teacherNameX,
            y: teacherY, // Original position for regular grades
            size: teacherFontSize,
            font: regularBookmanFont, // Using the regular (non-bold) Bookman Old Style font
            color: black,
            opacity: 1,
          });
        }

        // Serialize the PDF
        const modifiedPdfBytes = await pdfDoc.save();

        // Convert to Blob and download
        const blob = new Blob([modifiedPdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        // Create an anchor element and trigger download
        const fileName = `Excellence in ${subjectName} - ${studentName}.pdf`;
        console.log(`Creating download for ${fileName}`);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a); // Append to body to ensure download works in all browsers
        a.click();

        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          console.log(`Download triggered for ${fileName}`);
        }, 100);
      }

      // Clear selections after generating all certificates
      console.log("Certificate generation complete, clearing selections");
      setSelectedForCertificate({});
      setShowGenerateCertificates(false);
    } catch (error) {
      console.error("Error generating certificate:", error);
      alert(`Error generating certificate: ${error.message}`);
    }
  };

  // New handler for Certificate of Completion
  const handleGenerateCompletionCertificate = async () => {
    if (!classData || !students || students.length === 0) {
      alert("No students or class data available for certificate generation");
      return;
    }

    // Get selected student IDs
    const selectedIds = Object.keys(selectedForCertificate);

    if (selectedIds.length === 0) {
      alert("Please select at least one student to generate a certificate.");
      return;
    }

    // Find the selected students
    const selectedStudents = students.filter(
      (student) => selectedForCertificate[student.id],
    );

    console.log(
      "Selected student IDs for completion certificates:",
      selectedIds,
    );
    console.log(
      "Found students for completion certificates:",
      selectedStudents,
    );

    if (selectedStudents.length === 0) {
      alert("Could not find selected students. Please try again.");
      return;
    }

    try {
      // Generate completion certificates for each selected student
      for (const student of selectedStudents) {
        // Format the student's name
        const studentName = student.name;

        // Get grade level and section with safety checks
        const gradeLevel = classData.grade_level || classData.gradeLevel || "";
        const section = classData.section || "";
        // Format as "Grade X - Y" without the word "Section"
        const classDescription =
          gradeLevel === "Kindergarten" || gradeLevel === "K"
            ? `Kindergarten - ${section}`
            : `Grade ${gradeLevel} - ${section}`;

        // Get subject name and teacher name with safety checks
        const subjectName = classData.subject_name || classData.subject || "";
        const teacherName =
          classData.teacher_name || classData.teacherName || "";

        // Determine which template to use based on grade level
        let templateFileName;

        if (
          gradeLevel === "K" ||
          gradeLevel.toLowerCase() === "kindergarten" ||
          gradeLevel === "0"
        ) {
          templateFileName = "Certificate of Completion - Kindergarten.pdf";
        } else if (gradeLevel === "1") {
          templateFileName = "Certificate of Completion - Grade 1.pdf";
        } else if (gradeLevel === "2") {
          templateFileName = "Certificate of Completion - Grade 2.pdf";
        } else if (gradeLevel === "3") {
          templateFileName = "Certificate of Completion - Grade 3.pdf";
        } else if (gradeLevel === "4") {
          templateFileName = "Certificate of Completion - Grade 4.pdf";
        } else {
          // Default template if grade level doesn't match any specific template
          templateFileName = "Certificate of Completion - Grade 1.pdf";
        }

        console.log(
          `Using completion certificate template: ${templateFileName}`,
        );

        // Formulate the path to the PDF template file
        const templateUrl = `${window.location.origin}/templates/certificate-of-completion/${templateFileName}`;

        // Fetch the template PDF
        const templateBytes = await fetch(templateUrl).then((res) => {
          if (!res.ok) {
            throw new Error(
              `Failed to fetch template: ${res.status} ${res.statusText}`,
            );
          }
          return res.arrayBuffer();
        });

        // Load the PDF document
        const pdfDoc = await PDFDocument.load(templateBytes);

        // Register fontkit
        pdfDoc.registerFontkit(fontkit);

        // Get the first page of the PDF
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];

        // Get page dimensions
        const { width, height } = firstPage.getSize();

        // Embed the standard font as fallback
        const helveticaBold = await pdfDoc.embedFont(
          StandardFonts.HelveticaBold,
        );
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Try to load and embed the Bookman Old Style font if possible
        let customFont;
        let regularBookmanFont; // For the teacher's name (non-bold version)
        try {
          // Fetch the Bookman Old Style font file
          const fontUrl = `${window.location.origin}/fonts/bookman-old-style.ttf`;
          console.log("Attempting to load font from:", fontUrl);

          const fontResponse = await fetch(fontUrl);
          if (!fontResponse.ok) {
            throw new Error(
              `Failed to fetch font: ${fontResponse.status} ${fontResponse.statusText}`,
            );
          }

          const fontBytes = await fontResponse.arrayBuffer();
          console.log(
            "Font file fetched successfully, file size:",
            fontBytes.byteLength,
            "bytes",
          );

          // Embed the font with fontkit
          customFont = await pdfDoc.embedFont(fontBytes);
          console.log(
            "Successfully embedded Bookman Old Style font with fontkit",
          );

          // Also load the regular (non-bold) Bookman Old Style font for teacher name
          const regularFontUrl = `${window.location.origin}/fonts/bookman-old-style-regular.ttf`;
          console.log("Attempting to load regular font from:", regularFontUrl);

          const regularFontResponse = await fetch(regularFontUrl);
          if (!regularFontResponse.ok) {
            throw new Error(
              `Failed to fetch regular font: ${regularFontResponse.status} ${regularFontResponse.statusText}`,
            );
          }

          const regularFontBytes = await regularFontResponse.arrayBuffer();
          console.log(
            "Regular font file fetched successfully, file size:",
            regularFontBytes.byteLength,
            "bytes",
          );

          // Embed the regular font
          regularBookmanFont = await pdfDoc.embedFont(regularFontBytes);
          console.log("Successfully embedded Regular Bookman Old Style font");
        } catch (fontError) {
          console.error("Error loading Bookman Old Style font:", fontError);
          console.warn("Falling back to Helvetica Bold");
          // We'll fall back to helveticaBold if the custom font fails to load
          customFont = helveticaBold;
          regularBookmanFont = helvetica; // Fall back to regular Helvetica for teacher name
        }

        // Check if we're using the Kindergarten template (which is significantly different)
        const isKindergartenTemplate =
          gradeLevel === "K" ||
          gradeLevel.toLowerCase() === "kindergarten" ||
          gradeLevel === "0";

        if (isKindergartenTemplate) {
          // Special handling for Kindergarten template
          // Define colors for Kindergarten template
          const darkBlue = rgb(0.1, 0.2, 0.4); // Dark blue color for kindergarten text
          const black = rgb(0, 0, 0); // Define black color for text

          // For the student name in Kindergarten certificate, use different position and size
          let studentFontSize = 27.5; // Exact size as requested for Kindergarten Certificate of Completion
          let studentTextWidth = customFont.widthOfTextAtSize(
            studentName,
            studentFontSize,
          );
          const maxTextWidth = width * 0.7; // Use 70% of page width as maximum allowed width

          // Only reduce font size if absolutely necessary for extremely long names
          while (studentTextWidth > maxTextWidth && studentFontSize > 16) {
            studentFontSize -= 0.5; // Reduce in smaller increments to stay close to requested size
            studentTextWidth = customFont.widthOfTextAtSize(
              studentName,
              studentFontSize,
            );
          }

          // Calculate positions for Kindergarten template
          const studentXCenter = (width - studentTextWidth) / 2;
          const studentY = height * 0.465; // Moved lower as requested (from 0.47 to 0.45)

          // Draw student name for Kindergarten template
          firstPage.drawText(studentName, {
            x: studentXCenter,
            y: studentY,
            size: studentFontSize,
            font: customFont,
            color: black, // Changed to black as requested
            opacity: 1,
          });

          // Add the student's actual LRN - first try to get it from the API service
          // Need to get the student's LRN from their data
          const fetchStudentLRN = async (studentId) => {
            try {
              // Fetch student details from the API to get the LRN
              const response = await axios.get(gradingUrl(`/users/${studentId}`), { headers: getAuthHeader() });
              console.log("Fetched student data for LRN:", response.data);
              return response.data.lrn || "-";
            } catch (err) {
              console.error("Error fetching student LRN:", err);
              return "-"; // Fallback to dash if fetch fails
            }
          };

          // Get the LRN - either from the student object or by fetching it
          let lrnText;
          if (student.lrn) {
            // If LRN is already in the student object
            lrnText = student.lrn;
            console.log("Using LRN from student object:", lrnText);
          } else {
            // Otherwise fetch it from the API
            lrnText = await fetchStudentLRN(student.id);
            console.log("Fetched LRN for student:", lrnText);
          }

          const lrnFontSize = 10; // Reduced to 10 as requested
          const lrnTextWidth = regularBookmanFont.widthOfTextAtSize(
            lrnText,
            lrnFontSize,
          );

          // Position LRN directly right of the "Learner Reference Number (LRN):" text
          // The label is already in the template, just need to position the value correctly
          const lrnPosition = {
            x: width * 0.605, // Position to right of the label (adjusted based on template)
            y: height * 0.427, // Adjusted to align exactly with the (LRN): text
          };

          // Draw the LRN value
          firstPage.drawText(lrnText, {
            x: lrnPosition.x, // No centering - align left after the label
            y: lrnPosition.y,
            size: lrnFontSize,
            font: regularBookmanFont,
            color: black, // Changed to black as requested
            opacity: 1,
          });

          // Log for debugging
          console.log("Added LRN dash to Kindergarten certificate");

          // Add bilingual date signature line (Tagalog and English)
          // Format current date for certificate
          const currentDate = new Date();

          // Get day number
          const day = currentDate.getDate();

          // Get English month and year
          const monthEN = currentDate.toLocaleString("en-US", {
            month: "long",
          });
          const year = currentDate.getFullYear();

          // Format the day with ordinal suffix for English (1st, 2nd, 3rd, etc.)
          const getOrdinalSuffix = (day) => {
            if (day > 3 && day < 21) return "th";
            switch (day % 10) {
              case 1:
                return "st";
              case 2:
                return "nd";
              case 3:
                return "rd";
              default:
                return "th";
            }
          };
          const dayWithSuffix = day + getOrdinalSuffix(day);

          // Filipino month names
          const monthNames = {
            January: "Enero",
            February: "Pebrero",
            March: "Marso",
            April: "Abril",
            May: "Mayo",
            June: "Hunyo",
            July: "Hulyo",
            August: "Agosto",
            September: "Setyembre",
            October: "Oktubre",
            November: "Nobyembre",
            December: "Disyembre",
          };

          // Get Filipino month
          const monthTL = monthNames[monthEN];

          // Create the bilingual text
          const tagalogDate = `Nilagdaan sa Munisipalidad ng Guiguinto, Bulacan, Pilipinas nitong ika-${day} ng ${monthTL} ${year}.`;
          const englishDate = `Signed in Municipality of Guiguinto, Bulacan, Philippines on the ${dayWithSuffix} day of ${monthEN} ${year}.`;

          // Position the text at the bottom of the certificate
          const tagalogDateFontSize = 9;
          const englishDateFontSize = 9;

          // Calculate widths for centering
          const tagalogDateWidth = regularBookmanFont.widthOfTextAtSize(
            tagalogDate,
            tagalogDateFontSize,
          );
          const englishDateWidth = regularBookmanFont.widthOfTextAtSize(
            englishDate,
            englishDateFontSize,
          );

          // Position near bottom of certificate, just above signatures
          const tagalogDateY = height * 0.17;
          const englishDateY = height * 0.15;

          // Draw the Tagalog date text
          firstPage.drawText(tagalogDate, {
            x: (width - tagalogDateWidth) / 2,
            y: tagalogDateY,
            size: tagalogDateFontSize,
            font: regularBookmanFont,
            color: black,
            opacity: 1,
          });

          // Draw the English date text
          firstPage.drawText(englishDate, {
            x: (width - englishDateWidth) / 2,
            y: englishDateY,
            size: englishDateFontSize,
            font: regularBookmanFont,
            color: black,
            opacity: 1,
          });

          // Teacher name is removed for Kindergarten Certificate of Completion as requested
          // No teacher name will be displayed
        } else {
          // Regular Grade 1-4 template handling
          // Define colors for grade templates
          const gold = rgb(0.427, 0.325, 0.039); // #6D5310 - gold/brown color
          const black = rgb(0, 0, 0);

          // For the student name, manually center with auto-sizing if needed
          let studentFontSize = 30; // Starting font size
          let studentTextWidth = customFont.widthOfTextAtSize(
            studentName,
            studentFontSize,
          );
          const maxTextWidth = width * 0.8; // Use 80% of page width as maximum allowed width

          // Reduce student name font size if too wide
          while (studentTextWidth > maxTextWidth && studentFontSize > 18) {
            studentFontSize -= 2;
            studentTextWidth = customFont.widthOfTextAtSize(
              studentName,
              studentFontSize,
            );
          }

          // Calculate positions for regular templates
          const studentXCenter = (width - studentTextWidth) / 2;
          const studentY = height * 0.42; // Standard position for regular certificates

          // Draw student name for regular template
          firstPage.drawText(studentName, {
            x: studentXCenter,
            y: studentY,
            size: studentFontSize,
            font: customFont,
            color: gold,
            opacity: 1,
          });

          // For the class description, manually center with auto-sizing if needed
          let classFontSize = 16; // Starting font size
          let classTextWidth = regularBookmanFont.widthOfTextAtSize(
            classDescription,
            classFontSize,
          );

          // Reduce class description font size if too wide
          while (classTextWidth > maxTextWidth && classFontSize > 12) {
            classFontSize -= 1;
            classTextWidth = regularBookmanFont.widthOfTextAtSize(
              classDescription,
              classFontSize,
            );
          }

          // Calculate positions
          const classXCenter = (width - classTextWidth) / 2;
          const classY = height * 0.36;

          // Draw class description
          firstPage.drawText(classDescription, {
            x: classXCenter,
            y: classY,
            size: classFontSize,
            font: regularBookmanFont,
            color: gold,
            opacity: 1,
          });

          // Add completion message for regular grade levels
          // Determine pronoun (defaulting to neutral if gender info not available)
          const pronoun =
            student.gender === "M"
              ? "his"
              : student.gender === "F"
                ? "her"
                : "his/her";

          // Format current date (e.g., "May 30, 2025")
          const currentDate = new Date();
          const formattedDate = currentDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });

          // Create completion text
          const gradeProgramText =
            gradeLevel === "1"
              ? "Grade 1"
              : gradeLevel === "2"
                ? "Grade 2"
                : gradeLevel === "3"
                  ? "Grade 3"
                  : gradeLevel === "4"
                    ? "Grade 4"
                    : `Grade ${gradeLevel}`;

          const completionText = `for ${pronoun} completion in our ${gradeProgramText} Program\nat Little Champions Academy Inc. Given in ${formattedDate}.`;

          // Add the completion text centered below class description
          const completionFontSize = 13.5; // Increased from 13 to 13.5
          const completionLines = completionText.split("\n");

          // Add first line - positioned lower
          let line1Width = regularBookmanFont.widthOfTextAtSize(
            completionLines[0],
            completionFontSize,
          );
          let line1X = (width - line1Width) / 2;
          // Create the rich brown color #412711
          const richBrown = rgb(0.255, 0.153, 0.067); // #412711

          firstPage.drawText(completionLines[0], {
            x: line1X,
            y: height * 0.27, // Moved even lower from 0.29 to 0.27
            size: completionFontSize,
            font: regularBookmanFont,
            color: richBrown, // Rich brown color #412711
            opacity: 1,
          });

          // Add second line - with increased spacing from first line
          let line2Width = regularBookmanFont.widthOfTextAtSize(
            completionLines[1],
            completionFontSize,
          );
          let line2X = (width - line2Width) / 2;
          firstPage.drawText(completionLines[1], {
            x: line2X,
            y: height * 0.23, // Increased gap between lines (from 0.24 to 0.23)
            size: completionFontSize,
            font: regularBookmanFont,
            color: richBrown, // Rich brown color #412711
            opacity: 1,
          });

          // Draw teacher name at bottom for regular templates
          const teacherFontSize = 8.8; // Matching the size used in Best in Subject template
          const teacherTextWidth = regularBookmanFont.widthOfTextAtSize(
            teacherName.toUpperCase(),
            teacherFontSize,
          );
          // Further refined measurements to match the underline exactly
          const underlineStartX = width * 0.095; // Moved slightly more to the left
          const underlineEndX = width * 0.305; // Adjusted endpoint proportionally
          const underlineWidth = underlineEndX - underlineStartX;
          const underlineCenter = underlineStartX + underlineWidth / 2;
          // Positioned exactly in the center of the underline
          const teacherNameX = underlineCenter - teacherTextWidth / 2 - 5; // Shifted slightly more left for better centering
          // Positioned lower to better align with the underline
          const teacherY = height * 0.22 - 48.5; // Lowered slightly more

          firstPage.drawText(teacherName.toUpperCase(), {
            x: teacherNameX,
            y: teacherY,
            size: teacherFontSize,
            font: regularBookmanFont,
            color: richBrown, // Using the same rich brown for consistency
            opacity: 1,
          });
        }

        // Serialize the PDF
        const modifiedPdfBytes = await pdfDoc.save();

        // Convert to Blob and download
        const blob = new Blob([modifiedPdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        // Create an anchor element and trigger download
        const fileName = `Certificate of Completion - ${studentName}.pdf`;
        console.log(`Creating download for ${fileName}`);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          console.log(`Download triggered for ${fileName}`);
        }, 100);
      }

      // Clear selections after generating all certificates
      console.log("Certificate generation complete, clearing selections");
      setSelectedForCertificate({});
      setShowGenerateCertificates(false);
    } catch (error) {
      console.error("Error generating completion certificates:", error);
      alert(`Error generating completion certificates: ${error.message}`);
    }
  };

  // Add to the existing useState declarations at the top of the component
  const [selectedForSubmission, setSelectedForSubmission] = useState({});
  const [uploadedGrades, setUploadedGrades] = useState({});
  const [submittingGrades, setSubmittingGrades] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState(null);

  // Add new effect to fetch uploaded grades
  useEffect(() => {
    if (classData && quarter) {
      checkUploadedGrades();
    }
  }, [classData, quarter]); // Remove students from dependency array to prevent infinite loop

  // Function to check which grades are already uploaded
  const checkUploadedGrades = async () => {
    if (!classData) return;

    try {
      const { classId, subjectId } = classData;
      const currentQuarter = parseInt(quarter);

      // Fetch grades from student_grade table
      const response = await axios.get(gradingUrl("/api/grades/check-existing"), {
        params: { classId, subjectId, quarter: currentQuarter },
        headers: getAuthHeader(),
      });

      // Create a lookup object of student_id -> grade (numeric or character)
      const uploadedGradesMap = {};
      response.data.forEach((grade) => {
        // Store either the numeric grade or character grade
        uploadedGradesMap[grade.student_id] = isKindergartenClass
          ? grade.char_grade
          : grade.grade;
      });

      console.log("Fetched uploaded grades:", uploadedGradesMap);

      // Update the uploadedGrades state without triggering another fetch
      setUploadedGrades(uploadedGradesMap);

      // Only update student charGrade properties for Kindergarten students if needed
      // and don't update the entire students array if not necessary
      if (isKindergartenClass) {
        setStudents((prevStudents) => {
          // Check if we need to update at all
          const needsUpdate = prevStudents.some(
            (student) =>
              uploadedGradesMap[student.id] !== undefined &&
              student.charGrade !== uploadedGradesMap[student.id],
          );

          // If no updates needed, return the same array reference to prevent re-renders
          if (!needsUpdate) return prevStudents;

          // Otherwise update only the necessary students
          return prevStudents.map((student) => {
            if (
              uploadedGradesMap[student.id] !== undefined &&
              student.charGrade !== uploadedGradesMap[student.id]
            ) {
              return {
                ...student,
                charGrade: uploadedGradesMap[student.id],
              };
            }
            return student;
          });
        });
      }
    } catch (error) {
      console.error("Error checking uploaded grades:", error);
      // If there's an error or no grades found, assume none are uploaded
      setUploadedGrades({});
    }
  };

  // Function to handle selecting all valid grades
  const handleSelectAllForSubmission = (isSelected) => {
    const newSelections = {};
    let validCount = 0;

    students.forEach((student) => {
      let hasValidGrade = false;
      if (isKindergartenClass) {
        // For Kindergarten: allow A, B, C, D, E for upload (per backend validation)
        const charGrade = convertKinderQuarterlyToChar(student.quarterlyGrade);
        hasValidGrade = ["A", "B", "C", "D", "E"].includes(charGrade);
      } else {
        hasValidGrade =
          !isNaN(parseFloat(student.quarterlyGrade)) &&
          parseFloat(student.quarterlyGrade) > 0;
      }
      const isUploaded = uploadedGrades[student.id] !== undefined;
      if (hasValidGrade && !isUploaded) {
        newSelections[student.id.toString()] = isSelected === true;
        validCount++;
      }
    });
    setSelectedForSubmission(newSelections);
  };

  // Function to handle individual grade selection
  const handleGradeSubmissionSelect = (studentId, isSelected) => {
    console.log(`Setting selection for student ${studentId} to ${isSelected}`);
    setSelectedForSubmission((prev) => {
      const newSelections = {
        ...prev,
        [studentId.toString()]: isSelected === true, // Ensure boolean value
      };
      console.log("Updated selections:", newSelections);
      return newSelections;
    });
  };

  // Function to submit selected grades
  const submitSelectedGrades = async () => {
    // Get the selected students
    const selectedStudents = Object.keys(selectedForSubmission)
      .filter((id) => selectedForSubmission[id] === true) // Ensure boolean true, not truthy values
      .map((id) => students.find((s) => s.id.toString() === id.toString())) // Ensure string comparison
      .filter(
        (student) =>
          student &&
          // For non-Kindergarten: valid numerical grade
          ((!isKindergartenClass &&
            !isNaN(parseFloat(student.quarterlyGrade)) &&
            parseFloat(student.quarterlyGrade) > 0) ||
            // For Kindergarten: valid computed quarterly grade
            (isKindergartenClass &&
              !isNaN(parseFloat(student.quarterlyGrade)) &&
              parseFloat(student.quarterlyGrade) > 0)),
      );

    console.log("Selected for submission:", selectedForSubmission);
    console.log("Filtered selected students:", selectedStudents);

    if (selectedStudents.length === 0) {
      setSubmissionMessage({
        type: "warning",
        text: "No students with valid grades selected for submission.",
      });
      setTimeout(() => setSubmissionMessage(null), 3000);
      return;
    }

    try {
      setSubmittingGrades(true);

      // Prepare the grade data with all required fields
      const gradesData = selectedStudents.map((student) => {
        const baseData = {
          student_id: parseInt(student.id),
          class_id: parseInt(classData.classId),
          subject_id: parseInt(classData.subjectId),
          teacher_id: parseInt(classData.userId),
          quarter: parseInt(quarter),
          school_year_id: parseInt(classData.schoolYearId), // <-- Always include this
        };
        if (isKindergartenClass) {
          // Convert computed quarterlyGrade to char_grade
          const charGrade = convertKinderQuarterlyToChar(
            student.quarterlyGrade,
          );
          return {
            ...baseData,
            char_grade: charGrade,
          };
        } else {
          return {
            ...baseData,
            grade: parseFloat(student.quarterlyGrade),
          };
        }
      });

      console.log("Submitting grades to student_grade table:", gradesData);

      // Call the API to submit the grades
      const response = await axios.post(
        gradingUrl("/api/grades/submit"),
        gradesData,
        { headers: getAuthHeader() },
      );
      console.log("Grade submission response:", response.data);

      // --- Save Quarterly GWA for non-Kindergarten classes ---
      // The backend automatically handles:
      // - Subject final grade computation (when all 4 quarters exist)
      // - Final GWA computation (when all 4 quarterly GWAs exist)
      for (const student of selectedStudents) {
        try {
          if (!isKindergartenClass) {
            await axios.post(gradingUrl("/api/grades/quarterly-gwa"), {
              student_id: parseInt(student.id),
              class_id: parseInt(classData.classId),
              school_year_id: parseInt(classData.schoolYearId),
              quarter: parseInt(quarter),
            }, { headers: getAuthHeader() });
          }
        } catch (err) {
          console.error(
            "Error saving quarterly GWA for student",
            student.id,
            err,
          );
        }
      }
      // --- END ---

      // Update uploaded grades
      await checkUploadedGrades();

      // Clear selections after successful submission
      setSelectedForSubmission({});

      setTimeout(() => setSubmissionMessage(null), 3000);
    } catch (error) {
      console.error("Error submitting grades:", error);
      setSubmissionMessage({
        type: "error",
        text: `Failed to submit grades: ${error.response?.data?.error || error.message}`,
      });
      setTimeout(() => setSubmissionMessage(null), 5000);
    } finally {
      setSubmittingGrades(false);
    }
  };

  // Function to render checkbox for grade selection
  const renderGradeCheckbox = (student) => {
    if (isKindergartenClass) {
      // For Kindergarten: allow A, B, C, D, E for upload (per backend validation)
      const charGrade = convertKinderQuarterlyToChar(student.quarterlyGrade);
      const hasValidGrade = ["A", "B", "C", "D", "E"].includes(charGrade);
      const isSelected = selectedForSubmission[student.id] === true;
      const isUploaded = uploadedGrades[student.id] !== undefined;
      const disabled = !hasValidGrade || isUploaded;
      return (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) =>
            handleGradeSubmissionSelect(student.id, e.target.checked)
          }
          disabled={disabled}
          className={`h-3 w-3 border-gray-300 rounded ${
            hasValidGrade && !isUploaded
              ? "text-blue-600 focus:ring-blue-500"
              : "text-gray-300 cursor-not-allowed"
          }`}
          title={
            !hasValidGrade
              ? "No valid grade to submit"
              : isUploaded
                ? "Grade already submitted"
                : "Select for grade submission"
          }
        />
      );
    }

    // Original code for non-kindergarten students
    const hasValidGrade =
      !isNaN(parseFloat(student.quarterlyGrade)) &&
      parseFloat(student.quarterlyGrade) > 0;
    const isSelected = selectedForSubmission[student.id] === true;
    const isUploaded = uploadedGrades[student.id] !== undefined;

    // If the grade is already uploaded, checkbox should be disabled
    const disabled = !hasValidGrade || isUploaded;

    return (
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) =>
          handleGradeSubmissionSelect(student.id, e.target.checked)
        }
        disabled={disabled}
        className={`h-3 w-3 border-gray-300 rounded ${
          hasValidGrade && !isUploaded
            ? "text-blue-600 focus:ring-blue-500"
            : "text-gray-300 cursor-not-allowed"
        }`}
        title={
          !hasValidGrade
            ? "No valid grade to submit"
            : isUploaded
              ? "Grade already submitted"
              : "Select for grade submission"
        }
      />
    );
  };

  // Function to render quarterly grade cell with status indicator
  const renderQuarterlyGradeCell = (student) => {
    // For all classes (including Kindergarten), show the computed numeric grade just like regular classes
    const hasValidGrade =
      !isNaN(parseFloat(student.quarterlyGrade)) &&
      parseFloat(student.quarterlyGrade) > 0;
    const isUploaded = uploadedGrades[student.id] !== undefined;
    let gradesMatch = false;
    if (isKindergartenClass) {
      // For Kindergarten, compare char_grade (uploaded) to computed char grade
      const computedChar = convertKinderQuarterlyToChar(student.quarterlyGrade);
      gradesMatch = isUploaded && uploadedGrades[student.id] === computedChar;
    } else {
      // For regular, compare numeric grades
      gradesMatch =
        isUploaded &&
        Math.abs(
          parseFloat(uploadedGrades[student.id]) -
            parseFloat(student.quarterlyGrade),
        ) < 0.01;
    }

    // Determine the status style and text based on conditions
    let statusText = "";
    let statusClass = "";
    let statusTitle = "";

    if (isUploaded && gradesMatch) {
      statusText = "Uploaded";
      statusClass = "text-green-600";
      statusTitle =
        "Grade already uploaded. For any changes, please contact the administrator.";
    } else if (isUploaded && !gradesMatch) {
      statusText = "Uploaded*";
      statusClass = "text-amber-500";
      statusTitle =
        "Current grade differs from uploaded grade. To update the official record, please contact the administrator.";
    } else if (hasValidGrade) {
      statusText = "Not Uploaded";
      statusClass = "text-blue-600";
      statusTitle = "Valid grade, ready for submission";
    } else {
      statusText = "No Grade";
      statusClass = "text-gray-400";
      statusTitle = "No valid grade calculated yet";
    }

    return (
      <div
        className="flex flex-col h-full justify-between py-0.5"
        title={statusTitle}
      >
        {/* Status indicator - compact */}
        <div className={`text-[8px] ${statusClass} text-center leading-tight`}>
          {statusText}
        </div>
        {/* Grade and checkbox - compact */}
        <div className="flex justify-center items-center gap-1">
          <div
            className={`text-center font-semibold text-sm ${hasValidGrade ? "text-gray-700" : "text-gray-400"}`}
          >
            {hasValidGrade ? student.quarterlyGrade : "N/A"}
          </div>
          {renderGradeCheckbox(student)}
        </div>
      </div>
    );
  };

  // Grade submission UI component
  const renderGradeSubmissionPanel = () => {
    const selectedCount = Object.values(selectedForSubmission).filter(
      (v) => v,
    ).length;

    return (
      <div className="bg-white p-3 rounded-lg border border-gray-300 mb-4 shadow-sm">
        {/* Added header with buttons still aligned right */}
        <div className="flex justify-between items-center gap-3 mb-2">
          <h3 className="text-lg font-semibold text-gray-700">
            Uploading of Grades
          </h3>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSelectAllForSubmission(true)}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm font-medium"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => handleSelectAllForSubmission(false)}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm font-medium"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={submitSelectedGrades}
              disabled={submittingGrades || selectedCount === 0}
              className={`px-4 py-1.5 rounded text-white ${
                submittingGrades || selectedCount === 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              } transition font-medium min-w-[120px]`}
            >
              {submittingGrades ? "Uploading..." : "Upload Grades"}
            </button>
          </div>
        </div>

        {/* Submission message */}
        {submissionMessage && (
          <div
            className={`mt-3 p-2 rounded text-sm ${
              submissionMessage.type === "success"
                ? "bg-green-100 text-green-700"
                : submissionMessage.type === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {submissionMessage.text}
          </div>
        )}

        {/* Legend */}
        <div
          className={`flex flex-col md:flex-row md:items-start md:gap-8 w-full`}
        >
          <div className="flex-1 min-w-0">
            {/* Unified legend for all class types */}
            <div className="flex flex-wrap justify-start gap-6 text-xs">
              <div className="flex items-center">
                <span className="font-medium text-green-600 mr-1">
                  Uploaded:
                </span>
                <span className="text-gray-700">Grade submitted to system</span>
              </div>
              <div className="flex items-center">
                <span className="font-medium text-amber-500 mr-1">
                  Uploaded*:
                </span>
                <span className="text-gray-700">
                  Different version uploaded
                </span>
              </div>
              <div className="flex items-center">
                <span className="font-medium text-blue-600 mr-1">
                  Not Uploaded:
                </span>
                <span className="text-gray-700">
                  Valid grade, not submitted
                </span>
              </div>
              <div className="flex items-center">
                <span className="font-medium text-gray-500 mr-1">
                  No Grade:
                </span>
                <span className="text-gray-700">No valid grade available</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-600">
              <p>
                Note: When you see "Uploaded*" (with an asterisk), it means the
                current calculated grade differs from what was officially
                submitted. You can continue editing activity scores, which
                updates the current grade but not the submitted one. To update
                an officially submitted grade, please contact the administrator.
              </p>
            </div>
          </div>
          {isKindergartenClass && (
            <div className="flex-1 min-w-[260px] md:pl-8 mt-6 md:mt-0">
              <h4 className="text-base font-semibold mb-2">
                Guidelines for Grading
              </h4>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="py-1 font-semibold text-left">Grade</th>
                    <th className="py-1 font-semibold text-left">Range</th>
                    <th className="py-1 font-semibold text-left">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1 font-bold">A</td>
                    <td className="py-1">90 - 100</td>
                    <td className="py-1">Outstanding</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-bold">B</td>
                    <td className="py-1">85 - 89</td>
                    <td className="py-1">Very Satisfying</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-bold">C</td>
                    <td className="py-1">80 - 84</td>
                    <td className="py-1">Satisfying</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-bold">D</td>
                    <td className="py-1">75 - 79</td>
                    <td className="py-1">Fairly Satisfying</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-bold">E</td>
                    <td className="py-1">Below 75</td>
                    <td className="py-1">Failed</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Add a function to handle certificate selection
  const handleCertificateSelection = (studentId, isSelected) => {
    console.log(`Selecting student ${studentId}: ${isSelected}`);
    setSelectedForCertificate((prev) => {
      const newSelected = { ...prev };
      if (isSelected) {
        newSelected[studentId] = true;
      } else {
        delete newSelected[studentId];
      }

      // Update showGenerateCertificates based on whether any students are selected
      const hasSelections = Object.keys(newSelected).length > 0;
      console.log(
        `Setting showGenerateCertificates to: ${hasSelections}, selected count: ${Object.keys(newSelected).length}`,
      );
      setShowGenerateCertificates(hasSelections);

      return newSelected;
    });
  };

  // Render a checkbox for certificate selection in the student row
  const renderCertificateCheckbox = (student) => {
    const isSelected = !!selectedForCertificate[student.student_id];

    return (
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) =>
            handleCertificateSelection(student.student_id, e.target.checked)
          }
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          title="Select for certificate"
        />
      </div>
    );
  };

  // Add isKindergartenClass state variable at the top with other state variables
  const [isKindergartenClass, setIsKindergartenClass] = useState(false);

  // Update useEffect to set isKindergartenClass when classData is loaded
  useEffect(() => {
    if (!location.state) {
      setError("No class data provided");
      setLoading(false);
      return;
    }

    // Log the data passed from My-class.jsx to verify
    console.log("Data from My-class.jsx:", location.state);

    const {
      userId,
      classId,
      subjectId,
      schoolYearId,
      gradeLevel,
      section,
      subject,
      schoolYear,
    } = location.state;

    // Check if this is a Kindergarten class
    setIsKindergartenClass(gradeLevel === "Kindergarten");

    setClassData({
      userId,
      classId,
      subjectId,
      schoolYearId,
      gradeLevel,
      section,
      subject,
      schoolYear,
      teacherName: "", // Will be filled later
    });

    // Load teacher data
    loadTeacherData(userId);

    // Load grading criteria
    loadGradingCriteria(subjectId, schoolYearId);
  }, [location]);

  const convertKinderQuarterlyToChar = (quarterlyGrade) => {
    const grade = parseFloat(quarterlyGrade);
    if (isNaN(grade)) return "";
    if (grade >= 90) return "A";
    if (grade >= 85) return "B";
    if (grade >= 80) return "C";
    if (grade >= 75) return "D";
    return "E";
  };

  // Add after handleSaveActivity
  const [deletingActivityId, setDeletingActivityId] = useState(null);
  const handleDeleteActivity = async (activityId, type) => {
    setDeletingActivityId(activityId);
    try {
      await axios.delete(gradingUrl(`/api/activities/${activityId}`), { headers: getAuthHeader() });
      setActivities((prev) => {
        const updated = { ...prev };
        updated[type] = updated[type].filter(
          (a) => a.activity_id !== activityId,
        );
        return updated;
      });
      await loadScores();
    } catch (err) {
      alert("Failed to delete activity.");
    } finally {
      setDeletingActivityId(null);
      setConfirmDelete({ open: false, activityId: null, type: null });
    }
  };

  // Add state after useState declarations
  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    activityId: null,
    type: null,
  });

  // Add to the top of MyClassView:
  const inputRefs = useRef({});

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-lg text-gray-700">
          Loading class data...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
        <button
          onClick={handleBack}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Calculate column counts for each section
  const writtenColCount = activities.written.length || 0;
  const performanceColCount = activities.performance.length || 0;
  const assessmentColCount = activities.assessment.length || 0;

  // Add handler for character grade changes
  const handleCharGradeChange = (studentId, charGrade) => {
    setStudents((prevStudents) => {
      return prevStudents.map((s) => {
        if (s.id.toString() === studentId.toString()) {
          // Create a deep copy
          const updatedStudent = { ...s };
          updatedStudent.charGrade = charGrade;

          // Set student eligible for submission if valid grade
          if (charGrade && ["B", "C", "D"].includes(charGrade)) {
            handleGradeSubmissionSelect(studentId, true);
          }

          return updatedStudent;
        }
        return s;
      });
    });
  };

  return (
    <div className="min-h-screen bg-gray-200">
      {/* Main Content */}
      <div className="w-full">
        <div className="max-w-7xl mx-auto pt-8 px-4 pb-0">
          {/* Back to My Class Button */}
          <div className="flex justify-end mb-2">
            <button
              onClick={() => navigate("/my-class")}
              className="bg-[#7D9164] hover:bg-[#5a6b48] text-white font-semibold py-2 px-4 rounded shadow transition"
            >
              Back to My Class
            </button>
          </div>
          {/* Form layout */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-5 gap-x-6">
              {/* Row 1 */}
              <div className="flex flex-col md:flex-row md:items-center">
                <label className="font-bold w-32 text-right pr-3 text-black">
                  REGION:
                </label>
                <input
                  type="text"
                  value={schoolInfo.region}
                  readOnly
                  className="border border-gray-300 rounded w-full p-2 bg-white text-center text-gray-800"
                />
              </div>
              <div className="flex flex-col md:flex-row md:items-center">
                <label className="font-bold w-32 text-right pr-3 text-black">
                  DIVISION:
                </label>
                <input
                  type="text"
                  value={schoolInfo.division}
                  readOnly
                  className="border border-gray-300 rounded w-full p-2 bg-white text-center text-gray-800"
                />
              </div>
              <div className="flex flex-col md:flex-row md:items-center">
                <label className="font-bold w-32 text-right pr-3 text-black">
                  DISTRICT:
                </label>
                <input
                  type="text"
                  value={schoolInfo.district}
                  readOnly
                  className="border border-gray-300 rounded w-full p-2 bg-white text-center text-gray-800"
                />
              </div>

              {/* Row 2 */}
              <div className="flex flex-col md:flex-row md:items-center">
                <label className="font-bold w-32 text-right pr-3 text-black">
                  SCHOOL NAME:
                </label>
                <input
                  type="text"
                  value={schoolInfo.schoolName}
                  readOnly
                  className="border border-gray-300 rounded w-full p-2 bg-white text-center text-gray-800"
                />
              </div>
              <div className="flex flex-col md:flex-row md:items-center">
                <label className="font-bold w-32 text-right pr-3 text-black">
                  SCHOOL ID:
                </label>
                <input
                  type="text"
                  value={schoolInfo.schoolId}
                  readOnly
                  className="border border-gray-300 rounded w-full p-2 bg-white text-center text-gray-800"
                />
              </div>
              <div className="flex flex-col md:flex-row md:items-center">
                <label className="font-bold w-32 text-right pr-3 text-black">
                  SCHOOL YEAR:
                </label>
                <input
                  type="text"
                  value={classData?.schoolYear}
                  readOnly
                  className="border border-gray-300 rounded w-full p-2 bg-white text-center text-gray-800"
                />
              </div>

              {/* Row 3 */}
              <div className="flex flex-col md:flex-row md:items-center">
                <label className="font-bold w-32 text-right pr-3 text-black">
                  TEACHER:
                </label>
                <input
                  type="text"
                  value={classData?.teacherName}
                  readOnly
                  className="border border-gray-300 rounded w-full p-2 bg-white text-center text-gray-800"
                />
              </div>
              <div className="flex flex-col md:flex-row md:items-center">
                <label className="font-bold w-32 text-right pr-3 text-black">
                  GRADE & SECTION:
                </label>
                <input
                  type="text"
                  value={
                    classData?.gradeLevel === "Kindergarten"
                      ? `Kindergarten - ${classData?.section}`
                      : `Grade ${classData?.gradeLevel} - ${classData?.section}`
                  }
                  readOnly
                  className="border border-gray-300 rounded w-full p-2 bg-white text-center text-gray-800"
                />
              </div>
              <div className="flex flex-col md:flex-row md:items-center">
                <label className="font-bold w-32 text-right pr-3 text-black">
                  SUBJECT:
                </label>
                <input
                  type="text"
                  value={classData?.subject}
                  readOnly
                  className="border border-gray-300 rounded w-full p-2 bg-white text-center text-gray-800"
                />
              </div>
            </div>

            {/* Quarter Selector - Placed at bottom right with Print and Certificate buttons */}
            <div className="flex justify-end mt-4 items-center space-x-4">
              <div className="flex items-center w-52">
                <label className="font-bold mr-2 text-black text-sm">
                  Quarter:
                </label>
                <select
                  className="border border-gray-300 rounded w-full p-1.5 bg-white text-center text-gray-800 text-sm"
                  value={quarter}
                  onChange={handleQuarterChange}
                >
                  <option value="1">First Quarter</option>
                  <option value="2">Second Quarter</option>
                  <option value="3">Third Quarter</option>
                  <option value="4">Fourth Quarter</option>
                </select>
              </div>
            </div>
          </div>

          {/* Success message */}
          {activitySuccess && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mt-4 text-center">
              {activitySuccess}
            </div>
          )}

          {/* Score message */}
          {scoreMessage && (
            <div
              className={`px-4 py-3 rounded mt-4 text-center ${
                scoreMessage.type === "success"
                  ? "bg-green-100 border border-green-400 text-green-700"
                  : scoreMessage.type === "error"
                    ? "bg-red-100 border border-red-400 text-red-700"
                    : "bg-blue-100 border border-blue-400 text-blue-700"
              }`}
            >
              {scoreMessage.text}
            </div>
          )}

          {/* Class record content - no-h-scrollbar hides scrollbar but allows horizontal scroll when needed */}
          <div className="bg-gray-100 rounded-lg shadow-lg p-4 no-h-scrollbar mt-0">
            {!hasCriteria && (
              <div className="bg-red-100 border-2 border-red-500 text-red-700 p-3 mb-4 text-center font-semibold">
                No Grading Criteria is set for this subject on this school year
                yet. Please contact the administrator.
              </div>
            )}

            {loading ? (
              <div className="flex justify-center items-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                <span>Loading data...</span>
              </div>
            ) : null}

            <table className="min-w-full border-collapse border border-black table-fixed">
              {hasCriteria ? (
                <>
                  {/* Main header row - WITH criteria - compact */}
                  <thead>
                    <tr>
                      <th className="border border-black px-1 py-0.5 font-bold text-center bg-white text-gray-800 text-[9px] leading-tight w-[85px]">
                        LEARNERS' NAMES
                      </th>
                      <th
                        className="border border-black px-1 py-0.5 font-bold text-center bg-white text-[9px]"
                        colSpan={3 + writtenColCount}
                      >
                        WRITTEN WORKS (
                        {gradingCriteria.written_works_percentage}%){" "}
                        <AddActivityButton type="written" />
                      </th>
                      <th
                        className="border border-black px-1 py-0.5 font-bold text-center bg-white text-[9px]"
                        colSpan={3 + performanceColCount}
                      >
                        PERFORMANCE TASKS (
                        {gradingCriteria.performance_tasks_percentage}%){" "}
                        <AddActivityButton type="performance" />
                      </th>
                      <th
                        className="border border-black px-1 py-0.5 font-bold text-center bg-white text-[9px]"
                        colSpan={3 + assessmentColCount}
                      >
                        QUARTERLY ASSESSMENT (
                        {gradingCriteria.quarterly_assessment_percentage}%){" "}
                        <AddActivityButton type="assessment" />
                      </th>
                      <th className="px-0.5 py-0.5 font-bold text-center border-r border-black bg-white text-[8px] leading-tight w-[44px]">
                        <span className="block line-clamp-2 break-words">
                          Initial Grade
                        </span>
                      </th>
                      <th className="px-0.5 py-0.5 font-bold text-center bg-white text-[8px] leading-tight w-[44px]">
                        <span className="block line-clamp-2 break-words">
                          Quarterly Grade
                        </span>
                      </th>
                    </tr>

                    {/* Sub-header row - compact */}
                    <tr>
                      <th className="border border-black px-0.5 py-0.5 bg-white w-[85px]"></th>
                      {/* Activities for Written Works */}
                      {renderActivityColumns("written")}
                      <th className="border border-black px-0.5 py-0.5 font-medium text-center bg-white text-[9px] min-w-[44px]">
                        Total
                      </th>
                      <th className="border border-black px-0.5 py-0.5 font-medium text-center bg-white text-[9px] min-w-[44px]">
                        PS
                      </th>
                      <th className="border border-black px-0.5 py-0.5 font-medium text-center bg-white text-[9px] min-w-[44px]">
                        WS
                      </th>

                      {/* Activities for Performance Tasks */}
                      {renderActivityColumns("performance")}
                      <th className="border border-black px-0.5 py-0.5 font-medium text-center bg-white text-[9px] min-w-[44px]">
                        Total
                      </th>
                      <th className="border border-black px-0.5 py-0.5 font-medium text-center bg-white text-[9px] min-w-[44px]">
                        PS
                      </th>
                      <th className="border border-black px-0.5 py-0.5 font-medium text-center bg-white text-[9px] min-w-[44px]">
                        WS
                      </th>

                      {/* Activities for Quarterly Assessment */}
                      {renderActivityColumns("assessment")}
                      <th className="border border-black px-0.5 py-0.5 font-medium text-center bg-white text-[9px] min-w-[44px]">
                        Total
                      </th>
                      <th className="border border-black px-0.5 py-0.5 font-medium text-center bg-white text-[9px] min-w-[44px]">
                        PS
                      </th>
                      <th className="border border-black px-0.5 py-0.5 font-medium text-center bg-white text-[9px] min-w-[44px]">
                        WS
                      </th>

                      <th className="px-0.5 py-0.5 font-medium text-center border-r border-black bg-white"></th>
                      <th className="px-0.5 py-0.5 font-medium text-center bg-white"></th>
                    </tr>
                  </thead>

                  <tbody>
                    {/* Highest possible score row - compact */}
                    <tr className="bg-white">
                      <td className="border border-black px-1 py-0.5 font-bold bg-white text-[9px] w-[85px] max-w-[85px]">
                        HIGHEST POSSIBLE SCORE
                      </td>

                      {/* Highest scores for Written Works activities */}
                      {renderHighestPossibleScores("written")}
                      <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                        {calculateTotalMaxScores().written}
                      </td>
                      <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                        100
                      </td>
                      <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                        {gradingCriteria.written_works_percentage}%
                      </td>

                      {/* Highest scores for Performance Tasks activities */}
                      {renderHighestPossibleScores("performance")}
                      <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                        {calculateTotalMaxScores().performance}
                      </td>
                      <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                        100
                      </td>
                      <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                        {gradingCriteria.performance_tasks_percentage}%
                      </td>

                      {/* Highest scores for Quarterly Assessment activities */}
                      {renderHighestPossibleScores("assessment")}
                      <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                        {calculateTotalMaxScores().assessment}
                      </td>
                      <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                        100
                      </td>
                      <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                        {gradingCriteria.quarterly_assessment_percentage}%
                      </td>

                      <td className="px-0.5 py-0.5 text-center border-b border-r border-black bg-white"></td>
                      <td className="px-0.5 py-0.5 text-center border-b border-black bg-white"></td>
                    </tr>

                    {/* Student rows */}
                    {students.length === 0 ? (
                      <tr className="bg-white">
                        <td
                          colSpan="100%"
                          className="border border-black p-2 text-center text-gray-600 text-[10px]"
                        >
                          No students assigned to this class yet.
                        </td>
                      </tr>
                    ) : (
                      students.map((student, index) => {
                        // Check if student has uploaded grades
                        const isUploaded =
                          uploadedGrades[student.id] !== undefined;

                        return (
                          <tr
                            key={student.id || index}
                            className={`${isUploaded ? "bg-gray-50" : "bg-white"} hover:bg-gray-100`}
                          >
                            <td
                              className={`border border-black px-1 py-0.5 ${isUploaded ? "bg-gray-50" : "bg-white"} text-gray-800 text-[9px] leading-tight w-[85px] max-w-[85px] align-top`}
                            >
                              <div className="flex items-start gap-1">
                                <input
                                  type="checkbox"
                                  checked={!!selectedForCertificate[student.id]}
                                  onChange={(e) =>
                                    handleCertificateSelection(
                                      student.id,
                                      e.target.checked,
                                    )
                                  }
                                  className="h-2.5 w-2.5 mt-0.5 flex-shrink-0 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  title="Select for certificate"
                                />
                                <span
                                  className="break-words leading-tight text-[11px]"
                                  title={student.name}
                                >
                                  {student.name}
                                </span>
                              </div>
                            </td>

                            {/* Scores for Written Works activities */}
                            {renderActivityScores("written", student)}
                            <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                              {student.written.total}
                            </td>
                            <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                              {student.written.ps !== undefined &&
                              student.written.ps !== null
                                ? Number(student.written.ps).toFixed(2)
                                : ""}
                            </td>
                            <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                              {student.written.ws !== undefined &&
                              student.written.ws !== null
                                ? Number(student.written.ws).toFixed(2)
                                : ""}
                            </td>

                            {/* Scores for Performance Tasks activities */}
                            {renderActivityScores("performance", student)}
                            <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                              {student.performance.total}
                            </td>
                            <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                              {student.performance.ps !== undefined &&
                              student.performance.ps !== null
                                ? Number(student.performance.ps).toFixed(2)
                                : ""}
                            </td>
                            <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                              {student.performance.ws !== undefined &&
                              student.performance.ws !== null
                                ? Number(student.performance.ws).toFixed(2)
                                : ""}
                            </td>

                            {/* Scores for Quarterly Assessment activities */}
                            {renderActivityScores("assessment", student)}
                            <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                              {student.quarterly.total}
                            </td>
                            <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                              {student.quarterly.ps !== undefined &&
                              student.quarterly.ps !== null
                                ? Number(student.quarterly.ps).toFixed(2)
                                : ""}
                            </td>
                            <td className="border border-black px-0.5 py-0.5 text-center bg-white text-[10px] min-w-[44px]">
                              {student.quarterly.ws !== undefined &&
                              student.quarterly.ws !== null
                                ? Number(student.quarterly.ws).toFixed(2)
                                : ""}
                            </td>

                            <td className="px-0.5 py-0.5 text-center border-b border-r border-black bg-white font-medium text-[10px]">
                              {student.initialGrade}
                            </td>
                            <td className="px-0.5 py-0.5 text-center font-bold border-b border-black bg-white text-[10px]">
                              {renderQuarterlyGradeCell(student)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </>
              ) : (
                <>
                  {/* Simplified table when no criteria is set - compact */}
                  <thead>
                    <tr>
                      <th className="border border-black px-1 py-0.5 font-bold text-left bg-gray-200 text-gray-800 text-[9px] leading-tight">
                        LEARNERS' NAMES
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-gray-200">
                      <td className="border border-black px-1 py-0.5 font-bold bg-gray-200 text-gray-800 text-[9px]">
                        HIGHEST POSSIBLE SCORE
                      </td>
                    </tr>
                    {students.length === 0 ? (
                      <tr className="bg-white">
                        <td
                          colSpan="100%"
                          className="border border-black p-2 text-center text-gray-600 text-[10px]"
                        >
                          No students assigned to this class yet.
                        </td>
                      </tr>
                    ) : (
                      students.map((student, index) => (
                        <tr
                          key={student.id || index}
                          className="bg-white hover:bg-gray-100"
                        >
                          <td className="border border-black px-1 py-0.5 bg-gray-200 text-gray-800 text-[9px] leading-tight">
                            {student.name}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </>
              )}
            </table>

            {/* Unsaved changes notification - Redesigned and moved to bottom of table */}
            {Object.keys(pendingChanges).length > 0 && (
              <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#f8f9fa] to-[#e9ecef]">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
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
                    <div>
                      <h3 className="font-medium text-gray-800">
                        Pending Changes
                      </h3>
                      <p className="text-sm text-gray-600">
                        {Object.keys(pendingChanges).length} unsaved{" "}
                        {Object.keys(pendingChanges).length === 1
                          ? "change"
                          : "changes"}{" "}
                        to student scores
                      </p>
                      <p className="text-xs text-gray-500 mt-1 italic">
                        Note: Changes are not saved until you click "Save All
                        Changes"
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={discardAllChanges}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 font-medium shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition-all duration-200"
                    >
                      Discard All
                    </button>
                    <button
                      onClick={saveAllChanges}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200"
                    >
                      Save All Changes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!hasCriteria && (
              <div className="mt-4">
                <button
                  onClick={handleBack}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Go Back
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Grade Submission Panel here */}
      {hasCriteria && students.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pb-0">
          {renderGradeSubmissionPanel()}
        </div>
      )}

      {/* Action Buttons - Print Class Record and Generate Certificate */}
      <div className="w-full flex flex-col items-center mt-6 space-y-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrint}
            disabled={!hasCriteria || students.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1.5 px-3 rounded flex items-center justify-center space-x-1 shadow-md transition-all duration-200 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70 text-xs min-w-[70px] h-8"
            title={
              !hasCriteria
                ? "No grading criteria set"
                : students.length === 0
                  ? "No students to print"
                  : "Print class record"
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            <span>Print</span>
          </button>
          <button
            onClick={() => {
              handleGenerateCertificate();
            }}
            disabled={!showGenerateCertificates}
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-1.5 px-3 rounded flex items-center justify-center space-x-1 shadow-md transition-all duration-200 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70 text-xs min-w-[120px] h-8"
            title={
              !showGenerateCertificates
                ? "Select students to generate certificates"
                : "Generate certificates for selected students"
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
            <span>Excellence Certificate</span>
          </button>
          <button
            onClick={() => {
              handleGenerateCompletionCertificate();
            }}
            disabled={!showGenerateCertificates}
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-1.5 px-3 rounded flex items-center justify-center space-x-1 shadow-md transition-all duration-200 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70 text-xs min-w-[120px] h-8"
            title={
              !showGenerateCertificates
                ? "Select students to generate certificates"
                : "Generate completion certificates for selected students"
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span>Completion Certificate</span>
          </button>
        </div>
      </div>

      {/* Render the modal */}
      <ActivityModal />

      {/* Render the PDF template (hidden by default) */}
      <GradesPdfTemplate
        schoolInfo={schoolInfo}
        classData={classData || {}}
        students={students}
        activities={activities}
        gradingCriteria={gradingCriteria || {}}
        quarter={quarter}
        getTransmutedGrade={getTransmutedGrade}
      />
      {confirmDelete.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() =>
              setConfirmDelete({ open: false, activityId: null, type: null })
            }
          ></div>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xs mx-5 relative z-10 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              Delete Activity
            </h2>
            <p className="text-gray-700 mb-4">
              Are you sure you want to delete this activity? This will also
              remove all associated scores.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                onClick={() =>
                  setConfirmDelete({
                    open: false,
                    activityId: null,
                    type: null,
                  })
                }
                disabled={deletingActivityId === confirmDelete.activityId}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-300"
                onClick={() =>
                  handleDeleteActivity(
                    confirmDelete.activityId,
                    confirmDelete.type,
                  )
                }
                disabled={deletingActivityId === confirmDelete.activityId}
              >
                {deletingActivityId === confirmDelete.activityId
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyClassView;
