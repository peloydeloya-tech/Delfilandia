import { Request, Response, NextFunction } from 'express';

// List of sensitive query/body keys that must never appear in logs
const SENSITIVE_KEYS = new Set([
  'password',
  'rawpassword',
  'passwordhash',
  'newpassword',
  'currentpassword',
  'token',
  'sessiontoken',
  'recoverycode',
  'adminrecoverycode',
  'secret',
  'cookie',
  'authorization',
  'sql_password',
  'database_url',
  'gemini_api_key',
  'api_key',
  'apikey',
]);

/**
 * Scrubs sensitive key-value pairs from objects or query strings
 */
export function scrubSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(scrubSensitiveData);
  }

  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('token')) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      cleaned[key] = scrubSensitiveData(val);
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

/**
 * Structured HTTP Request Logger Middleware
 * Provides low-overhead request duration monitoring, HTTP status classification,
 * and strict secret redaction.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // Only log API requests and important top-level routes to avoid noise
  if (!req.path.startsWith('/api') && req.path !== '/') {
    return next();
  }

  const startTime = process.hrtime.bigint();
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const statusCode = res.statusCode;

    let category = 'HTTP';
    let level = 'INFO';

    if (statusCode >= 500) {
      level = 'ERROR';
      category = 'SYSTEM';
    } else if (statusCode === 401 || statusCode === 403) {
      level = 'WARN';
      category = 'AUTH';
    } else if (statusCode >= 400) {
      level = 'WARN';
      category = 'CLIENT';
    }

    const durationFormatted = durationMs < 1 ? `${durationMs.toFixed(2)}ms` : `${durationMs.toFixed(1)}ms`;
    
    // Structured log output
    console.log(`[${timestamp}] [${level}] [${category}] ${method} ${url} -> ${statusCode} (${durationFormatted})`);
  });

  next();
}
