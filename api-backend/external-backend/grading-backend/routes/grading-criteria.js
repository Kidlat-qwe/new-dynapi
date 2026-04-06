import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get grading criteria for a subject
router.get('/:subjectId/:schoolYearId', async (req, res) => {
  try {
    const { subjectId, schoolYearId } = req.params;
    
    // Validate parameters
    if (!subjectId || !schoolYearId) {
      return res.status(400).json({ 
        error: 'Missing required parameters', 
        details: 'subjectId and schoolYearId are required' 
      });
    }
    
    // First check if the subject exists
    const subjectQuery = 'SELECT * FROM subject WHERE subject_id = $1';
    const subjectResult = await pool.query(subjectQuery, [subjectId]);
    
    if (subjectResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Subject not found'
      });
    }

    // Then get the grading criteria if it exists
    const criteriaQuery = `SELECT * FROM grading_criteria WHERE subject_id = $1 AND school_year_id = $2`;
    const criteriaResult = await pool.query(criteriaQuery, [subjectId, schoolYearId]);
    
    if (criteriaResult.rows.length === 0) {
      // Return default values if no criteria exists
      return res.json({ 
        exists: false,
        subject_id: subjectId,
        school_year_id: schoolYearId,
        written_works_percentage: 0,
        performance_tasks_percentage: 0,
        quarterly_assessment_percentage: 0
      });
    }

    // Return existing criteria with exists flag
    res.json({
      exists: true,
      ...criteriaResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching grading criteria:', error);
    res.status(500).json({ error: 'Failed to fetch grading criteria' });
  }
});

// Get grading criteria with query parameters
router.get('/', async (req, res) => {
  try {
    const { subject_id, school_year_id } = req.query;
    
    console.log('Fetching grading criteria for:', {
      subject_id,
      school_year_id
    });

    const query = `
      SELECT 
        written_works_percentage,
        performance_tasks_percentage,
        quarterly_assessment_percentage
      FROM grading_criteria
      WHERE subject_id = $1 
      AND school_year_id = $2
    `;
    
    const result = await pool.query(query, [subject_id, school_year_id]);
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      // If no criteria found, return default values
      res.json({ 
        written_works_percentage: 40,
        performance_tasks_percentage: 40,
        quarterly_assessment_percentage: 20
      });
    }
  } catch (error) {
    console.error('Error fetching grading criteria:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      written_works_percentage: 40,
      performance_tasks_percentage: 40,
      quarterly_assessment_percentage: 20
    });
  }
});

// Save/update grading criteria for a subject
router.post('/', async (req, res) => {
  try {
    const {
      subject_id,
      school_year_id,
      written_works_percentage,
      performance_tasks_percentage,
      quarterly_assessment_percentage
    } = req.body;

    const result = await pool.query(
      `INSERT INTO grading_criteria (
        subject_id,
        school_year_id,
        written_works_percentage,
        performance_tasks_percentage,
        quarterly_assessment_percentage
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (subject_id, school_year_id) DO UPDATE SET
        written_works_percentage = EXCLUDED.written_works_percentage,
        performance_tasks_percentage = EXCLUDED.performance_tasks_percentage,
        quarterly_assessment_percentage = EXCLUDED.quarterly_assessment_percentage
      RETURNING *`,
      [
        subject_id,
        school_year_id,
        written_works_percentage,
        performance_tasks_percentage,
        quarterly_assessment_percentage
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving grading criteria:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 