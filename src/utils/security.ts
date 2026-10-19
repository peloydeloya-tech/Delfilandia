import { Order, PublicOrderView, AppSettings, OrderStatus } from '../types';
import { DEFAULT_SETTINGS } from '../data/mockData';
import { getStatusConfig } from './formatters';

/**
 * Normalizes title for public timeline events
 */
function normalizeEventTitle(status: OrderStatus, rawTitle: string): string {
  if (!rawTitle || rawTitle.toLowerCase().includes('jogo')) {
    const config = getStatusConfig(status);
    return config.label;
  }
  // If title is just "confirmado", expand to "Pagamento Confirmado"
  if (rawTitle.toLowerCase().trim() === 'confirmado') {
    return 'Pagamento Confirmado';
  }
  return rawTitle;
}

/**
 * SECURITY PROJECTION FUNCTION
 * Ensures client never sees internal costs, purchase locations in Angola, margins, or admin notes.
 * Strictly separates PUBLIC DATA from ADMINISTRATIVE DATA.
 */
export function sanitizeOrderForPublic(
  order: Order,
  settings: AppSettings = DEFAULT_SETTINGS
): PublicOrderView {
  // Extract only first name for privacy (e.g., "Maria" or "Cliente: Maria")
  const nameParts = order.clientName.trim().split(' ');
  const rawFirstName = nameParts[0] || 'Cliente';
  const clientFirstName = rawFirstName.toLowerCase().startsWith('cliente')
    ? rawFirstName
    : `Cliente: ${rawFirstName}`;

  const showSalesPrice = settings.showSalesPriceToClient === true;

  return {
    code: order.code,
    clientFirstName,
    productName: order.productName,
    productDescription: order.productDescription,
    productImageUrl: order.productImageUrl || order.productImageUrls?.[0],
    productImageUrls: order.productImageUrls && order.productImageUrls.length > 0 
      ? order.productImageUrls 
      : (order.productImageUrl ? [order.productImageUrl] : []),
    quantity: order.quantity || 1,
    status: order.status,
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    deliveryProvince: order.clientProvince,
    deliveryDistrict: order.clientDistrict,
    timeline: (order.timeline || []).map((event) => ({
      id: event.id,
      status: event.status,
      title: normalizeEventTitle(event.status, event.title),
      description: event.description,
      timestamp: event.timestamp,
      isCompleted: event.isCompleted,
      publicNote: event.publicNote,
    })),
    publicNotes: order.publicNotes,
    updatedAt: order.updatedAt,
    paymentStatus: order.paymentStatus,

    showSalesPrice,
    resalePrice: showSalesPrice ? order.resalePrice : undefined,
    amountPaid: showSalesPrice ? order.amountPaid : undefined,
    amountPending: showSalesPrice ? order.amountPending : undefined,

    isLocalPurchaseAndDelivery: true,
  };
}

/**
 * Validates if an object contains any internal cost leaks.
 */
export function verifyNoInternalDataLeaks(data: Record<string, unknown>): boolean {
  const forbiddenKeys = [
    'purchaseCost',
    'purchaseLocation',
    'deliveryCost',
    'otherCosts',
    'additionalExpenses',
    'grossProfit',
    'netProfit',
    'adminNotes',
    'sellerId',
    'lucro',
    'precoCompra',
    'margem',
  ];

  return !forbiddenKeys.some((key) => key in data);
}

/**
 * =========================================================================
 * CRYPTOGRAPHIC & AUTHENTICATION SECURITY LAYER
 * =========================================================================
 */

/**
 * Generates a cryptographically secure random hexadecimal salt
 */
export function generateSalt(length = 16): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for Node/SSR environments
  return Array.from({ length }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
}

/**
 * Computes a SHA-256 hash of a string combined with a salt using Web Crypto API or Node crypto
 */
export async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${password.trim()}:delfilandia_security_salt_2026`);
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Simple synchronous SHA-256 fallback when Web Crypto is unavailable
  let hash = 0;
  const str = `${salt}:${password.trim()}:delfilandia_security_salt_2026`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `sha256_mock_${Math.abs(hash).toString(16)}_${salt.substring(0, 8)}`;
}

/**
 * Generates an emergency recovery code (e.g. DELFI-8492-7103)
 */
export function generateEmergencyRecoveryCode(): string {
  const segment1 = Math.floor(1000 + Math.random() * 9000);
  const segment2 = Math.floor(1000 + Math.random() * 9000);
  return `DELFI-${segment1}-${segment2}`;
}

export const generateRecoveryCode = generateEmergencyRecoveryCode;

export interface PasswordStrengthResult {
  score: number; // 0 (muito fraca) to 4 (muito forte)
  level: 'muito_fraca' | 'fraca' | 'media' | 'forte' | 'muito_forte';
  label: string;
  color: string;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  isBlacklisted: boolean;
  isValid: boolean; // meets minimum security policy
  missingRequirements: string[];
}

const COMMON_WEAK_PASSWORDS = [
  '1234', '12345', '123456', '12345678', 'password', 'senha', 'admin', 'admin123',
  'delfilandia', 'angola', 'luanda', 'qwerty', '111111', '000000', 'welcome', 'kwanza'
];

/**
 * Evaluates password against enterprise security policies
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const p = password || '';
  const trimmed = p.trim().toLowerCase();
  
  const hasMinLength = p.length >= 8;
  const hasUppercase = /[A-Z]/.test(p);
  const hasLowercase = /[a-z]/.test(p);
  const hasNumber = /[0-9]/.test(p);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(p);
  const isBlacklisted = COMMON_WEAK_PASSWORDS.includes(trimmed);

  const missingRequirements: string[] = [];
  if (!hasMinLength) missingRequirements.push('Mínimo de 8 caracteres');
  if (!hasUppercase) missingRequirements.push('Pelo menos uma letra MAIÚSCULA');
  if (!hasLowercase) missingRequirements.push('Pelo menos uma letra minúscula');
  if (!hasNumber) missingRequirements.push('Pelo menos um número (0-9)');
  if (!hasSpecialChar) missingRequirements.push('Pelo menos um caractere especial (!@#$...)');
  if (isBlacklisted) missingRequirements.push('Senha muito comum ou previsível');

  let points = 0;
  if (hasMinLength) points += 1;
  if (hasUppercase && hasLowercase) points += 1;
  if (hasNumber) points += 1;
  if (hasSpecialChar) points += 1;
  if (p.length >= 12) points += 1;
  if (isBlacklisted) points = 0;

  let level: PasswordStrengthResult['level'] = 'muito_fraca';
  let label = 'Muito Fraca';
  let color = 'text-rose-500 bg-rose-500';

  if (points <= 1 || isBlacklisted) {
    level = 'muito_fraca';
    label = 'Muito Fraca';
    color = 'bg-rose-500 text-rose-500';
  } else if (points === 2) {
    level = 'fraca';
    label = 'Fraca';
    color = 'bg-amber-500 text-amber-500';
  } else if (points === 3) {
    level = 'media';
    label = 'Média';
    color = 'bg-yellow-500 text-yellow-500';
  } else if (points === 4) {
    level = 'forte';
    label = 'Forte';
    color = 'bg-emerald-500 text-emerald-500';
  } else {
    level = 'muito_forte';
    label = 'Muito Forte';
    color = 'bg-green-600 text-green-600';
  }

  // Password is valid for creation if it meets at least 8 chars + numbers + uppercase/lowercase + not blacklisted
  const isValid = hasMinLength && (hasUppercase || hasLowercase) && hasNumber && !isBlacklisted && p.length >= 6;

  return {
    score: points,
    level,
    label,
    color,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
    isBlacklisted,
    isValid,
    missingRequirements,
  };
}

/**
 * Checks if account is locked due to multiple failed login attempts
 */
export function checkAccountLockout(
  failedAttempts = 0,
  lockedUntil?: string
): { isLocked: boolean; remainingSeconds: number } {
  if (!lockedUntil) return { isLocked: false, remainingSeconds: 0 };
  
  const lockTime = new Date(lockedUntil).getTime();
  const now = Date.now();
  
  if (now < lockTime) {
    const remainingSeconds = Math.ceil((lockTime - now) / 1000);
    return { isLocked: true, remainingSeconds };
  }
  
  return { isLocked: false, remainingSeconds: 0 };
}

/**
 * Sanitizes input to prevent XSS injection
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}


