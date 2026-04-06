/**
 * Grading backend route aggregator.
 * Used when mounted in-process by api-backend at /api/grading.
 */

import express from 'express';
import { setCurrentUserForLogging } from '../middleware/setCurrentUser.js';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import teacherRoutes from './teachers.js';
import classRoutes from './classes.js';
import gradeRoutes from './grades.js';
import attendanceRoutes from './attendance.js';
import studentRoutes from './students.js';
import subjectRoutes from './subjects.js';
import schoolYearRoutes from './school-years.js';
import gradingCriteriaRoutes from './grading-criteria.js';
import studentStatusRoutes from './student-status.js';
import activityRoutes from './activities.js';

const router = express.Router();

// Set req.user when Bearer is Firebase/JWT so api-backend can log actual user in system_request_log
router.use(setCurrentUserForLogging);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Grading API is running',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/teachers', teacherRoutes);
router.use('/classes', classRoutes);
router.use('/grades', gradeRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/students', studentRoutes);
router.use('/subjects', subjectRoutes);
router.use('/school-years', schoolYearRoutes);
router.use('/grading-criteria', gradingCriteriaRoutes);
router.use('/student-status', studentStatusRoutes);
router.use('/activities', activityRoutes);

export default router;
