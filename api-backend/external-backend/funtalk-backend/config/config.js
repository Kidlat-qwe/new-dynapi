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
  
  // CORS — single origin or comma-separated list (e.g. dev + deployed hosts)
  cors: {
    origin: (() => {
      const raw = process.env.CORS_ORIGIN || 'http://localhost:5173';
      const list = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return list.length === 1 ? list[0] : list;
    })(),
  },

  // AWS S3 (materials uploads — bucket funtalk-storage, prefixes under materials/)
  s3: {
    bucket: process.env.AWS_S3_BUCKET || process.env.AWS_S3_BUCKET_NAME || '',
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
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

