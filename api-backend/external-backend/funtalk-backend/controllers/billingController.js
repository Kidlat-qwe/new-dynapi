import { query, getClient } from '../config/database.js';

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
        i.invoice_number,
        i.description,
        i.due_date,
        i.amount,
        i.status,
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

export const getBillingRecords = async (req, res) => {
  res.json({ message: 'Get billing records endpoint - to be implemented' });
};

export const createBilling = async (req, res) => {
  res.json({ message: 'Create billing endpoint - to be implemented' });
};

export const getBillingById = async (req, res) => {
  res.json({ message: 'Get billing by ID endpoint - to be implemented' });
};

export const recordPayment = async (req, res) => {
  res.json({ message: 'Record payment endpoint - to be implemented' });
};

export const approvePayment = async (req, res) => {
  res.json({ message: 'Approve payment endpoint - to be implemented' });
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

    // Generate unique invoice number
    const timestamp = Date.now();
    const invoiceNumber = `INV-${timestamp}-${billing.billing_id}`;

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
      invoiceNumber,
      description || null,
      dueDate || null,
      billing.amount || 0,
      'pending',
    ];

    const invoiceResult = await query(invoiceQuery, invoiceValues);

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
    const { packageName, packageType, creditsValue, price, isActive } = req.body;
    
    const sqlQuery = `
      INSERT INTO packagetbl (
        package_name, package_type, credits_value, price, is_active
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const values = [
      packageName,
      packageType || null,
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
    const { packageName, packageType, creditsValue, price, isActive } = req.body;
    
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
    
    if (packageType !== undefined) {
      updates.push(`package_type = $${paramIndex}`);
      values.push(packageType || null);
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

