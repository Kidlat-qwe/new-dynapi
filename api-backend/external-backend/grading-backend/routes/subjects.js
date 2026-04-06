import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get all subjects
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM subject');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Create a new subject
router.post('/', async (req, res) => {
  try {
    const { subjectName, gradeLevel, parentSubjectId } = req.body;
    const result = await pool.query(
      'INSERT INTO subject (subject_name, grade_level, parent_subject_id) VALUES ($1, $2, $3) RETURNING *',
      [subjectName, gradeLevel, parentSubjectId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding subject:', error);
    res.status(500).json({ error: 'Failed to add subject' });
  }
});

// Update a subject
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { subjectName, gradeLevel, parentSubjectId } = req.body;
    const result = await pool.query(
      'UPDATE subject SET subject_name = $1, grade_level = $2, parent_subject_id = $3 WHERE subject_id = $4 RETURNING *',
      [subjectName, gradeLevel, parentSubjectId, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    // If this subject is now a child (parentSubjectId is set), delete grading criteria for the parent subject
    if (parentSubjectId) {
      // Find all school years where this subject exists
      const schoolYearsRes = await pool.query(
        'SELECT DISTINCT school_year_id FROM grading_criteria WHERE subject_id = $1',
        [parentSubjectId]
      );
      for (const row of schoolYearsRes.rows) {
        await pool.query(
          'DELETE FROM grading_criteria WHERE subject_id = $1 AND school_year_id = $2',
          [parentSubjectId, row.school_year_id]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ error: 'Failed to update subject' });
  }
});

// Get subject by name
router.get('/by-name/:subjectName', async (req, res) => {
  try {
    const { subjectName } = req.params;
    
    // Validate parameter
    if (!subjectName) {
      return res.status(400).json({ error: 'Subject name is required' });
    }
    
    const result = await pool.query(
      'SELECT * FROM subject WHERE subject_name = $1',
      [subjectName]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching subject by name:', error);
    res.status(500).json({ error: 'Failed to fetch subject' });
  }
});

// Export the router
export default router; 