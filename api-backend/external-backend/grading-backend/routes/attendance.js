import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get attendance for a class in a specific month
router.get('/class/:classId/month/:month/year/:year', async (req, res) => {
  try {
    const { classId, month, year } = req.params;
    const { schoolYearId } = req.query;
    
    if (!schoolYearId) {
      return res.status(400).json({ error: 'schoolYearId is a required query parameter' });
    }
    
    const monthInt = parseInt(month);
    
    // Get all students in the class
    const studentsQuery = `
      SELECT cs.student_id, u.fname, u.mname, u.lname, u.gender
      FROM class_student cs
      JOIN users u ON cs.student_id = u.user_id
      WHERE cs.class_id = $1
      ORDER BY u.lname, u.fname
    `;
    
    const studentsResult = await pool.query(studentsQuery, [classId]);
    
    // Get attendance records for this class, month, and school year
    const attendanceQuery = `
      SELECT student_id, day, status 
      FROM student_attendance
      WHERE class_id = $1
        AND school_year_id = $2
        AND month = $3
    `;
    
    const attendanceResult = await pool.query(attendanceQuery, [
      classId,
      schoolYearId,
      monthInt
    ]);
    
    // Build a map of attendance records
    const attendanceMap = {};
    
    attendanceResult.rows.forEach(record => {
      if (!attendanceMap[record.student_id]) {
        attendanceMap[record.student_id] = {};
      }
      attendanceMap[record.student_id][record.day] = record.status;
    });
    
    // Format the response
    const studentsWithAttendance = studentsResult.rows.map(student => {
      return {
        ...student,
        attendance: attendanceMap[student.student_id] || {}
      };
    });
    
    // Calculate days in month
    const daysInMonth = new Date(parseInt(year), monthInt, 0).getDate();
    
    res.json({
      students: studentsWithAttendance,
      daysInMonth: daysInMonth
    });
    
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance data' });
  }
});

// Update attendance for a single student on a specific day
router.post('/update', async (req, res) => {
  try {
    const { 
      class_id, 
      student_id, 
      school_year_id, 
      month, 
      day, 
      status 
    } = req.body;
    
    // Validate inputs
    if (!class_id || !student_id || !school_year_id || !month || !day) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }
    
    // Validate status
    if (status && !['P', 'A', 'L'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        detail: "Status must be 'P' (present), 'A' (absent), or 'L' (late)"
      });
    }
    
    // If status is null/empty, delete the record if it exists
    if (!status) {
      await pool.query(
        'DELETE FROM student_attendance WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3 AND month = $4 AND day = $5',
        [student_id, class_id, school_year_id, month, day]
      );
      
      return res.json({ message: 'Attendance record cleared' });
    }
    
    // Otherwise, insert or update the record
    const query = `
      INSERT INTO student_attendance
        (student_id, class_id, school_year_id, month, day, status)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (student_id, class_id, school_year_id, month, day)
      DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING attendance_id
    `;
    
    const result = await pool.query(query, [
      student_id,
      class_id,
      school_year_id,
      month,
      day,
      status
    ]);
    
    res.json({
      message: 'Attendance record updated',
      attendanceId: result.rows[0].attendance_id
    });
    
  } catch (error) {
    console.error('Error updating attendance:', error);
    res.status(500).json({ error: 'Failed to update attendance record' });
  }
});

// Batch update multiple attendance records
router.post('/batch', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { 
      class_id, 
      school_year_id, 
      month,
      records,
      total_school_days
    } = req.body;
    
    // Validate inputs
    if (!class_id || !school_year_id || !month || !Array.isArray(records)) {
      return res.status(400).json({ 
        error: 'Invalid request data' 
      });
    }
    
    await client.query('BEGIN');
    
    const updatedRecords = [];
    
    for (const record of records) {
      const { student_id, day, status } = record;
      
      // Skip invalid records
      if (!student_id || !day) continue;
      
      if (!status) {
        // Delete record if status is empty
        await client.query(
          'DELETE FROM student_attendance WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3 AND month = $4 AND day = $5',
          [student_id, class_id, school_year_id, month, day]
        );
        
        updatedRecords.push({ student_id, day, action: 'deleted' });
      } else {
        // Insert or update record
        const query = `
          INSERT INTO student_attendance
            (student_id, class_id, school_year_id, month, day, status)
          VALUES
            ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (student_id, class_id, school_year_id, month, day)
          DO UPDATE SET
            status = EXCLUDED.status,
            updated_at = CURRENT_TIMESTAMP
          RETURNING attendance_id
        `;
        
        const result = await client.query(query, [
          student_id,
          class_id,
          school_year_id,
          month,
          day,
          status
        ]);
        
        updatedRecords.push({ 
          student_id, 
          day, 
          attendance_id: result.rows[0].attendance_id,
          action: 'updated'
        });
      }
    }
    
    // Store the total_school_days in a separate table or metadata if needed
    // For now, we'll just include it in the response
    
    await client.query('COMMIT');
    
    res.json({
      message: `Updated ${updatedRecords.length} attendance records`,
      records: updatedRecords,
      total_school_days: total_school_days
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in batch attendance update:', error);
    res.status(500).json({ error: 'Failed to update attendance records' });
  } finally {
    client.release();
  }
});

// Get attendance summary by gender for a specific month
router.get('/summary/:classId/:month/:year', async (req, res) => {
  try {
    const { classId, month, year } = req.params;
    const { schoolYearId } = req.query;
    
    console.log('Fetching attendance summary:', { classId, month, year, schoolYearId });
    
    if (!schoolYearId) {
      return res.status(400).json({ error: 'schoolYearId is required' });
    }
    
    // Get attendance with gender information - use more detailed query
    const query = `
      SELECT 
        sa.status, 
        u.gender,
        sa.student_id,
        sa.day
      FROM student_attendance sa
      JOIN users u ON sa.student_id = u.user_id
      WHERE sa.class_id = $1
        AND sa.school_year_id = $2
        AND sa.month = $3
    `;
    
    const result = await pool.query(query, [classId, schoolYearId, month]);
    
    console.log(`Found ${result.rowCount} attendance records`);
    
    // Calculate summary
    const summary = {
      male: { present: 0, absent: 0, late: 0 },
      female: { present: 0, absent: 0, late: 0 }
    };
    
    // Keep track of unique student/day combinations to avoid double counting
    const processedEntries = new Set();
    
    result.rows.forEach(row => {
      const entryKey = `${row.student_id}-${row.day}`;
      
      // Skip if we've already processed this student/day combination
      if (processedEntries.has(entryKey)) return;
      
      processedEntries.add(entryKey);
      
      const gender = row.gender === 'M' ? 'male' : 'female';
      
      if (row.status === 'P') {
        summary[gender].present++;
      } else if (row.status === 'A') {
        summary[gender].absent++;
      } else if (row.status === 'L') {
        summary[gender].late++;
      }
    });
    
    console.log('Calculated summary:', summary);
    
    // Get total school days (unique days with any attendance record)
    const daysQuery = `
      SELECT COUNT(DISTINCT day) as total_days
      FROM student_attendance
      WHERE class_id = $1
        AND school_year_id = $2
        AND month = $3
    `;
    
    const daysResult = await pool.query(daysQuery, [classId, schoolYearId, month]);
    const totalDays = daysResult.rows[0]?.total_days || 0;
    
    console.log('Total days with attendance records:', totalDays);
    
    res.json({
      summary,
      totalDays
    });
    
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
});

// Delete attendance for a specific class for a month/year
router.delete('/class/:classId/month/:month/year/:year', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { classId, month, year } = req.params;
    const { schoolYearId, day } = req.query;
    
    if (!schoolYearId) {
      return res.status(400).json({ error: 'schoolYearId is a required query parameter' });
    }
    
    await client.query('BEGIN');
    
    let deleteQuery;
    let queryParams;
    
    if (day) {
      // Delete records for a specific day only
      deleteQuery = `
        DELETE FROM student_attendance 
        WHERE class_id = $1 
        AND school_year_id = $2 
        AND month = $3 
        AND day = $4
      `;
      queryParams = [classId, schoolYearId, month, day];
      console.log(`Deleting attendance records for class ${classId}, day ${day}, month ${month}, year ${year}`);
    } else {
      // Delete all records for the month
      deleteQuery = `
        DELETE FROM student_attendance 
        WHERE class_id = $1 
        AND school_year_id = $2 
        AND month = $3
      `;
      queryParams = [classId, schoolYearId, month];
      console.log(`Deleting all attendance records for class ${classId}, month ${month}, year ${year}`);
    }
    
    const result = await client.query(deleteQuery, queryParams);
    
    await client.query('COMMIT');
    
    res.json({
      message: `Deleted ${result.rowCount} attendance records`,
      recordsDeleted: result.rowCount
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting attendance records:', error);
    res.status(500).json({ error: 'Failed to delete attendance records' });
  } finally {
    client.release();
  }
});

// Get previous-class attendance for a student (same school year and grade level),
// excluding the current class. Results are limited to a specific month/year and
// only include days before the student's enrollment date in the current class.
// Route: /api/attendance/student/:studentId/previous?schoolYearId=&gradeLevel=&excludeClassId=&month=&year=
router.get('/student/:studentId/previous', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { schoolYearId, gradeLevel, excludeClassId, month, year } = req.query;

    if (!studentId || !schoolYearId || !gradeLevel || !excludeClassId || !month || !year) {
      return res.status(400).json({ error: 'Missing required query params' });
    }

    // Find the enrollment date for the current class to use as cutoff
    const enrollRes = await pool.query(
      'SELECT date_enrolled FROM class_student WHERE student_id = $1 AND class_id = $2 LIMIT 1',
      [studentId, excludeClassId]
    );
    const cutoffDate = enrollRes.rows[0]?.date_enrolled || null;

    // Fetch attendance from other classes, same SY and grade level, same month, before cutoff
    const rows = await pool.query(
      `SELECT sa.class_id, c.section, c.class_code, c.grade_level, c.class_description, sa.day, sa.status,
              u.fname as adviser_fname, u.mname as adviser_mname, u.lname as adviser_lname
       FROM student_attendance sa
       JOIN class c ON c.class_id = sa.class_id
       LEFT JOIN users u ON c.class_adviser_id = u.user_id
       WHERE sa.student_id = $1
         AND c.school_year_id = $2
         AND c.grade_level = $3
         AND sa.class_id <> $4
         AND sa.month = $5
         AND ($6::date IS NULL OR make_date($7::int, $5::int, sa.day) <= $6::date)
       ORDER BY sa.class_id, sa.day`,
      [studentId, schoolYearId, gradeLevel, excludeClassId, month, cutoffDate, year]
    );

    // Aggregate into a compact per-class structure
    const classes = {};
    for (const r of rows.rows) {
      if (!classes[r.class_id]) {
        classes[r.class_id] = {
          class_id: r.class_id,
          section: r.section,
          class_code: r.class_code,
          grade_level: r.grade_level,
          class_description: r.class_description,
          adviser_fname: r.adviser_fname,
          adviser_mname: r.adviser_mname,
          adviser_lname: r.adviser_lname,
          days: {}
        };
      }
      classes[r.class_id].days[r.day] = r.status;
    }

    res.json({ classes: Object.values(classes) });
  } catch (error) {
    console.error('Error fetching previous attendance:', error);
    res.status(500).json({ error: 'Failed to fetch previous attendance' });
  }
});

// Check if a student has any previous-class attendance records in the same
// school year and grade level, excluding the current class
// Route: /api/attendance/student/:studentId/has-previous?schoolYearId=&gradeLevel=&excludeClassId=
router.get('/student/:studentId/has-previous', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { schoolYearId, gradeLevel, excludeClassId } = req.query;

    if (!studentId || !schoolYearId || !gradeLevel || !excludeClassId) {
      return res.status(400).json({ error: 'Missing required query params' });
    }

    const { rows } = await pool.query(
      `SELECT 1
       FROM student_attendance sa
       JOIN class c ON c.class_id = sa.class_id
       WHERE sa.student_id = $1
         AND c.school_year_id = $2
         AND c.grade_level = $3
         AND sa.class_id <> $4
       LIMIT 1`,
      [studentId, schoolYearId, gradeLevel, excludeClassId]
    );

    res.json({ hasPrevious: rows.length > 0 });
  } catch (error) {
    console.error('Error checking previous attendance:', error);
    res.status(500).json({ error: 'Failed to check previous attendance' });
  }
});

export default router; 