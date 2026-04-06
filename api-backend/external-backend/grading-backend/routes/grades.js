import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get student grades for rankings
router.get('/rankings', async (req, res) => {
  try {
    const { schoolYearId, quarter, classId } = req.query;
    
    let query = `
      SELECT 
        u.user_id as student_id,
        u.fname,
        u.mname,
        u.lname,
        c.grade_level,
        c.section,
        ROUND(AVG(sg.grade)::numeric, 2) as average_grade
      FROM users u
      JOIN class_student cs ON u.user_id = cs.student_id
      JOIN class c ON cs.class_id = c.class_id
      JOIN student_grade sg ON u.user_id = sg.student_id
      WHERE c.school_year_id = $1
      AND sg.quarter = $2
      AND c.grade_level != 'Kindergarten' -- Exclude Kindergarten classes which use character grades
    `;

    const queryParams = [schoolYearId, quarter];

    // Add class filter if specified
    if (classId && classId !== 'All Classes (Campus-wide)') {
      query += ` AND c.class_id = $3`;
      queryParams.push(classId);
    }

    // Group by student and order by average grade
    query += `
      GROUP BY 
        u.user_id,
        u.fname,
        u.mname,
        u.lname,
        c.grade_level,
        c.section
      ORDER BY average_grade DESC
    `;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching academic rankings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all student grades
router.get('/', async (req, res) => {
  try {
    const { schoolYearId, quarter, classId } = req.query;
    
    // Query to get student grades with subject info
    const query = `
            SELECT 
        sg.student_id,
        sg.subject_id,
        sg.grade,
        sg.char_grade,
        s.subject_name,
        c.grade_level
      FROM student_grade sg
      JOIN subject s ON sg.subject_id = s.subject_id
      JOIN class c ON sg.class_id = c.class_id
      WHERE sg.school_year_id = $1 
      AND sg.quarter = $2
      AND sg.class_id = $3
      ORDER BY sg.student_id, s.subject_name
    `;
    
    console.log('Executing query with params:', { schoolYearId, quarter, classId }); // Debug log
    
    const result = await pool.query(query, [schoolYearId, quarter, classId]);

    console.log(`Found ${result.rows.length} grade records`); // Debug log
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching student grades:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to build the ranking query
const buildRankingQuery = () => `
  WITH student_grades AS (
      SELECT 
      u.user_id as student_id,
      u.fname,
      u.mname,
      u.lname,
        c.grade_level,
        c.section,
      COUNT(DISTINCT cs2.subject_id) as total_subjects,
      COUNT(DISTINCT sg.subject_id) as graded_subjects,
      CASE 
        WHEN COUNT(DISTINCT cs2.subject_id) = COUNT(DISTINCT sg.subject_id) 
        THEN ROUND(AVG(sg.grade)::numeric, 2)
        ELSE NULL
      END as average_grade
    FROM users u
    JOIN class_student cs ON u.user_id = cs.student_id
        JOIN class c ON cs.class_id = c.class_id
    JOIN class_subject cs2 ON c.class_id = cs2.class_id
    LEFT JOIN student_grade sg ON u.user_id = sg.student_id 
      AND sg.subject_id = cs2.subject_id 
      AND sg.quarter = $2
    WHERE c.school_year_id = $1
    AND c.grade_level != 'Kindergarten' -- Exclude Kindergarten classes which use character grades
        GROUP BY 
      u.user_id,
      u.fname,
      u.mname,
      u.lname,
        c.grade_level,
          c.section
  )
  SELECT 
    student_id,
    fname,
    mname,
    lname,
    grade_level,
    section,
    CASE 
      WHEN average_grade IS NOT NULL 
      THEN RANK() OVER (ORDER BY average_grade DESC)
      ELSE NULL
    END as rank_number,
    CASE 
      WHEN average_grade IS NOT NULL THEN average_grade::text
      ELSE 'TBA'
    END as average_grade,
    total_subjects,
    graded_subjects
  FROM student_grades
        ORDER BY 
          average_grade DESC NULLS LAST,
    lname,
    fname;
`;

// Get existing grades
router.get('/check-existing', async (req, res) => {
  try {
    const { classId, subjectId, quarter } = req.query;
    
    // Validate parameters
    if (!classId || !subjectId || !quarter) {
      return res.status(400).json({ 
        error: 'Missing required parameters', 
        details: 'classId, subjectId, and quarter are required' 
      });
    }
    
    const query = `
      SELECT 
        sg.student_id,
        sg.grade,
        sg.char_grade
      FROM student_grade sg
      WHERE sg.class_id = $1 
      AND sg.subject_id = $2 
      AND sg.quarter = $3
    `;
    const result = await pool.query(query, [classId, subjectId, quarter]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error checking existing grades:', error);
    res.status(500).json({ error: 'Failed to check existing grades' });
  }
});

// Grade validation middleware
const validateGrade = (req, res, next) => {
  if (Array.isArray(req.body)) {
    const invalidGrades = req.body.filter(grade => {
      // Check for required fields
      if (!grade.student_id || 
          !grade.class_id || 
          !grade.subject_id || 
          !grade.teacher_id || 
          !grade.quarter) {
        return true;
      }
      // Check for either numeric grade OR character grade
      const hasNumericGrade = typeof grade.grade === 'number' && grade.grade >= 0 && grade.grade <= 100;
      // Allow A, B, C, D, E for Kindergarten
      const hasCharGrade = typeof grade.char_grade === 'string' && ['A', 'B', 'C', 'D', 'E'].includes(grade.char_grade);
      // Grade must have either a valid numeric grade or a valid character grade
      return !(hasNumericGrade || hasCharGrade);
    });
    if (invalidGrades.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid grade data', 
        details: 'Grades must either be numeric (0-100) or character-based (A, B, C, D, E) for Kindergarten'
      });
    }
  }
  next();
};

// Upload grades
router.post('/upload', validateGrade, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const gradesData = req.body;

    // Validate the incoming data structure
    if (!Array.isArray(gradesData)) {
      throw new Error('Invalid data format');
    }

    // Check if grades already exist for this class, subject, and quarter
    const checkQuery = `
      SELECT 1 FROM student_grade 
      WHERE class_id = $1 
      AND subject_id = $2 
      AND quarter = $3 
      AND school_year_id = $4
      LIMIT 1
    `;
    const checkResult = await client.query(checkQuery, [
      gradesData[0].class_id,
      gradesData[0].subject_id,
      gradesData[0].quarter,
      gradesData[0].school_year_id
    ]);

    if (checkResult.rows.length > 0) {
      // Update existing grades
      for (const grade of gradesData) {
        // Determine which query to use based on whether it's a char_grade or numeric grade
        let updateQuery;
        let updateParams;
        
        if (grade.char_grade !== undefined) {
          // For character grades (Kindergarten)
          updateQuery = `
            UPDATE student_grade 
            SET char_grade = $1, school_year_id = $2
            WHERE student_id = $3 
            AND class_id = $4 
            AND subject_id = $5 
            AND quarter = $6 
            AND school_year_id = $7
          `;
          updateParams = [
            grade.char_grade,
            grade.school_year_id,
            grade.student_id,
            grade.class_id,
            grade.subject_id,
            grade.quarter,
            grade.school_year_id
          ];
        } else {
          // For numeric grades (Grade 1+)
          updateQuery = `
            UPDATE student_grade 
            SET grade = $1, school_year_id = $2
            WHERE student_id = $3 
            AND class_id = $4 
            AND subject_id = $5 
            AND quarter = $6 
            AND school_year_id = $7
          `;
          updateParams = [
            grade.grade,
            grade.school_year_id,
            grade.student_id,
            grade.class_id,
            grade.subject_id,
            grade.quarter,
            grade.school_year_id
          ];
        }
        
        await client.query(updateQuery, updateParams);
      }
    } else {
      // Insert new grades
      for (const grade of gradesData) {
        // Determine which query to use based on whether it's a char_grade or numeric grade
        let insertQuery;
        let insertParams;
        
        if (grade.char_grade !== undefined) {
          // For character grades (Kindergarten)
          insertQuery = `
            INSERT INTO student_grade 
            (student_id, class_id, subject_id, teacher_id, quarter, char_grade, school_year_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `;
          insertParams = [
            grade.student_id,
            grade.class_id,
            grade.subject_id,
            grade.teacher_id,
            grade.quarter,
            grade.char_grade,
            grade.school_year_id
          ];
        } else {
          // For numeric grades (Grade 1+)
          insertQuery = `
            INSERT INTO student_grade 
            (student_id, class_id, subject_id, teacher_id, quarter, grade, school_year_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `;
          insertParams = [
            grade.student_id,
            grade.class_id,
            grade.subject_id,
            grade.teacher_id,
            grade.quarter,
            grade.grade,
            grade.school_year_id
          ];
        }
        
        await client.query(insertQuery, insertParams);
      }
    }

    await client.query('COMMIT');

    // --- MAPEH SYNC LOGIC START ---
    // For each affected student/class/quarter, sync the MAPEH parent grade
    const affected = new Set(gradesData.map(g => `${g.student_id}|${g.class_id}|${g.quarter}|${g.school_year_id}`));
    for (const key of affected) {
      const [student_id, class_id, quarter, school_year_id] = key.split('|');
      try {
        // 1. Find the MAPEH subject for this class/grade level
        const mapehParentRes = await client.query(
          `SELECT s.subject_id, s.grade_level FROM subject s
           WHERE s.subject_name = 'MAPEH' AND s.grade_level = (
             SELECT grade_level FROM class WHERE class_id = $1
           ) LIMIT 1`,
          [class_id]
        );
        if (mapehParentRes.rows.length === 0) continue; // No MAPEH for this class
        const mapehSubjectId = mapehParentRes.rows[0].subject_id;
        const gradeLevel = mapehParentRes.rows[0].grade_level;

        // 2. Get all components for this MAPEH subject
        const componentRes = await client.query(
          `SELECT subject_id, subject_name 
           FROM subject 
           WHERE parent_subject_id = $1 
           ORDER BY subject_name`,
          [mapehSubjectId]
        );

        if (componentRes.rows.length === 0) {
          console.log(`No components found for MAPEH (subject_id: ${mapehSubjectId})`);
          continue;
        }

        const componentIds = componentRes.rows.map(r => r.subject_id);
        console.log(`Found ${componentIds.length} components for MAPEH grade level ${gradeLevel}:`, 
          componentRes.rows.map(r => r.subject_name).join(', '));

        // 3. Get grades for all components
        const gradesRes = await client.query(
          `SELECT sg.grade, s.subject_name 
           FROM student_grade sg
           JOIN subject s ON sg.subject_id = s.subject_id
           WHERE sg.student_id = $1 
           AND sg.class_id = $2 
           AND sg.subject_id = ANY($3) 
           AND sg.quarter = $4 AND sg.school_year_id = $5`,
          [student_id, class_id, componentIds, quarter, school_year_id]
        );

        // Check if all components have grades
        if (gradesRes.rows.length !== componentIds.length) {
          console.log(`Missing grades for some components. Found ${gradesRes.rows.length} grades out of ${componentIds.length} components`);
          await client.query(
            'DELETE FROM student_grade WHERE student_id = $1 AND class_id = $2 AND subject_id = $3 AND quarter = $4 AND school_year_id = $5',
            [student_id, class_id, mapehSubjectId, quarter, school_year_id]
          );
          // Also delete any incomplete quarterly GWA record
          await client.query(
            'DELETE FROM student_quarterly_gwa WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3 AND quarter = $4',
            [student_id, class_id, school_year_id, quarter]
          );
          continue;
        }

        // Check for null grades
        if (gradesRes.rows.some(r => r.grade === null)) {
          console.log('Some components have null grades');
          await client.query(
            'DELETE FROM student_grade WHERE student_id = $1 AND class_id = $2 AND subject_id = $3 AND quarter = $4 AND school_year_id = $5',
            [student_id, class_id, mapehSubjectId, quarter, school_year_id]
          );
          // Also delete any incomplete quarterly GWA record
          await client.query(
            'DELETE FROM student_quarterly_gwa WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3 AND quarter = $4',
            [student_id, class_id, school_year_id, quarter]
          );
          continue;
        }

        // 4. Calculate average
        const avg = gradesRes.rows.reduce((sum, r) => sum + Number(r.grade), 0) / componentIds.length;
        console.log(`Calculated MAPEH average: ${avg} from components:`, 
          gradesRes.rows.map(r => `${r.subject_name}: ${r.grade}`).join(', '));

        // 5. Upsert MAPEH grade
        const existsRes = await client.query(
          'SELECT 1 FROM student_grade WHERE student_id = $1 AND class_id = $2 AND subject_id = $3 AND quarter = $4 AND school_year_id = $5',
          [student_id, class_id, mapehSubjectId, quarter, school_year_id]
        );

        if (existsRes.rows.length > 0) {
          await client.query(
            'UPDATE student_grade SET grade = $1 WHERE student_id = $2 AND class_id = $3 AND subject_id = $4 AND quarter = $5 AND school_year_id = $6',
            [avg, student_id, class_id, mapehSubjectId, quarter, school_year_id]
          );
          console.log(`Updated existing MAPEH grade to ${avg}`);
        } else {
          // Use teacher_id from one of the components (first one)
          const teacherRes = await client.query(
            'SELECT teacher_id FROM student_grade WHERE student_id = $1 AND class_id = $2 AND subject_id = $3 AND quarter = $4 AND school_year_id = $5 LIMIT 1',
            [student_id, class_id, componentIds[0], quarter, school_year_id]
          );
          const teacher_id = teacherRes.rows.length > 0 ? teacherRes.rows[0].teacher_id : null;
          await client.query(
            'INSERT INTO student_grade (student_id, class_id, subject_id, teacher_id, quarter, grade, school_year_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [student_id, class_id, mapehSubjectId, teacher_id, quarter, avg, school_year_id]
          );
          console.log(`Inserted new MAPEH grade: ${avg}`);
        }
      } catch (error) {
        console.error('Error syncing MAPEH grade:', error);
        // Continue with other students even if one fails
        continue;
      }
    }
    // --- MAPEH SYNC LOGIC END ---

    // After all grade inserts/updates, run this logic:
    const affectedSet = new Set(gradesData.map(g => `${g.student_id}|${g.subject_id}|${g.class_id}|${g.school_year_id}`));
    for (const key of affectedSet) {
      const [student_id, subject_id, class_id, school_year_id] = key.split('|');
      // Only process if subject_id and school_year_id are present and valid
      if (!subject_id || !school_year_id || isNaN(Number(school_year_id))) continue;
      // Fetch all four quarters for this student/subject/class
      const fetchQuery = `
        SELECT quarter, grade
        FROM student_grade
        WHERE student_id = $1 AND subject_id = $2 AND class_id = $3 AND grade IS NOT NULL AND school_year_id = $4
        ORDER BY quarter
      `;
      const fetchResult = await client.query(fetchQuery, [student_id, subject_id, class_id, school_year_id]);
      if (fetchResult.rows.length === 4) {
        // Ensure quarters 1-4 are present
        const gradesByQuarter = {};
        fetchResult.rows.forEach(row => { gradesByQuarter[row.quarter] = Number(row.grade); });
        if ([1,2,3,4].every(q => gradesByQuarter[q] !== undefined && gradesByQuarter[q] !== null)) {
          const subject_final_grade = ((gradesByQuarter[1] + gradesByQuarter[2] + gradesByQuarter[3] + gradesByQuarter[4]) / 4).toFixed(2);
          const remarks = parseFloat(subject_final_grade) >= 75 ? 'PASSED' : 'FAILED';
          // Upsert subject_final_grade and remarks
          const upsertQuery = `
            INSERT INTO student_subject_grades (student_id, subject_id, class_id, school_year_id, subject_final_grade, remarks)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (student_id, subject_id, class_id, school_year_id)
            DO UPDATE SET subject_final_grade = EXCLUDED.subject_final_grade, remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP;
          `;
          await client.query(upsertQuery, [student_id, subject_id, class_id, school_year_id, subject_final_grade, remarks]);
        }
      }
    }

    res.json({ message: 'Grades uploaded successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error uploading grades:', error);
    res.status(500).json({ 
      error: 'Failed to upload grades',
      details: error.message 
    });
  } finally {
    client.release();
  }
});

// Submit grades (new endpoint specifically for grade submission)
router.post('/submit', validateGrade, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const gradesData = req.body;

    // Validate the incoming data
    if (!Array.isArray(gradesData) || gradesData.length === 0) {
      throw new Error('Invalid grade data format');
    }

    // Delete existing grades if any
    const deleteQuery = `
      DELETE FROM student_grade 
      WHERE class_id = $1 
      AND subject_id = $2 
      AND quarter = $3
      AND school_year_id = $4
      AND student_id IN (${gradesData.map((_, idx) => `$${idx + 5}`).join(',')})
    `;
    
    // Extract student IDs for deletion
    const studentIds = gradesData.map(grade => grade.student_id);
    
    await client.query(deleteQuery, [
      gradesData[0].class_id,
      gradesData[0].subject_id,
      gradesData[0].quarter,
      gradesData[0].school_year_id,
      ...studentIds
    ]);

    // Insert new grades
    for (const grade of gradesData) {
      // Determine which query to use based on whether it's a char_grade or numeric grade
      let insertQuery;
      let insertParams;
      
      if (grade.char_grade !== undefined) {
        // For character grades (Kindergarten)
        insertQuery = `
          INSERT INTO student_grade 
          (student_id, class_id, subject_id, teacher_id, quarter, char_grade, school_year_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        insertParams = [
          grade.student_id,
          grade.class_id,
          grade.subject_id,
          grade.teacher_id,
          grade.quarter,
          grade.char_grade,
          grade.school_year_id
        ];
      } else {
        // For numeric grades (Grade 1+)
        insertQuery = `
          INSERT INTO student_grade 
          (student_id, class_id, subject_id, teacher_id, quarter, grade, school_year_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        insertParams = [
          grade.student_id,
          grade.class_id,
          grade.subject_id,
          grade.teacher_id,
          grade.quarter,
          grade.grade,
          grade.school_year_id
        ];
      }
      
      await client.query(insertQuery, insertParams);
    }

    await client.query('COMMIT');

    // --- MAPEH SYNC LOGIC START ---
    // For each affected student/class/quarter, sync the MAPEH parent grade
    const affected = new Set(gradesData.map(g => `${g.student_id}|${g.class_id}|${g.quarter}|${g.school_year_id}`));
    for (const key of affected) {
      const [student_id, class_id, quarter, school_year_id] = key.split('|');
      try {
        // 1. Find the MAPEH subject for this class/grade level
        const mapehParentRes = await client.query(
          `SELECT s.subject_id, s.grade_level FROM subject s
           WHERE s.subject_name = 'MAPEH' AND s.grade_level = (
             SELECT grade_level FROM class WHERE class_id = $1
           ) LIMIT 1`,
          [class_id]
        );
        if (mapehParentRes.rows.length === 0) continue; // No MAPEH for this class
        const mapehSubjectId = mapehParentRes.rows[0].subject_id;
        const gradeLevel = mapehParentRes.rows[0].grade_level;

        // 2. Get all components for this MAPEH subject
        const componentRes = await client.query(
          `SELECT subject_id, subject_name 
           FROM subject 
           WHERE parent_subject_id = $1 
           ORDER BY subject_name`,
          [mapehSubjectId]
        );

        if (componentRes.rows.length === 0) {
          console.log(`No components found for MAPEH (subject_id: ${mapehSubjectId})`);
          continue;
        }

        const componentIds = componentRes.rows.map(r => r.subject_id);
        console.log(`Found ${componentIds.length} components for MAPEH grade level ${gradeLevel}:`, 
          componentRes.rows.map(r => r.subject_name).join(', '));

        // 3. Get grades for all components
        const gradesRes = await client.query(
          `SELECT sg.grade, s.subject_name 
           FROM student_grade sg
           JOIN subject s ON sg.subject_id = s.subject_id
           WHERE sg.student_id = $1 
           AND sg.class_id = $2 
           AND sg.subject_id = ANY($3) 
           AND sg.quarter = $4 AND sg.school_year_id = $5`,
          [student_id, class_id, componentIds, quarter, school_year_id]
        );

        // Check if all components have grades
        if (gradesRes.rows.length !== componentIds.length) {
          console.log(`Missing grades for some components. Found ${gradesRes.rows.length} grades out of ${componentIds.length} components`);
          await client.query(
            'DELETE FROM student_grade WHERE student_id = $1 AND class_id = $2 AND subject_id = $3 AND quarter = $4 AND school_year_id = $5',
            [student_id, class_id, mapehSubjectId, quarter, school_year_id]
          );
          // Also delete any incomplete quarterly GWA record
          await client.query(
            'DELETE FROM student_quarterly_gwa WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3 AND quarter = $4',
            [student_id, class_id, school_year_id, quarter]
          );
          continue;
        }

        // Check for null grades
        if (gradesRes.rows.some(r => r.grade === null)) {
          console.log('Some components have null grades');
          await client.query(
            'DELETE FROM student_grade WHERE student_id = $1 AND class_id = $2 AND subject_id = $3 AND quarter = $4 AND school_year_id = $5',
            [student_id, class_id, mapehSubjectId, quarter, school_year_id]
          );
          // Also delete any incomplete quarterly GWA record
          await client.query(
            'DELETE FROM student_quarterly_gwa WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3 AND quarter = $4',
            [student_id, class_id, school_year_id, quarter]
          );
          continue;
        }

        // 4. Calculate average
        const avg = gradesRes.rows.reduce((sum, r) => sum + Number(r.grade), 0) / componentIds.length;
        console.log(`Calculated MAPEH average: ${avg} from components:`, 
          gradesRes.rows.map(r => `${r.subject_name}: ${r.grade}`).join(', '));

        // 5. Upsert MAPEH grade
        const existsRes = await client.query(
          'SELECT 1 FROM student_grade WHERE student_id = $1 AND class_id = $2 AND subject_id = $3 AND quarter = $4 AND school_year_id = $5',
          [student_id, class_id, mapehSubjectId, quarter, school_year_id]
        );

        if (existsRes.rows.length > 0) {
          await client.query(
            'UPDATE student_grade SET grade = $1 WHERE student_id = $2 AND class_id = $3 AND subject_id = $4 AND quarter = $5 AND school_year_id = $6',
            [avg, student_id, class_id, mapehSubjectId, quarter, school_year_id]
          );
          console.log(`Updated existing MAPEH grade to ${avg}`);
        } else {
          // Use teacher_id from one of the components (first one)
          const teacherRes = await client.query(
            'SELECT teacher_id FROM student_grade WHERE student_id = $1 AND class_id = $2 AND subject_id = $3 AND quarter = $4 AND school_year_id = $5 LIMIT 1',
            [student_id, class_id, componentIds[0], quarter, school_year_id]
          );
          const teacher_id = teacherRes.rows.length > 0 ? teacherRes.rows[0].teacher_id : null;
          await client.query(
            'INSERT INTO student_grade (student_id, class_id, subject_id, teacher_id, quarter, grade, school_year_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [student_id, class_id, mapehSubjectId, teacher_id, quarter, avg, school_year_id]
          );
          console.log(`Inserted new MAPEH grade: ${avg}`);
        }
      } catch (error) {
        console.error('Error syncing MAPEH grade:', error);
        // Continue with other students even if one fails
        continue;
      }
    }
    // --- MAPEH SYNC LOGIC END ---

    // After all grade inserts/updates, run this logic:
    const affectedSet = new Set(gradesData.map(g => `${g.student_id}|${g.subject_id}|${g.class_id}|${g.school_year_id}`));
    for (const key of affectedSet) {
      const [student_id, subject_id, class_id, school_year_id] = key.split('|');
      // Only process if subject_id and school_year_id are present and valid
      if (!subject_id || !school_year_id || isNaN(Number(school_year_id))) continue;
      // Fetch all four quarters for this student/subject/class
      const fetchQuery = `
        SELECT quarter, grade
        FROM student_grade
        WHERE student_id = $1 AND subject_id = $2 AND class_id = $3 AND grade IS NOT NULL AND school_year_id = $4
        ORDER BY quarter
      `;
      const fetchResult = await client.query(fetchQuery, [student_id, subject_id, class_id, school_year_id]);
      if (fetchResult.rows.length === 4) {
        // Ensure quarters 1-4 are present
        const gradesByQuarter = {};
        fetchResult.rows.forEach(row => { gradesByQuarter[row.quarter] = Number(row.grade); });
        if ([1,2,3,4].every(q => gradesByQuarter[q] !== undefined && gradesByQuarter[q] !== null)) {
          const subject_final_grade = ((gradesByQuarter[1] + gradesByQuarter[2] + gradesByQuarter[3] + gradesByQuarter[4]) / 4).toFixed(2);
          const remarks = parseFloat(subject_final_grade) >= 75 ? 'PASSED' : 'FAILED';
          // Upsert subject_final_grade and remarks
          const upsertQuery = `
            INSERT INTO student_subject_grades (student_id, subject_id, class_id, school_year_id, subject_final_grade, remarks)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (student_id, subject_id, class_id, school_year_id)
            DO UPDATE SET subject_final_grade = EXCLUDED.subject_final_grade, remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP;
          `;
          await client.query(upsertQuery, [student_id, subject_id, class_id, school_year_id, subject_final_grade, remarks]);
        }
      }
    }

    res.json({ success: true, message: 'Grades submitted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting grades:', error);
    res.status(500).json({ error: 'Failed to submit grades', details: error.message });
  } finally {
    client.release();
  }
});

// Get computed grades for a class and subject
router.get('/computed', async (req, res) => {
  try {
    const { class_id, subject_id, school_year_id, quarter } = req.query;
    
    if (!class_id || !subject_id || !quarter) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    let query = `
      SELECT * FROM computed_grades 
      WHERE class_id = $1 
      AND subject_id = $2 
      AND quarter = $3
    `;
    
    const params = [class_id, subject_id, quarter];
    
    // Add school_year_id parameter if provided
    if (school_year_id) {
      query += ` AND school_year_id = $4`;
      params.push(school_year_id);
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching computed grades:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save computed grades
router.post('/computed', async (req, res) => {
  try {
    console.log("Received computed grades data:", JSON.stringify(req.body, null, 2));
    
    const { 
      class_id, 
      subject_id, 
      school_year_id, 
      student_id, 
      quarter, 
      written_works_total, 
      written_works_percentage, 
      performance_tasks_total, 
      performance_tasks_percentage, 
      quarterly_assessment_total, 
      quarterly_assessment_percentage, 
      final_grade 
    } = req.body;
    
    // Validate required fields
    if (!class_id || !subject_id || !student_id || !quarter) {
      console.error("Missing required fields in request:", req.body);
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Parse all numeric values to ensure proper data types
    const parsedValues = {
      class_id: parseInt(class_id),
      subject_id: parseInt(subject_id),
      student_id: parseInt(student_id),
      quarter: parseInt(quarter),
      school_year_id: school_year_id ? parseInt(school_year_id) : null,
      written_works_total: parseFloat(written_works_total || 0),
      written_works_percentage: parseFloat(written_works_percentage || 0),
      performance_tasks_total: parseFloat(performance_tasks_total || 0),
      performance_tasks_percentage: parseFloat(performance_tasks_percentage || 0),
      quarterly_assessment_total: parseFloat(quarterly_assessment_total || 0),
      quarterly_assessment_percentage: parseFloat(quarterly_assessment_percentage || 0),
      final_grade: parseFloat(final_grade || 0)
    };
    
    // Validate all IDs are integers
    if (isNaN(parsedValues.class_id) || isNaN(parsedValues.subject_id) || 
        isNaN(parsedValues.student_id) || isNaN(parsedValues.quarter)) {
      console.error("Invalid ID values found:", parsedValues);
      return res.status(400).json({ error: 'Invalid ID values' });
    }
    
    console.log("Parsed values:", parsedValues);
    
    // Check if a record already exists for this student, class, subject, and quarter
    let checkQuery = `
      SELECT grade_id FROM computed_grades 
      WHERE class_id = $1 
      AND subject_id = $2 
      AND student_id = $3 
      AND quarter = $4
    `;
    
    const checkParams = [
      parsedValues.class_id, 
      parsedValues.subject_id, 
      parsedValues.student_id, 
      parsedValues.quarter
    ];
    
    // Only add school_year_id to the query if it's provided
    if (parsedValues.school_year_id) {
      checkQuery += ' AND school_year_id = $5';
      checkParams.push(parsedValues.school_year_id);
    }
    
    console.log("Checking for existing record with params:", checkParams);
    const checkResult = await pool.query(checkQuery, checkParams);
    console.log("Check result:", checkResult.rows);
    
    let result;
    
    if (checkResult.rows.length > 0) {
      // Update existing record - SIMPLIFIED APPROACH
      const gradeId = checkResult.rows[0].grade_id;
      console.log("Updating existing record with grade_id:", gradeId);
      
      // Build update query with sequential parameters
      let updateQuery;
      let updateParams;
      
      if (parsedValues.school_year_id) {
        updateQuery = `
          UPDATE computed_grades SET
            school_year_id = $1,
            written_works_total = $2,
            written_works_percentage = $3,
            performance_tasks_total = $4,
            performance_tasks_percentage = $5,
            quarterly_assessment_total = $6,
            quarterly_assessment_percentage = $7,
            final_grade = $8,
            updated_at = CURRENT_TIMESTAMP
          WHERE grade_id = $9
          RETURNING *
        `;
        
        updateParams = [
          parsedValues.school_year_id,
          parsedValues.written_works_total,
          parsedValues.written_works_percentage,
          parsedValues.performance_tasks_total,
          parsedValues.performance_tasks_percentage,
          parsedValues.quarterly_assessment_total,
          parsedValues.quarterly_assessment_percentage,
          parsedValues.final_grade,
          gradeId
        ];
      } else {
        updateQuery = `
          UPDATE computed_grades SET
            written_works_total = $1,
            written_works_percentage = $2,
            performance_tasks_total = $3,
            performance_tasks_percentage = $4,
            quarterly_assessment_total = $5,
            quarterly_assessment_percentage = $6,
            final_grade = $7,
            updated_at = CURRENT_TIMESTAMP
          WHERE grade_id = $8
          RETURNING *
        `;
        
        updateParams = [
          parsedValues.written_works_total,
          parsedValues.written_works_percentage,
          parsedValues.performance_tasks_total,
          parsedValues.performance_tasks_percentage,
          parsedValues.quarterly_assessment_total,
          parsedValues.quarterly_assessment_percentage,
          parsedValues.final_grade,
          gradeId
        ];
      }
      
      console.log("Executing update with query:", updateQuery);
      console.log("Update params:", updateParams);
      
      result = await pool.query(updateQuery, updateParams);
      console.log("Update result:", result.rows[0]);
    } else {
      // Insert new record - SIMPLIFIED APPROACH
      console.log("Creating new computed grade record");
      
      let insertQuery;
      let insertParams;
      
      if (parsedValues.school_year_id) {
        insertQuery = `
          INSERT INTO computed_grades (
            class_id, subject_id, school_year_id, student_id, quarter,
            written_works_total, written_works_percentage,
            performance_tasks_total, performance_tasks_percentage,
            quarterly_assessment_total, quarterly_assessment_percentage,
            final_grade
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
        `;
        
        insertParams = [
          parsedValues.class_id,
          parsedValues.subject_id, 
          parsedValues.school_year_id,
          parsedValues.student_id,
          parsedValues.quarter,
          parsedValues.written_works_total,
          parsedValues.written_works_percentage,
          parsedValues.performance_tasks_total,
          parsedValues.performance_tasks_percentage,
          parsedValues.quarterly_assessment_total,
          parsedValues.quarterly_assessment_percentage,
          parsedValues.final_grade
        ];
      } else {
        insertQuery = `
          INSERT INTO computed_grades (
            class_id, subject_id, student_id, quarter,
            written_works_total, written_works_percentage,
            performance_tasks_total, performance_tasks_percentage,
            quarterly_assessment_total, quarterly_assessment_percentage,
            final_grade
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `;
        
        insertParams = [
          parsedValues.class_id,
          parsedValues.subject_id,
          parsedValues.student_id,
          parsedValues.quarter,
          parsedValues.written_works_total,
          parsedValues.written_works_percentage,
          parsedValues.performance_tasks_total,
          parsedValues.performance_tasks_percentage,
          parsedValues.quarterly_assessment_total,
          parsedValues.quarterly_assessment_percentage,
          parsedValues.final_grade
        ];
      }
      
      console.log("Executing insert with query:", insertQuery);
      console.log("Insert params:", insertParams);
      
      result = await pool.query(insertQuery, insertParams);
      console.log("Insert result:", result.rows[0]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving computed grades:', error);
    // Include the full error stack in the response for debugging
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      stack: error.stack
    });
  }
});

// New endpoint for submitting computed grades to student_grade table
router.post('/submit-computed', validateGrade, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const gradesData = req.body;

    // Validate the incoming data
    if (!Array.isArray(gradesData) || gradesData.length === 0) {
      throw new Error('Invalid grade data format');
    }

    // Check if a record exists for each submitted grade
    for (const grade of gradesData) {
      // Validate required fields
      if (!grade.student_id || !grade.class_id || !grade.subject_id || 
          !grade.teacher_id || !grade.quarter) {
        throw new Error('Missing required fields in grade data');
      }
      
      // Ensure either grade or char_grade exists
      if (grade.grade === undefined && grade.char_grade === undefined) {
        throw new Error('Grade or char_grade must be provided');
      }
      
      // Check if the grade already exists
      const checkQuery = `
        SELECT 1 FROM student_grade 
        WHERE student_id = $1 
        AND class_id = $2 
        AND subject_id = $3 
        AND quarter = $4
      `;
      
      const checkResult = await client.query(checkQuery, [
        grade.student_id,
        grade.class_id,
        grade.subject_id,
        grade.quarter
      ]);
      
      if (checkResult.rows.length > 0) {
        // Determine which query to use based on whether it's a char_grade or numeric grade
        let updateQuery;
        let updateParams;
        
        if (grade.char_grade !== undefined) {
          // For character grades (Kindergarten)
          updateQuery = `
            UPDATE student_grade 
            SET char_grade = $1, teacher_id = $2
            WHERE student_id = $3 
            AND class_id = $4 
            AND subject_id = $5 
            AND quarter = $6
          `;
          updateParams = [
            grade.char_grade,
            grade.teacher_id,
            grade.student_id,
            grade.class_id,
            grade.subject_id,
            grade.quarter
          ];
        } else {
          // For numeric grades (Grade 1+)
          updateQuery = `
            UPDATE student_grade 
            SET grade = $1, teacher_id = $2
            WHERE student_id = $3 
            AND class_id = $4 
            AND subject_id = $5 
            AND quarter = $6
          `;
          updateParams = [
            grade.grade,
            grade.teacher_id,
            grade.student_id,
            grade.class_id,
            grade.subject_id,
            grade.quarter
          ];
        }
        
        await client.query(updateQuery, updateParams);
      } else {
        // Determine which query to use based on whether it's a char_grade or numeric grade
        let insertQuery;
        let insertParams;
        
        if (grade.char_grade !== undefined) {
          // For character grades (Kindergarten)
          insertQuery = `
            INSERT INTO student_grade 
            (student_id, class_id, subject_id, teacher_id, quarter, char_grade)
            VALUES ($1, $2, $3, $4, $5, $6)
          `;
          insertParams = [
            grade.student_id,
            grade.class_id,
            grade.subject_id,
            grade.teacher_id,
            grade.quarter,
            grade.char_grade
          ];
        } else {
          // For numeric grades (Grade 1+)
          insertQuery = `
            INSERT INTO student_grade 
            (student_id, class_id, subject_id, teacher_id, quarter, grade)
            VALUES ($1, $2, $3, $4, $5, $6)
          `;
          insertParams = [
            grade.student_id,
            grade.class_id,
            grade.subject_id,
            grade.teacher_id,
            grade.quarter,
            grade.grade
          ];
        }
        
        await client.query(insertQuery, insertParams);
      }
    }

    await client.query('COMMIT');
    res.json({ 
      success: true, 
      message: 'Computed grades successfully transferred to student_grade table',
      count: gradesData.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting computed grades:', error);
    res.status(500).json({ 
      error: 'Failed to submit computed grades', 
      message: error.message 
    });
  } finally {
    client.release();
  }
});

// 1. Save or update quarterly grades for a subject
router.post('/quarterly-grades', async (req, res) => {
  try {
    const {
      student_id,
      subject_id,
      class_id,
      school_year_id,
      quarter1_grade,
      quarter2_grade,
      quarter3_grade,
      quarter4_grade
    } = req.body;
    if (!student_id || !subject_id || !class_id || !school_year_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Upsert logic
    const upsertQuery = `
      INSERT INTO student_subject_grades
        (student_id, subject_id, class_id, school_year_id, quarter1_grade, quarter2_grade, quarter3_grade, quarter4_grade)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (student_id, subject_id, class_id, school_year_id)
      DO UPDATE SET
        quarter1_grade = EXCLUDED.quarter1_grade,
        quarter2_grade = EXCLUDED.quarter2_grade,
        quarter3_grade = EXCLUDED.quarter3_grade,
        quarter4_grade = EXCLUDED.quarter4_grade,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const result = await pool.query(upsertQuery, [
      student_id, subject_id, class_id, school_year_id,
      quarter1_grade, quarter2_grade, quarter3_grade, quarter4_grade
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving quarterly grades:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Compute and save/update subject final grade (average of Q1-Q4)
router.post('/subject-final-grade', async (req, res) => {
  try {
    const { student_id, subject_id, class_id, school_year_id } = req.body;
    if (!student_id || !subject_id || !class_id || !school_year_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Fetch quarterly grades from student_grade table
    const fetchQuery = `
      SELECT quarter, grade
      FROM student_grade
      WHERE student_id = $1 AND subject_id = $2 AND class_id = $3 AND grade IS NOT NULL
      ORDER BY quarter
    `;
    const fetchResult = await pool.query(fetchQuery, [student_id, subject_id, class_id]);
    if (fetchResult.rows.length !== 4) {
      return res.status(400).json({ error: 'All four quarterly grades are required to compute final grade' });
    }
    // Ensure quarters 1-4 are present
    const gradesByQuarter = {};
    fetchResult.rows.forEach(row => { gradesByQuarter[row.quarter] = Number(row.grade); });
    if (![1,2,3,4].every(q => gradesByQuarter[q] !== undefined && gradesByQuarter[q] !== null)) {
      return res.status(400).json({ error: 'All four quarterly grades are required to compute final grade' });
    }
    const subject_final_grade = ((gradesByQuarter[1] + gradesByQuarter[2] + gradesByQuarter[3] + gradesByQuarter[4]) / 4).toFixed(2);
    // Set remarks
    const remarks = parseFloat(subject_final_grade) >= 75 ? 'PASSED' : 'FAILED';
    // Upsert subject_final_grade and remarks into student_subject_grades
    const upsertQuery = `
      INSERT INTO student_subject_grades (student_id, subject_id, class_id, school_year_id, subject_final_grade, remarks)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (student_id, subject_id, class_id, school_year_id)
      DO UPDATE SET subject_final_grade = EXCLUDED.subject_final_grade, remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const result = await pool.query(upsertQuery, [student_id, subject_id, class_id, school_year_id, subject_final_grade, remarks]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving subject final grade:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Compute and save/update GWA (average of all quarterly GWA for quarters 1-4)
router.post('/gwa', async (req, res) => {
  try {
    const { student_id, class_id, school_year_id } = req.body;
    if (!student_id || !class_id || !school_year_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Fetch quarterly_gwa for quarters 1-4
    const fetchQuery = `
      SELECT quarter, quarterly_gwa
      FROM student_quarterly_gwa
      WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3
      ORDER BY quarter
    `;
    const fetchResult = await pool.query(fetchQuery, [student_id, class_id, school_year_id]);
    if (fetchResult.rows.length !== 4) {
      return res.status(400).json({ error: 'All four quarterly GWA are required to compute final GWA' });
    }
    // Ensure quarters 1-4 are present
    const gwaByQuarter = {};
    fetchResult.rows.forEach(row => { gwaByQuarter[row.quarter] = Number(row.quarterly_gwa); });
    if (![1,2,3,4].every(q => gwaByQuarter[q] !== undefined && gwaByQuarter[q] !== null)) {
      return res.status(400).json({ error: 'All four quarterly GWA are required to compute final GWA' });
    }
    const gwa = ((gwaByQuarter[1] + gwaByQuarter[2] + gwaByQuarter[3] + gwaByQuarter[4]) / 4).toFixed(2);
    // Upsert GWA
    const upsertQuery = `
      INSERT INTO student_gwa (student_id, class_id, school_year_id, gwa)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (student_id, class_id, school_year_id)
      DO UPDATE SET gwa = EXCLUDED.gwa, updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const result = await pool.query(upsertQuery, [student_id, class_id, school_year_id, gwa]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving GWA:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Compute and save/update Quarterly GWA (average of all subject grades for a quarter)
router.post('/quarterly-gwa', async (req, res) => {
  try {
    const { student_id, class_id, school_year_id, quarter } = req.body;
    if (!student_id || !class_id || !school_year_id || !quarter) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // 1. Fetch all subject_ids assigned to this class
    const subjectsQuery = `
      SELECT subject_id FROM class_subject WHERE class_id = $1
    `;
    const subjectsResult = await pool.query(subjectsQuery, [class_id]);
    const subjectIds = subjectsResult.rows.map(r => r.subject_id);
    if (subjectIds.length === 0) {
      return res.status(400).json({ error: 'No subjects assigned to this class' });
    }
    // 2. Fetch all grades for this student/class/quarter for those subjects
    const gradesQuery = `
      SELECT subject_id, grade
      FROM student_grade
      WHERE student_id = $1 AND class_id = $2 AND quarter = $3 AND grade IS NOT NULL
    `;
    const gradesResult = await pool.query(gradesQuery, [student_id, class_id, quarter]);
    const gradesMap = {};
    gradesResult.rows.forEach(row => { gradesMap[row.subject_id] = Number(row.grade); });
    // 3. Check if the student has a grade for every subject
    const allSubjectsGraded = subjectIds.every(sid => gradesMap[sid] !== undefined && gradesMap[sid] !== null);
    if (!allSubjectsGraded) {
      // Delete any existing incomplete quarterly GWA record
      await pool.query(
        'DELETE FROM student_quarterly_gwa WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3 AND quarter = $4',
        [student_id, class_id, school_year_id, quarter]
      );
      return res.status(200).json({ message: 'Not all subject grades are present for this quarter. Quarterly GWA not saved.' });
    }
    // 4. Compute the average
    const grades = subjectIds.map(sid => gradesMap[sid]);
    const gwa = (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(2);
    // 5. Upsert quarterly GWA
    const upsertQuery = `
      INSERT INTO student_quarterly_gwa (student_id, class_id, school_year_id, quarter, quarterly_gwa)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (student_id, class_id, school_year_id, quarter)
      DO UPDATE SET quarterly_gwa = EXCLUDED.quarterly_gwa, updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const result = await pool.query(upsertQuery, [student_id, class_id, school_year_id, quarter, gwa]);

    // --- AUTOMATICALLY TRIGGER FINAL GWA COMPUTATION ---
    // Fetch quarterly_gwa for quarters 1-4
    const gwaFetchQuery = `
      SELECT quarter, quarterly_gwa
      FROM student_quarterly_gwa
      WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3
      ORDER BY quarter
    `;
    const gwaFetchResult = await pool.query(gwaFetchQuery, [student_id, class_id, school_year_id]);
    if (gwaFetchResult.rows.length === 4) {
      const gwaByQuarter = {};
      gwaFetchResult.rows.forEach(row => { gwaByQuarter[row.quarter] = Number(row.quarterly_gwa); });
      if ([1,2,3,4].every(q => gwaByQuarter[q] !== undefined && gwaByQuarter[q] !== null)) {
        const gwaFinal = ((gwaByQuarter[1] + gwaByQuarter[2] + gwaByQuarter[3] + gwaByQuarter[4]) / 4).toFixed(2);
        // Upsert GWA
        const gwaUpsertQuery = `
          INSERT INTO student_gwa (student_id, class_id, school_year_id, gwa)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (student_id, class_id, school_year_id)
          DO UPDATE SET gwa = EXCLUDED.gwa, updated_at = CURRENT_TIMESTAMP;
        `;
        await pool.query(gwaUpsertQuery, [student_id, class_id, school_year_id, gwaFinal]);
      }
    }
    // --- END GWA TRIGGER ---

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving quarterly GWA:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET subject final grades and remarks for a student/class/year (optionally filter by subject)
router.get('/subject-final-grades', async (req, res) => {
  try {
    const { student_id, class_id, school_year_id, subject_id } = req.query;
    if (!student_id || !class_id || !school_year_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    let query = `
      SELECT subject_id, subject_final_grade, remarks
      FROM student_subject_grades
      WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3
    `;
    const params = [student_id, class_id, school_year_id];
    if (subject_id) {
      query += ' AND subject_id = $4';
      params.push(subject_id);
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subject final grades:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET endpoint for campus-wide academic ranking
router.get('/campus-wide-ranking', async (req, res) => {
  try {
    const { schoolYearId, quarter } = req.query;

    if (!schoolYearId || !quarter) {
      return res.status(400).json({ error: 'School Year ID and Quarter are required' });
    }

    let query;
    const queryParams = [schoolYearId];

    if (quarter === 'final') {
      // For final average, use the pre-calculated GWA from student_gwa table
      query = `
        SELECT
          sg.student_id,
          u.fname,
          u.mname,
          u.lname,
          c.grade_level,
          c.section,
          sg.gwa::numeric(10, 2) as average_grade,
          RANK() OVER (ORDER BY sg.gwa DESC) as rank_number
        FROM student_gwa sg
        JOIN users u ON sg.student_id = u.user_id
        JOIN class c ON sg.class_id = c.class_id
        WHERE sg.school_year_id = $1
          AND c.grade_level <> 'Kindergarten'
        ORDER BY rank_number, u.lname, u.fname;
      `;
    } else {
      // For quarterly average, use the pre-calculated quarterly GWA from student_quarterly_gwa table.
      query = `
        SELECT
          sqg.student_id,
          u.fname,
          u.mname,
          u.lname,
          c.grade_level,
          c.section,
          sqg.quarterly_gwa::numeric(10, 2) as average_grade,
          RANK() OVER (ORDER BY sqg.quarterly_gwa DESC) as rank_number
        FROM student_quarterly_gwa sqg
        JOIN users u ON sqg.student_id = u.user_id
        JOIN class c ON sqg.class_id = c.class_id
        WHERE sqg.school_year_id = $1
          AND sqg.quarter = $2
          AND c.grade_level <> 'Kindergarten'
        ORDER BY rank_number, u.lname, u.fname;
      `;
      queryParams.push(quarter);
    }

    const result = await pool.query(query, queryParams);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching campus-wide ranking:', error);
    res.status(500).json({ error: 'Failed to fetch campus-wide ranking' });
  }
});

// Clean up NULL quarterly GWA records (utility endpoint)
router.post('/cleanup-null-quarterly-gwa', async (req, res) => {
  try {
    const { classId, schoolYearId, quarter } = req.body;
    
    if (!classId || !schoolYearId || !quarter) {
      return res.status(400).json({ error: 'Missing required parameters: classId, schoolYearId, quarter' });
    }
    
    // Delete NULL quarterly GWA records for the specified class/year/quarter
    const deleteQuery = `
      DELETE FROM student_quarterly_gwa 
      WHERE class_id = $1 
      AND school_year_id = $2 
      AND quarter = $3 
      AND quarterly_gwa IS NULL
    `;
    
    const result = await pool.query(deleteQuery, [classId, schoolYearId, quarter]);
    
    res.json({ 
      message: `Cleaned up ${result.rowCount} NULL quarterly GWA records`,
      deletedCount: result.rowCount
    });
  } catch (error) {
    console.error('Error cleaning up NULL quarterly GWA records:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 