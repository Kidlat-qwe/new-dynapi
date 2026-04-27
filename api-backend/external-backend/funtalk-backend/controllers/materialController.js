import { query } from '../config/database.js';
import { getFileUrl } from '../middleware/upload.js';
import {
  isS3Configured,
  uploadMaterialFileToS3,
  removeMaterialFileFromStorage,
} from '../services/s3Materials.js';
import fs from 'fs';
import { notifyMaterialUploaded } from '../services/notificationDispatchService.js';

/**
 * @desc    Get all materials
 * @route   GET /api/materials
 * @access  Public (or Private)
 */
export const getMaterials = async (req, res) => {
  try {
    const { materialType, search } = req.query;
    const isOwnerScopedRole = req.user?.userType === 'teacher' || req.user?.userType === 'school';
    
    let sqlQuery = `
      SELECT 
        material_id,
        material_name,
        material_type,
        file_url,
        created_at,
        created_by_user_id
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

    if (isOwnerScopedRole) {
      sqlQuery += ` AND created_by_user_id = $${paramIndex}`;
      params.push(req.user.userId);
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
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Material name is required',
      });
    }
    if (!materialType || !String(materialType).trim()) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Material type is required',
      });
    }
    
    const userType = req.user?.userType || 'teacher';

    // Determine file URL: use uploaded file if available, otherwise use provided URL
    let finalFileUrl = null;
    if (req.file) {
      if (isS3Configured()) {
        try {
          finalFileUrl = await uploadMaterialFileToS3({
            localPath: req.file.path,
            userType,
            contentType: req.file.mimetype,
          });
        } finally {
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        }
      } else {
        finalFileUrl = getFileUrl(req.file.filename);
      }
    } else if (fileUrl && fileUrl.trim()) {
      // URL was provided instead
      finalFileUrl = fileUrl.trim();
    }
    
    const sqlQuery = `
      INSERT INTO materialtbl (material_name, material_type, file_url, created_by_user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      materialName,
      materialType || null,
      finalFileUrl || null,
      req.user?.userId || null,
    ];
    
    const result = await query(sqlQuery, values);
    await notifyMaterialUploaded({
      userId: req.user?.userId,
      userType,
      materialId: result.rows[0]?.material_id,
      materialName,
    });
    
    res.status(201).json({
      success: true,
      message: 'Material created successfully',
      data: {
        material: result.rows[0],
      },
    });
  } catch (error) {
    // If there's an error and a file was uploaded, clean it up
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
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
      'SELECT material_id, file_url, created_by_user_id FROM materialtbl WHERE material_id = $1',
      [id]
    );
    
    if (materialCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Material not found',
      });
    }
    
    const oldFileUrl = materialCheck.rows[0].file_url;
    const createdByUserId = materialCheck.rows[0].created_by_user_id;
    if (
      (req.user?.userType === 'teacher' || req.user?.userType === 'school') &&
      Number(createdByUserId) !== Number(req.user.userId)
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own materials.',
      });
    }
    const userType = req.user?.userType || 'admin';

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
      if (!String(materialType).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Material type is required',
        });
      }
      updates.push(`material_type = $${paramIndex}`);
      values.push(String(materialType).trim());
      paramIndex++;
    }
    
    // Handle file URL update
    if (req.file) {
      if (isS3Configured()) {
        try {
          newFileUrl = await uploadMaterialFileToS3({
            localPath: req.file.path,
            userType,
            contentType: req.file.mimetype,
          });
        } finally {
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        }
      } else {
        newFileUrl = getFileUrl(req.file.filename);
      }
      updates.push(`file_url = $${paramIndex}`);
      values.push(newFileUrl);
      paramIndex++;

      if (oldFileUrl && oldFileUrl !== newFileUrl) {
        await removeMaterialFileFromStorage(oldFileUrl);
      }
    } else if (fileUrl !== undefined) {
      // URL was provided (or cleared)
      newFileUrl = fileUrl && fileUrl.trim() ? fileUrl.trim() : null;
      updates.push(`file_url = $${paramIndex}`);
      values.push(newFileUrl);
      paramIndex++;

      if (oldFileUrl && oldFileUrl !== newFileUrl) {
        await removeMaterialFileFromStorage(oldFileUrl);
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
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
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

    const existing = await query(
      'SELECT material_id, file_url, created_by_user_id FROM materialtbl WHERE material_id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Material not found',
      });
    }

    if (
      (req.user?.userType === 'teacher' || req.user?.userType === 'school') &&
      Number(existing.rows[0].created_by_user_id) !== Number(req.user.userId)
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own materials.',
      });
    }

    const fileUrl = existing.rows[0].file_url;
    try {
      await removeMaterialFileFromStorage(fileUrl);
    } catch (storageErr) {
      console.error('Storage cleanup failed (file may remain on disk/S3):', storageErr);
    }

    await query('DELETE FROM materialtbl WHERE material_id = $1', [id]);

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
