import express from 'express';
import { body, query as queryValidator } from 'express-validator';
import { authenticate, isAdmin, isTeacher } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';
import * as teacherController from '../controllers/teacherController.js';
import { uploadMaterial } from '../middleware/upload.js';

const router = express.Router();

/**
 * @route   GET /api/teachers
 * @desc    Get all teachers (with filters)
 * @access  Public (or Private for detailed info)
 */
router.get(
  '/',
  [
    queryValidator('status').optional().isIn(['active', 'inactive']),
    queryValidator('gender').optional().isString(),
    queryValidator('search').optional().isString(),
    handleValidationErrors,
  ],
  teacherController.getTeachers
);

/**
 * @route   GET /api/teachers/:id
 * @desc    Get teacher by ID
 * @access  Public
 */
router.get('/:id(\\d+)', teacherController.getTeacherById);

/**
 * @route   POST /api/teachers
 * @desc    Create teacher profile (Admin only)
 * @access  Private (Admin/Superadmin)
 */
router.post(
  '/',
  authenticate,
  isAdmin,
  [
    body('userId').isInt().withMessage('User ID is required'),
    body('fullname').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('gender').optional().isIn(['male', 'female', 'other']),
    body('description').optional().isString(),
    handleValidationErrors,
  ],
  teacherController.createTeacher
);

/**
 * @route   PUT /api/teachers/:id
 * @desc    Update teacher profile
 * @access  Private (Teacher/Admin)
 */
router.put(
  '/:id(\\d+)',
  authenticate,
  [
    body('fullname').optional().trim().notEmpty(),
    body('gender').optional().isIn(['male', 'female', 'other']),
    body('description').optional().isString(),
    body('profilePicture').optional().isString(),
    body('audioIntro').optional().isString(),
    body('videoIntro').optional().isString(),
    body('docs').optional().isString(),
    handleValidationErrors,
  ],
  teacherController.updateTeacher
);

/**
 * @route   PUT /api/teachers/:id/status
 * @desc    Update teacher status (Admin only)
 * @access  Private (Admin/Superadmin)
 */
router.put(
  '/:id(\\d+)/status',
  authenticate,
  isAdmin,
  [
    body('status').isIn(['active', 'inactive']).withMessage('Invalid status'),
    handleValidationErrors,
  ],
  teacherController.updateTeacherStatus
);

/**
 * @route   GET /api/teachers/:id/availability
 * @desc    Get teacher availability schedule
 * @access  Public
 */
router.get('/:id(\\d+)/availability', teacherController.getTeacherAvailability);

/**
 * @route   GET /api/teachers/:id/appointments
 * @desc    Get teacher's appointments
 * @access  Private
 */
router.get('/:id(\\d+)/appointments', authenticate, teacherController.getTeacherAppointments);

/**
 * @route   GET /api/teachers/me/profile
 * @desc    Get current teacher profile
 * @access  Private (Teacher)
 */
router.get('/me/profile', authenticate, isTeacher, teacherController.getMyTeacherProfile);

/**
 * @route   PUT /api/teachers/me/profile
 * @desc    Update current teacher profile with media uploads
 * @access  Private (Teacher)
 */
router.put(
  '/me/profile',
  authenticate,
  isTeacher,
  uploadMaterial.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'curriculumVitae', maxCount: 1 },
    { name: 'introAudio', maxCount: 1 },
    { name: 'introVideo', maxCount: 1 },
  ]),
  [
    body('introText').optional({ nullable: true }).isString(),
    handleValidationErrors,
  ],
  teacherController.updateMyTeacherProfile
);

export default router;

