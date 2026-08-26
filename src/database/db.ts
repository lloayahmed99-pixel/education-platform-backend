import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// We will use DATABASE_URL from .env
// Example: postgres://postgres:password@localhost:5432/platform
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/platform',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// A wrapper to help transition from better-sqlite3 synchronous style 
// to pg's async style
export const query = async (text: string, params?: any[]) => {
  return await pool.query(text, params);
};

export const getClient = async () => {
  return await pool.connect();
};

export default pool;
