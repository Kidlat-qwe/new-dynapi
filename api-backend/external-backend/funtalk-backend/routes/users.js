import express from 'express';
import { body, query as queryValidator } from 'express-validator';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';
import * as userController from '../controllers/userController.js';

const router = express.Router();

/**
 * @route   GET /api/users
 * @desc    Get all users (Admin/Superadmin only)
 * @access  Private (Admin/Superadmin)
 */
router.get(
  '/',
  authenticate,
  isAdmin,
  [
    queryValidator('userType').optional().isIn(['superadmin', 'admin', 'school', 'teacher']),
    queryValidator('status').optional().isIn(['active', 'inactive', 'pending']),
    handleValidationErrors,
  ],
  userController.getUsers
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin/Superadmin or own profile)
 */
router.get('/:id', authenticate, userController.getUserById);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user profile
 * @access  Private (Admin/Superadmin or own profile)
 */
router.put(
  '/:id',
  authenticate,
  [
    body('name').optional().trim().notEmpty(),
    body('phoneNumber').optional().isString(),
    body('email').optional().isEmail(),
    handleValidationErrors,
  ],
  userController.updateUser
);

/**
 * @route   PUT /api/users/:id/status
 * @desc    Update user status (Admin/Superadmin only)
 * @access  Private (Admin/Superadmin)
 */
router.put(
  '/:id/status',
  authenticate,
  isAdmin,
  [
    body('status').isIn(['active', 'inactive', 'pending']).withMessage('Invalid status'),
    handleValidationErrors,
  ],
  userController.updateUserStatus
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (Admin/Superadmin only)
 * @access  Private (Admin/Superadmin)
 */
router.delete('/:id', authenticate, isAdmin, userController.deleteUser);

export default router;

