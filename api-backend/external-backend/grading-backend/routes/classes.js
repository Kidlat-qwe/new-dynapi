import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get all classes with optional school year filter
router.get('/', async (req, res) => {
  try {
    const { schoolYearId } = req.query;
    
    const query = `
      SELECT c.class_id, c.grade_level, c.section, c.class_description, 
             s.school_year, c.school_year_id, c.class_adviser_id,
             u.fname as adviser_fname, u.mname as adviser_mname, u.lname as adviser_lname,
             c.program_name, c.class_code
      FROM class c
      JOIN school_year s ON c.school_year_id = s.school_year_id
      LEFT JOIN users u ON c.class_adviser_id = u.user_id
      ${schoolYearId ? 'WHERE c.school_year_id = $1' : ''}
      ORDER BY c.grade_level, c.section
    `;

    const queryParams = schoolYearId ? [schoolYearId] : [];
    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single class
router.get('/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    const result = await pool.query(`
      SELECT c.class_id, c.grade_level, c.section, c.class_description, 
             s.school_year, c.school_year_id, c.class_adviser_id,
             u.fname as adviser_fname, u.mname as adviser_mname, u.lname as adviser_lname,
             c.program_name, c.class_code
      FROM class c
      JOIN school_year s ON c.school_year_id = s.school_year_id
      LEFT JOIN users u ON c.class_adviser_id = u.user_id
      WHERE c.class_id = $1
    `, [classId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new class
router.post('/', async (req, res) => {
  try {
    const { 
      grade_level, 
      section, 
      class_description, 
      school_year_id, 
      class_adviser_id,
      program_name,
      class_code
    } = req.body;
    
    // Verify the school year is active
    const schoolYearCheck = await pool.query(
      'SELECT is_active FROM school_year WHERE school_year_id = $1',
      [school_year_id]
    );
    
    if (schoolYearCheck.rows.length === 0) {
      return res.status(404).json({ error: 'School year not found' });
    }
    
    if (!schoolYearCheck.rows[0].is_active) {
      return res.status(400).json({ error: 'Classes can only be added for the active school year' });
    }
    
    // If class adviser ID is provided, verify it's a valid teacher
    if (class_adviser_id) {
      const teacherCheck = await pool.query(
        'SELECT * FROM users WHERE user_id = $1 AND user_type = $2 AND teacher_status = true',
        [class_adviser_id, 'teacher']
      );
      
      if (teacherCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Teacher not found or not active' });
      }
    }
    
    const result = await pool.query(
      'INSERT INTO class (grade_level, section, class_description, school_year_id, class_adviser_id, program_name, class_code) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [grade_level, section, class_description, school_year_id, class_adviser_id || null, program_name, class_code]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get students in a class
router.get('/:classId/students', async (req, res) => {
  try {
    const { classId } = req.params;
    const query = `
      SELECT u.* 
      FROM users u
      JOIN class_student cs ON u.user_id = cs.student_id
      WHERE cs.class_id = $1
      ORDER BY u.lname, u.fname
    `;
    const result = await pool.query(query, [classId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching class students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get students in a class (alternative endpoint)
router.get('/students-by-class/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    
    const query = `
      SELECT u.user_id as student_id, u.fname, u.mname, u.lname, u.email, cs.class_id 
      FROM class_student cs
      JOIN users u ON cs.student_id = u.user_id
      WHERE cs.class_id = $1
      ORDER BY u.lname, u.fname
    `;
    
    const result = await pool.query(query, [classId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching class students:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available students for a class
router.get('/:classId/available-students', async (req, res) => {
  try {
    const { classId } = req.params;
    const { schoolYearId, includePreviousGrade } = req.query;
    
    // First, get the target class grade level
    const classInfoQuery = `
      SELECT grade_level 
      FROM class 
      WHERE class_id = $1
    `;
    const classInfoResult = await pool.query(classInfoQuery, [classId]);
    
    if (classInfoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const targetGradeLevel = classInfoResult.rows[0].grade_level;
    
    // Helper function to convert grade level to a number
    const gradeToNumber = (gradeLevel) => {
      if (!gradeLevel) return 0;
      if (gradeLevel === 'Kindergarten' || gradeLevel === 'K') return 0;
      // Extract number from "Grade X" format
      const match = gradeLevel.toString().match(/Grade (\d+)/);
      return match ? parseInt(match[1]) : 0;
    };
    
    const targetGradeNumber = gradeToNumber(targetGradeLevel);
    
    // Get all unassigned students
    const unassignedStudentsQuery = `
      SELECT u.user_id, u.fname, u.mname, u.lname, u.email, u.gender, u.user_type
      FROM users u
      WHERE u.user_type = 'student'
      AND u.user_id NOT IN (
        SELECT cs.student_id 
        FROM class_student cs
        JOIN class c ON cs.class_id = c.class_id
        WHERE c.school_year_id = $1
      )
      AND u.user_id NOT IN (
        SELECT cs.student_id 
        FROM class_student cs 
        WHERE cs.class_id = $2
      )
    `;
    
    const unassignedStudents = await pool.query(unassignedStudentsQuery, [schoolYearId, classId]);
    const students = unassignedStudents.rows;
    
    // Get previous grade level for each student and apply validation rules
    const validatedStudents = await Promise.all(students.map(async (student) => {
      try {
        // Get previous grade level for this student
        const gradeResponse = await pool.query(`
          SELECT c.grade_level
          FROM class_student cs
          JOIN class c ON cs.class_id = c.class_id
          JOIN school_year sy ON c.school_year_id = sy.school_year_id
          WHERE cs.student_id = $1
          ORDER BY sy.school_year DESC
          LIMIT 1
        `, [student.user_id]);
        
        if (gradeResponse.rows.length === 0) {
          // New student - always valid
          return {
            ...student,
            previousGradeLevel: null,
            isValidGradeProgression: true
          };
        }
        
        const previousGradeLevel = gradeResponse.rows[0].grade_level;
        const previousGradeNumber = gradeToNumber(previousGradeLevel);
        
        // Apply validation rules:
        // 1. Student can advance one grade (previousGrade + 1)
        // 2. Student can repeat the same grade (previousGrade)
        // 3. Student cannot go backwards or skip grades
        const isValidGradeProgression = (
          previousGradeNumber === targetGradeNumber - 1 || // Advancing one grade
          previousGradeNumber === targetGradeNumber        // Repeating grade
        );
        
        return {
          ...student,
          previousGradeLevel,
          isValidGradeProgression
        };
      } catch (error) {
        console.error(`Error processing student ${student.user_id}:`, error);
        return {
          ...student,
          previousGradeLevel: null,
          isValidGradeProgression: false
        };
      }
    }));
    
    // Filter to only return valid students
    const eligibleStudents = validatedStudents.filter(student => 
      student.isValidGradeProgression
    );
    
    res.json(eligibleStudents);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Assign student to class
router.post('/:classId/students', async (req, res) => {
  const client = await pool.connect();
  try {
    const { classId } = req.params;
    const { student_id } = req.body;
    // Use current date for date_enrolled and effective_date
    const currentDate = new Date().toISOString().split('T')[0];
    await client.query('BEGIN');
    // Insert into class_student
    await client.query(
      'INSERT INTO class_student (class_id, student_id, date_enrolled) VALUES ($1, $2, $3)',
      [classId, student_id, currentDate]
    );
    // Get school_year_id for the class
    const classRes = await client.query('SELECT school_year_id FROM class WHERE class_id = $1', [classId]);
    if (classRes.rows.length === 0) throw new Error('Class not found');
    const school_year_id = classRes.rows[0].school_year_id;
    // Insert into student_status if not already present
    const statusCheck = await client.query(
      'SELECT status_id FROM student_status WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3',
      [student_id, classId, school_year_id]
    );
    if (statusCheck.rows.length === 0) {
      await client.query(
        'INSERT INTO student_status (student_id, class_id, school_year_id, status_type, effective_date) VALUES ($1, $2, $3, $4, $5)',
        [student_id, classId, school_year_id, 'ACTIVE', currentDate]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Student assigned successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Remove student from class
router.delete('/:classId/students/:studentId', async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    
    await pool.query(
      'DELETE FROM class_student WHERE class_id = $1 AND student_id = $2',
      [classId, studentId]
    );
    
    res.json({ message: 'Student removed successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subjects in a class
router.get('/:classId/subjects', async (req, res) => {
  try {
    const { classId } = req.params;
    const query = `
      SELECT s.subject_id, s.subject_name, s.parent_subject_id,
             u.fname, u.mname, u.lname, u.gender
      FROM class_subject cs
      JOIN subject s ON cs.subject_id = s.subject_id
      LEFT JOIN users u ON cs.teacher_id = u.user_id
      WHERE cs.class_id = $1
      ORDER BY s.subject_name
    `;
    const result = await pool.query(query, [classId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Assign subject to a class
router.post('/:classId/subjects', async (req, res) => {
  try {
    const { classId } = req.params;
    const { subject_id, teacher_id } = req.body;
    
    // Validate input
    if (!subject_id || !teacher_id) {
      return res.status(400).json({ error: 'Subject ID and Teacher ID are required' });
    }
    
    // Check if class exists
    const classCheck = await pool.query('SELECT * FROM class WHERE class_id = $1', [classId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Check if subject exists
    const subjectCheck = await pool.query('SELECT * FROM subject WHERE subject_id = $1', [subject_id]);
    if (subjectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    // Check if teacher exists
    const teacherCheck = await pool.query('SELECT * FROM users WHERE user_id = $1 AND user_type = \'teacher\'', [teacher_id]);
    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    // Check if this subject is already assigned to this class
    const existingCheck = await pool.query(
      'SELECT * FROM class_subject WHERE class_id = $1 AND subject_id = $2',
      [classId, subject_id]
    );
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'This subject is already assigned to this class' });
    }
    
    // Insert the new class-subject assignment
    const result = await pool.query(
      'INSERT INTO class_subject (class_id, subject_id, teacher_id) VALUES ($1, $2, $3) RETURNING *',
      [classId, subject_id, teacher_id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error assigning subject to class:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a subject's teacher in a class
router.put('/:classId/subjects/:subjectId/teacher', async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    const { teacher_id } = req.body;
    
    // Validate input
    if (!teacher_id) {
      return res.status(400).json({ error: 'Teacher ID is required' });
    }
    
    // Check if class exists
    const classCheck = await pool.query('SELECT * FROM class WHERE class_id = $1', [classId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Check if subject is assigned to class
    const subjectCheck = await pool.query(
      'SELECT * FROM class_subject WHERE class_id = $1 AND subject_id = $2',
      [classId, subjectId]
    );
    if (subjectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not assigned to this class' });
    }
    
    // Check if teacher exists
    const teacherCheck = await pool.query('SELECT * FROM users WHERE user_id = $1 AND user_type = \'teacher\'', [teacher_id]);
    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    // Update the teacher for this class-subject
    const result = await pool.query(
      'UPDATE class_subject SET teacher_id = $1 WHERE class_id = $2 AND subject_id = $3 RETURNING *',
      [teacher_id, classId, subjectId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating subject teacher:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a subject from a class
router.delete('/:classId/subjects/:subjectId', async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    
    // Check if class exists
    const classCheck = await pool.query('SELECT * FROM class WHERE class_id = $1', [classId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Check if subject is assigned to class
    const subjectCheck = await pool.query(
      'SELECT * FROM class_subject WHERE class_id = $1 AND subject_id = $2',
      [classId, subjectId]
    );
    if (subjectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not assigned to this class' });
    }
    
    // Check if there are any grades for this class-subject that would be orphaned
    const gradeCheck = await pool.query(
      `SELECT COUNT(*) FROM student_grade sg
       JOIN class_student cs ON sg.student_id = cs.student_id
       WHERE cs.class_id = $1 AND sg.subject_id = $2`,
      [classId, subjectId]
    );
    
    // Delete the subject from the class
    await pool.query(
      'DELETE FROM class_subject WHERE class_id = $1 AND subject_id = $2',
      [classId, subjectId]
    );
    
    res.json({ 
      message: 'Subject removed from class successfully',
      gradesAffected: parseInt(gradeCheck.rows[0].count)
    });
  } catch (error) {
    console.error('Error removing subject from class:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get class average grades for students
router.get('/:classId/student-average/:quarter', async (req, res) => {
  try {
    const { classId } = req.params;
    // The frontend sends the quarter in the path and as a query param. We'll use the query param as the source of truth.
    const { quarter } = req.query;

    if (!quarter) {
      return res.status(400).json({ error: 'Quarter parameter is required.' });
    }

    let query;
    const queryParams = [classId];

    if (quarter === 'final') {
      // For final average, use the pre-calculated GWA from student_gwa table
      query = `
        SELECT
          sg.student_id,
          u.fname,
          u.mname,
          u.lname,
          c.grade_level,
          c.section,
          sg.gwa::numeric(10, 2) as average_grade,
          RANK() OVER (ORDER BY sg.gwa DESC) as rank_number
        FROM student_gwa sg
        JOIN users u ON sg.student_id = u.user_id
        JOIN class c ON sg.class_id = c.class_id
        WHERE sg.class_id = $1
        ORDER BY rank_number, u.lname, u.fname;
      `;
    } else {
      // For quarterly average, use the pre-calculated GWA from student_quarterly_gwa table
      query = `
        SELECT
          sqg.student_id,
          u.fname,
          u.mname,
          u.lname,
          c.grade_level,
          c.section,
          sqg.quarterly_gwa::numeric(10, 2) as average_grade,
          RANK() OVER (ORDER BY sqg.quarterly_gwa DESC) as rank_number
        FROM student_quarterly_gwa sqg
        JOIN users u ON sqg.student_id = u.user_id
        JOIN class c ON sqg.class_id = c.class_id
        WHERE sqg.class_id = $1
          AND sqg.quarter = $2
        ORDER BY rank_number, u.lname, u.fname;
      `;
      queryParams.push(quarter);
    }

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching class average grades:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get students in a class for grade upload
router.get('/:classId/grade-upload/students', async (req, res) => {
  try {
    const { classId } = req.params;
    const query = `
      SELECT 
        u.user_id,
        u.fname,
        u.mname,
        u.lname
      FROM users u
      JOIN class_student cs ON u.user_id = cs.student_id
      WHERE cs.class_id = $1
      ORDER BY u.lname, u.fname
    `;
    const result = await pool.query(query, [classId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students for grade upload:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get enrollment statistics for a class
router.get('/:classId/enrollment-statistics', async (req, res) => {
  try {
    const { classId } = req.params;
    const { schoolYearId, month, year } = req.query;
    
    if (!classId || !schoolYearId) {
      return res.status(400).json({ error: 'Class ID and School Year ID are required' });
    }
    
    // Get the school year information to calculate the first Friday of June
    const schoolYearResult = await pool.query(
      'SELECT * FROM school_year WHERE school_year_id = $1',
      [schoolYearId]
    );
    
    if (schoolYearResult.rows.length === 0) {
      return res.status(404).json({ error: 'School year not found' });
    }
    
    const schoolYear = schoolYearResult.rows[0];
    const schoolYearStart = schoolYear.school_year.split('-')[0];
    
    // Calculate the first Friday of June for this school year
    const june1st = new Date(`${schoolYearStart}-06-01`);
    const dayOfWeek = june1st.getDay(); // 0 = Sunday, 6 = Saturday
    const daysUntilFriday = (dayOfWeek <= 5) ? (5 - dayOfWeek) : (5 + 7 - dayOfWeek);
    const firstFridayOfJune = new Date(june1st);
    firstFridayOfJune.setDate(june1st.getDate() + daysUntilFriday);
    
    // Format as YYYY-MM-DD for SQL comparison
    const cutoffDate = firstFridayOfJune.toISOString().split('T')[0];
    
    // Calculate the end date of the selected month
    let endOfMonth;
    if (month && year) {
      // Month is 1-based in the query, but 0-based in JavaScript Date
      // Last day of month = day 0 of next month
      endOfMonth = new Date(year, parseInt(month), 0);
    } else {
      // If no month/year provided, use current date
      endOfMonth = new Date();
    }
    const endOfMonthStr = endOfMonth.toISOString().split('T')[0];
    
    // Get enrollment statistics
    const query = `
      SELECT 
        u.gender,
        SUM(CASE WHEN cs.date_enrolled <= $3 THEN 1 ELSE 0 END) as enrolled_before_cutoff,
        SUM(CASE WHEN cs.date_enrolled > $3 THEN 1 ELSE 0 END) as enrolled_after_cutoff,
        COUNT(*) as total
      FROM class_student cs
      JOIN users u ON cs.student_id = u.user_id
      JOIN class c ON cs.class_id = c.class_id
      WHERE cs.class_id = $1 AND c.school_year_id = $2
      GROUP BY u.gender
    `;
    
    const result = await pool.query(query, [classId, schoolYearId, cutoffDate]);
    
    // Get dropped/transferred out students as of the end of the selected month
    const statusQuery = `
      SELECT 
        u.gender,
        COUNT(CASE WHEN ss.status_type IN ('DROPPED_OUT', 'TRANSFERRED_OUT') AND ss.effective_date <= $3 THEN 1 END) as dropped_count
      FROM student_status ss
      JOIN users u ON ss.student_id = u.user_id
      WHERE ss.class_id = $1 AND ss.school_year_id = $2
      GROUP BY u.gender
    `;
    
    const statusResult = await pool.query(statusQuery, [classId, schoolYearId, endOfMonthStr]);
    
    // Format the response
    const stats = {
      cutoffDate,
      endOfMonth: endOfMonthStr,
      enrollment: {
        male: 0,
        female: 0,
        total: 0
      },
      lateEnrollment: {
        male: 0,
        female: 0,
        total: 0
      },
      registeredLearners: {
        male: 0,
        female: 0,
        total: 0
      }
    };
    
    // Initialize dropped count
    const droppedCount = {
      male: 0,
      female: 0
    };
    
    // Process dropped/transferred out stats
    statusResult.rows.forEach(row => {
      if (row.gender === 'M') {
        droppedCount.male = parseInt(row.dropped_count || 0);
      } else if (row.gender === 'F') {
        droppedCount.female = parseInt(row.dropped_count || 0);
      }
    });
    
    // Process enrollment stats
    result.rows.forEach(row => {
      if (row.gender === 'M') {
        stats.enrollment.male = parseInt(row.enrolled_before_cutoff);
        stats.lateEnrollment.male = parseInt(row.enrolled_after_cutoff);
        
        // Calculate registered learners (total enrolled minus dropped/transferred out)
        const totalEnrolledMale = parseInt(row.total);
        stats.registeredLearners.male = Math.max(0, totalEnrolledMale - droppedCount.male);
      } else if (row.gender === 'F') {
        stats.enrollment.female = parseInt(row.enrolled_before_cutoff);
        stats.lateEnrollment.female = parseInt(row.enrolled_after_cutoff);
        
        // Calculate registered learners (total enrolled minus dropped/transferred out)
        const totalEnrolledFemale = parseInt(row.total);
        stats.registeredLearners.female = Math.max(0, totalEnrolledFemale - droppedCount.female);
      }
    });
    
    // Calculate totals
    stats.enrollment.total = stats.enrollment.male + stats.enrollment.female;
    stats.lateEnrollment.total = stats.lateEnrollment.male + stats.lateEnrollment.female;
    stats.registeredLearners.total = stats.registeredLearners.male + stats.registeredLearners.female;
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching enrollment statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update class adviser
router.post('/update-adviser', async (req, res) => {
  try {
    const { class_id, class_adviser_id } = req.body;
    
    // Validate input
    if (!class_id || !class_adviser_id) {
      return res.status(400).json({ error: 'Class ID and Class Adviser ID are required' });
    }
    
    // Check if class exists
    const classCheck = await pool.query('SELECT * FROM class WHERE class_id = $1', [class_id]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Get grade level to check if it's 1-3
    const gradeLevel = classCheck.rows[0].grade_level;
    const isGrade1to3 = ['1', '2', '3', 'Kindergarten'].includes(gradeLevel.toString());
    
    // Check if adviser (teacher) exists
    const teacherCheck = await pool.query(
      'SELECT * FROM users WHERE user_id = $1 AND user_type = \'teacher\'', 
      [class_adviser_id]
    );
    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    // Begin transaction for multiple updates
    await pool.query('BEGIN');
    
    // Update class adviser
    await pool.query(
      'UPDATE class SET class_adviser_id = $1 WHERE class_id = $2 RETURNING *',
      [class_adviser_id, class_id]
    );
    
    // If grade level is 1-3, update all subject teachers to be the new class adviser
    if (isGrade1to3) {
      await pool.query(
        'UPDATE class_subject SET teacher_id = $1 WHERE class_id = $2',
        [class_adviser_id, class_id]
      );
    }
    
    // Commit transaction
    await pool.query('COMMIT');
    
    // Return updated class data
    const updatedClass = await pool.query(`
      SELECT c.class_id, c.grade_level, c.section, c.class_description, 
             s.school_year, c.school_year_id, c.class_adviser_id,
             u.fname as adviser_fname, u.mname as adviser_mname, u.lname as adviser_lname
      FROM class c
      JOIN school_year s ON c.school_year_id = s.school_year_id
      LEFT JOIN users u ON c.class_adviser_id = u.user_id
      WHERE c.class_id = $1
    `, [class_id]);
    
    res.json(updatedClass.rows[0]);
  } catch (error) {
    // Rollback transaction in case of error
    await pool.query('ROLLBACK');
    console.error('Error updating class adviser:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE endpoint to delete a class by ID
router.delete('/:classId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { classId } = req.params;
    await client.query('BEGIN');
    // Check if class exists
    const classCheck = await client.query('SELECT * FROM class WHERE class_id = $1', [classId]);
    if (classCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Class not found' });
    }
    // Delete the class (ON DELETE CASCADE will handle related records)
    await client.query('DELETE FROM class WHERE class_id = $1', [classId]);
    await client.query('COMMIT');
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting class:', error);
    res.status(500).json({ error: 'Failed to delete class' });
  } finally {
    client.release();
  }
});

export default router; 