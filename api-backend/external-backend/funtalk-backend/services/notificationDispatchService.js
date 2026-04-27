import { query } from '../config/database.js';
import { createNotificationIfNotExists, ensureNotificationSchema } from './notificationService.js';

const APPOINTMENT_HREFS = {
  superadmin: '/superadmin/appointment',
  school: '/school/bookings',
  teacher: '/teacher/appointments',
};

const INVOICE_HREFS = {
  superadmin: '/superadmin/invoices',
  school: '/school/credits',
};

const normalizeDate = (value) => String(value || '').slice(0, 10);
const normalizeTime = (value) => String(value || '').slice(0, 5);

const createSafeNotification = async (payload, withinMinutes = 240) => {
  try {
    await createNotificationIfNotExists(payload, { withinMinutes });
  } catch (error) {
    console.error('Notification dispatch failed:', error);
  }
};

export const notifyTeacherAssignment = async ({ appointmentId, teacherId, date, time, classType }) => {
  await ensureNotificationSchema();
  const bookingDate = normalizeDate(date);
  const bookingTime = normalizeTime(time);
  await createSafeNotification(
    {
      userId: Number(teacherId),
      title: 'New class assigned',
      message: `You were assigned to a ${String(classType || 'class').replaceAll('_', '-')} class on ${bookingDate} at ${bookingTime}.`,
      href: APPOINTMENT_HREFS.teacher,
      severity: 'action_required',
      entityType: 'appointment',
      entityId: Number(appointmentId),
    },
    1440
  );
};

export const notifyAvailabilityChanged = async ({ teacherId, changeType, detail = '' }) => {
  await ensureNotificationSchema();
  await createSafeNotification(
    {
      targetRole: 'superadmin',
      title: 'Teacher availability updated',
      message: `Teacher #${Number(teacherId)} ${changeType}.${detail ? ` ${detail}` : ''}`,
      href: '/superadmin/teacher-availability',
      severity: 'info',
      entityType: 'availability',
      entityId: Number(teacherId),
    },
    180
  );
};

export const notifyMaterialUploaded = async ({ userId, userType, materialId, materialName }) => {
  await ensureNotificationSchema();
  const href = String(userType || '').toLowerCase() === 'teacher' ? '/teacher/materials' : '/school/materials';
  await createSafeNotification(
    {
      userId: Number(userId),
      title: 'Material uploaded',
      message: `${materialName || 'New material'} was uploaded successfully.`,
      href,
      severity: 'info',
      entityType: 'material',
      entityId: Number(materialId),
    },
    120
  );
};

export const notifyInvoicePaid = async ({ userId, invoiceId }) => {
  await ensureNotificationSchema();
  await createSafeNotification(
    {
      userId: Number(userId),
      title: 'Payment approved',
      message: `Invoice INV-${Number(invoiceId)} has been marked as paid.`,
      href: INVOICE_HREFS.school,
      severity: 'info',
      entityType: 'invoice',
      entityId: Number(invoiceId),
    },
    1440
  );
};

export const dispatchUpcomingClassReminders = async () => {
  await ensureNotificationSchema();
  const rows = await query(
    `SELECT
       a.appointment_id,
       a.user_id,
       a.teacher_id,
       a.class_type,
       a.appointment_date::text AS appointment_date,
       a.appointment_time::text AS appointment_time
     FROM appointmenttbl a
     WHERE a.status = 'approved'
       AND a.teacher_id IS NOT NULL
       AND (
         (a.appointment_date::date + a.appointment_time::time) BETWEEN NOW() + INTERVAL '14 minutes' AND NOW() + INTERVAL '16 minutes'
         OR (a.appointment_date::date + a.appointment_time::time) BETWEEN NOW() + INTERVAL '59 minutes' AND NOW() + INTERVAL '61 minutes'
       )`
  );

  for (const row of rows.rows) {
    const bookingDate = normalizeDate(row.appointment_date);
    const bookingTime = normalizeTime(row.appointment_time);
    const message = `Upcoming ${String(row.class_type || 'class').replaceAll('_', '-')} class on ${bookingDate} at ${bookingTime}.`;
    await createSafeNotification(
      {
        userId: Number(row.teacher_id),
        title: 'Class starts soon',
        message,
        href: APPOINTMENT_HREFS.teacher,
        severity: 'action_required',
        entityType: 'appointment',
        entityId: Number(row.appointment_id),
      },
      90
    );
    await createSafeNotification(
      {
        userId: Number(row.user_id),
        title: 'Class starts soon',
        message,
        href: APPOINTMENT_HREFS.school,
        severity: 'action_required',
        entityType: 'appointment',
        entityId: Number(row.appointment_id),
      },
      90
    );
  }
};

export const dispatchInvoiceDueReminders = async () => {
  await ensureNotificationSchema();
  const dueSoon = await query(
    `SELECT invoice_id, user_id, due_date::text AS due_date
     FROM invoicetbl
     WHERE LOWER(COALESCE(status, '')) = 'pending'
       AND due_date IS NOT NULL
       AND due_date IN (CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '1 day')`
  );
  const overdue = await query(
    `SELECT invoice_id, user_id, due_date::text AS due_date
     FROM invoicetbl
     WHERE LOWER(COALESCE(status, '')) = 'pending'
       AND due_date IS NOT NULL
       AND due_date < CURRENT_DATE`
  );

  for (const row of dueSoon.rows) {
    const dueDate = normalizeDate(row.due_date);
    await createSafeNotification(
      {
        userId: Number(row.user_id),
        title: 'Invoice due soon',
        message: `Invoice INV-${Number(row.invoice_id)} is due on ${dueDate}.`,
        href: INVOICE_HREFS.school,
        severity: 'warning',
        entityType: 'invoice',
        entityId: Number(row.invoice_id),
      },
      1440
    );
    await createSafeNotification(
      {
        targetRole: 'superadmin',
        title: 'Invoice due soon',
        message: `Invoice INV-${Number(row.invoice_id)} is due on ${dueDate}.`,
        href: INVOICE_HREFS.superadmin,
        severity: 'warning',
        entityType: 'invoice',
        entityId: Number(row.invoice_id),
      },
      1440
    );
  }

  for (const row of overdue.rows) {
    const dueDate = normalizeDate(row.due_date);
    await createSafeNotification(
      {
        userId: Number(row.user_id),
        title: 'Invoice overdue',
        message: `Invoice INV-${Number(row.invoice_id)} is overdue since ${dueDate}.`,
        href: INVOICE_HREFS.school,
        severity: 'action_required',
        entityType: 'invoice',
        entityId: Number(row.invoice_id),
      },
      1440
    );
    await createSafeNotification(
      {
        targetRole: 'superadmin',
        title: 'Invoice overdue',
        message: `Invoice INV-${Number(row.invoice_id)} is overdue since ${dueDate}.`,
        href: INVOICE_HREFS.superadmin,
        severity: 'action_required',
        entityType: 'invoice',
        entityId: Number(row.invoice_id),
      },
      1440
    );
  }
};
