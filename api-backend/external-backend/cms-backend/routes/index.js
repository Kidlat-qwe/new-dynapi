/**
 * CMS API router: mounted at /api/cms by api-backend (cmsMount.js).
 * Paths match the cms-frontend (apiRequest('/users'), '/auth/verify', etc.) — not /api/sms or /api/v1.
 */
import '../config/loadEnv.js';
import express from 'express';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';

import authRoutes from './auth.js';
import usersRoutes from './users.js';
import branchesRoutes from './branches.js';
import classesRoutes from './classes.js';
import studentsRoutes from './students.js';
import guardiansRoutes from './guardians.js';
import programsRoutes from './programs.js';
import curriculumRoutes from './curriculum.js';
import roomsRoutes from './rooms.js';
import packagesRoutes from './packages.js';
import pricinglistsRoutes from './pricinglists.js';
import merchandiseRoutes from './merchandise.js';
import promosRoutes from './promos.js';
import invoicesRoutes from './invoices.js';
import installmentinvoicesRoutes from './installmentinvoices.js';
import paymentsRoutes from './payments.js';
import cashDepositSummariesRoutes from './cashDepositSummaries.js';
import dailySummarySalesRoutes from './dailySummarySales.js';
import acknowledgementreceiptsRoutes from './acknowledgementreceipts.js';
import announcementsRoutes from './announcements.js';
import reservationsRoutes from './reservations.js';
import settingsRoutes from './settings.js';
import calendarRoutes from './calendar.js';
import dashboardRoutes from './dashboard.js';
import uploadRoutes from './upload.js';
import reportsRoutes from './reports.js';
import holidaysRoutes from './holidays.js';
import suspensionsRoutes from './suspensions.js';
import attendanceRoutes from './attendance.js';
import merchandiserequestsRoutes from './merchandiserequests.js';
import referralsRoutes from './referrals.js';
import phasesessionsRoutes from './phasesessions.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/branches', branchesRoutes);
router.use('/classes', classesRoutes);
router.use('/students', studentsRoutes);
router.use('/guardians', guardiansRoutes);
router.use('/programs', programsRoutes);
router.use('/curriculum', curriculumRoutes);
router.use('/rooms', roomsRoutes);
router.use('/packages', packagesRoutes);
router.use('/pricinglists', pricinglistsRoutes);
router.use('/merchandise', merchandiseRoutes);
router.use('/promos', promosRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/installment-invoices', installmentinvoicesRoutes);
router.use('/payments', paymentsRoutes);
router.use('/cash-deposit-summaries', cashDepositSummariesRoutes);
router.use('/daily-summary-sales', dailySummarySalesRoutes);
router.use('/acknowledgement-receipts', acknowledgementreceiptsRoutes);
router.use('/announcements', announcementsRoutes);
router.use('/reservations', reservationsRoutes);
router.use('/settings', settingsRoutes);
router.use('/calendar', calendarRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/upload', uploadRoutes);
router.use('/reports', reportsRoutes);
router.use('/holidays', holidaysRoutes);
router.use('/suspensions', suspensionsRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/merchandise-requests', merchandiserequestsRoutes);
router.use('/referrals', referralsRoutes);
router.use('/phasesessions', phasesessionsRoutes);

router.use(notFoundHandler);
router.use(errorHandler);

export default router;
