import { db, isSqlAvailable, markSqlUnavailable } from './index.ts';
import { orders, clients, appSettings, auditLogs } from './schema.ts';
import { eq, desc, notInArray, inArray } from 'drizzle-orm';
import { 
  VALID_ORDER_STATUSES, 
  VALID_PAYMENT_STATUSES, 
  VALID_PAYMENT_METHODS,
  type Order, 
  type Client, 
  type AppSettings, 
  type AuditLog, 
  type OrderStatus, 
  type PaymentStatus,
  type PaymentMethod,
  type TimelineEvent 
} from '../types.ts';
import { mergePreservedSettings } from '../utils/settingsPreservation.ts';

// Custom Error Class for Database operations with HTTP status and constraint metadata
export class DatabaseError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
  status: number;

  constructor(message: string, originalError?: any, status: number = 500) {
    super(message);
    this.name = 'DatabaseError';
    if (originalError) {
      this.code = originalError.code;
      this.constraint = originalError.constraint;
      this.detail = originalError.detail;
      this.cause = originalError;
    }
    this.status = status;
  }
}

/**
 * Maps and enriches PostgreSQL driver errors into structured DatabaseError
 */
export function wrapDbError(err: unknown, operationDescription: string): DatabaseError {
  if (err instanceof DatabaseError) {
    return err;
  }

  const pgErr = err as any;
  const pgCode = pgErr?.code;

  // Postgres specific error codes
  if (pgCode === '23505') {
    return new DatabaseError(
      `Registo duplicado (chave única violada): ${pgErr.detail || pgErr.message}`,
      pgErr,
      409
    );
  }
  if (pgCode === '23503') {
    return new DatabaseError(
      `Violação de chave estrangeira (relação não encontrada): ${pgErr.detail || pgErr.message}`,
      pgErr,
      422
    );
  }
  if (pgCode === '23514') {
    return new DatabaseError(
      `Violação de restrição CHECK (valor inválido para coluna): ${pgErr.detail || pgErr.message}`,
      pgErr,
      400
    );
  }
  if (pgCode === '23502') {
    return new DatabaseError(
      `Violação NOT NULL (campo obrigatório ausente): ${pgErr.detail || pgErr.message}`,
      pgErr,
      400
    );
  }
  if (pgCode === '22P02') {
    return new DatabaseError(
      `Representação de dados inválida (ex: formato numérico incorreto): ${pgErr.message}`,
      pgErr,
      400
    );
  }

  // Connection / Availability errors
  const isConnError =
    pgCode === 'ECONNREFUSED' ||
    pgCode === 'ETIMEDOUT' ||
    pgCode === '57P01' ||
    pgCode === '57P02' ||
    pgCode === '57P03' ||
    String(pgErr?.message || '').toLowerCase().includes('connection') ||
    String(pgErr?.message || '').toLowerCase().includes('timeout');

  if (isConnError) {
    markSqlUnavailable();
    return new DatabaseError(
      `Serviço de base de dados temporariamente indisponível: ${pgErr?.message || 'Erro de conexão'}`,
      pgErr,
      503
    );
  }

  return new DatabaseError(
    `Erro de persistência PostgreSQL em ${operationDescription}: ${pgErr?.message || String(err)}`,
    pgErr,
    500
  );
}

function buildDefaultTimeline(status: OrderStatus, createdAt: string, updatedAt: string): TimelineEvent[] {
  return [
    {
      id: `tm-init-1`,
      status: 'AGUARDANDO_PAGAMENTO',
      title: 'Encomenda Registada',
      description: 'A encomenda foi criada no sistema da loja.',
      timestamp: createdAt,
      isCompleted: true,
    },
    {
      id: `tm-init-2`,
      status: 'PAGAMENTO_CONFIRMADO',
      title: 'Pagamento',
      description: 'Confirmação do pagamento ou sinal do cliente.',
      timestamp: updatedAt,
      isCompleted: status !== 'AGUARDANDO_PAGAMENTO',
    },
    {
      id: `tm-init-3`,
      status: 'PRODUTO_COMPRADO',
      title: 'Compra Local Concluída',
      description: 'Artigo adquirido no fornecedor local em Angola.',
      timestamp: updatedAt,
      isCompleted: ['PRODUTO_COMPRADO', 'SAIU_PARA_ENTREGA', 'ENTREGUE'].includes(status),
    },
    {
      id: `tm-init-4`,
      status: 'SAIU_PARA_ENTREGA',
      title: 'Saiu para Entrega',
      description: 'Estafeta a caminho da morada de entrega.',
      timestamp: updatedAt,
      isCompleted: ['SAIU_PARA_ENTREGA', 'ENTREGUE'].includes(status),
    },
    {
      id: `tm-init-5`,
      status: 'ENTREGUE',
      title: 'Entregue com Sucesso',
      description: 'Artigo recebido pelo cliente.',
      timestamp: updatedAt,
      isCompleted: status === 'ENTREGUE',
    },
  ];
}

// Helper to parse image urls from JSONB or fallback string
function parseImageUrls(r: { productImageUrl?: string | null; productImageUrls?: unknown }): string[] {
  if (r.productImageUrls) {
    if (Array.isArray(r.productImageUrls) && r.productImageUrls.length > 0) {
      return r.productImageUrls as string[];
    }
    if (typeof r.productImageUrls === 'string') {
      try {
        const parsed = JSON.parse(r.productImageUrls);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        const split = r.productImageUrls.split(',').map((s) => s.trim()).filter(Boolean);
        if (split.length > 0) return split;
      }
    }
  }
  return r.productImageUrl ? [r.productImageUrl] : [];
}

function parseNumeric(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDateIso(val: Date | string | null | undefined): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function formatNumericForDb(val: number | null | undefined): string {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return num.toFixed(2);
}

function formatDateForDb(val: string | Date | null | undefined): Date {
  if (!val) return new Date();
  const d = val instanceof Date ? val : new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

function mapOrderFromRow(r: typeof orders.$inferSelect): Order {
  const imgUrls = parseImageUrls(r);
  const createdIso = parseDateIso(r.createdAt);
  const updatedIso = parseDateIso(r.updatedAt);
  return {
    id: r.code,
    code: r.code,
    clientId: r.clientId || '',
    clientName: r.clientName,
    clientPhone: r.clientPhone || '',
    clientProvince: r.clientProvince || 'Luanda',
    clientDistrict: r.clientDistrict || undefined,
    clientAddress: r.clientAddress || '',
    productName: r.productName,
    productDescription: r.productDescription || undefined,
    productImageUrl: imgUrls[0] || r.productImageUrl || undefined,
    productImageUrls: imgUrls,
    quantity: r.quantity || 1,
    resalePrice: parseNumeric(r.resalePrice),
    amountPaid: parseNumeric(r.amountPaid),
    amountPending: parseNumeric(r.amountPending),
    paymentStatus: (r.paymentStatus as any) || 'PENDENTE',
    paymentMethod: (r.paymentMethod as any) || 'TRANSFERENCIA',
    status: (r.status as OrderStatus) || 'AGUARDANDO_PAGAMENTO',
    estimatedDeliveryDate: r.estimatedDeliveryDate || '',
    purchaseCost: parseNumeric(r.purchaseCost),
    purchaseLocation: r.purchaseLocation || '',
    deliveryCost: parseNumeric(r.deliveryCost),
    otherCosts: parseNumeric(r.otherCosts),
    grossProfit: parseNumeric(r.grossProfit),
    netProfit: parseNumeric(r.netProfit),
    adminNotes: r.adminNotes || undefined,
    createdAt: createdIso,
    updatedAt: updatedIso,
    createdBy: 'Vendedora Admin',
    updatedBy: 'Vendedora Admin',
    timeline: buildDefaultTimeline((r.status as OrderStatus) || 'AGUARDANDO_PAGAMENTO', createdIso, updatedIso),
  };
}

// ---------------- ORDERS ----------------

/**
 * Retrieves all orders from PostgreSQL database ordered by ID descending
 */
export async function getDbOrders(): Promise<Order[]> {
  if (!db || !isSqlAvailable()) {
    return [];
  }
  try {
    const rows = await db.select().from(orders).orderBy(desc(orders.id));
    return rows.map(mapOrderFromRow);
  } catch (error) {
    markSqlUnavailable();
    return [];
  }
}

/**
 * Retrieves a single order by code from PostgreSQL database (supports standard format AO-XXXXXX, without hyphen AOXXXXXX, digit 0 alias A0-XXXXXX, or raw digits)
 */
export async function getDbOrderByCode(code: string): Promise<Order | null> {
  if (!db || !isSqlAvailable()) {
    return null;
  }
  try {
    const raw = (code || '').trim().toUpperCase();
    if (!raw) return null;

    const candidates = new Set<string>();
    candidates.add(raw);

    const norm = raw.replace(/^#/, '').replace(/[\s_]/g, '-').replace(/^A0/i, 'AO');
    candidates.add(norm);

    const matchNoHyphen = raw.match(/^A[O0](\d+)$/i);
    if (matchNoHyphen) {
      candidates.add(`AO-${matchNoHyphen[1]}`);
    }

    const matchDigitsOnly = raw.match(/^(\d{4,8})$/);
    if (matchDigitsOnly) {
      candidates.add(`AO-${matchDigitsOnly[1]}`);
    }

    const candidateArray = Array.from(candidates);
    const rows = await db.select().from(orders).where(inArray(orders.code, candidateArray));
    if (rows.length === 0) return null;
    return mapOrderFromRow(rows[0]);
  } catch (error) {
    markSqlUnavailable();
    return null;
  }
}

/**
 * Deletes a single order by code or ID with synchronous PostgreSQL confirmation and optional audit logging.
 * Returns true if deleted, or throws DatabaseError if operation fails.
 */
export async function deleteDbOrder(idOrCode: string, auditLog?: AuditLog): Promise<boolean> {
  if (!db || !isSqlAvailable()) {
    throw new DatabaseError('PostgreSQL indisponível para exclusão de encomenda', null, 503);
  }

  const clean = idOrCode.trim();
  if (!clean) return false;

  try {
    return await db.transaction(async (tx) => {
      const deletedRows = await tx.delete(orders).where(eq(orders.code, clean)).returning();

      if (auditLog) {
        const timeDate = formatDateForDb(auditLog.createdAt);
        await tx
          .insert(auditLogs)
          .values({
            logId: auditLog.id,
            orderCode: auditLog.orderCode || clean,
            user: auditLog.createdBy || 'Admin',
            action: auditLog.action,
            details: auditLog.description || '',
            previousStatus: null,
            newStatus: null,
            timestamp: timeDate,
          })
          .onConflictDoNothing();
      }

      return deletedRows.length > 0;
    });
  } catch (error) {
    throw wrapDbError(error, `deleteDbOrder(${clean})`);
  }
}

/**
 * Persists a single order synchronously and transactionally to PostgreSQL with optional audit log.
 * Throws DatabaseError on any constraint violation or connection error.
 */
export async function saveDbOrder(ord: Order, auditLog?: AuditLog): Promise<Order> {
  if (!db || !isSqlAvailable()) {
    throw new DatabaseError('PostgreSQL indisponível para gravação de encomenda', null, 503);
  }

  if (!ord || !ord.code) {
    throw new DatabaseError('Dados de encomenda inválidos: código obrigatório', null, 400);
  }

  // 1. Validação estrita do Estado da Encomenda
  const orderStatus = (ord.status as OrderStatus) || 'AGUARDANDO_PAGAMENTO';
  if (!VALID_ORDER_STATUSES.includes(orderStatus)) {
    throw new DatabaseError(`Estado de encomenda inválido: "${ord.status}". Estados válidos: ${VALID_ORDER_STATUSES.join(', ')}`, null, 400);
  }

  // 2. Validação e recálculo determinístico financeiro
  const resaleNum = Math.max(0, parseNumeric(ord.resalePrice));
  const paidNum = Math.max(0, parseNumeric(ord.amountPaid));
  const pendingNum = Math.max(0, resaleNum - paidNum);
  const purchaseNum = Math.max(0, parseNumeric(ord.purchaseCost));
  const deliveryNum = Math.max(0, parseNumeric(ord.deliveryCost));
  const otherNum = Math.max(0, parseNumeric(ord.otherCosts));
  const grossNum = resaleNum - purchaseNum;
  const netNum = resaleNum - purchaseNum - deliveryNum - otherNum;

  // 3. Sincronização e validação de PaymentStatus
  let paymentStatus = (ord.paymentStatus as PaymentStatus) || 'PENDENTE';
  if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
    paymentStatus = 'PENDENTE';
  }
  if (paymentStatus !== 'REEMBOLSADO') {
    if (paidNum >= resaleNum && resaleNum > 0) {
      paymentStatus = 'CONFIRMADO';
    } else if (paidNum > 0 && paidNum < resaleNum) {
      paymentStatus = 'PARCIAL';
    } else if (paidNum === 0) {
      paymentStatus = 'PENDENTE';
    }
  }

  const paymentMethod = (ord.paymentMethod && VALID_PAYMENT_METHODS.includes(ord.paymentMethod as any))
    ? (ord.paymentMethod as PaymentMethod)
    : 'TRANSFERENCIA';

  const allImages = ord.productImageUrls && ord.productImageUrls.length > 0 
    ? ord.productImageUrls 
    : (ord.productImageUrl ? [ord.productImageUrl] : []);
  const primaryImage = allImages[0] || ord.productImageUrl || '';
  const createdDate = formatDateForDb(ord.createdAt);
  const updatedDate = formatDateForDb(ord.updatedAt);
  const createdIso = parseDateIso(createdDate);
  const updatedIso = parseDateIso(updatedDate);

  // 4. Timeline determinística
  const currentTimeline = (ord.timeline && ord.timeline.length > 0)
    ? ord.timeline
    : buildDefaultTimeline(orderStatus, createdIso, updatedIso);

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(orders)
        .values({
          code: ord.code,
          clientId: ord.clientId && ord.clientId.trim() ? ord.clientId.trim() : null,
          clientName: ord.clientName,
          clientPhone: ord.clientPhone || '',
          clientProvince: ord.clientProvince || 'Luanda',
          clientDistrict: ord.clientDistrict || '',
          clientAddress: ord.clientAddress || '',
          productName: ord.productName,
          productDescription: ord.productDescription || '',
          productImageUrl: primaryImage,
          productImageUrls: allImages,
          quantity: Math.max(1, ord.quantity || 1),
          resalePrice: formatNumericForDb(resaleNum),
          amountPaid: formatNumericForDb(paidNum),
          amountPending: formatNumericForDb(pendingNum),
          paymentStatus: paymentStatus,
          paymentMethod: paymentMethod,
          status: orderStatus,
          estimatedDeliveryDate: ord.estimatedDeliveryDate || '',
          purchaseCost: formatNumericForDb(purchaseNum),
          purchaseLocation: ord.purchaseLocation || '',
          deliveryCost: formatNumericForDb(deliveryNum),
          otherCosts: formatNumericForDb(otherNum),
          grossProfit: formatNumericForDb(grossNum),
          netProfit: formatNumericForDb(netNum),
          adminNotes: ord.adminNotes || '',
          createdAt: createdDate,
          updatedAt: updatedDate,
        })
        .onConflictDoUpdate({
          target: orders.code,
          set: {
            clientId: ord.clientId && ord.clientId.trim() ? ord.clientId.trim() : null,
            clientName: ord.clientName,
            clientPhone: ord.clientPhone || '',
            clientProvince: ord.clientProvince || 'Luanda',
            clientDistrict: ord.clientDistrict || '',
            clientAddress: ord.clientAddress || '',
            productName: ord.productName,
            productDescription: ord.productDescription || '',
            productImageUrl: primaryImage,
            productImageUrls: allImages,
            quantity: Math.max(1, ord.quantity || 1),
            resalePrice: formatNumericForDb(resaleNum),
            amountPaid: formatNumericForDb(paidNum),
            amountPending: formatNumericForDb(pendingNum),
            paymentStatus: paymentStatus,
            paymentMethod: paymentMethod,
            status: orderStatus,
            estimatedDeliveryDate: ord.estimatedDeliveryDate || '',
            purchaseCost: formatNumericForDb(purchaseNum),
            purchaseLocation: ord.purchaseLocation || '',
            deliveryCost: formatNumericForDb(deliveryNum),
            otherCosts: formatNumericForDb(otherNum),
            grossProfit: formatNumericForDb(grossNum),
            netProfit: formatNumericForDb(netNum),
            adminNotes: ord.adminNotes || '',
            updatedAt: updatedDate,
          },
        });

      if (auditLog) {
        const timeDate = formatDateForDb(auditLog.createdAt);
        await tx
          .insert(auditLogs)
          .values({
            logId: auditLog.id,
            orderCode: auditLog.orderCode || ord.code,
            user: auditLog.createdBy || 'Admin',
            action: auditLog.action,
            details: auditLog.description || '',
            previousStatus: null,
            newStatus: orderStatus,
            timestamp: timeDate,
          })
          .onConflictDoNothing();
      }
    });

    return {
      ...ord,
      status: orderStatus,
      paymentStatus: paymentStatus,
      paymentMethod: paymentMethod,
      quantity: Math.max(1, ord.quantity || 1),
      resalePrice: resaleNum,
      amountPaid: paidNum,
      amountPending: pendingNum,
      purchaseCost: purchaseNum,
      deliveryCost: deliveryNum,
      otherCosts: otherNum,
      grossProfit: grossNum,
      netProfit: netNum,
      createdAt: createdIso,
      updatedAt: updatedIso,
      timeline: currentTimeline,
    };
  } catch (error) {
    throw wrapDbError(error, `saveDbOrder(${ord.code})`);
  }
}

/**
 * Persists an entire list of orders in a single atomic transaction.
 * Confirms all writes with PostgreSQL before returning. Throws DatabaseError on failure.
 */
export async function saveDbOrders(orderList: Order[]): Promise<void> {
  if (!db || !isSqlAvailable()) {
    throw new DatabaseError('PostgreSQL indisponível para gravação de encomendas', null, 503);
  }
  if (!Array.isArray(orderList)) {
    throw new DatabaseError('Lista de encomendas inválida', null, 400);
  }

  try {
    await db.transaction(async (tx) => {
      // If order list is empty, purge all orders from database
      if (orderList.length === 0) {
        await tx.delete(orders);
        return;
      }

      // Delete any orders from the database that are no longer in active orderList
      const activeCodes = orderList.map((o) => o.code).filter(Boolean);
      if (activeCodes.length > 0) {
        await tx.delete(orders).where(notInArray(orders.code, activeCodes));
      }

      for (const ord of orderList) {
        const allImages = ord.productImageUrls && ord.productImageUrls.length > 0 
          ? ord.productImageUrls 
          : (ord.productImageUrl ? [ord.productImageUrl] : []);
        const primaryImage = allImages[0] || ord.productImageUrl || '';

        const createdDate = formatDateForDb(ord.createdAt);
        const updatedDate = formatDateForDb(ord.updatedAt);

        await tx
          .insert(orders)
          .values({
            code: ord.code,
            clientId: ord.clientId && ord.clientId.trim() ? ord.clientId.trim() : null,
            clientName: ord.clientName,
            clientPhone: ord.clientPhone || '',
            clientProvince: ord.clientProvince || 'Luanda',
            clientDistrict: ord.clientDistrict || '',
            clientAddress: ord.clientAddress || '',
            productName: ord.productName,
            productDescription: ord.productDescription || '',
            productImageUrl: primaryImage,
            productImageUrls: allImages,
            quantity: ord.quantity || 1,
            resalePrice: formatNumericForDb(ord.resalePrice),
            amountPaid: formatNumericForDb(ord.amountPaid),
            amountPending: formatNumericForDb(ord.amountPending),
            paymentStatus: ord.paymentStatus || 'PENDENTE',
            paymentMethod: ord.paymentMethod || 'TRANSFERENCIA',
            status: ord.status || 'AGUARDANDO_PAGAMENTO',
            estimatedDeliveryDate: ord.estimatedDeliveryDate || '',
            purchaseCost: formatNumericForDb(ord.purchaseCost),
            purchaseLocation: ord.purchaseLocation || '',
            deliveryCost: formatNumericForDb(ord.deliveryCost),
            otherCosts: formatNumericForDb(ord.otherCosts),
            grossProfit: formatNumericForDb(ord.grossProfit),
            netProfit: formatNumericForDb(ord.netProfit),
            adminNotes: ord.adminNotes || '',
            createdAt: createdDate,
            updatedAt: updatedDate,
          })
          .onConflictDoUpdate({
            target: orders.code,
            set: {
              clientId: ord.clientId && ord.clientId.trim() ? ord.clientId.trim() : null,
              clientName: ord.clientName,
              clientPhone: ord.clientPhone || '',
              clientProvince: ord.clientProvince || 'Luanda',
              clientDistrict: ord.clientDistrict || '',
              clientAddress: ord.clientAddress || '',
              productName: ord.productName,
              productDescription: ord.productDescription || '',
              productImageUrl: primaryImage,
              productImageUrls: allImages,
              quantity: ord.quantity || 1,
              resalePrice: formatNumericForDb(ord.resalePrice),
              amountPaid: formatNumericForDb(ord.amountPaid),
              amountPending: formatNumericForDb(ord.amountPending),
              paymentStatus: ord.paymentStatus || 'PENDENTE',
              paymentMethod: ord.paymentMethod || 'TRANSFERENCIA',
              status: ord.status || 'AGUARDANDO_PAGAMENTO',
              estimatedDeliveryDate: ord.estimatedDeliveryDate || '',
              purchaseCost: formatNumericForDb(ord.purchaseCost),
              purchaseLocation: ord.purchaseLocation || '',
              deliveryCost: formatNumericForDb(ord.deliveryCost),
              otherCosts: formatNumericForDb(ord.otherCosts),
              grossProfit: formatNumericForDb(ord.grossProfit),
              netProfit: formatNumericForDb(ord.netProfit),
              adminNotes: ord.adminNotes || '',
              updatedAt: updatedDate,
            },
          });
      }
    });
  } catch (error) {
    throw wrapDbError(error, 'saveDbOrders');
  }
}

// ---------------- CLIENTS ----------------

/**
 * Retrieves all clients from PostgreSQL database
 */
export async function getDbClients(): Promise<Client[]> {
  if (!db || !isSqlAvailable()) {
    return [];
  }
  try {
    const rows = await db.select().from(clients);
    return rows.map((r): Client => ({
      id: r.clientId,
      name: r.name,
      phone: r.phone || '',
      province: r.province || 'Luanda',
      district: r.district || undefined,
      address: r.address || '',
      totalSpent: parseNumeric(r.totalSpent),
      totalOrders: r.orderCount || 0,
      createdAt: parseDateIso(r.createdAt),
    }));
  } catch (error) {
    markSqlUnavailable();
    return [];
  }
}

/**
 * Persists a single client synchronously to PostgreSQL.
 * Throws DatabaseError on failure.
 */
export async function saveDbClient(c: Client): Promise<Client> {
  if (!db || !isSqlAvailable()) {
    throw new DatabaseError('PostgreSQL indisponível para gravação de cliente', null, 503);
  }
  if (!c || !c.id || !c.name) {
    throw new DatabaseError('Dados de cliente inválidos: id e nome são obrigatórios', null, 400);
  }

  const createdDate = formatDateForDb(c.createdAt);

  try {
    await db
      .insert(clients)
      .values({
        clientId: c.id,
        name: c.name,
        phone: c.phone || '',
        province: c.province || 'Luanda',
        district: c.district || '',
        address: c.address || '',
        notes: '',
        totalSpent: formatNumericForDb(c.totalSpent),
        orderCount: c.totalOrders && c.totalOrders >= 0 ? c.totalOrders : 0,
        createdAt: createdDate,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: clients.clientId,
        set: {
          name: c.name,
          phone: c.phone || '',
          province: c.province || 'Luanda',
          district: c.district || '',
          address: c.address || '',
          totalSpent: formatNumericForDb(c.totalSpent),
          orderCount: c.totalOrders && c.totalOrders >= 0 ? c.totalOrders : 0,
          updatedAt: new Date(),
        },
      });

    return c;
  } catch (error) {
    throw wrapDbError(error, `saveDbClient(${c.id})`);
  }
}

/**
 * Persists a list of clients in a single atomic transaction.
 * Confirms with PostgreSQL before returning. Throws DatabaseError on failure.
 */
export async function saveDbClients(clientList: Client[]): Promise<void> {
  if (!db || !isSqlAvailable()) {
    throw new DatabaseError('PostgreSQL indisponível para gravação de clientes', null, 503);
  }
  if (!Array.isArray(clientList)) {
    throw new DatabaseError('Lista de clientes inválida', null, 400);
  }
  if (clientList.length === 0) return;

  try {
    await db.transaction(async (tx) => {
      for (const c of clientList) {
        const createdDate = formatDateForDb(c.createdAt);
        await tx
          .insert(clients)
          .values({
            clientId: c.id,
            name: c.name,
            phone: c.phone || '',
            province: c.province || 'Luanda',
            district: c.district || '',
            address: c.address || '',
            notes: '',
            totalSpent: formatNumericForDb(c.totalSpent),
            orderCount: c.totalOrders && c.totalOrders >= 0 ? c.totalOrders : 0,
            createdAt: createdDate,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: clients.clientId,
            set: {
              name: c.name,
              phone: c.phone || '',
              province: c.province || 'Luanda',
              district: c.district || '',
              address: c.address || '',
              totalSpent: formatNumericForDb(c.totalSpent),
              orderCount: c.totalOrders && c.totalOrders >= 0 ? c.totalOrders : 0,
              updatedAt: new Date(),
            },
          });
      }
    });
  } catch (error) {
    throw wrapDbError(error, 'saveDbClients');
  }
}

// ---------------- SETTINGS ----------------

/**
 * Retrieves global application settings from PostgreSQL
 */
export async function getDbSettings(): Promise<AppSettings | null> {
  if (!db || !isSqlAvailable()) {
    return null;
  }
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, 'global_settings'));
    if (rows.length === 0) return null;
    const dataVal = rows[0].data;
    if (typeof dataVal === 'object' && dataVal !== null) {
      return dataVal as AppSettings;
    }
    return JSON.parse(String(dataVal));
  } catch (error) {
    markSqlUnavailable();
    return null;
  }
}

/**
 * Persists global settings synchronously to PostgreSQL.
 * Throws DatabaseError on failure.
 */
export async function saveDbSettings(settingsData: AppSettings): Promise<void> {
  if (!db || !isSqlAvailable()) {
    throw new DatabaseError('PostgreSQL indisponível para gravação de configurações', null, 503);
  }
  if (!settingsData || typeof settingsData !== 'object') {
    throw new DatabaseError('Objeto de configurações inválido', null, 400);
  }

  try {
    // Sincronização e fusão atômica de credenciais para blindagem contra sobrescritas
    const existing = await getDbSettings();
    const mergedData = existing ? mergePreservedSettings(settingsData, existing) : settingsData;

    await db
      .insert(appSettings)
      .values({
        key: 'global_settings',
        data: mergedData,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          data: mergedData,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    throw wrapDbError(error, 'saveDbSettings');
  }
}

// ---------------- AUDIT LOGS ----------------

/**
 * Retrieves recent audit logs from PostgreSQL ordered by newest first
 */
export async function getDbAuditLogs(): Promise<AuditLog[]> {
  if (!db || !isSqlAvailable()) {
    return [];
  }
  try {
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(150);
    return rows.map((r): AuditLog => {
      const timeIso = parseDateIso(r.timestamp);
      return {
        id: r.logId,
        orderId: r.orderCode || 'ord-sistema',
        orderCode: r.orderCode || 'SISTEMA',
        action: r.action,
        description: r.details || r.action,
        createdAt: timeIso,
        createdBy: r.user || 'Admin',
        updatedAt: timeIso,
        updatedBy: r.user || 'Admin',
      };
    });
  } catch (error) {
    markSqlUnavailable();
    return [];
  }
}

/**
 * Persists a single audit log entry synchronously to PostgreSQL.
 * Throws DatabaseError on failure.
 */
export async function createDbAuditLog(l: AuditLog): Promise<AuditLog> {
  if (!db || !isSqlAvailable()) {
    throw new DatabaseError('PostgreSQL indisponível para gravação de log', null, 503);
  }
  if (!l || !l.id || !l.action) {
    throw new DatabaseError('Dados de log de auditoria inválidos', null, 400);
  }

  const timeDate = formatDateForDb(l.createdAt);

  try {
    await db
      .insert(auditLogs)
      .values({
        logId: l.id,
        orderCode: l.orderCode || 'SISTEMA',
        user: l.createdBy || 'Admin',
        action: l.action,
        details: l.description || '',
        previousStatus: null,
        newStatus: null,
        timestamp: timeDate,
      })
      .onConflictDoNothing();

    return l;
  } catch (error) {
    throw wrapDbError(error, `createDbAuditLog(${l.id})`);
  }
}

/**
 * Persists an array of audit logs in a single atomic transaction.
 * Throws DatabaseError on failure.
 */
export async function saveDbAuditLogs(logsList: AuditLog[]): Promise<void> {
  if (!db || !isSqlAvailable()) {
    throw new DatabaseError('PostgreSQL indisponível para gravação de logs', null, 503);
  }
  if (!Array.isArray(logsList)) {
    throw new DatabaseError('Lista de logs de auditoria inválida', null, 400);
  }
  if (logsList.length === 0) return;

  try {
    await db.transaction(async (tx) => {
      for (const l of logsList) {
        const timeDate = formatDateForDb(l.createdAt);
        await tx
          .insert(auditLogs)
          .values({
            logId: l.id,
            orderCode: l.orderCode || 'SISTEMA',
            user: l.createdBy || 'Admin',
            action: l.action,
            details: l.description || '',
            previousStatus: null,
            newStatus: null,
            timestamp: timeDate,
          })
          .onConflictDoNothing();
      }
    });
  } catch (error) {
    throw wrapDbError(error, 'saveDbAuditLogs');
  }
}

