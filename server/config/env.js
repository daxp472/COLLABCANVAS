import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/collabcanvas',
  jwtSecret: process.env.JWT_SECRET || 'collabcanvas_super_secret_jwt_key_2026',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  snapshotIntervalOps: parseInt(process.env.SNAPSHOT_INTERVAL_OPS || '50', 10),
  nodeEnv: process.env.NODE_ENV || 'development'
};
