import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get all student statuses for a class
router.get('/class/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    const { schoolYearId } = req.query;

    if (!classId || !schoolYearId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Class ID and School Year ID are required' 
      });
    }

    const query = `
      SELECT s.status_id, s.student_id, s.class_id, s.school_year_id, s.status_type, 
             s.reason, s.school_name, s.effective_date, s.created_at, s.updated_at,
             u.fname, u.lname, u.mname
      FROM student_status s
      JOIN users u ON s.student_id = u.user_id
      WHERE s.class_id = $1 AND s.school_year_id = $2
      ORDER BY u.lname, u.fname
    `;
    
    const result = await pool.query(query, [classId, schoolYearId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching student statuses:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch student statuses',
      error: error.message 
    });
  }
});

// Get status for a specific student
router.get('/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { classId, schoolYearId } = req.query;

    if (!studentId || !classId || !schoolYearId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Student ID, Class ID, and School Year ID are required' 
      });
    }

    const query = `
      SELECT status_id, student_id, class_id, school_year_id, status_type, 
             reason, school_name, effective_date, created_at, updated_at
      FROM student_status
      WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3
    `;
    
    const result = await pool.query(query, [studentId, classId, schoolYearId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student status not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching student status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch student status',
      error: error.message 
    });
  }
});

// Add or update a student status
router.post('/', async (req, res) => {
  try {
    const { 
      student_id, 
      class_id, 
      school_year_id, 
      status_type, 
      reason, 
      school_name, 
      effective_date 
    } = req.body;

    // Validate required fields
    if (!student_id || !class_id || !school_year_id || !status_type || !effective_date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Student ID, Class ID, School Year ID, Status Type, and Effective Date are required' 
      });
    }

    // Validate status type
    const validStatusTypes = ['ACTIVE', 'DROPPED_OUT', 'TRANSFERRED_OUT', 'TRANSFERRED_IN'];
    if (!validStatusTypes.includes(status_type)) {
      return res.status(400).json({
        success: false,
        message: `Status Type must be one of: ${validStatusTypes.join(', ')}`
      });
    }

    // Check if the student exists
    const studentCheck = await pool.query('SELECT user_id FROM users WHERE user_id = $1 AND user_type = $2', [student_id, 'student']);
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if the class exists
    const classCheck = await pool.query('SELECT class_id FROM class WHERE class_id = $1', [class_id]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Check if the school year exists
    const schoolYearCheck = await pool.query('SELECT school_year_id FROM school_year WHERE school_year_id = $1', [school_year_id]);
    if (schoolYearCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'School year not found'
      });
    }

    // First check if the student status already exists
    const checkQuery = `
      SELECT status_id FROM student_status 
      WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3
    `;
    
    const checkResult = await pool.query(checkQuery, [student_id, class_id, school_year_id]);
    
    let result;
    
    if (checkResult.rows.length > 0) {
      // Update existing record
      const updateQuery = `
        UPDATE student_status
        SET status_type = $1, reason = $2, school_name = $3, effective_date = $4, updated_at = CURRENT_TIMESTAMP
        WHERE status_id = $5
        RETURNING *
      `;
      
      result = await pool.query(updateQuery, [
        status_type,
        reason || null,
        school_name || null,
        effective_date,
        checkResult.rows[0].status_id
      ]);
    } else {
      // Insert new record
      const insertQuery = `
        INSERT INTO student_status(
          student_id, class_id, school_year_id, status_type, reason, school_name, effective_date
        )
        VALUES($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      
      result = await pool.query(insertQuery, [
        student_id,
        class_id,
        school_year_id,
        status_type,
        reason || null,
        school_name || null,
        effective_date
      ]);
    }
    
    res.status(201).json({
      success: true,
      message: 'Student status updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating student status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update student status',
      error: error.message 
    });
  }
});

// Get all student statuses
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM student_status');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching all student statuses:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch all student statuses', error: error.message });
  }
});

export default router; 