import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { query, getClient } from '../config/database.js';
import { checkEmailExists, createFirebaseUser, getFuntalkAuth } from '../config/firebase.js';

/**
 * @route   POST /api/auth/register
 * @desc    Register new user with Firebase authentication
 * @access  Public (for superadmin/admin), Private (for school/teacher - Admin only)
 */
export const register = async (req, res) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { name, email, password, phoneNumber, userType, billingType } = req.body;

    // Validate user type
    const allowedUserTypes = ['superadmin', 'admin', 'school', 'teacher'];
    if (!allowedUserTypes.includes(userType)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid user type',
      });
    }

    // Check if email already exists in database
    const existingUserResult = await client.query(
      'SELECT user_id, email FROM userstbl WHERE email = $1',
      [email]
    );

    if (existingUserResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Email already exists in the system',
      });
    }

    // Check if email exists in Firebase
    let emailCheck;
    try {
      emailCheck = await checkEmailExists(email);
    } catch (firebaseError) {
      // If Firebase is not configured, skip Firebase check
      if (firebaseError.message.includes('not initialized')) {
        console.warn('Firebase not initialized, skipping Firebase email check');
        emailCheck = { exists: false };
      } else {
        await client.query('ROLLBACK');
        return res.status(500).json({
          success: false,
          message: 'Error checking email in Firebase',
          error: firebaseError.message,
        });
      }
    }

    if (emailCheck.exists) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Email already exists. Please use a different email address.',
      });
    }

    // Create user in Firebase
    let firebaseUser;
    try {
      firebaseUser = await createFirebaseUser(email, password, name);
    } catch (firebaseError) {
      await client.query('ROLLBACK');
      
      // Handle specific Firebase errors
      if (firebaseError.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          message: 'Email already exists. Please use a different email address.',
        });
      }
      
      return res.status(400).json({
        success: false,
        message: firebaseError.message || 'Error creating Firebase user',
      });
    }

    // Insert user into database
    const insertUserQuery = `
      INSERT INTO userstbl (email, name, user_type, phone_number, firebase_uid, status, billing_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING user_id, email, name, user_type, status, created_at, billing_type
    `;

    const userResult = await client.query(insertUserQuery, [
      email,
      name,
      userType,
      phoneNumber || null,
      firebaseUser.uid,
      'active', // Default status
      billingType || null,
    ]);

    const newUser = userResult.rows[0];

    // If user is a school, create credits record
    if (userType === 'school') {
      await client.query(
        'INSERT INTO creditstbl (user_id, current_balance) VALUES ($1, $2)',
        [newUser.user_id, 0]
      );
    }

    // If user is a teacher, create teacher profile
    if (userType === 'teacher') {
      await client.query(
        `INSERT INTO teachertbl (teacher_id, fullname, email, status)
         VALUES ($1, $2, $3, $4)`,
        [newUser.user_id, name, email, 'pending'] // Teachers start as pending
      );
    }

    await client.query('COMMIT');

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: newUser.user_id,
        email: newUser.email,
        userType: newUser.user_type,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          userId: newUser.user_id,
          email: newUser.email,
          name: newUser.name,
          userType: newUser.user_type,
          status: newUser.status,
        },
        token,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);

    // Handle database errors
    if (error.code === '23505') {
      // Unique violation
      return res.status(409).json({
        success: false,
        message: 'Email already exists in the system',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Login user (Firebase Auth)
 * @access  Public
 */
export const login = async (req, res) => {
  try {
    const { email, firebaseToken } = req.body || {};

    if (!firebaseToken) {
      return res.status(400).json({
        success: false,
        message: req.body && typeof req.body === 'object' ? 'Firebase token is required' : 'Request body (email, firebaseToken) is required',
      });
    }
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Verify Firebase ID token (Funtalk uses its own Firebase app so project matches frontend)
    const funtalkAuth = getFuntalkAuth();
    if (!funtalkAuth) {
      return res.status(503).json({
        success: false,
        message: 'Funtalk Firebase is not configured. Add Funtalk project credentials to the backend.',
      });
    }
    let decodedToken;
    try {
      decodedToken = await funtalkAuth.verifyIdToken(firebaseToken);
    } catch (firebaseError) {
      console.warn('Funtalk login: Firebase token verification failed', firebaseError.message || firebaseError.code);
      const hint = firebaseError.code === 'auth/argument-error' || firebaseError.message?.includes('project')
        ? ' Ensure the Funtalk backend uses the same Firebase project as the frontend (funtalk-77c3d).'
        : '';
      return res.status(401).json({
        success: false,
        message: `Invalid or expired Firebase token.${hint}`,
      });
    }

    // Verify email matches
    if (decodedToken.email !== email.toLowerCase()) {
      return res.status(401).json({
        success: false,
        message: 'Email mismatch',
      });
    }

    // Find user in database
    const userResult = await query(
      `SELECT user_id, email, name, user_type, status, firebase_uid 
       FROM userstbl 
       WHERE email = $1 OR firebase_uid = $2`,
      [email.toLowerCase(), decodedToken.uid]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found in system. Please sign up first.',
      });
    }

    const user = userResult.rows[0];

    // Verify Firebase UID matches (if stored)
    if (user.firebase_uid && user.firebase_uid !== decodedToken.uid) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Please contact administrator.',
      });
    }

    // Update last login
    await query(
      'UPDATE userstbl SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [user.user_id]
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        userType: user.user_type,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          userId: user.user_id,
          email: user.email,
          name: user.name,
          userType: user.user_type,
          status: user.status,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
export const getCurrentUser = async (req, res) => {
  try {
    const userResult = await query(
      `SELECT user_id, email, name, user_type, phone_number, status, created_at, last_login
       FROM userstbl 
       WHERE user_id = $1`,
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        user: userResult.rows[0],
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
    });
  }
};

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
export const refreshToken = async (req, res) => {
  try {
    // Generate new token with same user info
    const token = jwt.sign(
      {
        userId: req.user.userId,
        email: req.user.email,
        userType: req.user.userType,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      success: true,
      data: {
        token,
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Error refreshing token',
    });
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
export const logout = async (req, res) => {
  // Since we're using JWT, logout is handled client-side by removing the token
  // In the future, you might want to implement token blacklisting
  res.json({
    success: true,
    message: 'Logout successful',
  });
};
