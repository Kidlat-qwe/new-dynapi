import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { uploadMaterial } from '../middleware/upload.js';
import * as materialController from '../controllers/materialController.js';

const router = express.Router();

/**
 * @route   GET /api/materials
 * @desc    Get all teaching materials
 * @access  Private (Admin/Superadmin/Teacher/School)
 */
router.get('/', authenticate, materialController.getMaterials);

/**
 * @route   GET /api/materials/:id
 * @desc    Get material by ID
 * @access  Public
 */
router.get('/:id', materialController.getMaterialById);

/**
 * @route   POST /api/materials
 * @desc    Create teaching material (Admin/Teacher/School)
 * @access  Private (Admin/Superadmin/Teacher/School)
 */
router.post(
  '/',
  authenticate,
  (req, res, next) => {
    // Allow admin/superadmin, teacher, or school
    if (
      req.user.userType === 'superadmin' ||
      req.user.userType === 'admin' ||
      req.user.userType === 'teacher' ||
      req.user.userType === 'school'
    ) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin, Teacher, or School role required.',
    });
  },
  (req, res, next) => {
    uploadMaterial.single('file')(req, res, (err) => {
      if (err) {
        // Handle multer errors (file too large, invalid file type, etc.)
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error',
        });
      }
      next();
    });
  },
  // Validation - note: body() won't work with multipart/form-data, so we validate in controller
  materialController.createMaterial
);

/**
 * @route   PUT /api/materials/:id
 * @desc    Update teaching material (Admin/Superadmin/Teacher own/School own)
 * @access  Private (Admin/Superadmin/Teacher own/School own)
 */
router.put(
  '/:id',
  authenticate,
  (req, res, next) => {
    if (
      req.user.userType === 'superadmin' ||
      req.user.userType === 'admin' ||
      req.user.userType === 'teacher' ||
      req.user.userType === 'school'
    ) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin, Teacher, or School role required.',
    });
  },
  (req, res, next) => {
    uploadMaterial.single('file')(req, res, (err) => {
      if (err) {
        // Handle multer errors (file too large, invalid file type, etc.)
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error',
        });
      }
      next();
    });
  },
  // Validation - note: body() won't work with multipart/form-data, so we validate in controller
  materialController.updateMaterial
);

/**
 * @route   DELETE /api/materials/:id
 * @desc    Delete teaching material (Admin/Superadmin/Teacher own/School own)
 * @access  Private (Admin/Superadmin/Teacher own/School own)
 */
router.delete(
  '/:id',
  authenticate,
  (req, res, next) => {
    if (
      req.user.userType === 'superadmin' ||
      req.user.userType === 'admin' ||
      req.user.userType === 'teacher' ||
      req.user.userType === 'school'
    ) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin, Teacher, or School role required.',
    });
  },
  materialController.deleteMaterial
);

export default router;

