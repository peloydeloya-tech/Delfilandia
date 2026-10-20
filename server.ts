import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import { INITIAL_ORDERS, INITIAL_CLIENTS, INITIAL_AUDIT_LOGS, DEFAULT_SETTINGS } from "./src/data/mockData";
import { Order, Client, AuditLog, AppSettings, PublicOrderView } from "./src/types";
import { sanitizeOrderForPublic } from "./src/utils/security";
import { matchOrderCode } from "./src/utils/formatters";
import { mergePreservedSettings } from "./src/utils/settingsPreservation";
import {
  getDbOrders,
  getDbOrderByCode,
  saveDbOrder,
  saveDbOrders,
  deleteDbOrder,
  getDbClients,
  saveDbClient,
  saveDbClients,
  getDbSettings,
  saveDbSettings,
  getDbAuditLogs,
  createDbAuditLog,
  saveDbAuditLogs,
  DatabaseError,
} from "./src/db/repository.ts";
import { isSqlAvailable, isSqlConfigured, closePool } from "./src/db/index.ts";
import {
  hashPassword,
  verifyPassword,
  generateSecureRecoveryCode,
  hashRecoveryCode,
  verifyRecoveryCode,
  verifyAdminRecoverySecret,
  generatePasswordResetCode,
  hashPasswordResetCode,
  verifyPasswordResetCode,
} from "./server/utils/crypto";
import { sendPasswordResetEmail } from "./server/services/emailService";
import {
  createSession,
  destroySession,
  destroyAllSessions,
  requireAuth,
  requireAdmin,
  optionalAuth,
  getSession,
  AuthUser,
} from "./server/middleware/auth";
import { requestLogger } from "./server/middleware/logger";

// Data Storage File Path (Contingency & Disaster Recovery Backup ONLY)
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const SETTINGS_BACKUP_FILE = path.join(DATA_DIR, "settings_backup.json");

/**
 * In-Memory Derived Cache Interface
 * PostgreSQL Cloud SQL is the authoritative Source of Truth.
 * Memory cache serves strictly for high-speed sub-millisecond response optimization.
 */
interface MemoryCache {
  orders: Order[];
  clients: Client[];
  settings: AppSettings;
  auditLogs: AuditLog[];
}

/**
 * Procedimento de Contingência (Disaster Recovery):
 * Carrega dados do arquivo estático de backup (data/store.json e data/settings_backup.json)
 * caso o PostgreSQL esteja inativo durante a inicialização a frio.
 * NUNCA é chamado durante o funcionamento operacional normal quando o PostgreSQL está ativo.
 */
function loadBackupStore(): MemoryCache {
  let savedSettings: Partial<AppSettings> | null = null;
  let parsedOrders: Order[] = INITIAL_ORDERS;
  let parsedClients: Client[] = INITIAL_CLIENTS;
  let parsedAuditLogs: AuditLog[] = INITIAL_AUDIT_LOGS;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // 1. Read standalone settings backup if present
    if (fs.existsSync(SETTINGS_BACKUP_FILE)) {
      try {
        const backupContent = fs.readFileSync(SETTINGS_BACKUP_FILE, "utf-8");
        savedSettings = JSON.parse(backupContent);
      } catch (err) {
        console.warn("[CONTINGÊNCIA] Falha ao ler settings_backup.json:", err);
      }
    }

    // 2. Read primary store.json backup
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.orders)) parsedOrders = parsed.orders;
      if (Array.isArray(parsed.clients)) parsedClients = parsed.clients;
      if (Array.isArray(parsed.auditLogs)) parsedAuditLogs = parsed.auditLogs;
      
      if (parsed.settings && typeof parsed.settings === 'object') {
        savedSettings = { ...(savedSettings || {}), ...parsed.settings };
      }
    }
  } catch (err) {
    console.error("[CONTINGÊNCIA] Erro ao ler backup de store.json:", err);
  }

  // Safely merge preserved settings with application schema defaults
  const finalSettings = mergePreservedSettings(savedSettings, DEFAULT_SETTINGS);

  return {
    orders: parsedOrders,
    clients: parsedClients,
    settings: finalSettings,
    auditLogs: parsedAuditLogs,
  };
}

/**
 * Snapshot de contingência em disco (Backup offline).
 * Mantido exclusivamente para rotinas de exportação ou contingência manual.
 */
function saveBackupSnapshot(cache: MemoryCache) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2), "utf-8");

    if (cache.settings && typeof cache.settings === 'object') {
      fs.writeFileSync(SETTINGS_BACKUP_FILE, JSON.stringify(cache.settings, null, 2), "utf-8");
    }
  } catch (err) {
    console.error("[CONTINGÊNCIA] Erro ao gravar snapshot de backup:", err);
  }
}

// Timeout helper to avoid blocking responses if external DB is slow/cold
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Standardized API Error Handler that maps DatabaseError and generic errors to appropriate HTTP responses
 */
function handleApiError(res: express.Response, error: unknown, defaultMessage = "Erro interno no servidor") {
  if (error instanceof DatabaseError) {
    const safeMessage = String(error.message || defaultMessage).replace(/password=[^\s]+/gi, 'password=[REDACTED]');
    return res.status(error.status).json({
      error: safeMessage,
      code: error.code,
      constraint: error.constraint,
    });
  }

  const err = error as any;
  const status = typeof err?.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 500;
  const rawMessage = String(err?.message || defaultMessage);
  const safeMessage = rawMessage.replace(/password=[^\s]+/gi, 'password=[REDACTED]');
  return res.status(status).json({ error: safeMessage });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  // Security Hardening: Disable Express signature header
  app.disable("x-powered-by");

  // In-Memory Cache (Derivado exclusivamente do PostgreSQL Cloud SQL)
  let memoryCache: MemoryCache = {
    orders: [],
    clients: [],
    settings: DEFAULT_SETTINGS,
    auditLogs: [],
  };

  // Inicialização primária síncrona a partir do PostgreSQL Cloud SQL
  try {
    const [dbOrders, dbClients, dbSettings, dbLogs] = await Promise.allSettled([
      withTimeout(getDbOrders(), 5000, []),
      withTimeout(getDbClients(), 5000, []),
      withTimeout(getDbSettings(), 5000, null),
      withTimeout(getDbAuditLogs(), 5000, []),
    ]);

    let loadedFromSql = false;

    if (dbOrders.status === "fulfilled" && dbOrders.value.length > 0) {
      memoryCache.orders = dbOrders.value;
      loadedFromSql = true;
    }
    if (dbClients.status === "fulfilled" && dbClients.value.length > 0) {
      memoryCache.clients = dbClients.value;
      loadedFromSql = true;
    }
    if (dbSettings.status === "fulfilled" && dbSettings.value) {
      memoryCache.settings = mergePreservedSettings(dbSettings.value, DEFAULT_SETTINGS);
      loadedFromSql = true;
    }
    if (dbLogs.status === "fulfilled" && dbLogs.value.length > 0) {
      memoryCache.auditLogs = dbLogs.value;
      loadedFromSql = true;
    }

    if (loadedFromSql) {
      console.log(`[DELFILÂNDIA] PostgreSQL inicializado como FONTE DE VERDADE: ${memoryCache.orders.length} encomendas, ${memoryCache.clients.length} clientes, ${memoryCache.auditLogs.length} logs.`);
    } else {
      console.warn("[DELFILÂNDIA] PostgreSQL não retornou dados no boot. Carregando snapshot de contingência.");
      memoryCache = loadBackupStore();
    }
  } catch (err) {
    console.warn("[DELFILÂNDIA] Erro na inicialização do PostgreSQL. Carregando snapshot de contingência:", err);
    memoryCache = loadBackupStore();
  }

  app.use(compression());
  // JSON payloads are intentionally bounded. Uploads should use a dedicated,
  // authenticated upload path rather than an unbounded JSON body.
  app.use(express.json({ limit: "5mb" }));

  // Explicit CORS allowlist. In production, configure CORS_ALLOWED_ORIGINS
  // as a comma-separated list of exact origins (scheme + host + optional port).
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set(
    configuredOrigins.length > 0
      ? configuredOrigins
      : process.env.NODE_ENV === "production"
        ? []
        : ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"]
  );

  app.use((req, res, next) => {
    // Standard HTTP Security Headers
    res.header("X-Content-Type-Options", "nosniff");
    res.header("Referrer-Policy", "strict-origin-when-cross-origin");
    res.header("X-DNS-Prefetch-Control", "off");
    res.header("X-Download-Options", "noopen");

    // Disable caching for sensitive API responses
    if (req.path.startsWith("/api/")) {
      res.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.header("Pragma", "no-cache");
      res.header("Expires", "0");
    }

    const origin = req.headers.origin;
    if (origin) {
      let isSameOrigin = false;
      try {
        const parsedOrigin = new URL(origin);
        const requestHost = req.get("host");
        const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
        const requestProto = forwardedProto || (req.secure ? "https" : "http");
        isSameOrigin = parsedOrigin.host === requestHost && parsedOrigin.protocol === `${requestProto}:`;
      } catch {
        isSameOrigin = false;
      }
      if (!isSameOrigin && !allowedOrigins.has(origin)) {
        return res.status(403).json({ error: "Origem não autorizada." });
      }
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token");
    if (req.method === "OPTIONS") {
      return res.sendStatus(origin && !allowedOrigins.has(origin) ? 403 : 204);
    }
    next();
  });

  // Structured Request Logger & Latency Monitor
  app.use(requestLogger);

  // ========================================================================
  // PUBLIC API ROUTES (Sem necessidade de autenticação)
  // ========================================================================

  // Health check com verificação de conectividade segura com o PostgreSQL
  app.get("/api/health", (req, res) => {
    const dbHealthy = isSqlAvailable();
    const isConfigured = isSqlConfigured();

    if (isConfigured && !dbHealthy) {
      return res.status(503).json({
        status: "degraded",
        postgres: "disconnected",
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      status: "ok",
      postgres: isConfigured ? "connected" : "standalone",
      timestamp: new Date().toISOString(),
    });
  });

  // Auth Status check (Does NOT leak passwords or hashes)
  app.get("/api/auth/status", async (req, res) => {
    try {
      const freshDbSettings = await getDbSettings();
      if (freshDbSettings) {
        memoryCache.settings = mergePreservedSettings(freshDbSettings, memoryCache.settings);
      }
    } catch {
      // continua com cache
    }

    const isConfigured = memoryCache.settings.adminConfigured === true || Boolean(memoryCache.settings.adminPasswordHash || memoryCache.settings.adminPassword);
    
    let isLocked = false;
    let remainingSeconds = 0;
    if (memoryCache.settings.lockedUntil) {
      const lockTime = new Date(memoryCache.settings.lockedUntil).getTime();
      const now = Date.now();
      if (now < lockTime) {
        isLocked = true;
        remainingSeconds = Math.ceil((lockTime - now) / 1000);
      } else {
        memoryCache.settings.lockedUntil = undefined;
        memoryCache.settings.failedLoginAttempts = 0;
      }
    }

    const session = getSession(req);

    res.json({
      configured: isConfigured,
      adminEmail: isConfigured ? (memoryCache.settings.adminEmail || '') : '',
      adminName: memoryCache.settings.adminName || 'Administrador',
      isLocked,
      remainingSeconds,
      failedAttempts: memoryCache.settings.failedLoginAttempts || 0,
      isAuthenticated: Boolean(session),
      user: session ? session.user : null,
    });
  });

  // Initial Admin Setup Endpoint (Only allowed if admin is not configured yet)
  app.post("/api/auth/setup", async (req, res) => {
    const { adminName, adminEmail, password, rawPassword, passwordHash, salt } = req.body;
    
    const isAlreadyConfigured = memoryCache.settings.adminConfigured === true && Boolean(memoryCache.settings.adminPasswordHash);
    if (isAlreadyConfigured) {
      return res.status(403).json({ error: "A conta de administrador já foi configurada previamente." });
    }

    const plainPass = String(password || rawPassword || '').trim();
    const cleanEmail = String(adminEmail || '').trim().toLowerCase();
    const cleanName = String(adminName || 'Administrador').trim();

    if (!cleanEmail || (!plainPass && !passwordHash)) {
      return res.status(400).json({ error: "Dados incompletos para a criação da conta de administrador." });
    }

    // 1. Gera o hash scrypt seguro no backend
    let finalHash: string;
    let finalSalt: string | undefined = undefined;

    if (plainPass) {
      finalHash = await hashPassword(plainPass);
    } else if (passwordHash) {
      finalHash = passwordHash;
      finalSalt = salt;
    } else {
      return res.status(400).json({ error: "Senha inválida." });
    }

    // 2. Gera Código de Emergência seguro no backend (CSPRNG)
    const recoveryCode = generateSecureRecoveryCode();
    const recoveryCodeHash = hashRecoveryCode(recoveryCode);

    memoryCache.settings.adminConfigured = true;
    memoryCache.settings.adminName = cleanName;
    memoryCache.settings.adminEmail = cleanEmail;
    memoryCache.settings.adminPasswordHash = finalHash;
    memoryCache.settings.adminPasswordSalt = finalSalt;
    memoryCache.settings.adminRecoveryCode = recoveryCode; // Compatibilidade transitória
    (memoryCache.settings as any).adminRecoveryCodeHash = recoveryCodeHash;
    memoryCache.settings.failedLoginAttempts = 0;
    memoryCache.settings.lockedUntil = undefined;
    memoryCache.settings.adminLastLoginAt = new Date().toISOString();

    // 3. Cria Sessão Segura e Cookie HTTP-Only
    const authUser: AuthUser = {
      id: 'admin-primary',
      name: cleanName,
      email: cleanEmail,
      role: 'ADMIN',
    };
    const sessionToken = createSession(authUser, res, req);

    // 4. Security Audit Log
    const auditId = `aud-${Date.now()}`;
    const setupLog: AuditLog = {
      id: auditId,
      orderId: 'SISTEMA',
      orderCode: 'SEGURANÇA',
      action: 'Criação de Conta de Administrador',
      description: `Conta de administrador criada com sucesso para ${cleanEmail} (${cleanName}) com criptografia scrypt e sessão segura HTTP-Only.`,
      createdAt: new Date().toISOString(),
      createdBy: cleanName,
      updatedAt: new Date().toISOString(),
      updatedBy: cleanName,
    };
    memoryCache.auditLogs = [setupLog, ...memoryCache.auditLogs];

    try {
      await saveDbSettings(memoryCache.settings);
      await createDbAuditLog(setupLog);
    } catch (err) {
      console.warn("DB setup sync note:", err);
    }

    return res.json({
      success: true,
      message: "Conta de administrador configurada com sucesso!",
      adminName: cleanName,
      adminEmail: cleanEmail,
      recoveryCode, // Retornado uma única vez para o administrador anotar
      token: sessionToken,
      user: authUser,
    });
  });

  // Secure Admin Login with Rate Limiting, Scrypt & Anti Brute-Force Lockout
  app.post("/api/auth/login", async (req, res) => {
    const { email, password, rawPassword, passwordHash } = req.body;

    // 1. Sempre sincroniza com a base de dados PostgreSQL para obter as configurações mais recentes
    try {
      const freshDbSettings = await getDbSettings();
      if (freshDbSettings) {
        memoryCache.settings = mergePreservedSettings(freshDbSettings, DEFAULT_SETTINGS);
      }
    } catch (dbErr) {
      console.warn("[AUTH] Aviso ao consultar configurações no banco antes do login:", dbErr);
    }

    // Check account lockout
    if (memoryCache.settings.lockedUntil) {
      const lockTime = new Date(memoryCache.settings.lockedUntil).getTime();
      const now = Date.now();
      if (now < lockTime) {
        const remainingSeconds = Math.ceil((lockTime - now) / 1000);
        return res.status(423).json({
          error: `Conta temporariamente bloqueada por segurança devido a tentativas falhadas. Tente novamente em ${remainingSeconds} segundos.`,
          isLocked: true,
          remainingSeconds,
        });
      } else {
        // Unlock automatically when lock time expires
        memoryCache.settings.lockedUntil = undefined;
        memoryCache.settings.failedLoginAttempts = 0;
      }
    }

    const enteredEmail = String(email || '').trim().toLowerCase();
    const storedAdminEmail = String(memoryCache.settings.adminEmail || '').trim().toLowerCase();
    const storedContactEmail = String(memoryCache.settings.email || '').trim().toLowerCase();
    const plainInput = String(password || rawPassword || '').trim();

    const storedHash = memoryCache.settings.adminPasswordHash;
    const storedSalt = memoryCache.settings.adminPasswordSalt;
    const storedPlainPass = memoryCache.settings.adminPassword || memoryCache.settings.adminPin;

    // Valida correspondência de email administrativo (aceita adminEmail configurado, email de contato ou email padrão da vendedora)
    const isEmailMatch = 
      !storedAdminEmail || 
      enteredEmail === storedAdminEmail || 
      enteredEmail === storedContactEmail || 
      enteredEmail === 'acmscorporation@gmail.com';

    let isAuthenticated = false;
    let needsRehash = false;

    // Verificação autoritativa da senha no backend
    if (plainInput) {
      const verifyResult = await verifyPassword(plainInput, storedHash, storedSalt, storedPlainPass);
      if (verifyResult.isValid && isEmailMatch) {
        isAuthenticated = true;
        needsRehash = verifyResult.needsRehash;
      }
    } else if (passwordHash && storedHash && storedSalt) {
      // Fallback para hash legado se necessário
      if (isEmailMatch && passwordHash === storedHash) {
        isAuthenticated = true;
      }
    }

    if (!isAuthenticated) {
      const currentAttempts = (memoryCache.settings.failedLoginAttempts || 0) + 1;
      memoryCache.settings.failedLoginAttempts = currentAttempts;

      let isNowLocked = false;
      let remainingSeconds = 0;

      if (currentAttempts >= 5) {
        const lockDurationMs = 5 * 60 * 1000; // 5 minutos de bloqueio temporário
        memoryCache.settings.lockedUntil = new Date(Date.now() + lockDurationMs).toISOString();
        isNowLocked = true;
        remainingSeconds = 300;
      }

      // Log de Alerta de Segurança
      const warnLog: AuditLog = {
        id: `aud-${Date.now()}`,
        orderId: 'SISTEMA',
        orderCode: 'ALERTA',
        action: 'Tentativa Falhada de Login',
        description: `Tentativa de login não autorizada com o email "${enteredEmail}". Tentativa ${currentAttempts} de 5.`,
        createdAt: new Date().toISOString(),
        createdBy: 'Sistema de Segurança',
        updatedAt: new Date().toISOString(),
        updatedBy: 'Sistema de Segurança',
      };
      memoryCache.auditLogs = [warnLog, ...memoryCache.auditLogs];

      try {
        await saveDbSettings(memoryCache.settings);
        await createDbAuditLog(warnLog);
      } catch (err) {
        console.warn("DB login warning note:", err);
      }

      return res.status(401).json({
        error: isNowLocked
          ? "Limite de tentativas excedido! A conta foi temporariamente bloqueada por 5 minutos."
          : `Credenciais de acesso incorretas. Tentativa ${currentAttempts} de 5.`,
        failedAttempts: currentAttempts,
        remainingAttempts: Math.max(0, 5 - currentAttempts),
        isLocked: isNowLocked,
        remainingSeconds,
      });
    }

    // Se a credencial for de versão legada, faz o re-hash automático transparente para scrypt
    if (needsRehash && plainInput) {
      try {
        const modernHash = await hashPassword(plainInput);
        memoryCache.settings.adminPasswordHash = modernHash;
        memoryCache.settings.adminPasswordSalt = undefined;
        memoryCache.settings.adminPassword = undefined;
        memoryCache.settings.adminPin = undefined;
      } catch (err) {
        console.warn("Re-hash warning:", err);
      }
    }

    // Login BEM SUCEDIDO: Limpa tentativas e bloqueios
    memoryCache.settings.failedLoginAttempts = 0;
    memoryCache.settings.lockedUntil = undefined;
    memoryCache.settings.adminLastLoginAt = new Date().toISOString();

    const authUser: AuthUser = {
      id: 'admin-primary',
      name: memoryCache.settings.adminName || 'Administrador',
      email: memoryCache.settings.adminEmail || enteredEmail,
      role: 'ADMIN',
    };

    // Cria sessão segura com cookie HTTP-only
    const sessionToken = createSession(authUser, res, req);

    const successLog: AuditLog = {
      id: `aud-${Date.now()}`,
      orderId: 'SISTEMA',
      orderCode: 'ACESSO',
      action: 'Login de Administrador',
      description: `Sessão iniciada com sucesso por ${authUser.name} (${authUser.email}).`,
      createdAt: new Date().toISOString(),
      createdBy: authUser.name,
      updatedAt: new Date().toISOString(),
      updatedBy: authUser.name,
    };
    memoryCache.auditLogs = [successLog, ...memoryCache.auditLogs];

    try {
      await saveDbSettings(memoryCache.settings);
      await createDbAuditLog(successLog);
    } catch (err) {
      console.warn("DB login sync note:", err);
    }

    return res.json({
      success: true,
      message: "Autenticação realizada com sucesso.",
      adminName: authUser.name,
      adminEmail: authUser.email,
      token: sessionToken,
      user: authUser,
    });
  });

  // Logout Endpoint
  app.post("/api/auth/logout", (req, res) => {
    destroySession(req, res);
    res.json({ success: true, message: "Sessão encerrada com sucesso." });
  });

  // ========================================================================
  // SISTEMA DE RECUPERAÇÃO DE SENHA POR EMAIL & CHAVE MESTRA SERVER-SIDE
  // ========================================================================

  interface PasswordResetEntry {
    codeHash: string;
    email: string;
    expiresAt: number;
    attempts: number;
    requestedAt: number;
  }

  // Armazena os códigos de recuperação ativos (armazenados exclusivamente como HASH SHA-256 com salt)
  const passwordResetStore = new Map<string, PasswordResetEntry>();

  // Rate Limiting para Solicitações de Código por Email (Máx 3 pedidos a cada 15 min por IP ou email)
  const emailResetRequestTracker = new Map<string, { count: number; resetAt: number }>();

  // Rate Limiting para Validação do Código (Anti Brute-Force)
  const recoveryAttemptTracker = new Map<string, { count: number; resetAt: number }>();

  /**
   * Endpoint 1: Solicitar Código de Recuperação de 6 Dígitos por Email
   * Não revela se o email existe para prevenir User Enumeration.
   */
  const handleRequestPasswordResetCode = async (req: express.Request, res: express.Response) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const { email } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ error: "Por favor, informe o email associado à conta de administrador." });
    }

    // 1. Rate Limiting Check (Anti-Abuso/Spam): Máx 3 solicitações a cada 15 minutos por IP ou por email
    const trackerKey = `${ip}:${normalizedEmail}`;
    const tracker = emailResetRequestTracker.get(trackerKey);
    if (tracker) {
      if (now < tracker.resetAt) {
        if (tracker.count >= 3) {
          const waitMinutes = Math.ceil((tracker.resetAt - now) / 60000);
          return res.status(429).json({
            error: `Muitos pedidos de recuperação para este endereço. Aguarde ${waitMinutes} minutos antes de tentar novamente.`,
            retryAfter: waitMinutes * 60,
          });
        }
        tracker.count += 1;
      } else {
        emailResetRequestTracker.set(trackerKey, { count: 1, resetAt: now + 15 * 60 * 1000 });
      }
    } else {
      emailResetRequestTracker.set(trackerKey, { count: 1, resetAt: now + 15 * 60 * 1000 });
    }

    // 2. Sincroniza configurações do banco
    try {
      const freshDbSettings = await getDbSettings();
      if (freshDbSettings) {
        memoryCache.settings = mergePreservedSettings(freshDbSettings, DEFAULT_SETTINGS);
      }
    } catch {
      // continua com memória
    }

    const storedAdminEmail = String(memoryCache.settings.adminEmail || 'acmscorporation@gmail.com').trim().toLowerCase();
    const storedContactEmail = String(memoryCache.settings.email || '').trim().toLowerCase();

    const isMatch = (normalizedEmail === storedAdminEmail || normalizedEmail === storedContactEmail || normalizedEmail === 'acmscorporation@gmail.com');

    // Se o email corresponder à conta administrativa autorizada, gera e envia o código
    if (isMatch) {
      // 3. Gera código numérico de 6 dígitos criptograficamente seguro (CSPRNG)
      const resetCode = generatePasswordResetCode();
      const codeHash = hashPasswordResetCode(resetCode, normalizedEmail);

      // 4. Armazena com validade de 15 minutos e máximo 5 tentativas de validação
      passwordResetStore.set(normalizedEmail, {
        codeHash,
        email: normalizedEmail,
        expiresAt: now + 15 * 60 * 1000,
        attempts: 0,
        requestedAt: now,
      });

      // 5. Envia o email transacional
      const adminName = memoryCache.settings.adminName || 'Administrador';
      try {
        await sendPasswordResetEmail(normalizedEmail, resetCode, adminName);
      } catch (emailErr) {
        console.error("[AUTH] Erro ao disparar email de recuperação:", emailErr);
      }

      // 6. Registra no Audit Log de Segurança
      const maskedEmail = normalizedEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      const resetReqLog: AuditLog = {
        id: `aud-${Date.now()}`,
        orderId: 'SISTEMA',
        orderCode: 'RECUPERAÇÃO',
        action: 'Solicitação de Código de Recuperação',
        description: `Código de verificação de 6 dígitos gerado e enviado para ${maskedEmail} (IP: ${ip}). Validade de 15 minutos.`,
        createdAt: new Date().toISOString(),
        createdBy: 'Sistema de Recuperação',
        updatedAt: new Date().toISOString(),
        updatedBy: 'Sistema de Recuperação',
      };
      memoryCache.auditLogs = [resetReqLog, ...memoryCache.auditLogs];
      try {
        await createDbAuditLog(resetReqLog);
      } catch {
        // ignore
      }
    } else {
      console.log(`[AUTH] Pedido de recuperação para email não associado à conta admin: ${normalizedEmail}`);
    }

    // 7. Resposta genérica segura (Anti User-Enumeration)
    return res.json({
      success: true,
      message: "Se o email informado corresponder à conta administrativa autorizada, um código de verificação de 6 dígitos foi enviado. Por favor verifique a sua caixa de entrada e pasta de spam.",
      expiresInMinutes: 15,
    });
  };

  app.post("/api/auth/recover/request-code", handleRequestPasswordResetCode);
  app.post("/api/auth/forgot-password", handleRequestPasswordResetCode);

  /**
   * Endpoint 2: Validar Código de 6 Dígitos e Redefinir Senha
   * Suporta tanto o fluxo por Email quanto a Chave Mestra Server-Side de contingência.
   */
  const handleVerifyResetCodeAndSetPassword = async (req: express.Request, res: express.Response) => {
    // PRODUCTION AUTH MUTATION GUARD (Checked first before rate limits)
    if (
      req.headers['x-test-mutation-guard'] === 'true' ||
      req.headers['x-delfilandia-test-suite'] === 'true' ||
      req.body?.isTestMutation === true
    ) {
      return res.status(403).json({
        error: "SAFETY BLOCK: test suite cannot modify production authentication state",
        blocked: true,
      });
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    // Rate Limiting Check: Máximo 10 tentativas a cada 10 minutos por IP
    const tracker = recoveryAttemptTracker.get(ip);
    if (tracker) {
      if (now < tracker.resetAt) {
        if (tracker.count >= 10) {
          const waitSeconds = Math.ceil((tracker.resetAt - now) / 1000);
          return res.status(429).json({
            error: `Muitas tentativas de recuperação. Por favor, tente novamente em ${waitSeconds} segundos.`,
            retryAfter: waitSeconds,
          });
        }
      } else {
        recoveryAttemptTracker.set(ip, { count: 0, resetAt: now + 10 * 60 * 1000 });
      }
    } else {
      recoveryAttemptTracker.set(ip, { count: 0, resetAt: now + 10 * 60 * 1000 });
    }

    const {
      email,
      code,
      resetCode,
      recoveryCode,
      recoverySecret,
      adminRecoverySecret,
      newPassword,
      rawPassword,
      newPasswordHash,
      newSalt,
    } = req.body;

    const normalizedEmail = String(email || memoryCache.settings.adminEmail || 'acmscorporation@gmail.com').trim().toLowerCase();
    const enteredCode = String(code || resetCode || recoveryCode || '').trim();
    const enteredSecret = String(adminRecoverySecret || recoverySecret || '').trim();

    let isAuthorized = false;
    let recoveryMethod = '';

    // A) Validação com Chave Mestra Server-Side (ADMIN_RECOVERY_SECRET) — Contingência de Infraestrutura
    if (enteredSecret) {
      if (verifyAdminRecoverySecret(enteredSecret)) {
        isAuthorized = true;
        recoveryMethod = 'Chave Mestra Server-Side';
      }
    }

    // B) Validação com Código de 6 Dígitos enviado por Email (CSPRNG + Hash SHA-256)
    if (!isAuthorized && enteredCode && normalizedEmail) {
      const resetEntry = passwordResetStore.get(normalizedEmail);
      if (resetEntry) {
        if (now > resetEntry.expiresAt) {
          passwordResetStore.delete(normalizedEmail);
          return res.status(400).json({
            error: "O código de verificação expirou (validade de 15 minutos). Por favor, solicite um novo código.",
          });
        }

        if (resetEntry.attempts >= 5) {
          passwordResetStore.delete(normalizedEmail);
          return res.status(429).json({
            error: "Limite de tentativas excedido para este código. Por favor, solicite um novo código de verificação por email.",
          });
        }

        resetEntry.attempts += 1;

        if (verifyPasswordResetCode(enteredCode, normalizedEmail, resetEntry.codeHash)) {
          isAuthorized = true;
          recoveryMethod = 'Código de Verificação por Email';
          // USO ÚNICO: Remove o código imediatamente após validação bem-sucedida
          passwordResetStore.delete(normalizedEmail);
        } else {
          return res.status(400).json({
            error: `Código de verificação incorreto. Restam ${Math.max(0, 5 - resetEntry.attempts)} tentativas.`,
            remainingAttempts: Math.max(0, 5 - resetEntry.attempts),
          });
        }
      }
    }

    // C) Fallback transitório de compatibilidade para Códigos de Emergência legados
    if (!isAuthorized && enteredCode) {
      const storedCode = memoryCache.settings.adminRecoveryCode || '';
      const storedCodeHash = (memoryCache.settings as any).adminRecoveryCodeHash;
      if (verifyRecoveryCode(enteredCode.toUpperCase(), storedCodeHash || storedCode)) {
        isAuthorized = true;
        recoveryMethod = 'Código de Emergência';
      }
    }

    // Se falhou em todas as validações
    if (!isAuthorized) {
      const currentTracker = recoveryAttemptTracker.get(ip)!;
      currentTracker.count += 1;

      // Log de Alerta de Segurança
      const failAudit: AuditLog = {
        id: `aud-${Date.now()}`,
        orderId: 'SISTEMA',
        orderCode: 'ALERTA',
        action: 'Tentativa Falhada de Recuperação',
        description: `Tentativa de recuperação inválida para "${normalizedEmail}" (Origem: ${ip}, Tentativa ${currentTracker.count}/5).`,
        createdAt: new Date().toISOString(),
        createdBy: 'Sistema de Segurança',
        updatedAt: new Date().toISOString(),
        updatedBy: 'Sistema de Segurança',
      };
      memoryCache.auditLogs = [failAudit, ...memoryCache.auditLogs];

      try {
        await createDbAuditLog(failAudit);
      } catch (err) {
        console.warn("DB recovery audit warning note:", err);
      }

      return res.status(401).json({
        error: "Código de verificação ou credencial de recuperação inválida.",
        remainingAttempts: Math.max(0, 5 - currentTracker.count),
      });
    }

    // Validação da Nova Senha
    const plainPass = String(newPassword || rawPassword || '').trim();
    if (plainPass.length < 6 && !newPasswordHash) {
      return res.status(400).json({ error: "A nova senha deve conter pelo menos 6 caracteres." });
    }

    // Evita senha igual ao segredo
    if (enteredSecret && plainPass === enteredSecret) {
      return res.status(400).json({ error: "A nova senha não pode ser idêntica à chave de recuperação." });
    }

    // 1. Gera o novo hash scrypt
    let finalHash: string;
    let finalSalt: string | undefined = undefined;

    if (plainPass) {
      finalHash = await hashPassword(plainPass);
    } else if (newPasswordHash) {
      finalHash = newPasswordHash;
      finalSalt = newSalt;
    } else {
      return res.status(400).json({ error: "Nova senha inválida." });
    }

    // Sincroniza configurações do banco antes de atualizar
    try {
      const freshDbSettings = await getDbSettings();
      if (freshDbSettings) {
        memoryCache.settings = mergePreservedSettings(freshDbSettings, DEFAULT_SETTINGS);
      }
    } catch {
      // continua
    }

    const targetEmail = normalizedEmail || memoryCache.settings.adminEmail || 'acmscorporation@gmail.com';

    // 2. Gera novo Código de Emergência CSPRNG e respectivo hash seguro
    const newEmergencyCode = generateSecureRecoveryCode();
    const newEmergencyCodeHash = hashRecoveryCode(newEmergencyCode);

    // 3. Atualiza estado de segurança com a nova senha scrypt e novo código
    memoryCache.settings.adminConfigured = true;
    memoryCache.settings.adminEmail = targetEmail;
    memoryCache.settings.adminPasswordHash = finalHash;
    memoryCache.settings.adminPasswordSalt = finalSalt;
    memoryCache.settings.adminRecoveryCode = newEmergencyCode;
    (memoryCache.settings as any).adminRecoveryCodeHash = newEmergencyCodeHash;
    memoryCache.settings.adminPassword = undefined;
    memoryCache.settings.adminPin = undefined;
    memoryCache.settings.failedLoginAttempts = 0;
    memoryCache.settings.lockedUntil = undefined;

    // 4. Invalida todas as sessões anteriores imediatamente
    destroyAllSessions();

    // 5. Reseta contador de tentativas deste IP
    recoveryAttemptTracker.delete(ip);

    // 6. Registra evento no Audit Log de Segurança (sem segredos ou senhas)
    const recoverLog: AuditLog = {
      id: `aud-${Date.now()}`,
      orderId: 'SISTEMA',
      orderCode: 'RECUPERAÇÃO',
      action: 'ADMIN_ACCESS_RECOVERY',
      description: `Acesso administrativo recuperado com sucesso para ${targetEmail} via ${recoveryMethod}. Sessões anteriores invalidadas e nova credencial scrypt persistida.`,
      createdAt: new Date().toISOString(),
      createdBy: recoveryMethod,
      updatedAt: new Date().toISOString(),
      updatedBy: recoveryMethod,
    };
    memoryCache.auditLogs = [recoverLog, ...memoryCache.auditLogs];

    try {
      await saveDbSettings(memoryCache.settings);
      await createDbAuditLog(recoverLog);
    } catch (err) {
      console.warn("DB recover sync note:", err);
    }

    return res.json({
      success: true,
      message: "Senha administrativa redefinida com sucesso! Pode agora iniciar sessão com a nova senha.",
      adminEmail: targetEmail,
      emergencyCode: newEmergencyCode,
    });
  };

  app.post("/api/auth/recover/verify-code", handleVerifyResetCodeAndSetPassword);
  app.post("/api/auth/recover", handleVerifyResetCodeAndSetPassword);


  // Alterar Senha e Email do Administrador (Protegido por Autenticação)
  app.post("/api/auth/change-credentials", requireAuth, async (req, res) => {
    const { currentPassword, newPassword, newEmail, adminName } = req.body;

    const plainCurrent = String(currentPassword || '').trim();
    if (!plainCurrent) {
      return res.status(400).json({ error: "Por favor, informe a senha atual para autorizar as alterações." });
    }

    const storedHash = memoryCache.settings.adminPasswordHash;
    const storedSalt = memoryCache.settings.adminPasswordSalt;
    const storedPlain = memoryCache.settings.adminPassword || memoryCache.settings.adminPin;

    const verifyCurrent = await verifyPassword(plainCurrent, storedHash, storedSalt, storedPlain);
    if (!verifyCurrent.isValid) {
      return res.status(401).json({ error: 'A "Senha Atual" informada está incorreta.' });
    }

    if (newEmail) {
      memoryCache.settings.adminEmail = String(newEmail).trim().toLowerCase();
    }
    if (adminName) {
      memoryCache.settings.adminName = String(adminName).trim();
    }

    const plainNew = String(newPassword || '').trim();
    if (plainNew) {
      if (plainNew.length < 6) {
        return res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres." });
      }
      const newHash = await hashPassword(plainNew);
      memoryCache.settings.adminPasswordHash = newHash;
      memoryCache.settings.adminPasswordSalt = undefined;
      memoryCache.settings.adminPassword = undefined;
      memoryCache.settings.adminPin = undefined;
    }

    const auditLog: AuditLog = {
      id: `aud-${Date.now()}`,
      orderId: 'SISTEMA',
      orderCode: 'SEGURANÇA',
      action: 'Alteração de Credenciais',
      description: `Credenciais de administrador alteradas com sucesso.`,
      createdAt: new Date().toISOString(),
      createdBy: memoryCache.settings.adminName || 'Administrador',
      updatedAt: new Date().toISOString(),
      updatedBy: memoryCache.settings.adminName || 'Administrador',
    };
    memoryCache.auditLogs = [auditLog, ...memoryCache.auditLogs];

    try {
      await saveDbSettings(memoryCache.settings);
      await createDbAuditLog(auditLog);
    } catch (err) {
      console.warn("DB change-credentials sync note:", err);
    }

    return res.json({
      success: true,
      message: "Credenciais atualizadas com sucesso!",
      adminName: memoryCache.settings.adminName,
      adminEmail: memoryCache.settings.adminEmail,
    });
  });

  // Public Order Tracking Lookup (ULTRA-FAST & 100% PÚBLICO: higienizado para clientes com PostgreSQL como fonte primária)
  app.get("/api/track/:code", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const query = (req.params.code || "").trim();
    if (!query || /[\x00-\x1F\x7F]/.test(query) || query.length > 60) {
      return res.status(400).json({ error: "Código de rastreio inválido" });
    }

    try {
      // 1. Consulta primária oficial ao PostgreSQL
      let found: Order | null = null;
      try {
        found = await withTimeout(getDbOrderByCode(query), 1500, null);
      } catch (err) {
        console.warn(`[TRACK] Consulta direta ao PostgreSQL falhou para ${query}:`, err);
      }

      // 2. Fallback de alta performance para cache derivado em memória
      if (!found) {
        found = memoryCache.orders.find((o) => matchOrderCode(o, query)) || null;
      }

      if (!found) {
        return res.status(404).json({ error: "Encomenda não encontrada ou link inativo", code: query });
      }

      // 3. Sanitização obrigatória para garantir estrita privacidade pública
      const publicView = sanitizeOrderForPublic(found, memoryCache.settings);
      return res.json({ order: publicView });
    } catch (error) {
      return handleApiError(res, error, "Erro ao consultar rastreio no PostgreSQL");
    }
  });

  // ========================================================================
  // PROTECTED ADMINISTRATIVE API ROUTES (Requer Sessão Segura de Admin)
  // ========================================================================

  // Get full data (Protegido por Autenticação - Carregamento Direto do PostgreSQL)
  app.get("/api/data", requireAuth, async (req, res) => {
    try {
      const [dbOrders, dbClients, dbSettings, dbLogs] = await Promise.all([
        getDbOrders(),
        getDbClients(),
        getDbSettings(),
        getDbAuditLogs(),
      ]);

      // Atualiza cache em memória derivado
      memoryCache.orders = dbOrders;
      memoryCache.clients = dbClients;
      if (dbSettings) {
        memoryCache.settings = mergePreservedSettings(dbSettings, memoryCache.settings);
      }
      memoryCache.auditLogs = dbLogs;

      return res.json({
        orders: memoryCache.orders,
        clients: memoryCache.clients,
        settings: memoryCache.settings,
        auditLogs: memoryCache.auditLogs,
      });
    } catch (error) {
      return handleApiError(res, error, "Erro ao recuperar dados do PostgreSQL");
    }
  });

  // Get orders (Protegido por Autenticação)
  app.get("/api/orders", requireAuth, async (req, res) => {
    try {
      const dbOrders = await getDbOrders();
      memoryCache.orders = dbOrders;
      return res.json({ orders: memoryCache.orders });
    } catch (error) {
      return handleApiError(res, error, "Erro ao recuperar encomendas");
    }
  });

  // Get clients (Protegido por Autenticação)
  app.get("/api/clients", requireAuth, async (req, res) => {
    try {
      const dbClients = await getDbClients();
      memoryCache.clients = dbClients;
      return res.json({ clients: memoryCache.clients });
    } catch (error) {
      return handleApiError(res, error, "Erro ao recuperar clientes");
    }
  });

  // Get settings (Protegido por Autenticação)
  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const dbSettings = await getDbSettings();
      if (dbSettings) {
        memoryCache.settings = mergePreservedSettings(dbSettings, memoryCache.settings);
      }
      return res.json({ settings: memoryCache.settings });
    } catch (error) {
      return handleApiError(res, error, "Erro ao recuperar configurações");
    }
  });

  // Get audit logs (Protegido por Autenticação)
  app.get("/api/audit-logs", requireAuth, async (req, res) => {
    try {
      const dbLogs = await getDbAuditLogs();
      memoryCache.auditLogs = dbLogs;
      return res.json({ auditLogs: memoryCache.auditLogs });
    } catch (error) {
      return handleApiError(res, error, "Erro ao recuperar logs de auditoria");
    }
  });

  // Create Single Order endpoint (Protegido por Autenticação)
  app.post("/api/orders/new", requireAuth, async (req, res) => {
    try {
      const { newOrder, newClient } = req.body;
      if (!newOrder || !newOrder.code) {
        return res.status(400).json({ error: "Dados de encomenda inválidos: código obrigatório" });
      }

      // 1. Se houver novo cliente associado, persiste primeiro no PostgreSQL para garantir chave estrangeira
      if (newClient && newClient.id && newClient.name) {
        await saveDbClient(newClient);
      }

      // 2. Persiste a encomenda no PostgreSQL com confirmação síncrona
      const savedOrder = await saveDbOrder(newOrder);

      // 3. Atualiza cache em memória SOMENTE após confirmação do PostgreSQL
      memoryCache.orders = [savedOrder, ...memoryCache.orders.filter((o) => o.code !== savedOrder.code && o.id !== savedOrder.id)];
      if (newClient && newClient.id) {
        memoryCache.clients = [newClient, ...memoryCache.clients.filter((c) => c.id !== newClient.id)];
      }

      return res.status(201).json({ success: true, order: savedOrder });
    } catch (error) {
      return handleApiError(res, error, "Erro ao criar encomenda no PostgreSQL");
    }
  });

  // Delete Single Order endpoint (Protegido por Autenticação)
  app.delete("/api/orders/:idOrCode", requireAdmin, async (req, res) => {
    try {
      const target = (req.params.idOrCode || "").trim();
      if (!target) {
        return res.status(400).json({ error: "Identificador de encomenda inválido" });
      }

      // 1. Localiza a encomenda no cache para obter código exato se necessário
      const matchingOrder = memoryCache.orders.find(
        (o) => o.id === target || o.code === target || matchOrderCode(o, target)
      );
      const codeToDelete = matchingOrder ? matchingOrder.code : target;

      // 2. Confirmação síncrona da exclusão no PostgreSQL
      const deleted = await deleteDbOrder(codeToDelete);

      // 3. Atualiza cache em memória SOMENTE após confirmação do PostgreSQL
      const deletedOrders = memoryCache.orders.filter(
        (o) => o.id === target || o.code === target || matchOrderCode(o, target)
      );

      memoryCache.orders = memoryCache.orders.filter(
        (o) => o.id !== target && o.code !== target && !matchOrderCode(o, target)
      );

      return res.json({ 
        success: true, 
        message: "Encomenda eliminada com sucesso", 
        remaining: memoryCache.orders.length,
        deletedCount: deleted ? 1 : deletedOrders.length 
      });
    } catch (error) {
      return handleApiError(res, error, "Erro ao eliminar encomenda no PostgreSQL");
    }
  });

  // Update Single Order endpoint (Protegido por Autenticação)
  app.put("/api/orders/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { updatedOrder, auditLog } = req.body;
      if (!updatedOrder || !updatedOrder.code) {
        return res.status(400).json({ error: "Dados de atualização inválidos: código obrigatório" });
      }

      // 1. Persiste a encomenda e o log transacionalmente no PostgreSQL
      const savedOrder = await saveDbOrder(updatedOrder, auditLog);

      // 2. Atualiza memória SOMENTE após confirmação do PostgreSQL
      memoryCache.orders = memoryCache.orders.map((o) => (o.id === id || o.code === savedOrder.code ? savedOrder : o));
      if (auditLog && auditLog.id) {
        memoryCache.auditLogs = [auditLog, ...memoryCache.auditLogs.filter((l) => l.id !== auditLog.id)];
      }

      return res.json({ success: true, order: savedOrder });
    } catch (error) {
      return handleApiError(res, error, "Erro ao atualizar encomenda no PostgreSQL");
    }
  });

  // Delete/Purge All Orders endpoint (Protegido por Autenticação)
  app.delete("/api/orders", requireAdmin, async (req, res) => {
    try {
      // 1. Confirmação atômica no PostgreSQL
      await saveDbOrders([]);

      // 2. Atualiza memória SOMENTE após confirmação
      memoryCache.orders = [];
      return res.json({ success: true, message: "Todas as encomendas foram eliminadas" });
    } catch (error) {
      return handleApiError(res, error, "Erro ao purgar encomendas no PostgreSQL");
    }
  });

  // Save Orders Batch (Protegido por Autenticação)
  app.post("/api/orders", requireAdmin, async (req, res) => {
    try {
      const { orders } = req.body;
      if (!Array.isArray(orders)) {
        return res.status(400).json({ error: "Lista de encomendas inválida" });
      }
      // An empty replacement batch must never implicitly purge production orders.
      if (orders.length === 0) {
        return res.status(400).json({
          error: "A lista vazia não pode substituir nem eliminar encomendas. Utilize um procedimento administrativo explícito.",
          code: "EMPTY_ORDER_BATCH",
        });
      }

      // 1. Confirmação transacional no PostgreSQL
      await saveDbOrders(orders);

      // 2. Atualiza memória SOMENTE após confirmação
      memoryCache.orders = orders;

      return res.json({ success: true, count: memoryCache.orders.length });
    } catch (error) {
      return handleApiError(res, error, "Erro ao gravar lote de encomendas no PostgreSQL");
    }
  });

  // Save clients (Protegido por Autenticação)
  app.post("/api/clients", requireAuth, async (req, res) => {
    try {
      const { clients, client } = req.body;

      if (Array.isArray(clients)) {
        // 1. Confirmação transacional no PostgreSQL
        await saveDbClients(clients);

        // 2. Atualiza memória SOMENTE após confirmação
        memoryCache.clients = clients;
        return res.json({ success: true, count: memoryCache.clients.length });
      }

      if (client && client.id) {
        // 1. Confirmação síncrona no PostgreSQL
        const saved = await saveDbClient(client);

        // 2. Atualiza memória SOMENTE após confirmação
        memoryCache.clients = [saved, ...memoryCache.clients.filter((c) => c.id !== saved.id)];
        return res.json({ success: true, client: saved });
      }

      return res.status(400).json({ error: "Dados de clientes inválidos" });
    } catch (error) {
      return handleApiError(res, error, "Erro ao gravar cliente(s) no PostgreSQL");
    }
  });

  // Save settings (Protegido por Autenticação)
  app.post("/api/settings", requireAdmin, async (req, res) => {
    try {
      const { settings } = req.body;
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: "Objeto de configurações inválido" });
      }

      // Sincroniza do banco primeiro para garantir integridade
      let currentDbSettings = memoryCache.settings;
      try {
        const fresh = await getDbSettings();
        if (fresh) {
          currentDbSettings = fresh;
        }
      } catch {
        // continua
      }

      // Remove campos sensíveis de autenticação do payload de configurações gerais
      const safeIncoming = { ...settings };
      delete safeIncoming.adminPasswordHash;
      delete safeIncoming.adminPasswordSalt;
      delete safeIncoming.adminRecoveryCodeHash;
      delete safeIncoming.adminRecoveryCode;
      delete safeIncoming.adminPassword;
      delete safeIncoming.adminPin;
      delete safeIncoming.failedLoginAttempts;
      delete safeIncoming.lockedUntil;

      const merged = mergePreservedSettings(safeIncoming, currentDbSettings);

      // 1. Confirmação no PostgreSQL
      await saveDbSettings(merged);

      // 2. Atualiza memória SOMENTE após confirmação
      memoryCache.settings = merged;

      return res.json({ success: true, settings: memoryCache.settings });
    } catch (error) {
      return handleApiError(res, error, "Erro ao salvar configurações no PostgreSQL");
    }
  });

  // Save audit logs (Protegido por Autenticação)
  app.post("/api/audit-logs", requireAdmin, async (req, res) => {
    try {
      const { auditLogs, auditLog } = req.body;

      if (Array.isArray(auditLogs)) {
        // 1. Confirmação transacional no PostgreSQL
        await saveDbAuditLogs(auditLogs);

        // 2. Atualiza memória SOMENTE após confirmação
        memoryCache.auditLogs = auditLogs;
        return res.json({ success: true, count: memoryCache.auditLogs.length });
      }

      if (auditLog && auditLog.id) {
        // 1. Confirmação síncrona no PostgreSQL
        const saved = await createDbAuditLog(auditLog);

        // 2. Atualiza memória SOMENTE após confirmação
        memoryCache.auditLogs = [saved, ...memoryCache.auditLogs.filter((l) => l.id !== saved.id)];
        return res.json({ success: true, auditLog: saved });
      }

      return res.status(400).json({ error: "Dados de logs de auditoria inválidos" });
    } catch (error) {
      return handleApiError(res, error, "Erro ao gravar log(s) de auditoria no PostgreSQL");
    }
  });

  // 404 Handler para rotas de API inexistentes (Garante respostas JSON consistentes)
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: "Endpoint de API não encontrado", path: req.path });
  });

  // Vite Middleware for SPA
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      maxAge: '7d',
      etag: true,
      index: false,
    }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`DELFILÂNDIA Server running on http://localhost:${PORT}`);
  });

  // Graceful Shutdown Handler
  const shutdown = async (signal: string) => {
    console.log(`[DELFILÂNDIA] Recebido sinal ${signal}. Iniciando encerramento suave...`);
    server.close(async () => {
      console.log("[DELFILÂNDIA] Servidor HTTP encerrado.");
      await closePool();
      console.log("[DELFILÂNDIA] Pool PostgreSQL finalizado.");
      process.exit(0);
    });

    // Forçar encerramento caso trave após 10s
    setTimeout(() => {
      console.error("[DELFILÂNDIA] Forçando encerramento após timeout.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();
