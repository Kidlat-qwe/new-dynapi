import express from 'express';
import { body, query as queryValidator } from 'express-validator';
import { authenticate, isSchool, isAdmin } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';
import * as billingController from '../controllers/billingController.js';

const router = express.Router();

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
    body('packageType').optional().isString(),
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
    body('packageType').optional().isString(),
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
  isSchool,
  [
    body('packageId').isInt().withMessage('Package ID is required'),
    body('billingType').optional().isIn(['invoice', 'card', 'bank_transfer']),
    handleValidationErrors,
  ],
  billingController.createBilling
);

/**
 * @route   GET /api/billing/:id
 * @desc    Get billing record by ID
 * @access  Private (School/Admin)
 */
router.get('/:id', authenticate, billingController.getBillingById);

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
router.post('/:id/approve', authenticate, isAdmin, billingController.approvePayment);

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

export default router;

