import express from 'express';
import { body, query as queryValidator } from 'express-validator';
import { authenticate, isSchool, isTeacher, isAdmin } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';
import * as appointmentController from '../controllers/appointmentController.js';

const router = express.Router();

/**
 * @route   GET /api/appointments
 * @desc    Get all appointments (filtered by user role)
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  [
    queryValidator('status').optional().isIn(['pending', 'approved', 'completed', 'cancelled', 'no_show']),
    queryValidator('teacherId').optional().isInt(),
    queryValidator('startDate').optional().isISO8601(),
    queryValidator('endDate').optional().isISO8601(),
    handleValidationErrors,
  ],
  appointmentController.getAppointments
);

/**
 * @route   GET /api/appointments/:id
 * @desc    Get appointment by ID
 * @access  Private
 */
router.get('/:id', authenticate, appointmentController.getAppointmentById);

/**
 * @route   POST /api/appointments
 * @desc    Create new appointment (School/Admin/Superadmin)
 * @access  Private (School/Admin/Superadmin)
 */
router.post(
  '/',
  authenticate,
  [
    body('teacherId').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('Teacher ID must be a valid integer'),
    body('appointmentDate').isISO8601().withMessage('Valid appointment date is required'),
    body('appointmentTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid time format is required (HH:MM)'),
    body('studentName').trim().notEmpty().withMessage('Student name is required'),
    body('studentAge').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1, max: 120 }),
    body('studentLevel').optional({ nullable: true, checkFalsy: true }).isString(),
    body('materialId').optional({ nullable: true, checkFalsy: true }).isInt(),
    body('classType').optional({ nullable: true, checkFalsy: true }).isIn(['one_on_one', 'group', 'vip']),
    body('duration').optional({ nullable: true, checkFalsy: true }).isIn(['25', '50', '75', '100']),
    body('materialType').optional({ nullable: true, checkFalsy: true }).isIn(['teacher_provided', 'student_provided', 'free_talk']),
    body('teacherRequirements').optional().isArray(),
    body('additionalNotes').optional({ nullable: true }).isString(),
    body('studentId').optional({ nullable: true, checkFalsy: true }).isInt(),
    body('schoolId').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('School ID must be a valid integer'), // For admin/superadmin to book on behalf of school
    handleValidationErrors,
  ],
  appointmentController.createAppointment
);

/**
 * @route   PUT /api/appointments/:id/status
 * @desc    Update appointment status
 * @access  Private (Teacher/Admin)
 */
router.put(
  '/:id/status',
  authenticate,
  [
    body('status').isIn(['pending', 'approved', 'completed', 'cancelled', 'no_show']).withMessage('Invalid status'),
    body('changeReason').optional().isString(),
    body('teacherId').optional({ nullable: true, checkFalsy: true }).isInt(),
    body('meetingLink').optional({ nullable: true, checkFalsy: true }).isURL().withMessage('Meeting link must be a valid URL'),
    body('meetingPlatform').optional({ nullable: true, checkFalsy: true }).isIn(['zoom', 'agora', 'google_meet', 'other']),
    handleValidationErrors,
  ],
  appointmentController.updateAppointmentStatus
);

/**
 * @route   PUT /api/appointments/:id
 * @desc    Update appointment details
 * @access  Private (School/Admin)
 */
router.put(
  '/:id',
  authenticate,
  [
    body('appointmentDate').optional().isISO8601(),
    body('appointmentTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('studentName').optional().trim().notEmpty(),
    body('materialId').optional().isInt(),
    body('additionalNotes').optional().isString(),
    handleValidationErrors,
  ],
  appointmentController.updateAppointment
);

/**
 * @route   DELETE /api/appointments/:id
 * @desc    Cancel/Delete appointment
 * @access  Private (School/Admin)
 */
router.delete('/:id', authenticate, appointmentController.deleteAppointment);

/**
 * @route   GET /api/appointments/:id/history
 * @desc    Get appointment history/audit trail
 * @access  Private
 */
router.get('/:id/history', authenticate, appointmentController.getAppointmentHistory);

/**
 * @route   POST /api/appointments/:id/feedback
 * @desc    Add teacher feedback after class
 * @access  Private (Teacher)
 */
router.post(
  '/:id/feedback',
  authenticate,
  isTeacher,
  [
    body('feedback').trim().notEmpty().withMessage('Feedback is required'),
    handleValidationErrors,
  ],
  appointmentController.addFeedback
);

export default router;

