import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get all users (no pagination)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY user_id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const query = `
      SELECT 
        user_id,
        email,
        user_type,
        fname,
        mname,
        lname,
        gender,
        teacher_status,
        lrn
      FROM users 
      WHERE user_id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Get user by email
router.get('/byEmail/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    // Validate email parameter
    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }
    
    // Query the database for the user with the provided email
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    // If no user found, return 404
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return the user data
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user by email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user by firebase_uid
router.get('/firebase/:firebaseUid', async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    console.log('Fetching user with firebase_uid:', firebaseUid);
    
    const query = `
      SELECT 
        user_id,
        email,
        user_type,
        fname,
        mname,
        lname,
        gender,
        teacher_status,
        firebase_uid,
        lrn
      FROM users 
      WHERE firebase_uid = $1
    `;
    
    const result = await pool.query(query, [firebaseUid]);
    console.log('Query result:', result.rows);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user by firebase_uid:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new user
router.post('/', async (req, res) => {
  try {
    const {
      email,
      fname,
      mname,
      lname,
      gender,
      user_type,
      teacher_status,
      firebase_uid,
      lrn
    } = req.body;

    // First check if a user with this email already exists
    const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: 'A user with this email already exists',
        code: 'EMAIL_EXISTS'
      });
    }

    // Check if LRN is already used by another student
    if (lrn) {
      const lrnCheck = await pool.query('SELECT * FROM users WHERE lrn = $1', [lrn]);
      if (lrnCheck.rows.length > 0) {
        return res.status(400).json({ 
          error: 'A student with this LRN already exists',
          code: 'LRN_EXISTS'
        });
      }
    }

    const query = `
      INSERT INTO users (
        email,
        fname,
        mname,
        lname,
        gender,
        user_type,
        teacher_status,
        firebase_uid,
        lrn
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      email,
      fname,
      mname,
      lname,
      gender,
      user_type,
      teacher_status,
      firebase_uid,
      lrn
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    
    // Handle specific PostgreSQL error codes
    if (error.code === '23505') { // unique violation
      if (error.constraint === 'users_email_key') {
        return res.status(400).json({ 
          error: 'A user with this email already exists',
          code: 'EMAIL_EXISTS'
        });
      } else if (error.constraint === 'users_lrn_unique') {
        return res.status(400).json({ 
          error: 'A student with this LRN already exists',
          code: 'LRN_EXISTS'
        });
      } else if (error.constraint === 'users_pkey') {
        return res.status(500).json({ 
          error: 'Database sequence error with user ID',
          code: 'ID_CONFLICT'
        });
      }
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Update a user
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      email,
      fname,
      mname,
      lname,
      gender,
      user_type,
      teacher_status,
      lrn
    } = req.body;

    // First check if the user exists
    const checkUser = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check LRN uniqueness if changing it
    if (lrn && lrn !== checkUser.rows[0].lrn) {
      const lrnCheck = await pool.query('SELECT * FROM users WHERE lrn = $1 AND user_id != $2', [lrn, userId]);
      if (lrnCheck.rows.length > 0) {
        return res.status(400).json({ 
          error: 'A student with this LRN already exists',
          code: 'LRN_EXISTS'
        });
      }
    }

    const query = `
      UPDATE users
      SET 
        email = $1,
        fname = $2,
        mname = $3,
        lname = $4,
        gender = $5,
        user_type = $6,
        teacher_status = $7,
        lrn = $8
      WHERE user_id = $9
      RETURNING *
    `;

    const values = [
      email,
      fname,
      mname,
      lname,
      gender,
      user_type,
      teacher_status,
      lrn,
      userId
    ];

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    
    if (error.code === '23505' && error.constraint === 'users_lrn_unique') {
      return res.status(400).json({ 
        error: 'A student with this LRN already exists',
        code: 'LRN_EXISTS'
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Update last_logged_in for a user
router.put('/:userId/last-logged-in', async (req, res) => {
  const { userId } = req.params;
  try {
    await pool.query(
      'UPDATE users SET last_logged_in = NOW() WHERE user_id = $1',
      [userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating last_logged_in:', error);
    res.status(500).json({ error: 'Failed to update last_logged_in' });
  }
});

export default router; 