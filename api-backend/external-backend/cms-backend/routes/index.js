/**
 * CMS API root router (mounted at /api/cms and /api/sms).
 * Sub-routers use path segments like /api/sms/auth/verify (see per-route file comments).
 */

import express from 'express';
import { activityLogger } from '../middleware/activityLogger.js';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';

import acknowledgementReceiptsRoutes from './acknowledgementreceipts.js';
import announcementsRoutes from './announcements.js';
import attendanceRoutes from './attendance.js';
import authRoutes from './auth.js';
import branchesRoutes from './branches.js';
import calendarRoutes from './calendar.js';
import cashDepositSummariesRoutes from './cashDepositSummaries.js';
import classesRoutes from './classes.js';
import curriculumRoutes from './curriculum.js';
import dailySummarySalesRoutes from './dailySummarySales.js';
import dashboardRoutes from './dashboard.js';
import guardiansRoutes from './guardians.js';
import holidaysRoutes from './holidays.js';
import installmentInvoicesRoutes from './installmentinvoices.js';
import invoicesRoutes from './invoices.js';
import merchandiseRoutes from './merchandise.js';
import merchandiseRequestsRoutes from './merchandiserequests.js';
import packagesRoutes from './packages.js';
import paymentsRoutes from './payments.js';
import phasesessionsRoutes from './phasesessions.js';
import pricinglistsRoutes from './pricinglists.js';
import programsRoutes from './programs.js';
import promosRoutes from './promos.js';
import referralsRoutes from './referrals.js';
import reportsRoutes from './reports.js';
import reservationsRoutes from './reservations.js';
import roomsRoutes from './rooms.js';
import settingsRoutes from './settings.js';
import studentsRoutes from './students.js';
import suspensionsRoutes from './suspensions.js';
import systemLogsRoutes from './systemLogs.js';
import uploadRoutes from './upload.js';
import usersRoutes from './users.js';

const router = express.Router();

router.use(activityLogger);

router.use('/acknowledgement-receipts', acknowledgementReceiptsRoutes);
router.use('/announcements', announcementsRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/auth', authRoutes);
router.use('/branches', branchesRoutes);
router.use('/calendar', calendarRoutes);
router.use('/cash-deposit-summaries', cashDepositSummariesRoutes);
router.use('/classes', classesRoutes);
router.use('/curriculum', curriculumRoutes);
router.use('/daily-summary-sales', dailySummarySalesRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/guardians', guardiansRoutes);
router.use('/holidays', holidaysRoutes);
router.use('/installment-invoices', installmentInvoicesRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/merchandise', merchandiseRoutes);
router.use('/merchandise-requests', merchandiseRequestsRoutes);
router.use('/packages', packagesRoutes);
router.use('/payments', paymentsRoutes);
router.use('/phasesessions', phasesessionsRoutes);
router.use('/pricinglists', pricinglistsRoutes);
router.use('/programs', programsRoutes);
router.use('/promos', promosRoutes);
router.use('/referrals', referralsRoutes);
router.use('/reports', reportsRoutes);
router.use('/reservations', reservationsRoutes);
router.use('/rooms', roomsRoutes);
router.use('/settings', settingsRoutes);
router.use('/students', studentsRoutes);
router.use('/suspensions', suspensionsRoutes);
router.use('/system-logs', systemLogsRoutes);
router.use('/upload', uploadRoutes);
router.use('/users', usersRoutes);

router.use(notFoundHandler);
router.use(errorHandler);

export default router;
