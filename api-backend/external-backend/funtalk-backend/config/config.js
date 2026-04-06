import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'funtalk_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
  
  // User Types
  userTypes: {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    SCHOOL: 'school',
    TEACHER: 'teacher',
  },
  
  // Appointment Status
  appointmentStatus: {
    PENDING: 'pending',
    APPROVED: 'approved',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_SHOW: 'no_show',
  },
  
  // Credit Transaction Types
  creditTransactionTypes: {
    PURCHASE: 'purchase',
    DEDUCTION: 'deduction',
    REFUND: 'refund',
    ADJUSTMENT: 'adjustment',
    EXPIRED: 'expired',
  },
  
  // Payment Status
  paymentStatus: {
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded',
  },
};

