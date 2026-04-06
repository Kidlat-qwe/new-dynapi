import { query } from '../config/database.js';

/**
 * @desc    Get credit balance (School: own balance, Admin: all balances)
 * @route   GET /api/credits/balance
 * @access  Private (School/Admin)
 */
export const getBalance = async (req, res) => {
  try {
    const userRole = req.user.userType;
    const userId = req.user.userId;
    
    let sqlQuery = '';
    let params = [];
    
    if (userRole === 'school') {
      // School users see only their own balance
      sqlQuery = `
        SELECT 
          c.credit_id,
          c.user_id,
          u.name as user_name,
          u.email,
          u.user_type,
          c.current_balance,
          c.last_updated
        FROM creditstbl c
        LEFT JOIN userstbl u ON c.user_id = u.user_id
        WHERE c.user_id = $1
      `;
      params = [userId];
    } else {
      // Admin/Superadmin see all balances
      sqlQuery = `
        SELECT 
          c.credit_id,
          c.user_id,
          u.name as user_name,
          u.email,
          u.user_type,
          c.current_balance,
          c.last_updated
        FROM creditstbl c
        LEFT JOIN userstbl u ON c.user_id = u.user_id
        ORDER BY c.current_balance DESC, c.last_updated DESC
      `;
    }
    
    const result = await query(sqlQuery, params);
    
    res.status(200).json({
      success: true,
      data: {
        balances: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching credit balances:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching credit balances',
      error: error.message,
    });
  }
};

/**
 * @desc    Get credit transaction history (School: own transactions, Admin: all transactions)
 * @route   GET /api/credits/transactions
 * @access  Private (School/Admin)
 */
export const getTransactions = async (req, res) => {
  try {
    const { startDate, endDate, transactionType, userId: queryUserId } = req.query;
    const userRole = req.user.userType;
    const userId = req.user.userId;
    
    let sqlQuery = `
      SELECT 
        ct.transaction_id,
        ct.user_id,
        u.name as user_name,
        u.email,
        ct.appointment_id,
        a.student_name as appointment_student,
        ct.transaction_type,
        ct.amount,
        ct.balance_before,
        ct.balance_after,
        ct.description,
        ct.created_by,
        creator.name as created_by_name,
        ct.created_at
      FROM credittransactionstbl ct
      LEFT JOIN userstbl u ON ct.user_id = u.user_id
      LEFT JOIN appointmenttbl a ON ct.appointment_id = a.appointment_id
      LEFT JOIN userstbl creator ON ct.created_by = creator.user_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Apply filters
    if (userRole === 'school') {
      // School users see only their own transactions
      sqlQuery += ` AND ct.user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    } else if (queryUserId) {
      // Admin can filter by userId
      sqlQuery += ` AND ct.user_id = $${paramIndex}`;
      params.push(queryUserId);
      paramIndex++;
    }
    
    if (transactionType) {
      sqlQuery += ` AND ct.transaction_type = $${paramIndex}`;
      params.push(transactionType);
      paramIndex++;
    }
    
    if (startDate) {
      sqlQuery += ` AND ct.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      sqlQuery += ` AND ct.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    sqlQuery += ` ORDER BY ct.created_at DESC`;
    
    const result = await query(sqlQuery, params);
    
    res.status(200).json({
      success: true,
      data: {
        transactions: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching credit transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching credit transactions',
      error: error.message,
    });
  }
};

/**
 * @desc    Manually adjust credits (Admin/Superadmin only)
 * @route   POST /api/credits/adjust
 * @access  Private (Admin/Superadmin)
 */
export const adjustCredits = async (req, res) => {
  try {
    const { userId, amount, transactionType, description } = req.body;
    const createdBy = req.user.userId; // From auth middleware
    
    // Validation
    if (!userId || !amount || !transactionType) {
      return res.status(400).json({
        success: false,
        message: 'userId, amount, and transactionType are required',
      });
    }
    
    if (!['purchase', 'deduction', 'refund', 'adjustment'].includes(transactionType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction type',
      });
    }
    
    // Get current balance
    const balanceResult = await query(
      'SELECT current_balance FROM creditstbl WHERE user_id = $1',
      [userId]
    );
    
    if (balanceResult.rows.length === 0) {
      // Create credit record if it doesn't exist
      await query(
        'INSERT INTO creditstbl (user_id, current_balance) VALUES ($1, 0)',
        [userId]
      );
    }
    
    const currentBalance = balanceResult.rows[0]?.current_balance || 0;
    const balanceBefore = currentBalance;
    const balanceAfter = transactionType === 'deduction' 
      ? currentBalance - Math.abs(amount)
      : currentBalance + Math.abs(amount);
    
    // Update credit balance
    await query(
      'UPDATE creditstbl SET current_balance = $1, last_updated = CURRENT_TIMESTAMP WHERE user_id = $2',
      [balanceAfter, userId]
    );
    
    // Insert transaction record
    const transactionResult = await query(
      `INSERT INTO credittransactionstbl 
       (user_id, transaction_type, amount, balance_before, balance_after, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, transactionType, Math.abs(amount), balanceBefore, balanceAfter, description || null, createdBy]
    );
    
    res.status(201).json({
      success: true,
      message: 'Credits adjusted successfully',
      data: {
        transaction: transactionResult.rows[0],
        newBalance: balanceAfter,
      },
    });
  } catch (error) {
    console.error('Error adjusting credits:', error);
    res.status(500).json({
      success: false,
      message: 'Error adjusting credits',
      error: error.message,
    });
  }
};
