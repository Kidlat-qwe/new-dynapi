import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get all school years
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM school_year ORDER BY school_year_id DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get active school year
router.get('/active', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM school_year WHERE is_active = true LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active school year found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching active school year:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add new school year
router.post('/', async (req, res) => {
  try {
    const { school_year, is_active, activation_date, inactivation_date } = req.body;
    const result = await pool.query(
      'INSERT INTO school_year (school_year, is_active, activation_date, inactivation_date) VALUES ($1, $2, $3, $4) RETURNING *',
      [school_year, is_active, activation_date || null, inactivation_date || null]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding school year:', error);
    res.status(500).json({ error: 'Failed to add school year' });
  }
});

// Toggle school year active status
router.put('/:id/toggle-active', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // If activating, first deactivate all other school years
    const { rows } = await client.query(
      'SELECT is_active FROM school_year WHERE school_year_id = $1',
      [req.params.id]
    );
    
    const currentStatus = rows[0].is_active;
    
    if (!currentStatus) {
      // If activating this school year, deactivate all others
      await client.query(
        'UPDATE school_year SET is_active = false, inactivation_date = NOW() WHERE school_year_id != $1 AND is_active = true',
        [req.params.id]
      );
      // Activate this school year, set activation_date only if NULL, clear inactivation_date
      await client.query(
        `UPDATE school_year
         SET is_active = true,
             activation_date = COALESCE(activation_date, NOW()),
             inactivation_date = NULL
         WHERE school_year_id = $1`,
        [req.params.id]
      );
    } else {
      // Inactivate this school year, set inactivation_date to NOW()
      await client.query(
        'UPDATE school_year SET is_active = false, inactivation_date = NOW() WHERE school_year_id = $1',
        [req.params.id]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error toggling school year status:', error);
    res.status(500).json({ error: 'Failed to update school year status' });
  } finally {
    client.release();
  }
});

export default router; 