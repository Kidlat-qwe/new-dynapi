import express from 'express';
import { body, param, query as queryValidator } from 'express-validator';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';
import * as notificationController from '../controllers/notificationController.js';

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    List notifications for current user (includes role notifications)
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  [
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }),
    queryValidator('unreadOnly').optional().isBoolean(),
    handleValidationErrors,
  ],
  notificationController.listNotifications
);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread count for current user
 * @access  Private
 */
router.get('/unread-count', authenticate, notificationController.unreadCount);

/**
 * @route   POST /api/notifications/:id/read
 * @desc    Mark a notification read
 * @access  Private
 */
router.post(
  '/:id/read',
  authenticate,
  [param('id').isInt().withMessage('Notification id must be an integer'), handleValidationErrors],
  notificationController.markRead
);

/**
 * @route   POST /api/notifications/mark-all-read
 * @desc    Mark all notifications read
 * @access  Private
 */
router.post('/mark-all-read', authenticate, notificationController.markAllRead);

/**
 * @route   POST /api/notifications
 * @desc    Create a notification (admin/superadmin only)
 * @access  Private (Admin/Superadmin)
 */
router.post(
  '/',
  authenticate,
  isAdmin,
  [
    body('title').trim().notEmpty().withMessage('title is required'),
    body('message').trim().notEmpty().withMessage('message is required'),
    body('href').trim().notEmpty().withMessage('href is required'),
    body('userId').optional().isInt(),
    body('targetRole').optional().isString(),
    body('severity').optional().isIn(['info', 'warning', 'action_required']),
    body('entityType').optional().isString(),
    body('entityId').optional().isInt(),
    handleValidationErrors,
  ],
  notificationController.create
);

export default router;

