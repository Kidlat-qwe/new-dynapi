import express from 'express';

import authRoutes from './auth.js';
import usersRoutes from './users.js';
import branchesRoutes from './branches.js';
import classesRoutes from './classes.js';
import studentsRoutes from './students.js';
import programsRoutes from './programs.js';
import roomsRoutes from './rooms.js';
import curriculumRoutes from './curriculum.js';
import guardiansRoutes from './guardians.js';
import pricingListsRoutes from './pricinglists.js';
import packagesRoutes from './packages.js';
import holidaysRoutes from './holidays.js';
import phaseSessionsRoutes from './phasesessions.js';
import calendarRoutes from './calendar.js';
import attendanceRoutes from './attendance.js';
import announcementsRoutes from './announcements.js';
import dashboardRoutes from './dashboard.js';
import reservationsRoutes from './reservations.js';
import referralsRoutes from './referrals.js';
import promosRoutes from './promos.js';
import reportsRoutes from './reports.js';
import settingsRoutes from './settings.js';
import uploadRoutes from './upload.js';
import paymentsRoutes from './payments.js';
import invoicesRoutes from './invoices.js';
import installmentInvoicesRoutes from './installmentinvoices.js';
import merchandiseRequestsRoutes from './merchandiserequests.js';
import merchandiseRoutes from './merchandise.js';
import suspensionsRoutes from './suspensions.js';
import dailySummarySalesRoutes from './dailySummarySales.js';
import cashDepositSummariesRoutes from './cashDepositSummaries.js';
import acknowledgementReceiptsRoutes from './acknowledgementreceipts.js';
import systemLogsRoutes from './systemLogs.js';

import { activityLogger } from '../middleware/activityLogger.js';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Request activity logging (writes after res.finish when req.user is available)
router.use(activityLogger);

// Core
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/branches', branchesRoutes);
router.use('/classes', classesRoutes);
router.use('/students', studentsRoutes);
router.use('/programs', programsRoutes);
router.use('/rooms', roomsRoutes);
router.use('/curriculum', curriculumRoutes);
router.use('/guardians', guardiansRoutes);
router.use('/pricinglists', pricingListsRoutes);
router.use('/packages', packagesRoutes);
router.use('/holidays', holidaysRoutes);
router.use('/phasesessions', phaseSessionsRoutes);
router.use('/calendar', calendarRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/announcements', announcementsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reservations', reservationsRoutes);
router.use('/referrals', referralsRoutes);
router.use('/promos', promosRoutes);
router.use('/reports', reportsRoutes);
router.use('/settings', settingsRoutes);
router.use('/upload', uploadRoutes);

// Billing / Finance
router.use('/payments', paymentsRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/installmentinvoices', installmentInvoicesRoutes);
// Alias: cms-frontend uses kebab-case
router.use('/installment-invoices', installmentInvoicesRoutes);
router.use('/dailySummarySales', dailySummarySalesRoutes);
// Alias: cms-frontend calls kebab-case
router.use('/daily-summary-sales', dailySummarySalesRoutes);
router.use('/cashDepositSummaries', cashDepositSummariesRoutes);
// Alias: cms-frontend calls kebab-case
router.use('/cash-deposit-summaries', cashDepositSummariesRoutes);
router.use('/acknowledgementreceipts', acknowledgementReceiptsRoutes);
// Alias: cms-frontend calls kebab-case
router.use('/acknowledgement-receipts', acknowledgementReceiptsRoutes);

// Merchandise
router.use('/merchandiserequests', merchandiseRequestsRoutes);
// Alias: cms-frontend calls kebab-case
router.use('/merchandise-requests', merchandiseRequestsRoutes);
router.use('/merchandise', merchandiseRoutes);

// Admin / misc
router.use('/suspensions', suspensionsRoutes);
router.use('/system-logs', systemLogsRoutes);

router.use(notFoundHandler);
router.use(errorHandler);

export default router;

