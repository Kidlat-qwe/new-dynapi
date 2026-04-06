import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, isTeacher } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';
import * as availabilityController from '../controllers/availabilityController.js';

const router = express.Router();

/**
 * @route   GET /api/availability/teacher/:teacherId
 * @desc    Get teacher's availability schedule
 * @access  Public
 */
router.get(
  '/teacher/:teacherId',
  [param('teacherId').isInt().withMessage('Valid teacher ID is required')],
  handleValidationErrors,
  availabilityController.getTeacherAvailability
);

/**
 * @route   GET /api/availability/teacher/:teacherId/available-slots
 * @desc    Get available time slots for a teacher on a specific date
 * @access  Public
 */
router.get(
  '/teacher/:teacherId/available-slots',
  [
    param('teacherId').isInt().withMessage('Valid teacher ID is required'),
    query('date').isISO8601().withMessage('Valid date is required'),
  ],
  handleValidationErrors,
  availabilityController.getAvailableSlots
);

/**
 * @route   GET /api/availability/teacher/:teacherId/exceptions
 * @desc    Get teacher's exceptions
 * @access  Private (Teacher)
 */
router.get(
  '/teacher/:teacherId/exceptions',
  authenticate,
  isTeacher,
  [
    param('teacherId').isInt().withMessage('Valid teacher ID is required'),
    handleValidationErrors,
  ],
  availabilityController.getTeacherExceptions
);

/**
 * @route   POST /api/availability
 * @desc    Set teacher availability schedule (Teacher only)
 * @access  Private (Teacher)
 */
router.post(
  '/',
  authenticate,
  isTeacher,
  [
    body('dayOfWeek').isInt({ min: 0, max: 6 }).withMessage('Day of week must be 0-6 (Sunday-Saturday)'),
    body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid start time is required (HH:MM)'),
    body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid end time is required (HH:MM)'),
    body('isActive').optional().isBoolean(),
    handleValidationErrors,
  ],
  availabilityController.setAvailability
);

/**
 * @route   PUT /api/availability/:id
 * @desc    Update availability schedule
 * @access  Private (Teacher)
 */
router.put(
  '/:id',
  authenticate,
  isTeacher,
  [
    body('startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('endTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('isActive').optional().isBoolean(),
    handleValidationErrors,
  ],
  availabilityController.updateAvailability
);

/**
 * @route   DELETE /api/availability/:id
 * @desc    Delete availability schedule
 * @access  Private (Teacher)
 */
router.delete('/:id', authenticate, isTeacher, availabilityController.deleteAvailability);

/**
 * @route   POST /api/availability/exceptions
 * @desc    Add availability exception (blocked date/holiday)
 * @access  Private (Teacher)
 */
router.post(
  '/exceptions',
  authenticate,
  isTeacher,
  [
    body('exceptionDate').isISO8601().withMessage('Valid exception date is required'),
    body('startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('endTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('reason').optional().isString(),
    body('isBlocked').optional().isBoolean(),
    handleValidationErrors,
  ],
  availabilityController.addException
);

/**
 * @route   DELETE /api/availability/exceptions/:id
 * @desc    Remove availability exception
 * @access  Private (Teacher)
 */
router.delete('/exceptions/:id', authenticate, isTeacher, availabilityController.deleteException);

export default router;

