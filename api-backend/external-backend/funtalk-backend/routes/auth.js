import express from 'express';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.js';
import * as authController from '../controllers/authController.js';

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login user (Firebase Auth or Email/Password)
 * @access  Public
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('firebaseToken').notEmpty().withMessage('Firebase token is required'),
    handleValidationErrors,
  ],
  authController.login
);

/**
 * @route   POST /api/auth/register
 * @desc    Register new user with Firebase authentication
 * @access  Public (for superadmin/admin), Private (for school/teacher - Admin only)
 */
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('userType')
      .isIn(['superadmin', 'admin', 'school', 'teacher'])
      .withMessage('Invalid user type. Must be: superadmin, admin, school, or teacher'),
    body('phoneNumber').optional({ nullable: true, checkFalsy: true }).isString().withMessage('Phone number must be a string'),
    body('billingType').optional({ nullable: true, checkFalsy: true }).isString().withMessage('Billing type must be a string'),
    handleValidationErrors,
  ],
  authController.register
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authController.getCurrentUser);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh', authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authController.logout);

export default router;

