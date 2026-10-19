/**
 * ============================================================================
 * DELFILÂNDIA - AUTHENTICATION & AUTHORIZATION MIDDLEWARE
 * ============================================================================
 * 
 * Fornece proteção de rotas com autoridade final no Backend (OWASP).
 * Gerenciamento de Sessão com Cookies HTTP-Only Seguros e Tokens CSPRNG.
 */

import { Request, Response, NextFunction } from 'express';
import { generateSessionToken } from '../utils/crypto';

export type UserRole = 'ADMIN' | 'OPERATOR';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface SessionData {
  token: string;
  user: AuthUser;
  createdAt: number;
  expiresAt: number;
}

// Store de Sessões em Memória (Sessões Ativas)
const sessionStore = new Map<string, SessionData>();

// Duração padrão da sessão: 7 dias (em ms)
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = 'delfilandia_session';

/**
 * Utilitário para extrair cookies do cabeçalho da requisição
 */
function parseCookies(req: Request): Record<string, string> {
  const list: Record<string, string> = {};
  const rc = req.headers.cookie;

  if (rc) {
    rc.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      const name = parts.shift()?.trim();
      if (name) {
        try {
          const val = decodeURIComponent(parts.join('='));
          list[name] = val;
        } catch {
          list[name] = parts.join('=');
        }
      }
    });
  }

  return list;
}

/**
 * Cria uma sessão segura no backend, define o cookie HTTP-Only e retorna o token
 */
export function createSession(user: AuthUser, res: Response, req?: Request): string {
  const token = generateSessionToken();
  const now = Date.now();

  const session: SessionData = {
    token,
    user,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  sessionStore.set(token, session);

  // Configuração do Cookie HTTP-Only Seguro
  const isProduction = process.env.NODE_ENV === 'production';
  const isHttps = req ? (req.secure || req.headers['x-forwarded-proto'] === 'https') : false;
  const cookieOptions = [
    `${COOKIE_NAME}=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];

  if (isProduction || isHttps) {
    cookieOptions.push(`Secure`);
  }

  res.setHeader('Set-Cookie', cookieOptions.join('; '));
  return token;
}

/**
 * Destrói a sessão atual e limpa o cookie
 */
export function destroySession(req: Request, res: Response): void {
  const token = extractToken(req);
  if (token) {
    sessionStore.delete(token);
  }

  // Limpa o cookie no cliente
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );
}

/**
 * Invalida todas as sessões ativas no sistema (ex: após recuperação/reset de senha)
 */
export function destroyAllSessions(): void {
  sessionStore.clear();
}

/**
 * Extrai o token de autenticação do Cookie HTTP-Only ou do Header Authorization (Bearer)
 */
function extractToken(req: Request): string | null {
  // 1. Tenta obter do Cookie HTTP-Only
  const cookies = parseCookies(req);
  if (cookies[COOKIE_NAME]) {
    return cookies[COOKIE_NAME];
  }

  // 2. Fallback para cabeçalho Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * Recupera e valida a sessão ativa a partir da requisição
 */
export function getSession(req: Request): SessionData | null {
  const token = extractToken(req);
  if (!token) return null;

  const session = sessionStore.get(token);
  if (!session) return null;

  // Verifica expiração
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(token);
    return null;
  }

  return session;
}

/**
 * Middleware: Exige que a requisição seja autenticada com sessão válida
 * Retorna HTTP 401 caso não autenticado.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);

  if (!session) {
    return res.status(401).json({
      error: 'Não autenticado. Por favor, inicie sessão como administrador para aceder a este recurso.',
      authenticated: false,
    });
  }

  // Injeta o usuário autenticado na requisição
  (req as any).user = session.user;
  (req as any).session = session;
  next();
}

/**
 * Middleware: Exige que o usuário autenticado tenha perfil de ADMIN
 * Retorna HTTP 403 caso autenticado porém sem permissão.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    const user = (req as any).user as AuthUser;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Acesso negado. Apenas administradores podem executar esta operação.',
        authorized: false,
      });
    }
    next();
  });
}

/**
 * Middleware Opcional: Anexa os dados da sessão caso exista, sem bloquear caso anônimo
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (session) {
    (req as any).user = session.user;
    (req as any).session = session;
  }
  next();
}
