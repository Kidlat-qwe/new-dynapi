import { query } from '../config/database.js';

/**
 * Get all users with optional filtering
 * Includes billing type from the latest billing record
 */
export const getUsers = async (req, res) => {
  try {
    const { userType, status } = req.query;
    
    // Build the query with optional filters
    let sqlQuery = `
      SELECT 
        u.user_id,
        u.email,
        u.name,
        u.user_type,
        u.phone_number,
        u.status,
        u.created_at,
        u.last_login,
        COALESCE(u.billing_type, '-') as billing_type
      FROM userstbl u
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    // Add filters
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
    
    // Order by created_at descending (newest first)
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
  res.json({ message: 'Get user by ID endpoint - to be implemented' });
};

export const updateUser = async (req, res) => {
  res.json({ message: 'Update user endpoint - to be implemented' });
};

export const updateUserStatus = async (req, res) => {
  res.json({ message: 'Update user status endpoint - to be implemented' });
};

export const deleteUser = async (req, res) => {
  res.json({ message: 'Delete user endpoint - to be implemented' });
};

