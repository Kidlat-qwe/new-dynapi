import { query } from '../config/database.js';

/**
 * @desc    Get teacher's availability schedule
 * @route   GET /api/availability/teacher/:teacherId
 * @access  Public
 */
export const getTeacherAvailability = async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    const sqlQuery = `
      SELECT 
        availability_id,
        teacher_id,
        day_of_week,
        start_time,
        end_time,
        is_active,
        created_at,
        updated_at
      FROM teacheravailabilitytbl
      WHERE teacher_id = $1
      ORDER BY day_of_week, start_time
    `;
    
    const result = await query(sqlQuery, [teacherId]);
    
    res.status(200).json({
      success: true,
      data: {
        availability: result.rows,
        count: result.rows.length,
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
 * @desc    Get available time slots for a teacher on a specific date
 * @route   GET /api/availability/teacher/:teacherId/available-slots
 * @access  Public
 */
export const getAvailableSlots = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required',
      });
    }
    
    // Get day of week (0 = Sunday, 6 = Saturday)
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    
    // Get teacher's availability for this day
    const availabilityQuery = `
      SELECT start_time, end_time
      FROM teacheravailabilitytbl
      WHERE teacher_id = $1 AND day_of_week = $2 AND is_active = true
    `;
    
    const availabilityResult = await query(availabilityQuery, [teacherId, dayOfWeek]);
    
    // Get exceptions (blocked times) for this date
    const exceptionQuery = `
      SELECT start_time, end_time
      FROM teacheravailabilityexceptionstbl
      WHERE teacher_id = $1 AND exception_date = $2 AND is_blocked = true
    `;
    
    const exceptionResult = await query(exceptionQuery, [teacherId, date]);
    
    // Get existing appointments for this date
    const appointmentQuery = `
      SELECT appointment_time
      FROM appointmenttbl
      WHERE teacher_id = $1 AND appointment_date = $2 
      AND status NOT IN ('cancelled', 'no_show')
    `;
    
    const appointmentResult = await query(appointmentQuery, [teacherId, date]);
    
    res.status(200).json({
      success: true,
      data: {
        availability: availabilityResult.rows,
        exceptions: exceptionResult.rows,
        bookedSlots: appointmentResult.rows.map(apt => apt.appointment_time),
      },
    });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available slots',
      error: error.message,
    });
  }
};

/**
 * @desc    Set teacher availability schedule (Teacher only)
 * @route   POST /api/availability
 * @access  Private (Teacher)
 */
export const setAvailability = async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime, isActive } = req.body;
    const teacherId = req.user.userId;
    
    const sqlQuery = `
      INSERT INTO teacheravailabilitytbl (teacher_id, day_of_week, start_time, end_time, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const values = [
      teacherId,
      dayOfWeek,
      startTime,
      endTime,
      isActive !== undefined ? isActive : true,
    ];
    
    const result = await query(sqlQuery, values);
    
    res.status(201).json({
      success: true,
      message: 'Availability set successfully',
      data: {
        availability: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error setting availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting availability',
      error: error.message,
    });
  }
};

/**
 * @desc    Update availability schedule
 * @route   PUT /api/availability/:id
 * @access  Private (Teacher)
 */
export const updateAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, isActive } = req.body;
    const teacherId = req.user.userId;
    
    // Check if availability exists and belongs to this teacher
    const checkQuery = await query(
      'SELECT availability_id FROM teacheravailabilitytbl WHERE availability_id = $1 AND teacher_id = $2',
      [id, teacherId]
    );
    
    if (checkQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Availability not found or access denied',
      });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (startTime !== undefined) {
      updates.push(`start_time = $${paramIndex}`);
      values.push(startTime);
      paramIndex++;
    }
    
    if (endTime !== undefined) {
      updates.push(`end_time = $${paramIndex}`);
      values.push(endTime);
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
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const updateQuery = `
      UPDATE teacheravailabilitytbl
      SET ${updates.join(', ')}
      WHERE availability_id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await query(updateQuery, values);
    
    res.status(200).json({
      success: true,
      message: 'Availability updated successfully',
      data: {
        availability: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating availability',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete availability schedule
 * @route   DELETE /api/availability/:id
 * @access  Private (Teacher)
 */
export const deleteAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.userId;
    
    // Check if availability exists and belongs to this teacher
    const checkQuery = await query(
      'SELECT availability_id FROM teacheravailabilitytbl WHERE availability_id = $1 AND teacher_id = $2',
      [id, teacherId]
    );
    
    if (checkQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Availability not found or access denied',
      });
    }
    
    const result = await query(
      'DELETE FROM teacheravailabilitytbl WHERE availability_id = $1 RETURNING *',
      [id]
    );
    
    res.status(200).json({
      success: true,
      message: 'Availability deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting availability',
      error: error.message,
    });
  }
};

/**
 * @desc    Add availability exception (blocked date/holiday)
 * @route   POST /api/availability/exceptions
 * @access  Private (Teacher)
 */
export const addException = async (req, res) => {
  try {
    const { exceptionDate, startTime, endTime, reason, isBlocked } = req.body;
    const teacherId = req.user.userId;
    
    const sqlQuery = `
      INSERT INTO teacheravailabilityexceptionstbl (
        teacher_id, exception_date, start_time, end_time, reason, is_blocked
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      teacherId,
      exceptionDate,
      startTime || null,
      endTime || null,
      reason || null,
      isBlocked !== undefined ? isBlocked : true,
    ];
    
    const result = await query(sqlQuery, values);
    
    res.status(201).json({
      success: true,
      message: 'Exception added successfully',
      data: {
        exception: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error adding exception:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding exception',
      error: error.message,
    });
  }
};

/**
 * @desc    Get teacher's exceptions
 * @route   GET /api/availability/teacher/:teacherId/exceptions
 * @access  Private (Teacher)
 */
export const getTeacherExceptions = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const authenticatedTeacherId = req.user.userId;
    
    // Ensure teacher can only view their own exceptions
    if (parseInt(teacherId) !== authenticatedTeacherId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own exceptions.',
      });
    }
    
    const sqlQuery = `
      SELECT 
        exception_id,
        teacher_id,
        exception_date,
        start_time,
        end_time,
        reason,
        is_blocked,
        created_at
      FROM teacheravailabilityexceptionstbl
      WHERE teacher_id = $1
      ORDER BY exception_date DESC
    `;
    
    const result = await query(sqlQuery, [teacherId]);
    
    res.status(200).json({
      success: true,
      data: {
        exceptions: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching teacher exceptions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching teacher exceptions',
      error: error.message,
    });
  }
};

/**
 * @desc    Remove availability exception
 * @route   DELETE /api/availability/exceptions/:id
 * @access  Private (Teacher)
 */
export const deleteException = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.userId;
    
    // Check if exception exists and belongs to this teacher
    const checkQuery = await query(
      'SELECT exception_id FROM teacheravailabilityexceptionstbl WHERE exception_id = $1 AND teacher_id = $2',
      [id, teacherId]
    );
    
    if (checkQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exception not found or access denied',
      });
    }
    
    await query(
      'DELETE FROM teacheravailabilityexceptionstbl WHERE exception_id = $1',
      [id]
    );
    
    res.status(200).json({
      success: true,
      message: 'Exception removed successfully',
    });
  } catch (error) {
    console.error('Error deleting exception:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting exception',
      error: error.message,
    });
  }
};
