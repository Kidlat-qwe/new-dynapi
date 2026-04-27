import { handleValidationErrors } from '../middleware/validation.js';
import {
  ensureNotificationSchema,
  createNotification,
  listNotificationsForUser,
  getUnreadCountForUser,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notificationService.js';

export const listNotifications = async (req, res) => {
  try {
    await ensureNotificationSchema();
    const { limit, unreadOnly } = req.query || {};
    const rows = await listNotificationsForUser({
      userId: req.user.userId,
      userType: req.user.userType,
      limit,
      unreadOnly: String(unreadOnly || '').toLowerCase() === 'true',
    });
    res.status(200).json({ success: true, data: { notifications: rows } });
  } catch (error) {
    console.error('Error listing notifications:', error);
    res.status(500).json({ success: false, message: 'Error listing notifications' });
  }
};

export const unreadCount = async (req, res) => {
  try {
    await ensureNotificationSchema();
    const count = await getUnreadCountForUser({ userId: req.user.userId, userType: req.user.userType });
    res.status(200).json({ success: true, data: { unreadCount: count } });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ success: false, message: 'Error getting unread count' });
  }
};

export const markRead = async (req, res) => {
  try {
    await ensureNotificationSchema();
    const result = await markNotificationRead({
      notificationId: req.params.id,
      userId: req.user.userId,
      userType: req.user.userType,
    });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ success: false, message: 'Error marking notification read' });
  }
};

export const markAllRead = async (req, res) => {
  try {
    await ensureNotificationSchema();
    const result = await markAllNotificationsRead({ userId: req.user.userId, userType: req.user.userType });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ success: false, message: 'Error marking all notifications read' });
  }
};

// Superadmin/admin can create role/user notifications (for testing or ops)
export const create = async (req, res) => {
  try {
    await ensureNotificationSchema();
    handleValidationErrors(req, res, () => {});
    const n = await createNotification({
      userId: req.body.userId ?? null,
      targetRole: req.body.targetRole ?? null,
      title: String(req.body.title || '').trim(),
      message: String(req.body.message || '').trim(),
      href: String(req.body.href || '').trim(),
      severity: req.body.severity || 'info',
      entityType: req.body.entityType ?? null,
      entityId: req.body.entityId ?? null,
    });
    res.status(201).json({ success: true, data: { notification: n } });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ success: false, message: 'Error creating notification' });
  }
};

