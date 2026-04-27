import { query, getClient } from '../config/database.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import {
  ensureSubscriptionSchema,
  upsertPattySubscription,
  runCycleForSubscription,
  runDueCycles,
  listSubscriptionsWithStatus,
  getSubscriptionStatusByUserId,
  backfillPattySubscriptions,
  listPattySchoolUsersForInstallmentView,
  getPattyInstallmentSummary,
  defaults,
} from '../services/billingSubscriptionService.js';
import { isS3Configured, uploadReceiptFileToS3 } from '../services/s3Materials.js';
import { createNotification } from '../services/notificationService.js';
import { notifyInvoicePaid } from '../services/notificationDispatchService.js';

let paymentSchemaReadyPromise = null;
const ensurePaymentSchema = async () => {
  if (!paymentSchemaReadyPromise) {
    paymentSchemaReadyPromise = (async () => {
      await query(`ALTER TABLE paymenttbl ADD COLUMN IF NOT EXISTS attachment_url TEXT`);
    })().catch((error) => {
      paymentSchemaReadyPromise = null;
      throw error;
    });
  }
  return paymentSchemaReadyPromise;
};

/**
 * @desc    Get all available credit packages
 * @route   GET /api/billing/packages
 * @access  Public (or Private)
 */
export const getPackages = async (req, res) => {
  try {
    const { isActive } = req.query;
    
    let sqlQuery = `
      SELECT 
        package_id,
        package_name,
        package_type,
        credits_value,
        price,
        is_active,
        created_at
      FROM packagetbl
      WHERE 1=1
    `;
    
    const params = [];
    
    // Filter by active status if provided
    if (isActive !== undefined) {
      sqlQuery += ` AND is_active = $1`;
      params.push(isActive === 'true');
    }
    
    sqlQuery += ` ORDER BY price ASC, created_at DESC`;
    
    const result = await query(sqlQuery, params);
    
    res.status(200).json({
      success: true,
      data: {
        packages: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching packages',
      error: error.message,
    });
  }
};

/**
 * @desc    Get all invoices (Superadmin view)
 * @route   GET /api/billing/invoices
 * @access  Private (Admin/Superadmin)
 */
export const getInvoices = async (req, res) => {
  try {
    const { status, userId, startDate, endDate } = req.query;
    
    let sqlQuery = `
      SELECT 
        i.invoice_id,
        i.billing_id,
        i.user_id,
        u.name as user_name,
        u.email,
        u.user_type,
        CONCAT('INV-', i.invoice_id::text) as invoice_number,
        i.description,
        i.due_date,
        i.amount,
        i.status,
        i.receipt_url,
        i.subscription_id,
        i.cycle_start,
        i.created_at,
        b.billing_type,
        b.status as billing_status,
        p.package_name
      FROM invoicetbl i
      LEFT JOIN userstbl u ON i.user_id = u.user_id
      LEFT JOIN billingtbl b ON i.billing_id = b.billing_id
      LEFT JOIN packagetbl p ON b.package_id = p.package_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      sqlQuery += ` AND i.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (userId) {
      sqlQuery += ` AND i.user_id = $${paramIndex}`;
      params.push(parseInt(userId));
      paramIndex++;
    }
    
    if (startDate) {
      sqlQuery += ` AND i.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      sqlQuery += ` AND i.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    sqlQuery += ` ORDER BY i.created_at DESC`;
    
    const result = await query(sqlQuery, params);
    
    res.status(200).json({
      success: true,
      data: {
        invoices: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoices',
      error: error.message,
    });
  }
};

/**
 * @desc    Get payment logs (Superadmin view)
 * @route   GET /api/billing/payment-logs
 * @access  Private (Admin/Superadmin)
 */
export const getPaymentLogs = async (req, res) => {
  try {
    await ensurePaymentSchema();

    const { paymentType, userId, reference } = req.query;
    let sqlQuery = `
      SELECT
        p.payment_id,
        p.billing_id,
        p.user_id,
        u.name AS user_name,
        u.email,
        p.payment_method,
        p.transaction_ref,
        p.amount_paid,
        p.status,
        p.remarks,
        p.attachment_url,
        p.created_at,
        b.billing_type
      FROM paymenttbl p
      LEFT JOIN userstbl u ON u.user_id = p.user_id
      LEFT JOIN billingtbl b ON b.billing_id = p.billing_id
      WHERE 1=1
    `;

    const params = [];
    let idx = 1;
    if (paymentType) {
      sqlQuery += ` AND p.payment_method = $${idx}`;
      params.push(paymentType);
      idx++;
    }
    if (userId) {
      sqlQuery += ` AND p.user_id = $${idx}`;
      params.push(Number(userId));
      idx++;
    }
    if (reference) {
      sqlQuery += ` AND p.transaction_ref ILIKE $${idx}`;
      params.push(`%${reference}%`);
      idx++;
    }
    sqlQuery += ` ORDER BY p.created_at DESC`;

    const result = await query(sqlQuery, params);
    res.status(200).json({
      success: true,
      data: {
        payments: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching payment logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment logs',
      error: error.message,
    });
  }
};

/**
 * @desc    Download invoice PDF
 * @route   GET /api/billing/invoices/:id/pdf
 * @access  Private (Admin/Superadmin)
 */
export const downloadInvoicePdf = async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    if (Number.isNaN(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice id',
      });
    }

    const result = await query(
      `SELECT
         i.invoice_id,
         i.invoice_number,
         i.description,
         i.due_date,
         i.amount,
         i.status,
         i.created_at,
         u.name as user_name,
         u.email,
         b.billing_type
       FROM invoicetbl i
       LEFT JOIN userstbl u ON i.user_id = u.user_id
       LEFT JOIN billingtbl b ON i.billing_id = b.billing_id
       WHERE i.invoice_id = $1`,
      [invoiceId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }
    const inv = result.rows[0];
    const invoiceNumber = inv.invoice_number || `INV-${inv.invoice_id}`;

    const safeNumber = String(invoiceNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeNumber}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    doc.fontSize(24).text('Invoice', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#333333');
    doc.text(`Invoice #: ${invoiceNumber}`);
    doc.text(`Created: ${inv.created_at ? new Date(inv.created_at).toLocaleDateString() : 'N/A'}`);
    doc.text(`Due Date: ${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}`);
    doc.text(`Status: ${String(inv.status || '').toUpperCase()}`);
    doc.moveDown();

    doc.fontSize(14).fillColor('#111111').text('Billed To');
    doc.fontSize(12).fillColor('#333333');
    doc.text(inv.user_name || 'N/A');
    doc.text(inv.email || 'N/A');
    doc.moveDown();

    doc.fontSize(14).fillColor('#111111').text('Details');
    doc.fontSize(12).fillColor('#333333');
    doc.text(`Billing Type: ${inv.billing_type || '-'}`);
    doc.text(`Description: ${inv.description || '-'}`);
    doc.moveDown();

    const amount = Number(inv.amount || 0);
    doc.fontSize(16).fillColor('#111111').text(`Total: $${amount.toFixed(2)}`, { align: 'right' });
    doc.moveDown(2);
    doc.fontSize(10).fillColor('#666666').text('Generated by Funtalk', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Error downloading invoice PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating invoice PDF',
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/billing/patty-installment-users
 * @desc    List all school users with patty billing (installment) — superadmin
 * @access  Private (Superadmin)
 */
export const getPattyInstallmentUsers = async (req, res) => {
  try {
    await ensureSubscriptionSchema();
    const rows = await listPattySchoolUsersForInstallmentView();
    res.status(200).json({
      success: true,
      data: {
        users: rows,
        count: rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching patty installment users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching installment (patty) users',
      error: error.message,
    });
  }
};

export const getBillingRecords = async (req, res) => {
  try {
    await ensureSubscriptionSchema();
    let rows = await listSubscriptionsWithStatus();
    if (req.user?.userType === 'school') {
      rows = rows.filter((s) => Number(s.user_id) === Number(req.user.userId));
    }
    res.status(200).json({
      success: true,
      data: {
        subscriptions: rows,
        count: rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching billing records:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching billing records',
      error: error.message,
    });
  }
};

export const createBilling = async (req, res) => {
  try {
    await ensureSubscriptionSchema();
    const {
      userId,
      billingType,
      planName,
      creditsPerCycle,
      ratePerCredit,
      paymentDueDay,
      graceDays,
      rolloverEnabled,
      maxRolloverCredits,
      autoRenew,
      startDate,
    } = req.body;

    const targetUserId = userId || req.user.userId;
    const normalizedBillingType = String(billingType || defaults.PATTY_BILLING_TYPE).toLowerCase();
    if (normalizedBillingType !== defaults.PATTY_BILLING_TYPE) {
      return res.status(400).json({
        success: false,
        message: 'Only patty monthly subscriptions are supported in this endpoint.',
      });
    }

    if (!creditsPerCycle || !ratePerCredit) {
      return res.status(400).json({
        success: false,
        message: 'creditsPerCycle and ratePerCredit are required for patty monthly billing.',
      });
    }

    const result = await upsertPattySubscription({
      userId: Number(targetUserId),
      planName: planName || `Patty Plan User ${targetUserId}`,
      creditsPerCycle: Number(creditsPerCycle),
      creditRate: Number(ratePerCredit),
      paymentDueDay: Number(paymentDueDay || 1),
      graceDays: Number(graceDays || 0),
      rolloverEnabled: rolloverEnabled !== undefined ? Boolean(rolloverEnabled) : true,
      maxRolloverCredits: Number(maxRolloverCredits || 0),
      autoRenew: autoRenew !== undefined ? Boolean(autoRenew) : true,
      startDate: startDate || null,
    });

    res.status(201).json({
      success: true,
      message: 'Monthly billing subscription saved successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error creating billing subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating billing subscription',
      error: error.message,
    });
  }
};

export const getBillingById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT
        b.billing_id,
        b.user_id,
        b.package_id,
        b.billing_type,
        b.amount,
        b.status,
        b.created_at,
        p.package_name,
        p.credits_value
      FROM billingtbl b
      LEFT JOIN packagetbl p ON p.package_id = b.package_id
      WHERE b.billing_id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found',
      });
    }
    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching billing by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching billing by ID',
      error: error.message,
    });
  }
};

export const recordPayment = async (req, res) => {
  res.json({ message: 'Record payment endpoint - to be implemented' });
};

export const approvePayment = async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { paymentType, referenceNumber, remarks } = req.body;
    let paymentAttachmentUrl = req.file?.filename ? `/uploads/receipts/${req.file.filename}` : null;
    if (req.file?.path && isS3Configured()) {
      try {
        paymentAttachmentUrl = await uploadReceiptFileToS3({
          localPath: req.file.path,
          contentType: req.file.mimetype,
        });
      } finally {
        try {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        } catch {
          // best-effort cleanup
        }
      }
    }

    const ref =
      typeof referenceNumber === 'string' ? referenceNumber.trim() : String(referenceNumber || '').trim();
    if (!paymentType || !ref) {
      return res.status(400).json({
        success: false,
        message: 'Payment type and reference number are required.',
      });
    }
    if (!paymentAttachmentUrl) {
      return res.status(400).json({
        success: false,
        message: 'Payment attachment is required.',
      });
    }

    await ensurePaymentSchema();
    await client.query('BEGIN');
    const invoiceLookup = await client.query(
      `SELECT i.invoice_id, i.user_id, i.status, i.subscription_id, i.description, i.billing_id, i.amount
       FROM invoicetbl i
       WHERE i.invoice_id = $1
       FOR UPDATE`,
      [id]
    );
    if (invoiceLookup.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }
    const inv = invoiceLookup.rows[0];
    if (inv.status === 'paid') {
      await client.query('COMMIT');
      return res.status(200).json({
        success: true,
        message: 'Invoice already marked as paid',
      });
    }

    const invoice = await client.query(
      `UPDATE invoicetbl
       SET status = 'paid', overdue_since = NULL
       WHERE invoice_id = $1
       RETURNING *`,
      [id]
    );

    if (inv.billing_id) {
      await client.query(
        `INSERT INTO paymenttbl (
           billing_id, user_id, payment_method, transaction_ref, amount_paid, status, remarks, attachment_url
         ) VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7)`,
        [
          inv.billing_id,
          inv.user_id,
          paymentType,
          ref,
          Number(inv.amount || 0),
          remarks || null,
          paymentAttachmentUrl,
        ]
      );
      await client.query(
        `UPDATE billingtbl SET status = 'approved' WHERE billing_id = $1`,
        [inv.billing_id]
      );
    }

    // Invoice payment approval does not change credits.
    await client.query('COMMIT');
    await notifyInvoicePaid({ userId: inv.user_id, invoiceId: Number(id) });

    res.status(200).json({
      success: true,
      message: 'Payment approved successfully',
      data: {
        invoice: invoice.rows[0],
      },
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* no-op */
    }
    console.error('Error approving payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving payment',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

/**
 * @desc    Generate invoice for billing
 * @route   POST /api/billing/:id/invoice
 * @access  Private (Admin/Superadmin)
 */
export const generateInvoice = async (req, res) => {
  try {
    const { id } = req.params; // billing_id
    const { dueDate, description } = req.body;

    // Get billing record
    const billingResult = await query(
      'SELECT * FROM billingtbl WHERE billing_id = $1',
      [id]
    );

    if (billingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found',
      });
    }

    const billing = billingResult.rows[0];

    // Check if invoice already exists for this billing
    const existingInvoice = await query(
      'SELECT invoice_id FROM invoicetbl WHERE billing_id = $1',
      [id]
    );

    if (existingInvoice.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invoice already exists for this billing record',
      });
    }

    // Insert invoice
    const invoiceQuery = `
      INSERT INTO invoicetbl (
        billing_id,
        user_id,
        invoice_number,
        description,
        due_date,
        amount,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const invoiceValues = [
      id,
      billing.user_id,
      null,
      description || null,
      dueDate || null,
      billing.amount || 0,
      'pending',
    ];

    const invoiceResult = await query(invoiceQuery, invoiceValues);
    const invoiceId = invoiceResult.rows[0].invoice_id;
    await query(
      'UPDATE invoicetbl SET invoice_number = $1 WHERE invoice_id = $2',
      [`INV-${invoiceId}`, invoiceId]
    );
    await createNotification({
      targetRole: 'superadmin',
      title: 'Invoice generated',
      message: `INV-${invoiceId} generated manually.`,
      href: '/superadmin/invoices',
      severity: 'info',
      entityType: 'invoice',
      entityId: invoiceId,
    });
    await createNotification({
      userId: Number(billing.user_id),
      title: 'New invoice generated',
      message: `INV-${invoiceId} has been generated.`,
      href: '/school/credits',
      severity: 'info',
      entityType: 'invoice',
      entityId: invoiceId,
    });

    res.status(201).json({
      success: true,
      message: 'Invoice generated successfully',
      data: {
        invoice: invoiceResult.rows[0],
      },
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating invoice',
      error: error.message,
    });
  }
};

/**
 * @desc    Create new package
 * @route   POST /api/billing/packages
 * @access  Private (Admin/Superadmin)
 */
export const createPackage = async (req, res) => {
  try {
    const { packageName, packageType, description, creditsValue, price, isActive } = req.body;
    const packageDescription = (description ?? packageType) || null;
    
    const sqlQuery = `
      INSERT INTO packagetbl (
        package_name, package_type, credits_value, price, is_active
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const values = [
      packageName,
      packageDescription,
      creditsValue,
      price,
      isActive !== undefined ? isActive : true,
    ];
    
    const result = await query(sqlQuery, values);
    
    res.status(201).json({
      success: true,
      message: 'Package created successfully',
      data: {
        package: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating package',
      error: error.message,
    });
  }
};

/**
 * @desc    Update package
 * @route   PUT /api/billing/packages/:id
 * @access  Private (Admin/Superadmin)
 */
export const updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { packageName, packageType, description, creditsValue, price, isActive } = req.body;
    
    // Check if package exists
    const packageCheck = await query(
      'SELECT package_id FROM packagetbl WHERE package_id = $1',
      [id]
    );
    
    if (packageCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Package not found',
      });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (packageName !== undefined) {
      updates.push(`package_name = $${paramIndex}`);
      values.push(packageName);
      paramIndex++;
    }
    
    const hasDescriptionField = Object.prototype.hasOwnProperty.call(req.body, 'description');
    if (hasDescriptionField || packageType !== undefined) {
      updates.push(`package_type = $${paramIndex}`);
      values.push((description ?? packageType) || null);
      paramIndex++;
    }
    
    if (creditsValue !== undefined) {
      updates.push(`credits_value = $${paramIndex}`);
      values.push(creditsValue);
      paramIndex++;
    }
    
    if (price !== undefined) {
      updates.push(`price = $${paramIndex}`);
      values.push(price);
      paramIndex++;
    }
    
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(isActive);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }
    
    values.push(id);
    const updateQuery = `
      UPDATE packagetbl
      SET ${updates.join(', ')}
      WHERE package_id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await query(updateQuery, values);
    
    res.status(200).json({
      success: true,
      message: 'Package updated successfully',
      data: {
        package: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating package',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete package
 * @route   DELETE /api/billing/packages/:id
 * @access  Private (Admin/Superadmin)
 */
export const deletePackage = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM packagetbl WHERE package_id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Package not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Package deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting package:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting package',
      error: error.message,
    });
  }
};

/**
 * @desc    Get monthly billing subscription status by user id
 * @route   GET /api/billing/subscriptions/:userId/status
 * @access  Private
 */
export const getSubscriptionStatus = async (req, res) => {
  try {
    await ensureSubscriptionSchema();
    const { userId } = req.params;
    if (req.user?.userType === 'school' && Number(userId) !== Number(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own subscription status.',
      });
    }
    const uid = Number(userId);
    const status = await getSubscriptionStatusByUserId(uid);
    const userRow = await query('SELECT billing_type FROM userstbl WHERE user_id = $1', [uid]);
    const billingType = String(userRow.rows[0]?.billing_type || '').toLowerCase();

    if (billingType === 'patty') {
      const patty_installment = await getPattyInstallmentSummary(uid, status);
      const payload = status
        ? { ...status, patty_installment }
        : { patty_installment, subscription: null };
      return res.status(200).json({ success: true, data: payload });
    }

    if (!status) {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription status',
      error: error.message,
    });
  }
};

/**
 * @desc    Run monthly cycle for due subscriptions or specific subscription
 * @route   POST /api/billing/subscriptions/run-cycle
 * @access  Private (Admin/Superadmin)
 */
export const runSubscriptionCycle = async (req, res) => {
  try {
    await ensureSubscriptionSchema();
    const { subscriptionId } = req.body || {};
    let results;
    if (subscriptionId) {
      // Manual generate: if current cycle already has an invoice, generate for the next cycle instead.
      const one = await runCycleForSubscription(Number(subscriptionId), req.user?.userId || null, {
        advanceToNextCycleIfAlreadyInvoiced: true,
      });
      results = [one];
    } else {
      results = await runDueCycles(req.user?.userId || null);
    }
    res.status(200).json({
      success: true,
      data: {
        results,
      },
    });
  } catch (error) {
    console.error('Error running subscription cycle:', error);
    res.status(500).json({
      success: false,
      message: 'Error running subscription cycle',
      error: error.message,
    });
  }
};

/**
 * @desc    Backfill patty subscriptions for existing schools
 * @route   POST /api/billing/subscriptions/backfill
 * @access  Private (Admin/Superadmin)
 */
export const backfillSubscriptions = async (req, res) => {
  try {
    await ensureSubscriptionSchema();
    const result = await backfillPattySubscriptions();
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error backfilling subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Error backfilling subscriptions',
      error: error.message,
    });
  }
};

