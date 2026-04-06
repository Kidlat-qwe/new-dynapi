import express from 'express';
import { setCurrentUserForLogging } from '../middleware/setCurrentUser.js';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import teacherRoutes from './teachers.js';
import appointmentRoutes from './appointments.js';
import availabilityRoutes from './availability.js';
import studentRoutes from './students.js';
import creditRoutes from './credits.js';
import billingRoutes from './billing.js';
import materialRoutes from './materials.js';
import meetingRoutes from './meetings.js';

const router = express.Router();

// Set req.user from X-User-Email when Bearer is user token so api-backend can log actual user in system_request_log
router.use(setCurrentUserForLogging);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Funtalk API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/teachers', teacherRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/availability', availabilityRoutes);
router.use('/students', studentRoutes);
router.use('/credits', creditRoutes);
router.use('/billing', billingRoutes);
router.use('/materials', materialRoutes);
router.use('/meetings', meetingRoutes);

export default router;

