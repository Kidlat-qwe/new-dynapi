import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { query } from '../config/database.js';

/**
 * Middleware to verify JWT token and authenticate user
 */
export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a token.',
      });
    }
    
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Verify user still exists and is active
    const userResult = await query(
      'SELECT user_id, email, name, user_type, status FROM userstbl WHERE user_id = $1',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found.',
      });
    }
    
    const user = userResult.rows[0];
    
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active.',
      });
    }
    
    // Attach user info to request
    req.user = {
      userId: user.user_id,
      email: user.email,
      name: user.name,
      userType: user.user_type,
      status: user.status,
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error.',
    });
  }
};

/**
 * Middleware to check if user has required role(s)
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }
    
    if (!allowedRoles.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }
    
    next();
  };
};

/**
 * Middleware to check if user is superadmin
 */
export const isSuperAdmin = authorize(config.userTypes.SUPERADMIN);

/**
 * Middleware to check if user is admin or superadmin
 */
export const isAdmin = authorize(config.userTypes.ADMIN, config.userTypes.SUPERADMIN);

/**
 * Middleware to check if user is school
 */
export const isSchool = authorize(config.userTypes.SCHOOL);

/**
 * Middleware to check if user is teacher
 */
export const isTeacher = authorize(config.userTypes.TEACHER);

/**
 * Middleware to check if user is school or admin
 */
export const isSchoolOrAdmin = authorize(
  config.userTypes.SCHOOL,
  config.userTypes.ADMIN,
  config.userTypes.SUPERADMIN
);

