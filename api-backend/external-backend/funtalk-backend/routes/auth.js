import express from 'express';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.js';
import * as authController from '../controllers/authController.js';
import { uploadMaterial, uploadReceipt } from '../middleware/upload.js';
import { authenticate } from '../middleware/auth.js';

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
  uploadReceipt.single('receipt'),
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('userType')
      .isIn(['superadmin', 'school', 'teacher'])
      .withMessage('Invalid user type. Must be: superadmin, school, or teacher'),
    body('teacherEmploymentType')
      .optional({ nullable: true, checkFalsy: true })
      .isIn(['part_time', 'full_time'])
      .withMessage('Teacher employment type must be part_time or full_time'),
    body('gender')
      .optional({ nullable: true, checkFalsy: true })
      .isIn(['male', 'female', 'other'])
      .withMessage('Gender must be male, female, or other'),
    body('phoneNumber').optional({ nullable: true, checkFalsy: true }).isString().withMessage('Phone number must be a string'),
    body('billingType').optional({ nullable: true, checkFalsy: true }).isString().withMessage('Billing type must be a string'),
    body('billingConfig')
      .optional()
      .custom((value) => {
        if (typeof value === 'object') return true;
        if (typeof value === 'string') {
          JSON.parse(value);
          return true;
        }
        throw new Error('billingConfig must be an object or JSON string');
      }),
    body('billingConfig.creditsPerCycle').optional().isInt({ min: 1 }),
    body('billingConfig.ratePerCredit').optional().isFloat({ min: 0 }),
    body('billingConfig.paymentDueDay').optional().isInt({ min: 1, max: 28 }),
    body('billingConfig.billingDurationMonths').optional().isIn([3, 6, 12]),
    body('billingConfig.penaltyPercentage').optional().isFloat({ min: 0, max: 100 }),
    body('billingConfig.graceDays').optional().isInt({ min: 0 }),
    body('billingConfig.rolloverEnabled').optional().isBoolean(),
    body('billingConfig.maxRolloverCredits').optional().isInt({ min: 0 }),
    body('billingConfig.autoRenew').optional().isBoolean(),
    body('billingConfig.startDate').optional().isISO8601(),
    body('paymentStatus').optional().isIn(['pending', 'paid']),
    body('paymentType').optional().isIn(['bank_transfer', 'e_wallet', 'card', 'cash']),
    body('initialPaymentAmount')
      .optional({ nullable: true, checkFalsy: true })
      .isFloat({ min: 0.01 })
      .withMessage('initialPaymentAmount must be a positive number'),
    handleValidationErrors,
  ],
  authController.register
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, authController.getCurrentUser);

/**
 * @route   PUT /api/auth/me/profile-picture
 * @desc    Update current user profile picture
 * @access  Private
 */
router.put(
  '/me/profile-picture',
  authenticate,
  uploadMaterial.single('profilePhoto'),
  authController.updateMyProfilePicture
);

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

