import { Order, Client, AuditLog, AppSettings } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  brandName: 'DELFILÂNDIA',
  logoUrl: '/logo.jpg',
  whatsappNumber: '923000000',
  phoneNumber: '923000000',
  email: 'contacto@delfilandia.com',
  initialMessage: 'Olá! Vim do site da DELFILÂNDIA e gostaria de tirar uma dúvida sobre a minha encomenda.',
  businessHours: 'Segunda a Sábado: 08h00 - 18h00',
  provincesServed: ['Luanda', 'Benguela', 'Huambo', 'Huíla', 'Cabinda', 'Cuanza Sul', 'Namibe', 'Malanje'],
  minDeliveryDays: 1,
  maxDeliveryDays: 3,
  codePrefix: 'AO-',

  // Privacy Options
  showSalesPriceToClient: false, // Default false (NÃO)
  showFullNameToClient: false, // Default false (Apenas primeiro nome)
  showDistrictToClient: true,
  showEstimatedDeliveryToClient: true,

  // Security & Admin (Sem credenciais padrão - Requer primeiro acesso)
  adminConfigured: false,
  adminName: '',
  adminEmail: '',
  adminPasswordHash: '',
  adminPasswordSalt: '',
  adminRecoveryCodeHash: '',
  failedLoginAttempts: 0,
  lockedUntil: undefined,
  sessionTimeoutMinutes: 30,
  adminPassword: '',
  adminPin: '',
  publicTrackingDomain: '',
};

export const INITIAL_CLIENTS: Client[] = [];

export const INITIAL_ORDERS: Order[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
