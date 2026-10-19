import { OrderStatus, StatusConfig, PaymentStatus, PaymentMethod, Order } from '../types';

/**
 * Formats numbers into standard Angolan Kwanza format (e.g., 25000 -> "25.000 Kz")
 */
export function formatKz(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '0 Kz';
  }
  const formatted = new Intl.NumberFormat('pt-AO', {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted} Kz`;
}

/**
 * Formats phone numbers for Angolan WhatsApp (e.g., "+244 923 456 789")
 */
export function formatAngolaPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('244')) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.length === 9) {
    return `+244 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
  }
  return phone;
}

/**
 * Linear standard status step definitions in strict order
 */
export const LINEAR_STATUS_FLOW: StatusConfig[] = [
  {
    key: 'AGUARDANDO_PAGAMENTO',
    label: 'Aguardando Pagamento',
    description: 'Estamos a aguardar a confirmação do pagamento.',
    color: '#10b981', // green
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    badgeText: 'Aguardando Pagamento',
    iconName: 'Clock',
    stepNumber: 1,
  },
  {
    key: 'PAGAMENTO_CONFIRMADO',
    label: 'Pagamento Confirmado',
    description: 'O seu pagamento foi confirmado com sucesso.',
    color: '#10b981', // green
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    badgeText: 'Pagamento Confirmado',
    iconName: 'CheckCircle2',
    stepNumber: 2,
  },
  {
    key: 'PRODUTO_COMPRADO',
    label: 'Produto Comprado',
    description: 'O seu produto já foi adquirido e brevemente será entregue a si.',
    color: '#10b981', // green
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    badgeText: 'Produto Comprado',
    iconName: 'ShoppingBag',
    stepNumber: 3,
  },
  {
    key: 'SAIU_PARA_ENTREGA',
    label: 'Saiu para Entrega',
    description: 'A sua encomenda já saiu para entrega ao destinatário.',
    color: '#10b981', // green
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    badgeText: 'Saiu para Entrega',
    iconName: 'Truck',
    stepNumber: 4,
  },
  {
    key: 'ENTREGUE',
    label: 'Entregue',
    description: 'A sua encomenda foi entregue com sucesso.',
    color: '#10b981', // green
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    badgeText: 'Entregue',
    iconName: 'CheckCheck',
    stepNumber: 5,
  },
];

/**
 * Full status list including administrative exception statuses (Problema & Cancelada)
 */
export const STATUS_FLOW: StatusConfig[] = [
  ...LINEAR_STATUS_FLOW,
  {
    key: 'PROBLEMA',
    label: 'Problema',
    description: 'Identificamos uma situação que precisa de atenção.',
    color: '#f59e0b', // yellow / amber
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    badgeText: 'Atenção / Problema',
    iconName: 'AlertTriangle',
    stepNumber: 99,
  },
  {
    key: 'CANCELADA',
    label: 'Cancelada',
    description: 'Esta encomenda foi cancelada.',
    color: '#ef4444', // red
    badgeBg: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
    badgeText: 'Cancelada',
    iconName: 'XCircle',
    stepNumber: 100,
  },
];

export function getStatusConfig(status: OrderStatus): StatusConfig {
  return (
    STATUS_FLOW.find((s) => s.key === status) || {
      key: status,
      label: status,
      description: 'Estado da encomenda',
      color: '#6b7280',
      badgeBg: 'bg-gray-100 text-gray-800 border-gray-200',
      badgeText: status,
      iconName: 'Package',
      stepNumber: 1,
    }
  );
}

export function getStepIndex(status: OrderStatus): number {
  return LINEAR_STATUS_FLOW.findIndex((s) => s.key === status);
}

/**
 * Standard customer-facing steps (5 essential steps)
 */
export const CUSTOMER_BASE_STATUS_FLOW: StatusConfig[] = LINEAR_STATUS_FLOW;

/**
 * Returns the dynamic customer-facing step flow:
 * Standard 5 steps, with PROBLEMA or CANCELADA appended ONLY when set by administrator.
 */
export function getCustomerStatusFlow(status: OrderStatus): StatusConfig[] {
  if (status === 'PROBLEMA') {
    return [
      ...CUSTOMER_BASE_STATUS_FLOW,
      {
        key: 'PROBLEMA',
        label: 'Problema',
        description: 'Identificamos uma situação que precisa de atenção.',
        color: '#f59e0b',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
        badgeText: 'Atenção / Problema',
        iconName: 'AlertTriangle',
        stepNumber: 6,
      },
    ];
  }

  if (status === 'CANCELADA') {
    return [
      ...CUSTOMER_BASE_STATUS_FLOW,
      {
        key: 'CANCELADA',
        label: 'Cancelada',
        description: 'Esta encomenda foi cancelada.',
        color: '#ef4444',
        badgeBg: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
        badgeText: 'Cancelada',
        iconName: 'XCircle',
        stepNumber: 6,
      },
    ];
  }

  return CUSTOMER_BASE_STATUS_FLOW;
}

/**
 * Maps the internal order status to the active index in the customer stepper.
 */
export function getCustomerStepIndex(status: OrderStatus): number {
  if (status === 'PROBLEMA') return 5;
  if (status === 'CANCELADA') return 5;

  switch (status) {
    case 'AGUARDANDO_PAGAMENTO':
      return 0;
    case 'PAGAMENTO_CONFIRMADO':
      return 1;
    case 'PRODUTO_COMPRADO':
      return 2;
    case 'SAIU_PARA_ENTREGA':
      return 3;
    case 'ENTREGUE':
      return 4;
    default:
      return 0;
  }
}

export function getPaymentStatusInfo(status: PaymentStatus) {
  switch (status) {
    case 'CONFIRMADO':
      return {
        label: 'Confirmado',
        publicBadge: 'Pagamento confirmado ✓',
        badgeBg: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
      };
    case 'PARCIAL':
      return {
        label: 'Parcial',
        publicBadge: 'Pagamento parcial (Sinal) ✓',
        badgeBg: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300',
      };
    case 'REEMBOLSADO':
      return {
        label: 'Reembolsado',
        publicBadge: 'Reembolsado',
        badgeBg: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300',
      };
    case 'PENDENTE':
    default:
      return {
        label: 'Pendente',
        publicBadge: 'Aguardando pagamento',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
      };
  }
}

export function getPaymentMethodLabel(method?: PaymentMethod): string {
  switch (method) {
    case 'EXPRESS':
      return 'Multicaixa Express';
    case 'TRANSFERENCIA':
      return 'Transferência Bancária';
    case 'TPA':
      return 'TPA (Terminal Pagamento)';
    case 'DINHEIRO':
      return 'Dinheiro em Mão';
    case 'OUTRO':
      return 'Outro Método';
    default:
      return 'Não informado';
  }
}

/**
 * Checks if an order is delayed administratively.
 * Delayed if estimatedDeliveryDate < today AND status is not ENTREGUE or CANCELADA.
 */
export function checkIsOrderDelayed(order: Order): boolean {
  if (order.status === 'ENTREGUE' || order.status === 'CANCELADA') {
    return false;
  }
  if (!order.estimatedDeliveryDate) return false;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Try parsing ISO or YYYY-MM-DD date
    const targetDate = new Date(order.estimatedDeliveryDate);
    if (!isNaN(targetDate.getTime())) {
      targetDate.setHours(23, 59, 59, 999);
      return today > targetDate;
    }
  } catch {
    // ignore parse error
  }
  return false;
}

export function formatDatePT(dateIsoString: string): string {
  try {
    const date = new Date(dateIsoString);
    if (isNaN(date.getTime())) return dateIsoString;
    return date.toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateIsoString;
  }
}

export function formatDateOnlyPT(dateIsoString: string): string {
  try {
    const date = new Date(dateIsoString);
    if (isNaN(date.getTime())) return dateIsoString;
    return date.toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateIsoString;
  }
}

/**
 * Smart matcher for order codes. Handles:
 * - Full code: "AO-974519" or "A0-974519" (letter O vs digit 0)
 * - Without prefix: "974519"
 * - No hyphen: "AO974519" or "A0974519" or "ao974519"
 * - With hash or spaces: "#AO-974519" or "AO 974519" or "#A0-974519"
 * - Client phone numbers or suffix matches
 */
export function matchOrderCode(
  order: { code: string; clientPhone?: string },
  query: string
): boolean {
  if (!query || !query.trim() || !order || !order.code) return false;

  // Reject queries containing suspicious/injection characters (e.g. quotes, semicolons, brackets, SQL operators)
  if (/[<>'"`;=()\\\/\[\]{}|*+?]/.test(query) || query.includes('--')) {
    return false;
  }

  const rawQuery = query.trim().toUpperCase();
  const orderCode = order.code.trim().toUpperCase();

  // 1. Direct exact match
  if (orderCode === rawQuery) return true;

  // 2. Normalize letter O and digit 0 for Angola prefix: "AO" <-> "A0"
  const normalizePrefix = (str: string) =>
    str
      .replace(/^#/, '')
      .replace(/[\s\-_]/g, '')
      .replace(/^A0/i, 'AO')
      .toUpperCase();

  const normQuery = normalizePrefix(rawQuery);
  const normOrderCode = normalizePrefix(orderCode);

  if (normOrderCode === normQuery) return true;

  // 3. Extract core pure numbers (ignoring AO/A0/Angola prefixes)
  const extractCoreDigits = (str: string) => {
    // Remove AO or A0 prefix if at the beginning
    const withoutPrefix = str.replace(/^#?\s*A[O0][\s\-_]*/i, '');
    return withoutPrefix.replace(/\D/g, '');
  };

  const orderDigits = extractCoreDigits(orderCode);
  const queryDigits = extractCoreDigits(rawQuery);

  if (
    queryDigits.length >= 4 &&
    orderDigits.length >= 4 &&
    (orderDigits === queryDigits ||
      orderDigits.endsWith(queryDigits) ||
      queryDigits.endsWith(orderDigits))
  ) {
    return true;
  }

  // 4. Missing prefix match (e.g. query is "974519" and order is "AO974519")
  const cleanQuery = rawQuery.replace(/[^A-Z0-9]/g, '');
  const cleanOrderCode = orderCode.replace(/[^A-Z0-9]/g, '');

  if (
    cleanQuery &&
    (cleanOrderCode === `AO${cleanQuery}` ||
      cleanOrderCode === `A0${cleanQuery}` ||
      `AO${cleanOrderCode}` === cleanQuery ||
      `A0${cleanOrderCode}` === cleanQuery)
  ) {
    return true;
  }

  // 5. Client phone match
  if (order.clientPhone) {
    const phoneDigits = order.clientPhone.replace(/\D/g, '');
    const rawDigitsOnly = rawQuery.replace(/\D/g, '');
    if (rawDigitsOnly.length >= 7 && phoneDigits.includes(rawDigitsOnly)) {
      return true;
    }
  }

  // 6. Substring alphanumeric match
  if (cleanQuery.length >= 4 && normOrderCode.includes(normQuery)) {
    return true;
  }

  return false;
}


