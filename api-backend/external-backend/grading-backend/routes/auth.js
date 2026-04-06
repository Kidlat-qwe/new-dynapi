import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt:', { username, password: '***' });
    
    // For teachers, check teacher_status instead of flag
    const result = await pool.query(`
      SELECT * FROM users 
      WHERE email = $1 
      AND (
        (user_type = 'teacher' AND teacher_status = TRUE) OR
        (user_type != 'teacher' AND flag = TRUE)
      )`, 
      [username]
    );
    
    console.log('User found:', result.rows.length > 0);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials (user not found)' });
    }
    
    const user = result.rows[0];
    console.log('User data:', { 
      id: user.user_id, 
      email: user.email, 
      userType: user.user_type,
      passwordInDB: user.password.substring(0, 10) + '...' // Show just the beginning for security
    });
    
    // Try both methods
    let isPasswordValid;
    let bcryptCompare = false;
    
    try {
      // Try bcrypt first
      bcryptCompare = await bcrypt.compare(password, user.password);
      console.log('bcrypt comparison result:', bcryptCompare);
    } catch (err) {
      console.log('bcrypt comparison failed, likely not a hash:', err.message);
    }
    
    // Also try direct comparison
    const directCompare = (password === user.password);
    console.log('Direct comparison result:', directCompare);
    
    isPasswordValid = bcryptCompare || directCompare;
    
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials (password mismatch)' });
    }
    
    // Update last_logged_in timestamp
    try {
      await pool.query(
        'UPDATE users SET last_logged_in = NOW() WHERE user_id = $1',
        [user.user_id]
      );
    } catch (updateError) {
      console.error('Failed to update last_logged_in:', updateError);
      // Don't fail the login if this update fails
    }
    
    // Create token
    const token = jwt.sign(
      { id: user.user_id, userType: user.user_type },
      'your_jwt_secret',
      { expiresIn: '1h' }
    );
    
    // Format user data for frontend
    const userData = {
      id: user.user_id,
      username: user.email,
      fname: user.fname || '',
      mname: user.mname || '',
      lname: user.lname || '',
      userType: user.user_type
    };

    res.json({
      success: true,
      token,
      userType: user.user_type,
      user: userData
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Test user creation endpoint
router.post('/create-test-user', async (req, res) => {
  try {
    // Create a test admin user with plain text password for testing
    const result = await pool.query(
      'INSERT INTO users (email, password, user_type, fname, lname, flag) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id',
      ['admin1@example.com', '123', 'admin', 'Admin', 'User', true]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Test user created', 
      userId: result.rows[0].user_id 
    });
  } catch (error) {
    console.error('Error creating test user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router; 