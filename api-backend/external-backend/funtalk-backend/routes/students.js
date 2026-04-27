import express from 'express';
import { body, query } from 'express-validator';
import { authenticate, isSchool, isAdmin } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';
import * as studentController from '../controllers/studentController.js';

const router = express.Router();

/**
 * @route   GET /api/students
 * @desc    Get all students for current school (or by schoolId for admin/superadmin)
 * @access  Private (School/Admin/Superadmin)
 */
router.get(
  '/',
  authenticate,
  [
    query('schoolId')
      .optional()
      .custom((value) => value === undefined || value === null || value === '' || value === 'undefined' || value === 'null' || Number.isInteger(Number(value)))
      .withMessage('School ID must be a valid integer'),
    handleValidationErrors,
  ],
  studentController.getStudents
);

/**
 * @route   GET /api/students/:id
 * @desc    Get student by ID
 * @access  Private (School)
 */
router.get('/:id', authenticate, isSchool, studentController.getStudentById);

/**
 * @route   POST /api/students
 * @desc    Create student profile
 * @access  Private (School)
 */
router.post(
  '/',
  authenticate,
  isSchool,
  [
    body('studentName').trim().notEmpty().withMessage('Student name is required'),
    body('studentAge')
      .exists({ checkFalsy: true })
      .withMessage('Age is required')
      .isInt({ min: 1, max: 120 })
      .withMessage('Age must be a whole number between 1 and 120'),
    body('studentLevel').optional({ nullable: true, checkFalsy: true }).isString(),
    body('studentEmail')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email address'),
    body('studentPhone').optional({ nullable: true, checkFalsy: true }).isString(),
    body('parentName')
      .trim()
      .notEmpty()
      .withMessage('Parent name is required')
      .isString(),
    body('parentContact')
      .trim()
      .notEmpty()
      .withMessage('Parent contact is required')
      .isString(),
    body('notes').optional({ nullable: true }).isString(),
    handleValidationErrors,
  ],
  studentController.createStudent
);

/**
 * @route   PUT /api/students/:id
 * @desc    Update student profile
 * @access  Private (School)
 */
router.put(
  '/:id',
  authenticate,
  isSchool,
  [
    body('studentName').optional({ nullable: true, checkFalsy: true }).trim().notEmpty(),
    body('studentAge')
      .exists({ checkFalsy: true })
      .withMessage('Age is required')
      .isInt({ min: 1, max: 120 })
      .withMessage('Age must be a whole number between 1 and 120'),
    body('studentLevel').optional({ nullable: true, checkFalsy: true }).isString(),
    body('studentEmail')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email address'),
    body('studentPhone').optional({ nullable: true, checkFalsy: true }).isString(),
    body('parentName')
      .trim()
      .notEmpty()
      .withMessage('Parent name is required')
      .isString(),
    body('parentContact')
      .trim()
      .notEmpty()
      .withMessage('Parent contact is required')
      .isString(),
    body('notes').optional({ nullable: true }).isString(),
    body('isActive').optional().isBoolean(),
    handleValidationErrors,
  ],
  studentController.updateStudent
);

/**
 * @route   DELETE /api/students/:id
 * @desc    Delete student profile (soft delete by setting isActive = false)
 * @access  Private (School)
 */
router.delete('/:id', authenticate, isSchool, studentController.deleteStudent);

/**
 * @route   GET /api/students/:id/appointments
 * @desc    Get all appointments for a student
 * @access  Private (School)
 */
router.get('/:id/appointments', authenticate, isSchool, studentController.getStudentAppointments);

export default router;

