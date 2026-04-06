import db from '../config/database.js';

/**
 * @desc    Get all teachers with optional filters
 * @route   GET /api/teachers
 * @access  Public
 */
export const getTeachers = async (req, res) => {
  try {
    const { status, gender, search } = req.query;
    
    let query = `
      SELECT 
        t.teacher_id,
        t.fullname,
        t.email,
        t.gender,
        t.description,
        t.profile_picture,
        t.audio_intro,
        t.video_intro,
        t.docs,
        t.status,
        t.created_at,
        u.name as user_name,
        u.phone_number,
        u.status as user_status
      FROM teachertbl t
      LEFT JOIN userstbl u ON t.teacher_id = u.user_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Apply filters
    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (gender) {
      query += ` AND t.gender = $${paramIndex}`;
      params.push(gender);
      paramIndex++;
    }
    
    if (search) {
      query += ` AND (t.fullname ILIKE $${paramIndex} OR t.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY t.created_at DESC`;
    
    const result = await db.query(query, params);
    
    res.status(200).json({
      success: true,
      data: {
        teachers: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching teachers',
      error: error.message,
    });
  }
};

/**
 * @desc    Get teacher by ID
 * @route   GET /api/teachers/:id
 * @access  Public
 */
export const getTeacherById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        t.*,
        u.name as user_name,
        u.phone_number,
        u.user_type,
        u.status as user_status
      FROM teachertbl t
      LEFT JOIN userstbl u ON t.teacher_id = u.user_id
      WHERE t.teacher_id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        teacher: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error fetching teacher:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching teacher',
      error: error.message,
    });
  }
};

/**
 * @desc    Create new teacher profile
 * @route   POST /api/teachers
 * @access  Private (Admin/Superadmin)
 */
export const createTeacher = async (req, res) => {
  try {
    const {
      userId,
      fullname,
      email,
      gender,
      description,
      profilePicture,
      audioIntro,
      videoIntro,
      docs,
    } = req.body;
    
    // Check if user exists and is of type 'teacher'
    const userCheck = await db.query(
      'SELECT user_id, user_type FROM userstbl WHERE user_id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    if (userCheck.rows[0].user_type !== 'teacher') {
      return res.status(400).json({
        success: false,
        message: 'User must be of type "teacher"',
      });
    }
    
    // Check if teacher profile already exists
    const existingTeacher = await db.query(
      'SELECT teacher_id FROM teachertbl WHERE teacher_id = $1',
      [userId]
    );
    
    if (existingTeacher.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Teacher profile already exists for this user',
      });
    }
    
    const query = `
      INSERT INTO teachertbl (
        teacher_id, fullname, email, gender, description,
        profile_picture, audio_intro, video_intro, docs, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const values = [
      userId,
      fullname,
      email,
      gender || null,
      description || null,
      profilePicture || null,
      audioIntro || null,
      videoIntro || null,
      docs || null,
      'pending', // Default status
    ];
    
    const result = await db.query(query, values);
    
    res.status(201).json({
      success: true,
      message: 'Teacher profile created successfully',
      data: {
        teacher: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error creating teacher:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating teacher profile',
      error: error.message,
    });
  }
};

/**
 * @desc    Update teacher profile
 * @route   PUT /api/teachers/:id
 * @access  Private (Teacher/Admin)
 */
export const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullname,
      gender,
      description,
      profilePicture,
      audioIntro,
      videoIntro,
      docs,
    } = req.body;
    
    // Check if teacher exists
    const teacherCheck = await db.query(
      'SELECT teacher_id FROM teachertbl WHERE teacher_id = $1',
      [id]
    );
    
    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found',
      });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (fullname !== undefined) {
      updates.push(`fullname = $${paramIndex}`);
      values.push(fullname);
      paramIndex++;
    }
    
    if (gender !== undefined) {
      updates.push(`gender = $${paramIndex}`);
      values.push(gender);
      paramIndex++;
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }
    
    if (profilePicture !== undefined) {
      updates.push(`profile_picture = $${paramIndex}`);
      values.push(profilePicture);
      paramIndex++;
    }
    
    if (audioIntro !== undefined) {
      updates.push(`audio_intro = $${paramIndex}`);
      values.push(audioIntro);
      paramIndex++;
    }
    
    if (videoIntro !== undefined) {
      updates.push(`video_intro = $${paramIndex}`);
      values.push(videoIntro);
      paramIndex++;
    }
    
    if (docs !== undefined) {
      updates.push(`docs = $${paramIndex}`);
      values.push(docs);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }
    
    values.push(id);
    const query = `
      UPDATE teachertbl
      SET ${updates.join(', ')}
      WHERE teacher_id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await db.query(query, values);
    
    res.status(200).json({
      success: true,
      message: 'Teacher profile updated successfully',
      data: {
        teacher: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error updating teacher:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating teacher profile',
      error: error.message,
    });
  }
};

/**
 * @desc    Update teacher status
 * @route   PUT /api/teachers/:id/status
 * @access  Private (Admin/Superadmin)
 */
export const updateTeacherStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const query = `
      UPDATE teachertbl
      SET status = $1
      WHERE teacher_id = $2
      RETURNING *
    `;
    
    const result = await db.query(query, [status, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Teacher status updated successfully',
      data: {
        teacher: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error updating teacher status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating teacher status',
      error: error.message,
    });
  }
};

/**
 * @desc    Get teacher availability schedule
 * @route   GET /api/teachers/:id/availability
 * @access  Public
 */
export const getTeacherAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT *
      FROM teacheravailabilitytbl
      WHERE teacher_id = $1 AND is_active = true
      ORDER BY day_of_week, start_time
    `;
    
    const result = await db.query(query, [id]);
    
    res.status(200).json({
      success: true,
      data: {
        availability: result.rows,
      },
    });
  } catch (error) {
    console.error('Error fetching teacher availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching teacher availability',
      error: error.message,
    });
  }
};

/**
 * @desc    Get teacher's appointments
 * @route   GET /api/teachers/:id/appointments
 * @access  Private
 */
export const getTeacherAppointments = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        a.*,
        u.name as school_name,
        u.email as school_email
      FROM appointmenttbl a
      LEFT JOIN userstbl u ON a.user_id = u.user_id
      WHERE a.teacher_id = $1
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `;
    
    const result = await db.query(query, [id]);
    
    res.status(200).json({
      success: true,
      data: {
        appointments: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching teacher appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching teacher appointments',
      error: error.message,
    });
  }
};

