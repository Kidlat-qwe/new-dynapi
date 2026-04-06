import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Add new activity
router.post('/', async (req, res) => {
  try {
    const { 
      class_id, 
      subject_id, 
      school_year_id,
      activity_type,
      title,
      max_score,
      quarter,
      user_id
    } = req.body;

    // Validate required fields
    if (!class_id || !subject_id || !school_year_id || !activity_type || 
        !title || !max_score || !quarter || !user_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get teacher's name from users table
    const teacherQuery = `
      SELECT CONCAT(
        fname, 
        CASE 
          WHEN mname IS NOT NULL AND mname != '' THEN ' ' || mname || ' '
          ELSE ' '
        END,
        lname
      ) as full_name
      FROM users 
      WHERE user_id = $1
    `;

    const teacherResult = await pool.query(teacherQuery, [user_id]);
    const teacherName = teacherResult.rows[0]?.full_name || 'Unknown Teacher';

    const query = `
      INSERT INTO activities (
        class_id,
        subject_id,
        school_year_id,
        activity_type,
        title,
        max_score,
        quarter,
        teachers_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      class_id,
      subject_id,
      school_year_id,
      activity_type,
      title,
      max_score,
      quarter,
      teacherName
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get activities for a class
router.get('/', async (req, res) => {
  try {
    const { classId, subjectId, schoolYearId, quarter } = req.query;

    // Validate required parameters
    if (!classId || !subjectId || !schoolYearId || !quarter) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const query = `
      SELECT 
        a.activity_id,
        a.class_id,
        a.subject_id,
        a.school_year_id,
        a.teachers_name,
        a.activity_type,
        a.title,
        a.max_score,
        a.quarter,
        a.created_at,
        a.updated_at
      FROM activities a
      WHERE a.class_id = $1 
      AND a.subject_id = $2 
      AND a.school_year_id = $3 
      AND a.quarter = $4
      ORDER BY a.created_at ASC
    `;

    const result = await pool.query(query, [
      classId,
      subjectId,
      schoolYearId,
      quarter
    ]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get activities for a class with subject and quarter (alternative endpoint)
router.get('/class/:classId/subject/:subjectId/quarter/:quarter', async (req, res) => {
  try {
    const { classId, subjectId, quarter } = req.params;
    
    if (!classId || !subjectId || !quarter) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const query = `
      SELECT activity_id, class_id, subject_id, activity_type, title as activity_name, 
             max_score, quarter, teachers_name, created_at, updated_at
      FROM activities
      WHERE class_id = $1 AND subject_id = $2 AND quarter = $3
      ORDER BY activity_type, created_at
    `;
    
    const result = await pool.query(query, [classId, subjectId, quarter]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete activity
router.delete('/:activityId', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // First delete all scores associated with this activity
    await client.query(
      'DELETE FROM activity_scores WHERE activity_id = $1',
      [req.params.activityId]
    );

    // Then delete the activity itself
    const result = await client.query(
      'DELETE FROM activities WHERE activity_id = $1 RETURNING *',
      [req.params.activityId]
    );

    await client.query('COMMIT');

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json({ 
      message: 'Activity and associated scores deleted successfully',
      deletedActivity: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting activity:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get activities and grades for class
router.get('/activities-and-grades', async (req, res) => {
  try {
    const { class_id, subject_id, quarter } = req.query;

    // Query to get written works
    const writtenWorksQuery = `
      SELECT 
        a.activity_id,
        a.title,
        a.max_score,
        a.activity_type,
        a.quarter,
        a.teachers_name,
        json_agg(
          json_build_object(
            'student_id', s.student_id,
            'score', s.score
          )
        ) as scores
      FROM activities a
      LEFT JOIN activity_scores s ON a.activity_id = s.activity_id
      WHERE a.class_id = $1 
      AND a.subject_id = $2 
      AND a.quarter = $3
      AND a.activity_type = 'written'
      GROUP BY a.activity_id
      ORDER BY a.activity_id
    `;

    // Query to get performance tasks
    const performanceTasksQuery = `
      SELECT 
        a.activity_id,
        a.title,
        a.max_score,
        a.activity_type,
        a.quarter,
        a.teachers_name,
        json_agg(
          json_build_object(
            'student_id', s.student_id,
            'score', s.score
          )
        ) as scores
      FROM activities a
      LEFT JOIN activity_scores s ON a.activity_id = s.activity_id
      WHERE a.class_id = $1 
      AND a.subject_id = $2 
      AND a.quarter = $3
      AND a.activity_type = 'performance'
      GROUP BY a.activity_id
      ORDER BY a.activity_id
    `;

    // Query to get quarterly assessment
    const assessmentQuery = `
      SELECT 
        a.activity_id,
        a.title,
        a.max_score,
        a.activity_type,
        a.quarter,
        a.teachers_name,
        json_agg(
          json_build_object(
            'student_id', s.student_id,
            'score', s.score
          )
        ) as scores
      FROM activities a
      LEFT JOIN activity_scores s ON a.activity_id = s.activity_id
      WHERE a.class_id = $1 
      AND a.subject_id = $2 
      AND a.quarter = $3
      AND a.activity_type = 'assessment'
      GROUP BY a.activity_id
      ORDER BY a.activity_id
    `;

    const [writtenWorks, performanceTasks, assessment] = await Promise.all([
      pool.query(writtenWorksQuery, [class_id, subject_id, quarter]),
      pool.query(performanceTasksQuery, [class_id, subject_id, quarter]),
      pool.query(assessmentQuery, [class_id, subject_id, quarter])
    ]);

    res.json({
      written: writtenWorks.rows,
      performance: performanceTasks.rows,
      assessment: assessment.rows
    });

  } catch (error) {
    console.error('Error fetching activities and grades:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      written: [],
      performance: [],
      assessment: []
    });
  }
});

// Get scores
router.get('/scores', async (req, res) => {
  try {
    const { classId, subjectId, schoolYearId, quarter } = req.query;

    // Validate required parameters
    if (!classId || !subjectId || !schoolYearId || !quarter) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const query = `
      SELECT 
        s.score_id,
        s.activity_id,
        s.student_id,
        s.teachers_name,
        s.score,
        s.quarter,
        s.created_at,
        s.updated_at,
        a.title as activity_title,
        a.activity_type,
        a.max_score
      FROM activity_scores s
      JOIN activities a ON s.activity_id = a.activity_id
      WHERE a.class_id = $1 
      AND a.subject_id = $2 
      AND a.school_year_id = $3 
      AND s.quarter = $4
      ORDER BY s.created_at ASC
    `;

    const result = await pool.query(query, [
      classId,
      subjectId,
      schoolYearId,
      quarter
    ]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching scores:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get scores for students in a class for a specific quarter
router.get('/scores/class/:classId/quarter/:quarter', async (req, res) => {
  try {
    const { classId, quarter } = req.params;
    
    if (!classId || !quarter) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const query = `
      SELECT s.score_id, s.activity_id, s.student_id, s.score, s.quarter,
             a.class_id, a.subject_id, a.activity_type, s.teachers_name
      FROM activity_scores s
      JOIN activities a ON s.activity_id = a.activity_id
      WHERE a.class_id = $1 AND s.quarter = $2
    `;
    
    const result = await pool.query(query, [classId, quarter]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching scores:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save/Update score
router.post('/scores', async (req, res) => {
  try {
    const { student_id, activity_id, score, quarter, user_id } = req.body;
    
    if (!student_id || !activity_id || score === undefined || !quarter || !user_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get teacher's name
    const teacherQuery = `
      SELECT CONCAT(
        fname, 
        CASE 
          WHEN mname IS NOT NULL AND mname != '' THEN ' ' || mname || ' '
          ELSE ' '
        END,
        lname
      ) as full_name
      FROM users 
      WHERE user_id = $1
    `;

    const teacherResult = await pool.query(teacherQuery, [user_id]);
    const teacherName = teacherResult.rows[0]?.full_name || 'Unknown Teacher';
    
    // Check if score already exists
    const checkQuery = `
      SELECT * FROM activity_scores 
      WHERE student_id = $1 AND activity_id = $2 AND quarter = $3
    `;
    
    const existingScore = await pool.query(checkQuery, [student_id, activity_id, quarter]);
    
    if (existingScore.rows.length > 0) {
      // Update existing score
      const updateQuery = `
        UPDATE activity_scores 
        SET score = $1, updated_at = CURRENT_TIMESTAMP, teachers_name = $2
        WHERE student_id = $3 AND activity_id = $4 AND quarter = $5
        RETURNING *
      `;
      const result = await pool.query(updateQuery, [score, teacherName, student_id, activity_id, quarter]);
      res.json(result.rows[0]);
    } else {
      // Insert new score
      const insertQuery = `
        INSERT INTO activity_scores (student_id, activity_id, score, quarter, teachers_name)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const result = await pool.query(insertQuery, [student_id, activity_id, score, quarter, teacherName]);
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error saving score:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 