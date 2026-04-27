import express from 'express';
import { body, param, query as queryValidator } from 'express-validator';
import { authenticate, isAdmin, isSuperAdmin } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';
import * as billingController from '../controllers/billingController.js';
import { uploadReceipt } from '../middleware/upload.js';

const router = express.Router();

const handleReceiptUpload = (req, res, next) => {
  uploadReceipt.single('paymentAttachment')(req, res, (err) => {
    if (!err) return next();
    if (err?.name === 'MulterError') {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Attachment exceeds 10MB limit.',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Invalid attachment upload.',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || 'Attachment upload failed.',
    });
  });
};

/**
 * @route   GET /api/billing/packages
 * @desc    Get all available credit packages
 * @access  Public (or Private)
 */
router.get(
  '/packages',
  [
    queryValidator('isActive').optional().isBoolean(),
    handleValidationErrors,
  ],
  billingController.getPackages
);

/**
 * @route   POST /api/billing/packages
 * @desc    Create new package (Admin/Superadmin only)
 * @access  Private (Admin/Superadmin)
 */
router.post(
  '/packages',
  authenticate,
  isAdmin,
  [
    body('packageName').trim().notEmpty().withMessage('Package name is required'),
    body('description').optional().isString(),
    body('creditsValue').isInt({ min: 1 }).withMessage('Credits value must be a positive integer'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('isActive').optional().isBoolean(),
    handleValidationErrors,
  ],
  billingController.createPackage
);

/**
 * @route   PUT /api/billing/packages/:id
 * @desc    Update package (Admin/Superadmin only)
 * @access  Private (Admin/Superadmin)
 */
router.put(
  '/packages/:id',
  authenticate,
  isAdmin,
  [
    body('packageName').optional().trim().notEmpty(),
    body('description').optional().isString(),
    body('creditsValue').optional().isInt({ min: 1 }),
    body('price').optional().isFloat({ min: 0 }),
    body('isActive').optional().isBoolean(),
    handleValidationErrors,
  ],
  billingController.updatePackage
);

/**
 * @route   DELETE /api/billing/packages/:id
 * @desc    Delete package (Admin/Superadmin only)
 * @access  Private (Admin/Superadmin)
 */
router.delete('/packages/:id', authenticate, isAdmin, billingController.deletePackage);

/**
 * @route   GET /api/billing/patty-installment-users
 * @desc    All school users with patty (installment) billing — superadmin installment invoice view
 * @access  Private (Superadmin)
 */
router.get(
  '/patty-installment-users',
  authenticate,
  isSuperAdmin,
  billingController.getPattyInstallmentUsers
);

/**
 * @route   GET /api/billing
 * @desc    Get billing records for school
 * @access  Private (School/Admin)
 */
router.get(
  '/',
  authenticate,
  [
    queryValidator('status').optional().isIn(['pending', 'paid', 'failed', 'refunded']),
    handleValidationErrors,
  ],
  billingController.getBillingRecords
);

/**
 * @route   POST /api/billing/create
 * @desc    Create billing record (purchase credits)
 * @access  Private (School)
 */
router.post(
  '/create',
  authenticate,
  isAdmin,
  [
    body('userId').isInt().withMessage('User ID is required'),
    body('billingType').optional().isIn(['patty']),
    body('creditsPerCycle').isInt({ min: 1 }).withMessage('creditsPerCycle must be a positive integer'),
    body('ratePerCredit').isFloat({ min: 0 }).withMessage('ratePerCredit must be a positive number'),
    body('paymentDueDay').optional().isInt({ min: 1, max: 28 }),
    body('graceDays').optional().isInt({ min: 0 }),
    body('rolloverEnabled').optional().isBoolean(),
    body('maxRolloverCredits').optional().isInt({ min: 0 }),
    body('autoRenew').optional().isBoolean(),
    body('startDate').optional().isISO8601(),
    handleValidationErrors,
  ],
  billingController.createBilling
);

router.get(
  '/subscriptions/:userId/status',
  authenticate,
  [
    param('userId').isInt(),
    handleValidationErrors,
  ],
  billingController.getSubscriptionStatus
);

router.post(
  '/subscriptions/run-cycle',
  authenticate,
  isAdmin,
  [
    body('subscriptionId').optional().isInt(),
    handleValidationErrors,
  ],
  billingController.runSubscriptionCycle
);

router.post(
  '/subscriptions/backfill',
  authenticate,
  isAdmin,
  billingController.backfillSubscriptions
);

/**
 * @route   POST /api/billing/:id/payment
 * @desc    Record payment for billing
 * @access  Private (School/Admin)
 */
router.post(
  '/:id/payment',
  authenticate,
  [
    body('paymentMethod').isIn(['card', 'bank_transfer', 'other']).withMessage('Valid payment method is required'),
    body('transactionRef').optional().isString(),
    body('amountPaid').isNumeric().withMessage('Amount paid is required'),
    body('remarks').optional().isString(),
    handleValidationErrors,
  ],
  billingController.recordPayment
);

/**
 * @route   POST /api/billing/:id/approve
 * @desc    Approve payment and release credits (Admin only)
 * @access  Private (Admin/Superadmin)
 */
router.post(
  '/:id/approve',
  authenticate,
  isAdmin,
  handleReceiptUpload,
  [
    body('paymentType').trim().notEmpty().withMessage('Payment type is required'),
    body('referenceNumber').trim().notEmpty().withMessage('Reference number is required'),
    body('remarks').optional().isString(),
    handleValidationErrors,
  ],
  billingController.approvePayment
);

/**
 * @route   POST /api/billing/:id/invoice
 * @desc    Generate invoice for billing (Admin only)
 * @access  Private (Admin/Superadmin)
 */
router.post(
  '/:id/invoice',
  authenticate,
  isAdmin,
  [
    body('dueDate').optional().isISO8601(),
    body('description').optional().isString(),
    handleValidationErrors,
  ],
  billingController.generateInvoice
);

/**
 * @route   GET /api/billing/invoices
 * @desc    Get all invoices (Superadmin view)
 * @access  Private (Admin/Superadmin)
 */
router.get(
  '/invoices',
  authenticate,
  isAdmin,
  [
    queryValidator('status').optional().isString(),
    queryValidator('userId').optional().isInt(),
    queryValidator('startDate').optional().isISO8601(),
    queryValidator('endDate').optional().isISO8601(),
    handleValidationErrors,
  ],
  billingController.getInvoices
);

router.get(
  '/payment-logs',
  authenticate,
  isAdmin,
  [
    queryValidator('paymentType').optional().isString(),
    queryValidator('userId').optional().isInt(),
    queryValidator('reference').optional().isString(),
    handleValidationErrors,
  ],
  billingController.getPaymentLogs
);

router.get(
  '/invoices/:id/pdf',
  authenticate,
  isAdmin,
  [
    param('id').isInt().withMessage('Invoice id must be an integer'),
    handleValidationErrors,
  ],
  billingController.downloadInvoicePdf
);

/**
 * @route   GET /api/billing/:id
 * @desc    Get billing record by ID
 * @access  Private (School/Admin)
 */
router.get('/:id', authenticate, billingController.getBillingById);

export default router;

