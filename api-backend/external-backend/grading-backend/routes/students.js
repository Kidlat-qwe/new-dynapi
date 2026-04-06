import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get all students
router.get('/', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE user_type = 'student'");
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get student grades
router.get('/:studentId/grades', async (req, res) => {
  try {
    const { studentId } = req.params;
    const result = await pool.query(
      `SELECT sg.*, s.subject_name, c.grade_level, c.section,
              u.fname as teacher_fname, u.mname as teacher_mname, u.lname as teacher_lname
       FROM student_grade sg
       JOIN subject s ON sg.subject_id = s.subject_id
       JOIN class c ON sg.class_id = c.class_id
       LEFT JOIN users u ON sg.teacher_id = u.user_id
       WHERE sg.student_id = $1`,
      [studentId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get student's previous grade level
router.get('/:studentId/previous-grade', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Find the most recent class where the student was enrolled, ordered by school year
    const query = `
      SELECT c.grade_level, c.class_id, sy.school_year
      FROM class_student cs
      JOIN class c ON cs.class_id = c.class_id
      JOIN school_year sy ON c.school_year_id = sy.school_year_id
      WHERE cs.student_id = $1
      ORDER BY sy.school_year DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [studentId]);
    
    if (result.rows.length === 0) {
      // Student has no previous grade level (new student)
      return res.json({ 
        previousGradeLevel: null,
        isNewStudent: true
      });
    }
    
    // Return the previous grade level
    res.json({
      previousGradeLevel: result.rows[0].grade_level,
      classId: result.rows[0].class_id,
      schoolYear: result.rows[0].school_year,
      isNewStudent: false
    });
  } catch (error) {
    console.error('Error fetching student previous grade:', error);
    res.status(500).json({ error: 'Failed to fetch student history' });
  }
});

// Get all classes a student is enrolled in (optionally filter by school year)
router.get('/:studentId/classes', async (req, res) => {
  try {
    const { studentId } = req.params;
    let { schoolYearId } = req.query;
    let query = `
      SELECT c.class_id, c.grade_level, c.section, c.school_year_id, sy.school_year
      FROM class_student cs
      JOIN class c ON cs.class_id = c.class_id
      JOIN school_year sy ON c.school_year_id = sy.school_year_id
      WHERE cs.student_id = $1
    `;
    const params = [studentId];
    // Only append schoolYearId if it is a valid integer
    if (schoolYearId && !isNaN(parseInt(schoolYearId))) {
      query += ' AND c.school_year_id = $2::int';
      params.push(parseInt(schoolYearId));
    }
    query += ' ORDER BY c.grade_level, c.section';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching student classes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get student grades by school year
router.get('/:studentId/:schoolYearId', async (req, res) => {
  try {
    const { studentId, schoolYearId } = req.params;
    const onlyAssigned = req.query.onlyAssigned === 'true';
    
    // First, get the student's class information
    const classQuery = `
      SELECT c.class_id, c.grade_level, c.section
      FROM class_student cs
      JOIN class c ON cs.class_id = c.class_id
      WHERE cs.student_id = $1 AND c.school_year_id = $2
    `;
    const classResult = await pool.query(classQuery, [studentId, schoolYearId]);
    
    // Get student information
    const studentQuery = `
      SELECT user_id as student_id, fname, mname, lname, lrn
      FROM users
      WHERE user_id = $1
    `;
    const studentResult = await pool.query(studentQuery, [studentId]);
    
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Return empty data structure if student isn't enrolled in this school year
    if (classResult.rows.length === 0) {
      return res.status(200).json({
        ...studentResult.rows[0],
        grade_level: null,
        section: null,
        grades: [],
        enrolled: false,
        message: 'Student not enrolled in any class for this school year'
      });
    }
    
    // Combine class and student info
    const classInfo = classResult.rows[0];
    const studentData = {
      ...studentResult.rows[0],
      grade_level: classInfo.grade_level || null,
      section: classInfo.section || null,
      class_id: classInfo.class_id || null,
      grades: [],
      enrolled: true
    };
    
    // Check if this is a Kindergarten class (needs character grades)
    // Make sure grade_level exists and is exactly 'Kindergarten'
    const isKindergarten = classInfo && classInfo.grade_level && classInfo.grade_level === 'Kindergarten';
    
    // Check if char_grade column exists in the database
    let hasCharGradeColumn = false;
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'student_grade' 
        AND column_name = 'char_grade'
      `);
      hasCharGradeColumn = columnCheck.rows.length > 0;
    } catch (err) {
      console.warn('Error checking for char_grade column:', err.message);
      // If there's an error checking, we'll assume it doesn't exist rather than breaking
      hasCharGradeColumn = false;
    }
    
    // If Kindergarten but char_grade column doesn't exist, fall back to regular grades
    const useCharGrades = isKindergarten && hasCharGradeColumn;
    
    // Get grades for the student, but only for subjects assigned to their class if onlyAssigned is true
    let gradesQuery;
    let queryParams;
    
    if (onlyAssigned) {
      // Only get subjects assigned to the student's class
      if (useCharGrades) {
        // For Kindergarten: use character grades
        gradesQuery = `
          SELECT s.subject_id, s.subject_name, s.parent_subject_id,
            MAX(CASE WHEN sg.quarter = '1' THEN sg.char_grade END) as quarter1_char,
            MAX(CASE WHEN sg.quarter = '2' THEN sg.char_grade END) as quarter2_char,
            MAX(CASE WHEN sg.quarter = '3' THEN sg.char_grade END) as quarter3_char,
            MAX(CASE WHEN sg.quarter = '4' THEN sg.char_grade END) as quarter4_char
          FROM subject s
          JOIN class_subject cs ON s.subject_id = cs.subject_id
          LEFT JOIN student_grade sg ON s.subject_id = sg.subject_id 
            AND sg.student_id = $1 
            AND sg.class_id = $2
          WHERE cs.class_id = $2
          GROUP BY s.subject_id, s.subject_name, s.parent_subject_id
          ORDER BY s.subject_name
        `;
      } else {
        // For non-Kindergarten or when char_grade is not available: use numeric grades
        gradesQuery = `
          SELECT s.subject_id, s.subject_name, s.parent_subject_id,
            MAX(CASE WHEN sg.quarter = '1' THEN sg.grade END) as quarter1,
            MAX(CASE WHEN sg.quarter = '2' THEN sg.grade END) as quarter2,
            MAX(CASE WHEN sg.quarter = '3' THEN sg.grade END) as quarter3,
            MAX(CASE WHEN sg.quarter = '4' THEN sg.grade END) as quarter4,
            ROUND(AVG(sg.grade)::numeric, 2) as final_grade
          FROM subject s
          JOIN class_subject cs ON s.subject_id = cs.subject_id
          LEFT JOIN student_grade sg ON s.subject_id = sg.subject_id 
            AND sg.student_id = $1 
            AND sg.class_id = $2
          WHERE cs.class_id = $2
          GROUP BY s.subject_id, s.subject_name, s.parent_subject_id
          ORDER BY s.subject_name
        `;
      }
      queryParams = [studentId, classInfo.class_id];
    } else {
      // Get all subjects (previous behavior)
      if (useCharGrades) {
        // For Kindergarten: use character grades
        gradesQuery = `
          SELECT s.subject_id, s.subject_name, s.parent_subject_id,
            MAX(CASE WHEN sg.quarter = '1' THEN sg.char_grade END) as quarter1_char,
            MAX(CASE WHEN sg.quarter = '2' THEN sg.char_grade END) as quarter2_char,
            MAX(CASE WHEN sg.quarter = '3' THEN sg.char_grade END) as quarter3_char,
            MAX(CASE WHEN sg.quarter = '4' THEN sg.char_grade END) as quarter4_char
          FROM subject s
          LEFT JOIN student_grade sg ON s.subject_id = sg.subject_id 
            AND sg.student_id = $1 
            AND sg.class_id = $2
          GROUP BY s.subject_id, s.subject_name, s.parent_subject_id
          ORDER BY s.subject_name
        `;
      } else {
        // For non-Kindergarten or when char_grade is not available: use numeric grades
        gradesQuery = `
          SELECT s.subject_id, s.subject_name, s.parent_subject_id,
            MAX(CASE WHEN sg.quarter = '1' THEN sg.grade END) as quarter1,
            MAX(CASE WHEN sg.quarter = '2' THEN sg.grade END) as quarter2,
            MAX(CASE WHEN sg.quarter = '3' THEN sg.grade END) as quarter3,
            MAX(CASE WHEN sg.quarter = '4' THEN sg.grade END) as quarter4,
            AVG(sg.grade) as final_grade
          FROM subject s
          LEFT JOIN student_grade sg ON s.subject_id = sg.subject_id 
            AND sg.student_id = $1 
            AND sg.class_id = $2
          GROUP BY s.subject_id, s.subject_name, s.parent_subject_id
          ORDER BY s.subject_name
        `;
      }
      queryParams = [studentId, classInfo.class_id];
    }
    
    const gradesResult = await pool.query(gradesQuery, queryParams);
    studentData.grades = gradesResult.rows;
    
    // Set isKindergarten flag in the response
    studentData.isKindergarten = isKindergarten;
    
    res.json(studentData);
  } catch (error) {
    console.error('Error fetching student grades:', error);
    res.status(500).json({ 
      message: 'Server error when fetching student grades', 
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get quarterly GWA for a student
router.get('/:studentId/:classId/:schoolYearId/quarterly-gwa/:quarter', async (req, res) => {
  try {
    const { studentId, classId, schoolYearId, quarter } = req.params;
    const query = `
      SELECT quarterly_gwa
      FROM student_quarterly_gwa
      WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3 AND quarter = $4
      LIMIT 1;
    `;
    const result = await pool.query(query, [studentId, classId, schoolYearId, quarter]);
    if (result.rows.length === 0) {
      return res.json({ quarterly_gwa: null });
    }
    res.json({ quarterly_gwa: result.rows[0].quarterly_gwa });
  } catch (error) {
    console.error('Error fetching quarterly GWA:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get final GWA for a student
router.get('/:studentId/:classId/:schoolYearId/gwa', async (req, res) => {
  try {
    const { studentId, classId, schoolYearId } = req.params;
    const query = `
      SELECT gwa
      FROM student_gwa
      WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3
      LIMIT 1;
    `;
    const result = await pool.query(query, [studentId, classId, schoolYearId]);
    if (result.rows.length === 0) {
      return res.json({ gwa: null });
    }
    res.json({ gwa: result.rows[0].gwa });
  } catch (error) {
    console.error('Error fetching GWA:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 