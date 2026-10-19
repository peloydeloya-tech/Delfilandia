/**
 * ============================================================================
 * DELFILÂNDIA - CRYPTOGRAPHIC & PASSWORD SECURITY ENGINE
 * ============================================================================
 * 
 * Implementação padrão de segurança industrial para Hashing de Senhas,
 * Geração CSPRNG de Tokens e Verificação à prova de Timing Attacks (OWASP).
 * 
 * Algoritmo Principal: scrypt (N=16384, r=8, p=1, keylen=64) com salt CSPRNG de 16 bytes.
 * Suporta migração automática e transparente de hashes legados SHA-256.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
  keylen: 64,
};

const SECRET_KEY_FILE = path.join(process.cwd(), 'data', '.recovery_secret');

let inMemoryRecoverySecret: string | null = null;

/**
 * Obtém a Chave Mestra Server-Side (ADMIN_RECOVERY_SECRET)
 * Prioridade:
 * 1. process.env.ADMIN_RECOVERY_SECRET (Cloud Run / Secret Manager / Environment)
 * 2. In-Memory Cache de Sessão do Servidor
 * 3. Fallback de Desenvolvimento Local (/data/.recovery_secret)
 * 
 * Regra: NUNCA depende do filesystem em produção Cloud Run e NUNCA expõe o valor ao frontend.
 */
export function getOrInitAdminRecoverySecret(): string {
  if (process.env.ADMIN_RECOVERY_SECRET && process.env.ADMIN_RECOVERY_SECRET.trim()) {
    return process.env.ADMIN_RECOVERY_SECRET.trim();
  }

  if (inMemoryRecoverySecret) {
    return inMemoryRecoverySecret;
  }

  // Fallback para desenvolvimento local
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (fs.existsSync(SECRET_KEY_FILE)) {
      const secret = fs.readFileSync(SECRET_KEY_FILE, 'utf-8').trim();
      if (secret) {
        inMemoryRecoverySecret = secret;
        return secret;
      }
    }
  } catch {
    // Ignora erro de leitura local
  }

  // Gera chave volátil em memória segura para a instância
  const generatedSecret = `DELFI_SEC_RECOVERY_${crypto.randomBytes(16).toString('hex')}`;
  inMemoryRecoverySecret = generatedSecret;

  // Tenta salvar localmente APENAS se for ambiente de desenvolvimento não-produção
  if (process.env.NODE_ENV !== 'production') {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(SECRET_KEY_FILE, generatedSecret, { encoding: 'utf-8', mode: 0o600 });
    } catch {
      // Ignora falha de escrita em ambientes restritos
    }
  }

  return generatedSecret;
}

/**
 * Gera um hash scrypt seguro para armazenamento de senha
 */
export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(
      password.trim(),
      salt,
      SCRYPT_PARAMS.keylen,
      { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p, maxmem: SCRYPT_PARAMS.maxmem },
      (err, derivedKey) => {
        if (err) return reject(err);
        const hashHex = derivedKey.toString('hex');
        // Formato estruturado de armazenamento de credencial
        resolve(`$scrypt$v=1$N=${SCRYPT_PARAMS.N},r=${SCRYPT_PARAMS.r},p=${SCRYPT_PARAMS.p}$${salt}$${hashHex}`);
      }
    );
  });
}

/**
 * Computa o hash legado SHA-256 (compatibilidade com versões anteriores)
 */
function computeLegacySha256(password: string, salt: string): string {
  return crypto
    .createHash('sha256')
    .update(`${salt}:${password.trim()}:delfilandia_security_salt_2026`)
    .digest('hex');
}

/**
 * Verifica uma senha contra um hash armazenado (compara com timingSafeEqual)
 * Suporta tanto hashes modernos scrypt quanto hashes legados SHA-256 e senhas legadas
 */
export function verifyPassword(
  plainPassword: string,
  storedHash: string | undefined,
  legacySalt?: string,
  legacyPlainPassword?: string
): Promise<{ isValid: boolean; needsRehash: boolean }> {
  return new Promise((resolve) => {
    if (!plainPassword) {
      return resolve({ isValid: false, needsRehash: false });
    }

    const trimmed = plainPassword.trim();

    // 1. Verificação com scrypt moderno
    if (storedHash && storedHash.startsWith('$scrypt$')) {
      const parts = storedHash.split('$');
      // Esperado: ['', 'scrypt', 'v=1', 'N=...,r=...,p=...', salt, hashHex]
      if (parts.length >= 6) {
        const salt = parts[4];
        const originalHashHex = parts[5];

        crypto.scrypt(
          trimmed,
          salt,
          SCRYPT_PARAMS.keylen,
          { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p, maxmem: SCRYPT_PARAMS.maxmem },
          (err, derivedKey) => {
            if (err) return resolve({ isValid: false, needsRehash: false });

            const derivedHashBuf = Buffer.from(derivedKey.toString('hex'), 'utf-8');
            const originalHashBuf = Buffer.from(originalHashHex, 'utf-8');

            if (derivedHashBuf.length === originalHashBuf.length && crypto.timingSafeEqual(derivedHashBuf, originalHashBuf)) {
              return resolve({ isValid: true, needsRehash: false });
            }
            return resolve({ isValid: false, needsRehash: false });
          }
        );
        return;
      }
    }

    // 2. Verificação com hash legado SHA-256 + salt
    if (storedHash && legacySalt) {
      const computedLegacy = computeLegacySha256(trimmed, legacySalt);
      const computedBuf = Buffer.from(computedLegacy, 'utf-8');
      const storedBuf = Buffer.from(storedHash, 'utf-8');

      if (computedBuf.length === storedBuf.length && crypto.timingSafeEqual(computedBuf, storedBuf)) {
        return resolve({ isValid: true, needsRehash: true });
      }
    }

    // 3. Fallback de migração para senha legada em texto (se ainda existir nos dados iniciais)
    if (legacyPlainPassword && trimmed === legacyPlainPassword.trim()) {
      return resolve({ isValid: true, needsRehash: true });
    }

    return resolve({ isValid: false, needsRehash: false });
  });
}

/**
 * Gera um Código de Emergência seguro com CSPRNG (ex: DELFI-8492-7103)
 */
export function generateSecureRecoveryCode(): string {
  const buf = crypto.randomBytes(4);
  const seg1 = 1000 + (buf.readUInt16BE(0) % 9000);
  const seg2 = 1000 + (buf.readUInt16BE(2) % 9000);
  return `DELFI-${seg1}-${seg2}`;
}

/**
 * Gera hash seguro para o Código de Emergência
 */
export function hashRecoveryCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  return crypto.createHash('sha256').update(`recovery:${normalized}:delfilandia_2026`).digest('hex');
}

/**
 * Verifica um Código de Emergência informado contra o hash armazenado
 */
export function verifyRecoveryCode(enteredCode: string, storedHashOrPlain: string | undefined): boolean {
  if (!enteredCode || !storedHashOrPlain) return false;
  const normalized = enteredCode.trim().toUpperCase();

  // Verifica se o armazenado já é o hash
  const computedHash = hashRecoveryCode(normalized);
  const computedBuf = Buffer.from(computedHash, 'utf-8');

  if (storedHashOrPlain.length === 64) {
    const storedBuf = Buffer.from(storedHashOrPlain, 'utf-8');
    if (computedBuf.length === storedBuf.length && crypto.timingSafeEqual(computedBuf, storedBuf)) {
      return true;
    }
  }

  // Fallback de compatibilidade caso o código legado esteja salvo em texto
  const legacyStoredBuf = Buffer.from(storedHashOrPlain.trim().toUpperCase(), 'utf-8');
  const enteredBuf = Buffer.from(normalized, 'utf-8');
  if (legacyStoredBuf.length === enteredBuf.length && crypto.timingSafeEqual(legacyStoredBuf, enteredBuf)) {
    return true;
  }

  return false;
}

/**
 * Verifica uma Chave de Recuperação Server-Side (ADMIN_RECOVERY_SECRET)
 * Compara em tempo constante (timingSafeEqual) para evitar Timing Attacks (OWASP).
 */
export function verifyAdminRecoverySecret(enteredSecret: string): boolean {
  const configuredSecret = getOrInitAdminRecoverySecret().trim();
  if (!configuredSecret || !enteredSecret) return false;

  const enteredBuf = Buffer.from(enteredSecret.trim(), 'utf-8');
  const configuredBuf = Buffer.from(configuredSecret, 'utf-8');

  if (enteredBuf.length === configuredBuf.length && crypto.timingSafeEqual(enteredBuf, configuredBuf)) {
    return true;
  }

  return false;
}

/**
 * Gera um Token de Sessão criptograficamente aleatório (256 bits de entropia)
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Gera um código numérico de 6 dígitos criptograficamente seguro (CSPRNG) para recuperação por email
 */
export function generatePasswordResetCode(): string {
  // Gera um número aleatório estritamente no intervalo 100000 - 999999
  const codeNum = crypto.randomInt(100000, 1000000);
  return codeNum.toString();
}

/**
 * Gera o hash criptográfico seguro do código de recuperação por email (SHA-256 com salt)
 */
export function hashPasswordResetCode(code: string, email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.trim();
  const salt = getOrInitAdminRecoverySecret();
  return crypto
    .createHash('sha256')
    .update(`delfilandia_reset:${normalizedEmail}:${normalizedCode}:${salt}`)
    .digest('hex');
}

/**
 * Verifica o código de recuperação por email contra o hash armazenado usando timingSafeEqual
 */
export function verifyPasswordResetCode(
  enteredCode: string,
  email: string,
  storedHash: string
): boolean {
  if (!enteredCode || !email || !storedHash) return false;
  const computedHash = hashPasswordResetCode(enteredCode, email);
  const computedBuf = Buffer.from(computedHash, 'utf-8');
  const storedBuf = Buffer.from(storedHash, 'utf-8');

  if (computedBuf.length === storedBuf.length && crypto.timingSafeEqual(computedBuf, storedBuf)) {
    return true;
  }
  return false;
}

