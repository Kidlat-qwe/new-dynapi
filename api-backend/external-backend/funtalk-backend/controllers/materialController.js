import { query } from '../config/database.js';
import { getFileUrl } from '../middleware/upload.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @desc    Get all materials
 * @route   GET /api/materials
 * @access  Public (or Private)
 */
export const getMaterials = async (req, res) => {
  try {
    const { materialType, search } = req.query;
    
    let sqlQuery = `
      SELECT 
        material_id,
        material_name,
        material_type,
        file_url,
        created_at
      FROM materialtbl
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Apply filters
    if (materialType) {
      sqlQuery += ` AND material_type = $${paramIndex}`;
      params.push(materialType);
      paramIndex++;
    }
    
    if (search) {
      sqlQuery += ` AND material_name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    sqlQuery += ` ORDER BY created_at DESC`;
    
    const result = await query(sqlQuery, params);
    
    res.status(200).json({
      success: true,
      data: {
        materials: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching materials',
      error: error.message,
    });
  }
};

/**
 * @desc    Get material by ID
 * @route   GET /api/materials/:id
 * @access  Public
 */
export const getMaterialById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const sqlQuery = `
      SELECT 
        material_id,
        material_name,
        material_type,
        file_url,
        created_at
      FROM materialtbl
      WHERE material_id = $1
    `;
    
    const result = await query(sqlQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Material not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        material: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error fetching material:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching material',
      error: error.message,
    });
  }
};

/**
 * @desc    Create new material
 * @route   POST /api/materials
 * @access  Private (Admin/Superadmin)
 */
export const createMaterial = async (req, res) => {
  try {
    // Extract form data (works with both JSON and multipart/form-data)
    const materialName = req.body.materialName || req.body['materialName'];
    const materialType = req.body.materialType || req.body['materialType'];
    const fileUrl = req.body.fileUrl || req.body['fileUrl'];
    
    // Manual validation (since express-validator doesn't work well with multipart/form-data)
    if (!materialName || !materialName.trim()) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', 'materials', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(400).json({
        success: false,
        message: 'Material name is required',
      });
    }
    
    // Determine file URL: use uploaded file if available, otherwise use provided URL
    let finalFileUrl = null;
    if (req.file) {
      // File was uploaded - use the uploaded file path
      finalFileUrl = getFileUrl(req.file.filename);
    } else if (fileUrl && fileUrl.trim()) {
      // URL was provided instead
      finalFileUrl = fileUrl.trim();
    }
    
    const sqlQuery = `
      INSERT INTO materialtbl (material_name, material_type, file_url)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const values = [
      materialName,
      materialType || null,
      finalFileUrl || null,
    ];
    
    const result = await query(sqlQuery, values);
    
    res.status(201).json({
      success: true,
      message: 'Material created successfully',
      data: {
        material: result.rows[0],
      },
    });
  } catch (error) {
    // If there's an error and a file was uploaded, clean it up
    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', 'materials', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    console.error('Error creating material:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating material',
      error: error.message,
    });
  }
};

/**
 * @desc    Update material
 * @route   PUT /api/materials/:id
 * @access  Private (Admin/Superadmin)
 */
export const updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { materialName, materialType, fileUrl } = req.body;
    
    // Check if material exists and get current file_url
    const materialCheck = await query(
      'SELECT material_id, file_url FROM materialtbl WHERE material_id = $1',
      [id]
    );
    
    if (materialCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Material not found',
      });
    }
    
    const oldFileUrl = materialCheck.rows[0].file_url;
    let oldFileName = null;
    
    // Extract old filename if it's an uploaded file (starts with /uploads/materials/)
    if (oldFileUrl && oldFileUrl.startsWith('/uploads/materials/')) {
      oldFileName = path.basename(oldFileUrl);
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    let newFileUrl = null;
    
    if (materialName !== undefined) {
      updates.push(`material_name = $${paramIndex}`);
      values.push(materialName);
      paramIndex++;
    }
    
    if (materialType !== undefined) {
      updates.push(`material_type = $${paramIndex}`);
      values.push(materialType || null);
      paramIndex++;
    }
    
    // Handle file URL update
    if (req.file) {
      // New file was uploaded - use uploaded file path
      newFileUrl = getFileUrl(req.file.filename);
      updates.push(`file_url = $${paramIndex}`);
      values.push(newFileUrl);
      paramIndex++;
      
      // Delete old file if it was an uploaded file
      if (oldFileName) {
        const oldFilePath = path.join(__dirname, '..', 'uploads', 'materials', oldFileName);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    } else if (fileUrl !== undefined) {
      // URL was provided (or cleared)
      newFileUrl = fileUrl && fileUrl.trim() ? fileUrl.trim() : null;
      updates.push(`file_url = $${paramIndex}`);
      values.push(newFileUrl);
      paramIndex++;
      
      // If URL is being cleared and old file was uploaded, delete it
      if (!newFileUrl && oldFileName) {
        const oldFilePath = path.join(__dirname, '..', 'uploads', 'materials', oldFileName);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }
    
    values.push(id);
    const updateQuery = `
      UPDATE materialtbl
      SET ${updates.join(', ')}
      WHERE material_id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await query(updateQuery, values);
    
    res.status(200).json({
      success: true,
      message: 'Material updated successfully',
      data: {
        material: result.rows[0],
      },
    });
  } catch (error) {
    // If there's an error and a new file was uploaded, clean it up
    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', 'materials', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    console.error('Error updating material:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating material',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete material
 * @route   DELETE /api/materials/:id
 * @access  Private (Admin/Superadmin)
 */
export const deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM materialtbl WHERE material_id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Material not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Material deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting material:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting material',
      error: error.message,
    });
  }
};
