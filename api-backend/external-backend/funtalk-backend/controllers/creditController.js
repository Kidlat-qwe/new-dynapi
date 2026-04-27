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
          u.billing_type,
          COALESCE(p.credits_per_cycle, c.current_balance, 0) AS total_credits,
          p.credit_rate,
          c.current_balance,
          COALESCE(paid_inv.total_paid_amount, 0)::numeric(12,2) AS paid_invoice_amount,
          (
            CASE
              WHEN LOWER(COALESCE(u.billing_type, '')) = 'explore' THEN
                COALESCE(explore_inv.total_invoice_amount, 0)::numeric
              WHEN p.credit_rate IS NOT NULL THEN
                (COALESCE(p.credits_per_cycle, c.current_balance, 0)::numeric * p.credit_rate::numeric)
              ELSE
                c.current_balance::numeric
            END
            - COALESCE(paid_inv.total_paid_amount, 0)
          )::numeric(12,2) AS display_balance,
          c.last_updated
        FROM creditstbl c
        LEFT JOIN userstbl u ON c.user_id = u.user_id
        LEFT JOIN subscriptionscheduletbl s ON s.user_id = c.user_id
        LEFT JOIN subscriptionplantbl p ON p.plan_id = s.plan_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(i.amount), 0) AS total_invoice_amount
          FROM invoicetbl i
          LEFT JOIN billingtbl b ON b.billing_id = i.billing_id
          WHERE i.user_id = c.user_id
            AND LOWER(COALESCE(b.billing_type, '')) = 'explore'
        ) explore_inv ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(i.amount), 0) AS total_paid_amount
          FROM invoicetbl i
          WHERE i.user_id = c.user_id
            AND LOWER(COALESCE(i.status, '')) = 'paid'
        ) paid_inv ON true
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
          u.billing_type,
          COALESCE(p.credits_per_cycle, c.current_balance, 0) AS total_credits,
          p.credit_rate,
          c.current_balance,
          COALESCE(paid_inv.total_paid_amount, 0)::numeric(12,2) AS paid_invoice_amount,
          (
            CASE
              WHEN LOWER(COALESCE(u.billing_type, '')) = 'explore' THEN
                COALESCE(explore_inv.total_invoice_amount, 0)::numeric
              WHEN p.credit_rate IS NOT NULL THEN
                (COALESCE(p.credits_per_cycle, c.current_balance, 0)::numeric * p.credit_rate::numeric)
              ELSE
                c.current_balance::numeric
            END
            - COALESCE(paid_inv.total_paid_amount, 0)
          )::numeric(12,2) AS display_balance,
          c.last_updated
        FROM creditstbl c
        LEFT JOIN userstbl u ON c.user_id = u.user_id
        LEFT JOIN subscriptionscheduletbl s ON s.user_id = c.user_id
        LEFT JOIN subscriptionplantbl p ON p.plan_id = s.plan_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(i.amount), 0) AS total_invoice_amount
          FROM invoicetbl i
          LEFT JOIN billingtbl b ON b.billing_id = i.billing_id
          WHERE i.user_id = c.user_id
            AND LOWER(COALESCE(b.billing_type, '')) = 'explore'
        ) explore_inv ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(i.amount), 0) AS total_paid_amount
          FROM invoicetbl i
          WHERE i.user_id = c.user_id
            AND LOWER(COALESCE(i.status, '')) = 'paid'
        ) paid_inv ON true
        ORDER BY c.current_balance DESC, c.last_updated DESC
      `;
    }
    
    const result = await query(sqlQuery, params);
    
    res.status(200).json({
      success: true,
      data: {
        balances: result.rows,
        count: result.rows.length,
        current_balance: userRole === 'school' ? (result.rows[0]?.current_balance || 0) : undefined,
        last_updated: userRole === 'school' ? (result.rows[0]?.last_updated || null) : undefined,
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
 * @desc    Get settled transactions (Explore fully paid + fully settled installment plans)
 * @route   GET /api/credits/transactions
 * @access  Private (School/Admin)
 */
export const getTransactions = async (req, res) => {
  try {
    const userRole = req.user.userType;
    const userId = req.user.userId;
    const { userId: queryUserId } = req.query;

    const params = [];
    const filters = [];
    let idx = 1;

    if (userRole === 'school') {
      filters.push(`u.user_id = $${idx}`);
      params.push(userId);
      idx++;
    } else if (queryUserId) {
      filters.push(`u.user_id = $${idx}`);
      params.push(Number(queryUserId));
      idx++;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const sqlQuery = `
      WITH base_users AS (
        SELECT u.user_id, u.name AS user_name, u.email, u.billing_type
        FROM userstbl u
        ${whereClause}
      ),
      explore_paid AS (
        SELECT
          i.invoice_id,
          i.user_id,
          i.invoice_number,
          i.amount,
          i.created_at
        FROM invoicetbl i
        LEFT JOIN billingtbl b ON b.billing_id = i.billing_id
        WHERE LOWER(COALESCE(i.status, '')) = 'paid'
          AND LOWER(COALESCE(b.billing_type, '')) = 'explore'
      ),
      installment_agg AS (
        SELECT
          s.subscription_id,
          s.user_id,
          COALESCE(s.billing_duration_months, 12) AS expected_installments,
          COUNT(i.invoice_id)::int AS generated_installments,
          COUNT(i.invoice_id) FILTER (WHERE LOWER(COALESCE(i.status, '')) = 'paid')::int AS paid_installments,
          COALESCE(SUM(i.amount) FILTER (WHERE LOWER(COALESCE(i.status, '')) = 'paid'), 0)::numeric(12,2) AS settled_amount,
          MAX(i.created_at) FILTER (WHERE LOWER(COALESCE(i.status, '')) = 'paid') AS settled_at
        FROM subscriptionscheduletbl s
        LEFT JOIN invoicetbl i ON i.subscription_id = s.subscription_id
        GROUP BY s.subscription_id, s.user_id, s.billing_duration_months
      )
      SELECT
        CONCAT('EXP-', ep.invoice_id) AS transaction_id,
        bu.user_id,
        bu.user_name,
        bu.email,
        'full_payment_paid' AS settlement_type,
        ep.amount::numeric(12,2) AS amount,
        1 AS paid_installments,
        1 AS expected_installments,
        ep.created_at AS settled_at,
        CONCAT('Full payment settled via invoice ', COALESCE(ep.invoice_number, CONCAT('INV-', ep.invoice_id))) AS description
      FROM base_users bu
      INNER JOIN explore_paid ep ON ep.user_id = bu.user_id

      UNION ALL

      SELECT
        CONCAT('INS-', ia.subscription_id) AS transaction_id,
        bu.user_id,
        bu.user_name,
        bu.email,
        'installment_fully_paid' AS settlement_type,
        ia.settled_amount AS amount,
        ia.paid_installments,
        ia.expected_installments,
        ia.settled_at,
        CONCAT('Installment plan fully settled (', ia.paid_installments, '/', ia.expected_installments, ' invoices paid)') AS description
      FROM base_users bu
      INNER JOIN installment_agg ia ON ia.user_id = bu.user_id
      WHERE ia.generated_installments >= ia.expected_installments
        AND ia.paid_installments >= ia.expected_installments

      ORDER BY settled_at DESC NULLS LAST
    `;

    const result = await query(sqlQuery, params);

    res.status(200).json({
      success: true,
      data: {
        transactions: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching settled transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching settled transactions',
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
