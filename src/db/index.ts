import dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _sqlDisabledUntil: number | undefined;
}

/**
 * Checks if SQL connection environment variables are properly provided
 */
export function isSqlConfigured(): boolean {
  const host = process.env.SQL_HOST?.trim();
  const user = process.env.SQL_USER?.trim();
  const dbName = process.env.SQL_DB_NAME?.trim();
  if (!host || !user || !dbName) return false;
  return true;
}

/**
 * Checks if SQL database is active and not in a failure cooldown
 */
export function isSqlAvailable(): boolean {
  if (!isSqlConfigured()) return false;
  if (global._sqlDisabledUntil && Date.now() < global._sqlDisabledUntil) {
    return false;
  }
  return true;
}

/**
 * Temporarily marks SQL as offline after a network/connection failure
 */
export function markSqlUnavailable(cooldownMs: number = 60000) {
  global._sqlDisabledUntil = Date.now() + cooldownMs;
}

/**
 * Resets SQL failure cooldown when a successful operation completes
 */
export function markSqlAvailable() {
  global._sqlDisabledUntil = undefined;
}

/**
 * Closes the PostgreSQL pool gracefully during application shutdown
 */
export async function closePool(): Promise<void> {
  if (global._postgresPool) {
    try {
      await global._postgresPool.end();
    } catch {
      // ignore
    } finally {
      global._postgresPool = undefined;
    }
  }
}

export const createPool = (): Pool | null => {
  if (!isSqlConfigured()) {
    return null;
  }

  if (!global._postgresPool) {
    try {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD || '',
        database: process.env.SQL_DB_NAME,
        max: 5,
        connectionTimeoutMillis: 2000,
        idleTimeoutMillis: 30000,
      });

      global._postgresPool.on('error', (_err) => {
        markSqlUnavailable();
      });
    } catch {
      markSqlUnavailable();
      return null;
    }
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = pool ? drizzle(pool, { schema }) : null;

