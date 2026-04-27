import { query, getClient } from '../config/database.js';
import { deleteFirebaseUser, updateFirebaseUser } from '../config/firebase.js';
import {
  ensureSubscriptionSchema,
  upsertPattySubscription,
} from '../services/billingSubscriptionService.js';

/**
 * Get all users with optional filtering
 */
export const getUsers = async (req, res) => {
  try {
    const { userType, status } = req.query;

    let sqlQuery = `
      SELECT 
        u.user_id,
        u.email,
        u.name,
        u.user_type,
        u.profile_picture,
        u.phone_number,
        u.status,
        u.created_at,
        u.last_login,
        COALESCE(u.billing_type, '-') as billing_type,
        t.employment_type AS teacher_employment_type
      FROM userstbl u
      LEFT JOIN teachertbl t ON t.teacher_id = u.user_id
      WHERE 1=1
    `;

    const queryParams = [];
    let paramIndex = 1;

    if (userType) {
      sqlQuery += ` AND u.user_type = $${paramIndex}`;
      queryParams.push(userType);
      paramIndex++;
    }

    if (status) {
      sqlQuery += ` AND u.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    sqlQuery += ' ORDER BY u.created_at DESC';

    const result = await query(sqlQuery, queryParams);

    res.json({
      success: true,
      data: {
        users: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    const isAdmin = ['admin', 'superadmin'].includes(req.user.userType);
    const isSelf = Number(req.user.userId) === userId;
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const result = await query(
      `SELECT
         u.user_id,
         u.email,
         u.name,
         u.user_type,
         u.profile_picture,
         u.phone_number,
         u.status,
         u.billing_type,
         u.created_at,
         u.last_login,
         t.employment_type AS teacher_employment_type
       FROM userstbl u
       LEFT JOIN teachertbl t ON t.teacher_id = u.user_id
       WHERE u.user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const u = result.rows[0];

    let pattyBilling = null;
    if (isAdmin && u.user_type === 'school' && String(u.billing_type || '').toLowerCase() === 'patty') {
      await ensureSubscriptionSchema();
      const sub = await query(
        `SELECT s.start_date, s.payment_due_day, s.billing_duration_months, s.penalty_percentage, s.grace_days, s.rollover_enabled, s.max_rollover_credits, s.auto_renew,
                p.plan_name, p.credits_per_cycle, p.credit_rate
         FROM subscriptionscheduletbl s
         LEFT JOIN subscriptionplantbl p ON p.plan_id = s.plan_id
         WHERE s.user_id = $1`,
        [userId]
      );
      if (sub.rows.length > 0) {
        const r = sub.rows[0];
        const sd = r.start_date ? String(r.start_date).slice(0, 10) : '';
        pattyBilling = {
          planName: r.plan_name || '',
          creditsPerCycle: r.credits_per_cycle != null ? String(r.credits_per_cycle) : '',
          ratePerCredit: r.credit_rate != null ? String(r.credit_rate) : '',
          paymentDueDay: String(r.payment_due_day ?? '1'),
          billingDurationMonths: String(r.billing_duration_months ?? '12'),
          penaltyPercentage: String(r.penalty_percentage ?? '10'),
          graceDays: String(r.grace_days ?? '0'),
          rolloverEnabled: Boolean(r.rollover_enabled),
          maxRolloverCredits: String(r.max_rollover_credits ?? '0'),
          autoRenew: Boolean(r.auto_renew),
          startDate: sd,
        };
      }
    }

    res.json({
      success: true,
      data: {
        user: u,
        pattyBilling,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message,
    });
  }
};

export const updateUser = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ success: false, message: 'Invalid user id' });
  }

  const isAdmin = ['admin', 'superadmin'].includes(req.user.userType);
  const isSelf = Number(req.user.userId) === userId;
  if (!isAdmin && !isSelf) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const client = await getClient();
  try {
    const {
      name,
      email,
      phoneNumber,
      status,
      userType,
      billingType,
      teacherEmploymentType,
      billingConfig,
      password,
    } = req.body;

    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT
         user_id,
         email,
         name,
         phone_number,
         status,
         firebase_uid,
         user_type,
         billing_type
       FROM userstbl
       WHERE user_id = $1
       FOR UPDATE`,
      [userId]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const prev = existing.rows[0];

    let nextName = prev.name;
    let nextEmail = prev.email;
    let nextPhone = prev.phone_number;
    let nextStatus = prev.status;
    let nextUserType = prev.user_type;
    let nextBillingType = prev.billing_type;

    if (isAdmin) {
      if (name !== undefined) nextName = String(name).trim();
      if (email !== undefined) nextEmail = String(email).trim().toLowerCase();
      if (phoneNumber !== undefined) nextPhone = phoneNumber ? String(phoneNumber).trim() : null;
      if (status !== undefined) nextStatus = status;
      if (userType !== undefined) nextUserType = userType;
      if (billingType !== undefined) nextBillingType = billingType || null;
    } else {
      if (name !== undefined) nextName = String(name).trim();
      if (email !== undefined) nextEmail = String(email).trim().toLowerCase();
      if (phoneNumber !== undefined) nextPhone = phoneNumber ? String(phoneNumber).trim() : null;
    }
    const normalizedTeacherEmploymentType =
      teacherEmploymentType == null
        ? null
        : String(teacherEmploymentType || '').toLowerCase() === 'full_time'
        ? 'full_time'
        : 'part_time';

    if (nextEmail !== prev.email) {
      const dup = await client.query('SELECT user_id FROM userstbl WHERE email = $1 AND user_id <> $2', [
        nextEmail,
        userId,
      ]);
      if (dup.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }
    }

    await client.query(
      `UPDATE userstbl SET
        name = $1,
        email = $2,
        phone_number = $3,
        status = $4,
        user_type = $5,
        billing_type = $6
       WHERE user_id = $7`,
      [nextName, nextEmail, nextPhone, nextStatus, nextUserType, nextBillingType, userId]
    );

    if (isAdmin && nextUserType === 'teacher' && normalizedTeacherEmploymentType) {
      await client.query(
        `UPDATE teachertbl
         SET employment_type = $1
         WHERE teacher_id = $2`,
        [normalizedTeacherEmploymentType, userId]
      );
    }

    await client.query('COMMIT');

    if (prev.firebase_uid && (nextEmail !== prev.email || password || nextName !== prev.name)) {
      try {
        await updateFirebaseUser(prev.firebase_uid, {
          email: nextEmail !== prev.email ? nextEmail : undefined,
          password: password || undefined,
          displayName: nextName !== prev.name ? nextName : undefined,
        });
      } catch (fbErr) {
        console.error('Firebase update error:', fbErr);
        return res.status(200).json({
          success: true,
          message: 'User updated in database; Firebase sync failed. Check Firebase configuration.',
          warning: fbErr.message,
          data: { userId },
        });
      }
    }

    if (
      isAdmin &&
      nextUserType === 'school' &&
      String(nextBillingType || '').toLowerCase() === 'patty' &&
      billingConfig
    ) {
      try {
        await ensureSubscriptionSchema();
        await upsertPattySubscription({
          userId,
          planName: billingConfig.planName || `${nextName} Patty Plan`,
          creditsPerCycle: Number(billingConfig.creditsPerCycle || 20),
          creditRate: Number(billingConfig.ratePerCredit || 5),
          paymentDueDay: Number(billingConfig.paymentDueDay || 1),
          billingDurationMonths: Number(billingConfig.billingDurationMonths || 12),
          penaltyPercentage: Number(billingConfig.penaltyPercentage || 10),
          graceDays: Number(billingConfig.graceDays || 7),
          rolloverEnabled:
            billingConfig.rolloverEnabled !== undefined ? Boolean(billingConfig.rolloverEnabled) : true,
          maxRolloverCredits: Number(billingConfig.maxRolloverCredits ?? 100),
          autoRenew: billingConfig.autoRenew !== undefined ? Boolean(billingConfig.autoRenew) : true,
          startDate: billingConfig.startDate || null,
        });
      } catch (subErr) {
        console.error('Patty subscription upsert after user update:', subErr);
        return res.status(200).json({
          success: true,
          message: 'User updated; subscription settings could not be saved.',
          warning: subErr.message,
          data: { userId },
        });
      }
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { userId },
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore if already committed */
    }
    console.error('Error updating user:', error);
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (Number.isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    const result = await query(
      'UPDATE userstbl SET status = $1 WHERE user_id = $2 RETURNING user_id, status',
      [status, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Status updated',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating status',
      error: error.message,
    });
  }
};

/**
 * Delete user from PostgreSQL (dependent rows first) and Firebase Auth.
 */
export const deleteUser = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ success: false, message: 'Invalid user id' });
  }

  if (Number(req.user.userId) === userId) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const row = await client.query(
      'SELECT user_id, firebase_uid, user_type FROM userstbl WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    if (row.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { firebase_uid: firebaseUid, user_type: userType } = row.rows[0];

    if (userType === 'superadmin') {
      const cnt = await client.query(
        `SELECT COUNT(*)::int AS c FROM userstbl WHERE user_type = 'superadmin'`
      );
      if (cnt.rows[0].c <= 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the only superadmin account',
        });
      }
    }

    await client.query('UPDATE appointmenttbl SET approved_by = NULL WHERE approved_by = $1', [userId]);

    await client.query(
      `DELETE FROM appointmenthistorytbl WHERE appointment_id IN (
        SELECT appointment_id FROM appointmenttbl WHERE user_id = $1 OR teacher_id = $1
      )`,
      [userId]
    );

    await client.query('DELETE FROM appointmenttbl WHERE user_id = $1 OR teacher_id = $1', [userId]);

    await client.query('DELETE FROM meetingtbl WHERE teacher_id = $1', [userId]);

    await client.query('DELETE FROM credittransactionstbl WHERE user_id = $1', [userId]);

    try {
      await client.query(
        `DELETE FROM paymenthistorytbl WHERE payment_id IN (SELECT payment_id FROM paymenttbl WHERE user_id = $1)`,
        [userId]
      );
    } catch (histErr) {
      if (histErr.code !== '42P01') throw histErr;
    }
    await client.query('DELETE FROM paymenttbl WHERE user_id = $1', [userId]);

    await client.query('DELETE FROM invoicetbl WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM billingtbl WHERE user_id = $1', [userId]);

    await client.query('DELETE FROM subscriptionscheduletbl WHERE user_id = $1', [userId]);

    await client.query('DELETE FROM creditstbl WHERE user_id = $1', [userId]);

    try {
      await client.query('DELETE FROM materialtbl WHERE created_by_user_id = $1', [userId]);
    } catch (mErr) {
      if (mErr.code !== '42703') throw mErr;
    }

    await client.query('DELETE FROM userstbl WHERE user_id = $1', [userId]);

    await client.query('COMMIT');

    let firebaseResult = { deleted: false, skipped: true };
    try {
      firebaseResult = await deleteFirebaseUser(firebaseUid);
    } catch (fbErr) {
      console.error('Firebase delete error:', fbErr);
      return res.status(200).json({
        success: true,
        message:
          'User removed from the database. Firebase deletion failed — remove the Auth user manually if needed.',
        warning: fbErr.message,
        firebase: { deleted: false },
      });
    }

    const payload = {
      success: true,
      message: 'User deleted successfully',
      firebase: firebaseResult,
    };
    if (firebaseResult.skipped) {
      payload.message =
        'User removed from the database. Firebase was not configured or had no UID; Auth user was not deleted.';
    }
    res.json(payload);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message,
    });
  } finally {
    client.release();
  }
};
