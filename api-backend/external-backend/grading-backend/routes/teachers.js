import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get all teachers
router.get('/', async (req, res) => {
  try {
    // Remove the teacher_status filter to get all teachers
    const result = await pool.query('SELECT * FROM users WHERE user_type = \'teacher\'');
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available teachers for class adviser selection
router.get('/available-advisers', async (req, res) => {
  try {
    const { schoolYearId } = req.query;
    
    if (!schoolYearId) {
      return res.status(400).json({ error: 'School year ID is required' });
    }

    // Convert schoolYearId to number and validate
    const schoolYearIdNum = parseInt(schoolYearId);
    if (isNaN(schoolYearIdNum)) {
      return res.status(400).json({ error: 'Invalid school year ID format' });
    }

    // First verify if the school year exists
    const schoolYearCheck = await pool.query(
      'SELECT school_year_id FROM school_year WHERE school_year_id = $1',
      [schoolYearIdNum]
    );

    if (schoolYearCheck.rows.length === 0) {
      return res.status(404).json({ error: 'School year not found' });
    }

    // Get all active teachers with no restrictions
    const query = `
      SELECT DISTINCT u.user_id, u.fname, u.mname, u.lname, u.gender
      FROM users u
      WHERE u.user_type = 'teacher'
      AND u.teacher_status = true
      ORDER BY u.lname, u.fname
    `;
    
    const result = await pool.query(query);
    
    // Log the result for debugging
    console.log('Available teachers query result:', {
      schoolYearId: schoolYearIdNum,
      teacherCount: result.rows.length
    });
    
    res.json(result.rows);
  } catch (error) {
    // Log the detailed error
    console.error('Error in available-advisers endpoint:', {
      error: error.message,
      stack: error.stack,
      query: error.query
    });
    
    // Send a more specific error message
    if (error.code === '23503') { // Foreign key violation
      res.status(400).json({ error: 'Invalid school year ID' });
    } else if (error.code === '42P01') { // Undefined table
      res.status(500).json({ error: 'Database schema error' });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch available teachers',
        details: error.message
      });
    }
  }
});

// Get a single teacher
router.get('/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    const result = await pool.query(
      'SELECT user_id, fname, mname, lname, email, gender FROM users WHERE user_id = $1 AND user_type = \'teacher\'',
      [teacherId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching teacher:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get teacher's classes where they are the class adviser
router.get('/:teacherId/advisory-classes', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { schoolYearId } = req.query;
    
    let query = `
      SELECT 
        c.class_id,
        c.grade_level,
        c.section,
        c.school_year_id,
        sy.school_year,
        sy.is_active
      FROM class c
      JOIN school_year sy ON c.school_year_id = sy.school_year_id
      WHERE c.class_adviser_id = $1
    `;
    
    const queryParams = [teacherId];
    
    // If school year ID is provided, filter by it
    if (schoolYearId) {
      query += ` AND c.school_year_id = $2`;
      queryParams.push(schoolYearId);
    }
    
    query += ` ORDER BY c.grade_level, c.section`;
    
    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching advisory classes:', error);
    res.status(500).json({ error: 'Failed to fetch advisory classes' });
  }
});

// Add new teacher
router.post('/', async (req, res) => {
  try {
    const { fname, mname, lname, gender, email, password } = req.body;
    
    // Validate required fields
    if (!fname || !lname || !gender || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if email already exists
    const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Insert new teacher using teacher_status column
    const result = await pool.query(
      'INSERT INTO users (fname, mname, lname, gender, email, password, user_type, teacher_status, flag) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [fname, mname || null, lname, gender, email, password, 'teacher', true, true]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding teacher:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update teacher status
router.put('/:teacherId/status', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { status } = req.body; // Renamed from flag to status for clarity
    
    // Validate that status is a boolean
    if (typeof status !== 'boolean') {
      return res.status(400).json({ error: 'Status must be a boolean value' });
    }
    
    // Check if teacher exists
    const teacherCheck = await pool.query(
      'SELECT * FROM users WHERE user_id = $1 AND user_type = \'teacher\'', 
      [teacherId]
    );
    
    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    // Update the teacher's status using teacher_status column
    const result = await pool.query(
      'UPDATE users SET teacher_status = $1 WHERE user_id = $2 AND user_type = \'teacher\' RETURNING *',
      [status, teacherId]
    );
    
    res.json({
      success: true,
      message: `Teacher status updated to ${status ? 'ACTIVE' : 'INACTIVE'}`,
      teacher: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating teacher status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get teacher's classes
router.get('/:teacherId/classes', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const query = `
      SELECT DISTINCT c.* 
      FROM class c
      JOIN class_subject cs ON c.class_id = cs.class_id
      WHERE cs.teacher_id = $1
      AND c.school_year_id = (
        SELECT school_year_id 
        FROM school_year 
        WHERE is_active = true
      )
    `;
    const result = await pool.query(query, [teacherId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get teacher's classes with more details
router.get('/:teacherId/class-details', async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    const result = await pool.query(`
      SELECT DISTINCT 
        c.class_id,
        c.grade_level,
        c.section,
        s.subject_name as subject,
        c.school_year_id,
        sy.school_year
      FROM class_subject cs
      JOIN class c ON cs.class_id = c.class_id
      JOIN subject s ON cs.subject_id = s.subject_id
      JOIN school_year sy ON c.school_year_id = sy.school_year_id
      WHERE cs.teacher_id = $1
      ORDER BY c.grade_level, c.section
    `, [teacherId]);
    
    // Return empty array if no classes found
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subjects for a specific class that the teacher teaches
router.get('/:teacherId/class/:classId/subjects', async (req, res) => {
  try {
    const { teacherId, classId } = req.params;
    const query = `
      SELECT s.* 
      FROM subject s
      JOIN class_subject cs ON s.subject_id = cs.subject_id
      WHERE cs.class_id = $1 
      AND cs.teacher_id = $2
    `;
    const result = await pool.query(query, [classId, teacherId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching class subjects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get teacher's assigned classes for grade upload
router.get('/:teacherId/grade-upload/classes', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const query = `
      SELECT DISTINCT 
        c.class_id,
        c.grade_level,
        c.section,
        c.school_year_id,
        sy.school_year
      FROM class_subject cs
      JOIN class c ON cs.class_id = c.class_id
      JOIN school_year sy ON c.school_year_id = sy.school_year_id
      WHERE cs.teacher_id = $1
      AND sy.is_active = true
      ORDER BY c.grade_level, c.section
    `;
    const result = await pool.query(query, [teacherId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching teacher classes for grade upload:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Get subjects taught by teacher in a specific class
router.get('/:teacherId/class/:classId/grade-upload/subjects', async (req, res) => {
  try {
    const { teacherId, classId } = req.params;
    const query = `
      SELECT DISTINCT 
        s.subject_id,
        s.subject_name
      FROM class_subject cs
      JOIN subject s ON cs.subject_id = s.subject_id
      WHERE cs.teacher_id = $1 
      AND cs.class_id = $2
    `;
    const result = await pool.query(query, [teacherId, classId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subjects for grade upload:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Get all classes assigned to a teacher with subjects
router.get('/:userId/class-subjects', async (req, res) => {
  try {
    const { userId } = req.params;
    const { schoolYearId } = req.query;
    
    let query = `
      SELECT cs.class_id, cs.subject_id, c.grade_level, c.section,
             s.subject_name as subject, s.parent_subject_id, sy.school_year, sy.school_year_id,
             c.program_name, c.class_code
      FROM class_subject cs
      JOIN class c ON cs.class_id = c.class_id
      JOIN subject s ON cs.subject_id = s.subject_id
      JOIN school_year sy ON c.school_year_id = sy.school_year_id
      WHERE cs.teacher_id = $1
    `;
    
    const queryParams = [userId];
    
    // Filter by school year if provided
    if (schoolYearId) {
      query += ` AND sy.school_year_id = $2`;
      queryParams.push(schoolYearId);
    }
    
    query += ` ORDER BY c.grade_level, c.section`;
    
    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 