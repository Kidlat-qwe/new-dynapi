import express from 'express';
import { body } from 'express-validator';
import { authenticate, isTeacher, isAdmin } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';
import * as meetingController from '../controllers/meetingController.js';

const router = express.Router();

/**
 * @route   GET /api/meetings/teacher/:teacherId
 * @desc    Get meeting links for a teacher
 * @access  Private
 */
router.get('/teacher/:teacherId', authenticate, meetingController.getTeacherMeetings);

/**
 * @route   POST /api/meetings
 * @desc    Create meeting link (Teacher/Admin)
 * @access  Private (Teacher/Admin)
 */
router.post(
  '/',
  authenticate,
  [
    body('meetingLink').trim().notEmpty().withMessage('Meeting link is required'),
    body('meetingPlatform').optional().isIn(['zoom', 'agora', 'google_meet', 'other']),
    body('meetingPassword').optional().isString(),
    handleValidationErrors,
  ],
  meetingController.createMeeting
);

/**
 * @route   PUT /api/meetings/:id
 * @desc    Update meeting link
 * @access  Private (Teacher/Admin)
 */
router.put(
  '/:id',
  authenticate,
  [
    body('meetingLink').optional().trim().notEmpty(),
    body('meetingPlatform').optional().isIn(['zoom', 'agora', 'google_meet', 'other']),
    body('meetingPassword').optional().isString(),
    handleValidationErrors,
  ],
  meetingController.updateMeeting
);

/**
 * @route   DELETE /api/meetings/:id
 * @desc    Delete meeting link
 * @access  Private (Teacher/Admin)
 */
router.delete('/:id', authenticate, meetingController.deleteMeeting);

export default router;

