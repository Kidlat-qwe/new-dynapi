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
    query('schoolId').optional().isInt().withMessage('School ID must be a valid integer'),
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
    body('studentAge').optional().isInt({ min: 1, max: 120 }),
    body('studentLevel').optional().isString(),
    body('studentEmail').optional().isEmail(),
    body('studentPhone').optional().isString(),
    body('parentName').optional().isString(),
    body('parentContact').optional().isString(),
    body('notes').optional().isString(),
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
    body('studentName').optional().trim().notEmpty(),
    body('studentAge').optional().isInt({ min: 1, max: 120 }),
    body('studentLevel').optional().isString(),
    body('studentEmail').optional().isEmail(),
    body('studentPhone').optional().isString(),
    body('parentName').optional().isString(),
    body('parentContact').optional().isString(),
    body('notes').optional().isString(),
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

