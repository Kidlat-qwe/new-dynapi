import express from 'express';
import { body, query as queryValidator } from 'express-validator';
import { authenticate, isSchool, isAdmin } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';
import * as creditController from '../controllers/creditController.js';

const router = express.Router();

/**
 * @route   GET /api/credits/balance
 * @desc    Get credit balances (School: own balance, Admin: all balances)
 * @access  Private (School/Admin)
 */
router.get('/balance', authenticate, creditController.getBalance);

/**
 * @route   GET /api/credits/transactions
 * @desc    Get credit transaction history (School: own transactions, Admin: all transactions)
 * @access  Private (School/Admin)
 */
router.get(
  '/transactions',
  authenticate,
  [
    queryValidator('startDate').optional().isISO8601(),
    queryValidator('endDate').optional().isISO8601(),
    queryValidator('transactionType').optional().isIn(['purchase', 'deduction', 'refund', 'adjustment', 'expired']),
    queryValidator('userId').optional().isInt(),
    handleValidationErrors,
  ],
  creditController.getTransactions
);

/**
 * @route   POST /api/credits/adjust
 * @desc    Manually adjust credits (Admin/Superadmin only)
 * @access  Private (Admin/Superadmin)
 */
router.post(
  '/adjust',
  authenticate,
  isAdmin,
  [
    body('userId').isInt().withMessage('User ID is required'),
    body('amount').isInt().withMessage('Amount is required'),
    body('transactionType').isIn(['adjustment', 'refund']).withMessage('Invalid transaction type'),
    body('description').optional().isString(),
    handleValidationErrors,
  ],
  creditController.adjustCredits
);

export default router;

