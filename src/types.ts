export type OrderStatus =
  | 'AGUARDANDO_PAGAMENTO'
  | 'PAGAMENTO_CONFIRMADO'
  | 'PRODUTO_COMPRADO'
  | 'SAIU_PARA_ENTREGA'
  | 'ENTREGUE'
  | 'PROBLEMA'
  | 'CANCELADA';

export const VALID_ORDER_STATUSES: readonly OrderStatus[] = [
  'AGUARDANDO_PAGAMENTO',
  'PAGAMENTO_CONFIRMADO',
  'PRODUTO_COMPRADO',
  'SAIU_PARA_ENTREGA',
  'ENTREGUE',
  'PROBLEMA',
  'CANCELADA',
] as const;

export type PaymentStatus = 'PENDENTE' | 'PARCIAL' | 'CONFIRMADO' | 'REEMBOLSADO';

export const VALID_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'PENDENTE',
  'PARCIAL',
  'CONFIRMADO',
  'REEMBOLSADO',
] as const;

export type PaymentMethod = 'TRANSFERENCIA' | 'EXPRESS' | 'TPA' | 'DINHEIRO' | 'OUTRO';

export const VALID_PAYMENT_METHODS: readonly PaymentMethod[] = [
  'TRANSFERENCIA',
  'EXPRESS',
  'TPA',
  'DINHEIRO',
  'OUTRO',
] as const;

export type DatePeriodFilter = 'TODOS' | 'HOJE' | '7_DIAS' | 'ESTE_MES' | 'MES_ANTERIOR' | 'PERSONALIZADO';

export interface TimelineEvent {
  id: string;
  status: OrderStatus;
  title: string;
  description: string;
  timestamp: string;
  isCompleted: boolean;
  publicNote?: string;
}

// Full Internal Admin Order Model
export interface Order {
  id: string;
  code: string; // e.g. AO-894125
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
  
  // Public Client Information
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientProvince: string; // e.g. Luanda, Benguela, Huambo
  clientDistrict?: string; // e.g. Talatona, Maianga, Cazenga
  clientAddress: string;

  // Product & Public Financials
  productName: string;
  productDescription?: string;
  productImageUrl?: string;
  productImageUrls?: string[]; // Multiple photos of the same item
  quantity: number; // Quantidade de itens
  resalePrice: number; // Preço de venda total / combinado (Kz)
  amountPaid: number; // Quanto o cliente já pagou (Kz)
  amountPending: number; // Calculado: resalePrice - amountPaid (Kz)
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentReceiptRef?: string;
  
  // Status & Delivery
  status: OrderStatus;
  estimatedDeliveryDate: string; // Formato AAAA-MM-DD ou intervalo ex: "14 a 16 de Agosto"
  referencePoint?: string; // Ponto de referência para entrega
  shippedAt?: string; // Data de saída para entrega
  deliveredAt?: string; // Data em que foi entregue
  deliveryTime?: string; // Hora em que foi entregue (ex: "14:30")
  receivedBy?: string; // Nome de quem recebeu a encomenda
  deliveryNote?: string; // Observação registrada ao entregar
  courierName?: string;
  courierPhone?: string;
  timeline: TimelineEvent[];
  publicNotes?: string; // Instructions visible to client

  // DADOS INTERNOS / ADMINISTRATIVOS PRIVADOS (NUNCA MOSTRAR AO CLIENTE PÚBLICO)
  purchaseCost: number; // Preço de compra do produto localmente em Angola (Kz)
  purchaseLocation: string; // Local de compra em Angola (ex: Loja local em Luanda, Armazém Palanca)
  deliveryCost: number; // Custo de entrega / transporte local (Kz)
  otherCosts: number; // Outros custos / despesas operacionais (Kz)
  grossProfit: number; // Calculado: resalePrice - purchaseCost
  netProfit: number; // Calculado: resalePrice - purchaseCost - deliveryCost - otherCosts
  adminNotes?: string; // Observações internas da vendedora
  sellerId?: string; // ID da administradora/vendedora
  isDelayed?: boolean; // Se a data prevista já expirou e a encomenda não foi entregue
}

// Public View Model (Strictly Filtered - Excludes internal costs, location, admin notes)
export interface PublicOrderView {
  code: string;
  clientFirstName: string; // Simplified name e.g. "Maria" or "Cliente: Maria"
  productName: string;
  productDescription?: string;
  productImageUrl?: string;
  productImageUrls?: string[];
  quantity: number;
  status: OrderStatus;
  estimatedDeliveryDate: string;
  deliveryProvince: string;
  deliveryDistrict?: string;
  timeline: TimelineEvent[];
  publicNotes?: string;
  updatedAt: string;
  paymentStatus: PaymentStatus;
  
  // Setting-controlled sales value visibility
  showSalesPrice: boolean;
  resalePrice?: number; // Only present if showSalesPrice is true in AppSettings
  amountPaid?: number;
  amountPending?: number;
  
  isLocalPurchaseAndDelivery: true; // Mandatory flag confirming local Angola transaction
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  province: string;
  district?: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
}

export interface StatusConfig {
  key: OrderStatus;
  label: string;
  description: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  iconName: string;
  stepNumber: number;
}

export interface FinancialStats {
  totalRevenue: number; // Receita de Vendas (Kz)
  totalPaid: number; // Total Recebido (Kz)
  totalPending: number; // Total Pendente (Kz)
  totalCost: number; // Custo dos Produtos (Kz)
  totalDeliveryCost: number; // Custo de Entrega (Kz)
  totalOtherCosts: number; // Outros Custos (Kz)
  grossProfit: number; // Lucro Bruto (Kz)
  netProfit: number; // Lucro Líquido Estimado (Kz)
  averageMarginPercent: number; // Margem Líquida %
  totalOrdersCount: number;
  activeOrdersCount: number;
  deliveredOrdersCount: number;
  delayedOrdersCount: number;
  problemOrdersCount: number;
  canceledOrdersCount: number;
}

export interface AuditLog {
  id: string;
  orderId: string;
  orderCode: string;
  action: string; // e.g. 'Criação de encomenda', 'Alteração de estado', 'Alteração de pagamento'
  description: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface AppSettings {
  brandName: string; // Default: "DELFILÂNDIA"
  logoUrl?: string;
  whatsappNumber: string; // Default: "923000000"
  phoneNumber: string; // Default: "923000000"
  email: string; // Default: "contacto@kwanzaexpress.ao"
  initialMessage: string;
  businessHours: string; // Default: "Segunda a Sábado: 08h00 - 18h00"
  provincesServed: string[]; // e.g. ["Luanda", "Benguela", "Huambo", "Huíla", "Cabinda", "Cuanza Sul"]
  minDeliveryDays: number; // e.g. 1
  maxDeliveryDays: number; // e.g. 3
  codePrefix: string; // e.g. "AO-"

  // Privacy Settings (Exibição Pública)
  showSalesPriceToClient: boolean; // Default: false (NÃO)
  showFullNameToClient: boolean; // Default: false (Apenas primeiro nome)
  showDistrictToClient: boolean; // Default: true
  showEstimatedDeliveryToClient: boolean; // Default: true

  // Admin Account & Robust Security (Sem credenciais padrão)
  adminConfigured: boolean; // false until first admin account setup
  adminName?: string;
  adminEmail?: string;
  adminPasswordHash?: string;
  adminPasswordSalt?: string;
  adminRecoveryCodeHash?: string;
  adminRecoveryCode?: string; // Stored securely for initial display/recovery
  adminLastLoginAt?: string;
  failedLoginAttempts?: number;
  lockedUntil?: string; // ISO date string if account is temporarily locked
  sessionTimeoutMinutes?: number; // Default 30 min

  adminPassword?: string; // Legacy field
  adminPin: string; // Legacy PIN
  publicTrackingDomain?: string; // Optional custom public tracking domain / URL override
}

export interface ProductSummaryItem {
  productName: string;
  totalSalesCount: number;
  totalRevenue: number;
  totalEstimatedProfit: number;
  lastSaleDate: string;
  averagePrice: number;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  statusKey: OrderStatus | 'CONFIRMACAO_ENTREGA';
  templateText: string;
}

