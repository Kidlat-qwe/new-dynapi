import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { query, getClient } from '../config/database.js';
import fs from 'fs';
import firebaseApp, { checkEmailExists, createFirebaseUser } from '../config/firebase.js';
import {
  ensureSubscriptionSchema,
  upsertPattySubscription,
} from '../services/billingSubscriptionService.js';
import {
  isS3Configured,
  uploadReceiptFileToS3,
  uploadTeacherProfileFileToS3,
} from '../services/s3Materials.js';

const normalizePaymentStatus = (value) => {
  const raw = String(value || '').toLowerCase();
  return raw === 'paid' ? 'paid' : 'pending';
};

const normalizePaymentType = (value) => {
  const v = String(value || 'bank_transfer').toLowerCase();
  const allowed = new Set(['bank_transfer', 'e_wallet', 'card', 'cash']);
  return allowed.has(v) ? v : 'bank_transfer';
};

const parseInitialPaymentAmount = (req) => {
  const raw = req.body?.initialPaymentAmount;
  if (raw === undefined || raw === null || raw === '') return null;
  const n = parseFloat(String(raw));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

const normalizeTeacherEmploymentType = (value) => {
  return String(value || '').toLowerCase() === 'full_time' ? 'full_time' : 'part_time';
};

const logInitialPaymentIfPaid = async ({
  billingId,
  userId,
  amount,
  paymentStatus,
  paymentType,
  attachmentUrl,
}) => {
  if (paymentStatus !== 'paid') return;
  await query(`ALTER TABLE paymenttbl ADD COLUMN IF NOT EXISTS attachment_url TEXT`);
  const reference = `ONBOARD-${userId}-${Date.now()}`;
  await query(
    `INSERT INTO paymenttbl (
       billing_id, user_id, payment_method, transaction_ref, amount_paid, status, remarks, attachment_url
     ) VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7)`,
    [
      billingId,
      userId,
      paymentType,
      reference,
      Number(amount || 0),
      'Marked paid during user creation',
      attachmentUrl || null,
    ]
  );
};

/**
 * @route   POST /api/auth/register
 * @desc    Register new user with Firebase authentication
 * @access  Public (for superadmin/admin), Private (for school/teacher - Admin only)
 */
export const register = async (req, res) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const {
      name,
      email,
      password,
      phoneNumber,
      gender,
      userType,
      billingType,
      paymentStatus,
      paymentType,
      teacherEmploymentType,
    } = req.body;
    let { billingConfig } = req.body;
    if (typeof billingConfig === 'string') {
      try {
        billingConfig = JSON.parse(billingConfig);
      } catch {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Invalid billingConfig payload',
        });
      }
    }
    const normalizedPaymentStatus = normalizePaymentStatus(paymentStatus);
    const normalizedPaymentType = normalizePaymentType(paymentType);
    let receiptUrl = req.file?.filename ? `/uploads/receipts/${req.file.filename}` : null;
    if (req.file?.path && isS3Configured()) {
      try {
        receiptUrl = await uploadReceiptFileToS3({
          localPath: req.file.path,
          contentType: req.file.mimetype,
        });
      } finally {
        try {
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch {
          // best-effort temp cleanup
        }
      }
    }
    const billingTypeLower = (billingType || '').toLowerCase();

    if (
      userType === 'school' &&
      normalizedPaymentStatus === 'paid' &&
      !receiptUrl &&
      billingTypeLower === 'explore'
    ) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Receipt attachment is required when payment status is paid.',
      });
    }

    const initialPaymentAmountParsed = parseInitialPaymentAmount(req);
    if (
      userType === 'school' &&
      normalizedPaymentStatus === 'paid' &&
      billingTypeLower === 'explore' &&
      initialPaymentAmountParsed === null
    ) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Payment amount is required when payment status is paid.',
      });
    }

    // Validate user type
    const allowedUserTypes = ['superadmin', 'school', 'teacher'];
    if (!allowedUserTypes.includes(userType)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid user type',
      });
    }

    // Check if email already exists in database
    const existingUserResult = await client.query(
      'SELECT user_id, email FROM userstbl WHERE email = $1',
      [email]
    );

    if (existingUserResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Email already exists in the system',
      });
    }

    // Check if email exists in Firebase
    let emailCheck;
    try {
      emailCheck = await checkEmailExists(email);
    } catch (firebaseError) {
      // If Firebase is not configured, skip Firebase check
      if (firebaseError.message.includes('not initialized')) {
        console.warn('Firebase not initialized, skipping Firebase email check');
        emailCheck = { exists: false };
      } else {
        await client.query('ROLLBACK');
        return res.status(500).json({
          success: false,
          message: 'Error checking email in Firebase',
          error: firebaseError.message,
        });
      }
    }

    if (emailCheck.exists) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Email already exists. Please use a different email address.',
      });
    }

    // Create user in Firebase
    let firebaseUser;
    try {
      firebaseUser = await createFirebaseUser(email, password, name);
    } catch (firebaseError) {
      await client.query('ROLLBACK');
      
      // Handle specific Firebase errors
      if (firebaseError.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          message: 'Email already exists. Please use a different email address.',
        });
      }
      
      return res.status(400).json({
        success: false,
        message: firebaseError.message || 'Error creating Firebase user',
      });
    }

    // Insert user into database
    const insertUserQuery = `
      INSERT INTO userstbl (email, name, user_type, phone_number, firebase_uid, status, billing_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING user_id, email, name, user_type, status, created_at, billing_type
    `;

    const userResult = await client.query(insertUserQuery, [
      email,
      name,
      userType,
      phoneNumber || null,
      firebaseUser.uid,
      'active', // Default status
      billingType || null,
    ]);

    const newUser = userResult.rows[0];

    // If user is a school, create a fixed credit allocation (set once at creation).
    if (userType === 'school') {
      const fixedCredits = Math.max(0, Number(billingConfig?.creditsPerCycle || 0));
      await client.query(
        'INSERT INTO creditstbl (user_id, current_balance) VALUES ($1, $2)',
        [newUser.user_id, fixedCredits]
      );
      // Patty subscription is applied AFTER COMMIT — upsertPattySubscription uses its own DB
      // connection; FK to userstbl is only visible to other sessions after commit.
    }

    // If user is a teacher, create teacher profile
    if (userType === 'teacher') {
      const employmentType = normalizeTeacherEmploymentType(teacherEmploymentType);
      const normalizedGender = ['male', 'female', 'other'].includes(String(gender || '').toLowerCase())
        ? String(gender).toLowerCase()
        : null;
      await client.query(
        `INSERT INTO teachertbl (teacher_id, fullname, email, gender, status, employment_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newUser.user_id, name, email, normalizedGender, 'active', employmentType] // Teachers start as active
      );
    }

    await client.query('COMMIT');

    // Patty plan must run after school user row is committed (see note above).
    if (userType === 'school' && (billingType || '').toLowerCase() === 'patty') {
      try {
        await ensureSubscriptionSchema();
        await upsertPattySubscription({
          userId: newUser.user_id,
          planName: billingConfig?.planName || `${name} Patty Plan`,
          creditsPerCycle: Number(billingConfig?.creditsPerCycle || 20),
          creditRate: Number(billingConfig?.ratePerCredit || 5),
          paymentDueDay: Number(billingConfig?.paymentDueDay || 1),
          billingDurationMonths: Number(billingConfig?.billingDurationMonths || 12),
          penaltyPercentage: Number(billingConfig?.penaltyPercentage || 10),
          graceDays: Number(billingConfig?.graceDays || 7),
          rolloverEnabled: billingConfig?.rolloverEnabled !== undefined ? Boolean(billingConfig.rolloverEnabled) : true,
          maxRolloverCredits: Number(billingConfig?.maxRolloverCredits || 100),
          autoRenew: billingConfig?.autoRenew !== undefined ? Boolean(billingConfig.autoRenew) : true,
          startDate: billingConfig?.startDate || null,
        });

        // No forced first-cycle invoice at signup.
        // Monthly Patty invoices are generated by subscription cycle runner:
        // - auto: 7 days before due date
        // - manual: Generate action in billing page
      } catch (subError) {
        console.error('Patty subscription setup failed after user create:', subError);
        return res.status(500).json({
          success: false,
          message:
            'User was created but monthly billing (subscription) could not be saved. Please configure billing in the admin panel or contact support.',
          error: process.env.NODE_ENV === 'development' ? subError.message : undefined,
        });
      }
    }

    if (userType === 'school' && (billingType || '').toLowerCase() === 'explore') {
      try {
        const credits = Number(billingConfig?.creditsPerCycle || 0);
        const rate = Number(billingConfig?.ratePerCredit || 0);
        if (credits <= 0 || rate < 0) {
          return res.status(400).json({
            success: false,
            message: 'Explore billing requires valid credits and rate per credit.',
          });
        }

        const amount = Number((credits * rate).toFixed(2));
        const exploreInvoiceAmount =
          normalizedPaymentStatus === 'paid' && initialPaymentAmountParsed !== null
            ? initialPaymentAmountParsed
            : amount;
        const billingStatus = normalizedPaymentStatus === 'paid' ? 'approved' : 'pending';
        const billingRow = await query(
          `INSERT INTO billingtbl (user_id, package_id, billing_type, amount, status)
           VALUES ($1, NULL, $2, $3, $4)
           RETURNING billing_id`,
          [newUser.user_id, 'explore', exploreInvoiceAmount, billingStatus]
        );
        const billingId = billingRow.rows[0].billing_id;

        const invoiceResult = await query(
          `INSERT INTO invoicetbl (
             billing_id, user_id, invoice_number, description, due_date, amount, status, receipt_url
           ) VALUES (
             $1, $2, NULL, $3, CURRENT_DATE, $4, $5, $6
           )
           RETURNING invoice_id`,
          [billingId, newUser.user_id, 'signup_explore_invoice', exploreInvoiceAmount, normalizedPaymentStatus, receiptUrl]
        );
        await query(
          'UPDATE invoicetbl SET invoice_number = $1 WHERE invoice_id = $2',
          [`INV-${invoiceResult.rows[0].invoice_id}`, invoiceResult.rows[0].invoice_id]
        );
        await logInitialPaymentIfPaid({
          billingId,
          userId: newUser.user_id,
          amount: exploreInvoiceAmount,
          paymentStatus: normalizedPaymentStatus,
          paymentType: normalizedPaymentType,
          attachmentUrl: receiptUrl,
        });

        // Invoice/payment does not change credits. Credits are fixed at user creation.
      } catch (exploreError) {
        console.error('Explore billing setup failed after user create:', exploreError);
        return res.status(500).json({
          success: false,
          message: 'User was created but explore billing setup failed.',
          error: process.env.NODE_ENV === 'development' ? exploreError.message : undefined,
        });
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: newUser.user_id,
        email: newUser.email,
        userType: newUser.user_type,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          userId: newUser.user_id,
          email: newUser.email,
          name: newUser.name,
          userType: newUser.user_type,
          status: newUser.status,
        },
        token,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);

    // Handle database errors
    if (error.code === '23505') {
      // Unique violation
      return res.status(409).json({
        success: false,
        message: 'Email already exists in the system',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Login user (Firebase Auth)
 * @access  Public
 */
export const login = async (req, res) => {
  try {
    const { email, firebaseToken } = req.body;

    if (!firebaseToken) {
      return res.status(400).json({
        success: false,
        message: 'Firebase token is required',
      });
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      if (!firebaseApp) {
        return res.status(503).json({
          success: false,
          message: 'Firebase Admin is not configured on the server',
        });
      }
      decodedToken = await firebaseApp.auth().verifyIdToken(firebaseToken);
    } catch (firebaseError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired Firebase token',
      });
    }

    // Verify email matches
    if (decodedToken.email !== email.toLowerCase()) {
      return res.status(401).json({
        success: false,
        message: 'Email mismatch',
      });
    }

    // Find user in database
    await query('ALTER TABLE userstbl ADD COLUMN IF NOT EXISTS profile_picture TEXT');
    const userResult = await query(
      `SELECT user_id, email, name, user_type, status, firebase_uid, profile_picture
       FROM userstbl 
       WHERE email = $1 OR firebase_uid = $2`,
      [email.toLowerCase(), decodedToken.uid]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found in system. Please sign up first.',
      });
    }

    const user = userResult.rows[0];

    // Verify Firebase UID matches (if stored)
    if (user.firebase_uid && user.firebase_uid !== decodedToken.uid) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Please contact administrator.',
      });
    }

    // Update last login
    await query(
      'UPDATE userstbl SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [user.user_id]
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        userType: user.user_type,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          userId: user.user_id,
          email: user.email,
          name: user.name,
          userType: user.user_type,
          status: user.status,
          profile_picture: user.profile_picture || '',
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
export const getCurrentUser = async (req, res) => {
  try {
    await query('ALTER TABLE userstbl ADD COLUMN IF NOT EXISTS profile_picture TEXT');
    const userResult = await query(
      `SELECT user_id, email, name, user_type, phone_number, status, created_at, last_login, profile_picture
       FROM userstbl 
       WHERE user_id = $1`,
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        user: userResult.rows[0],
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
    });
  }
};

/**
 * @route   PUT /api/auth/me/profile-picture
 * @desc    Update current user's profile picture (all roles)
 * @access  Private
 */
export const updateMyProfilePicture = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userType = String(req.user.userType || '').toLowerCase();
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Profile picture file is required.',
      });
    }

    await query('ALTER TABLE userstbl ADD COLUMN IF NOT EXISTS profile_picture TEXT');

    let profilePictureUrl = `/uploads/materials/${file.filename}`;
    if (file.path && isS3Configured()) {
      try {
        profilePictureUrl = await uploadTeacherProfileFileToS3({
          localPath: file.path,
          assetType: 'profile_photo',
          contentType: file.mimetype,
        });
      } finally {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch {
          // best-effort temp cleanup
        }
      }
    }

    await query(
      `UPDATE userstbl
       SET profile_picture = $1
       WHERE user_id = $2`,
      [profilePictureUrl, userId]
    );

    if (userType === 'teacher') {
      await query(
        `UPDATE teachertbl
         SET profile_picture = $1
         WHERE teacher_id = $2`,
        [profilePictureUrl, userId]
      );
    }

    const userResult = await query(
      `SELECT user_id, email, name, user_type, phone_number, status, created_at, last_login, profile_picture
       FROM userstbl
       WHERE user_id = $1`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully.',
      data: {
        user: userResult.rows[0],
      },
    });
  } catch (error) {
    console.error('Update profile picture error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating profile picture.',
    });
  }
};

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
export const refreshToken = async (req, res) => {
  try {
    // Generate new token with same user info
    const token = jwt.sign(
      {
        userId: req.user.userId,
        email: req.user.email,
        userType: req.user.userType,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      success: true,
      data: {
        token,
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Error refreshing token',
    });
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
export const logout = async (req, res) => {
  // Since we're using JWT, logout is handled client-side by removing the token
  // In the future, you might want to implement token blacklisting
  res.json({
    success: true,
    message: 'Logout successful',
  });
};
