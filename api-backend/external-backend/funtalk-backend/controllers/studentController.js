import { query } from '../config/database.js';

/**
 * @desc    Get all students for current school
 * @route   GET /api/students
 * @access  Private (School/Admin/Superadmin)
 */
export const getStudents = async (req, res) => {
  try {
    const { schoolId } = req.query;
    const userId = schoolId || req.user.userId;

    let sqlQuery = `
      SELECT 
        student_id,
        school_id,
        student_name,
        student_age,
        student_level,
        student_email,
        student_phone,
        parent_name,
        parent_contact,
        notes,
        is_active,
        created_at,
        updated_at
      FROM studentprofilestbl
      WHERE school_id = $1
    `;

    const params = [userId];

    // For admin/superadmin, they can filter by schoolId
    // For school users, they can only see their own students
    if (req.user.userType === 'school' && schoolId && parseInt(schoolId) !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own students.',
      });
    }

    sqlQuery += ` ORDER BY created_at DESC`;

    const result = await query(sqlQuery, params);

    res.status(200).json({
      success: true,
      data: {
        students: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching students',
      error: error.message,
    });
  }
};

/**
 * @desc    Get student by ID
 * @route   GET /api/students/:id
 * @access  Private (School)
 */
export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const sqlQuery = `
      SELECT 
        student_id,
        school_id,
        student_name,
        student_age,
        student_level,
        student_email,
        student_phone,
        parent_name,
        parent_contact,
        notes,
        is_active,
        created_at,
        updated_at
      FROM studentprofilestbl
      WHERE student_id = $1 AND school_id = $2
    `;

    const result = await query(sqlQuery, [id, req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        student: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student',
      error: error.message,
    });
  }
};

/**
 * @desc    Create student profile
 * @route   POST /api/students
 * @access  Private (School)
 */
export const createStudent = async (req, res) => {
  try {
    const {
      studentName,
      studentAge,
      studentLevel,
      studentEmail,
      studentPhone,
      parentName,
      parentContact,
      notes,
    } = req.body;

    const sqlQuery = `
      INSERT INTO studentprofilestbl (
        school_id,
        student_name,
        student_age,
        student_level,
        student_email,
        student_phone,
        parent_name,
        parent_contact,
        notes,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      req.user.userId,
      studentName,
      studentAge || null,
      studentLevel || null,
      studentEmail || null,
      studentPhone || null,
      parentName || null,
      parentContact || null,
      notes || null,
      true, // is_active defaults to true
    ];

    const result = await query(sqlQuery, values);

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: {
        student: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating student',
      error: error.message,
    });
  }
};

/**
 * @desc    Update student profile
 * @route   PUT /api/students/:id
 * @access  Private (School)
 */
export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      studentName,
      studentAge,
      studentLevel,
      studentEmail,
      studentPhone,
      parentName,
      parentContact,
      notes,
      isActive,
    } = req.body;

    // Check if student exists and belongs to the school
    const checkQuery = await query(
      'SELECT student_id FROM studentprofilestbl WHERE student_id = $1 AND school_id = $2',
      [id, req.user.userId]
    );

    if (checkQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (studentName !== undefined) {
      updates.push(`student_name = $${paramIndex}`);
      values.push(studentName);
      paramIndex++;
    }

    if (studentAge !== undefined) {
      updates.push(`student_age = $${paramIndex}`);
      values.push(studentAge || null);
      paramIndex++;
    }

    if (studentLevel !== undefined) {
      updates.push(`student_level = $${paramIndex}`);
      values.push(studentLevel || null);
      paramIndex++;
    }

    if (studentEmail !== undefined) {
      updates.push(`student_email = $${paramIndex}`);
      values.push(studentEmail || null);
      paramIndex++;
    }

    if (studentPhone !== undefined) {
      updates.push(`student_phone = $${paramIndex}`);
      values.push(studentPhone || null);
      paramIndex++;
    }

    if (parentName !== undefined) {
      updates.push(`parent_name = $${paramIndex}`);
      values.push(parentName || null);
      paramIndex++;
    }

    if (parentContact !== undefined) {
      updates.push(`parent_contact = $${paramIndex}`);
      values.push(parentContact || null);
      paramIndex++;
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      values.push(notes || null);
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

    // Add updated_at timestamp
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);
    const updateQuery = `
      UPDATE studentprofilestbl
      SET ${updates.join(', ')}
      WHERE student_id = $${paramIndex} AND school_id = $${paramIndex + 1}
      RETURNING *
    `;

    values.push(req.user.userId);
    const result = await query(updateQuery, values);

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: {
        student: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating student',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete student profile (soft delete)
 * @route   DELETE /api/students/:id
 * @access  Private (School)
 */
export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if student exists and belongs to the school
    const checkQuery = await query(
      'SELECT student_id FROM studentprofilestbl WHERE student_id = $1 AND school_id = $2',
      [id, req.user.userId]
    );

    if (checkQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Soft delete by setting is_active = false
    const result = await query(
      `UPDATE studentprofilestbl 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP 
       WHERE student_id = $1 AND school_id = $2 
       RETURNING *`,
      [id, req.user.userId]
    );

    res.status(200).json({
      success: true,
      message: 'Student deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting student',
      error: error.message,
    });
  }
};

/**
 * @desc    Get student appointments
 * @route   GET /api/students/:id/appointments
 * @access  Private (School)
 */
export const getStudentAppointments = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if student exists and belongs to the school
    const studentCheck = await query(
      'SELECT student_id FROM studentprofilestbl WHERE student_id = $1 AND school_id = $2',
      [id, req.user.userId]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    const sqlQuery = `
      SELECT 
        a.appointment_id,
        a.appointment_date,
        a.appointment_time,
        a.class_type,
        a.status,
        a.student_name,
        a.student_level,
        a.additional_notes,
        a.created_at,
        t.fullname as teacher_name,
        t.email as teacher_email,
        m.material_name,
        ah.teacher_feedback
      FROM appointmenttbl a
      LEFT JOIN teachertbl t ON a.teacher_id = t.teacher_id
      LEFT JOIN materialtbl m ON a.material_id = m.material_id
      LEFT JOIN appointmenthistorytbl ah ON a.appointment_id = ah.appointment_id
      WHERE a.student_id = $1
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `;

    const result = await query(sqlQuery, [id]);

    res.status(200).json({
      success: true,
      data: {
        appointments: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching student appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student appointments',
      error: error.message,
    });
  }
};
