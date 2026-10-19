import { pgTable, serial, text, varchar, integer, numeric, timestamp, jsonb, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ==========================================
// 1. Clients table (Base de Clientes DELFILÂNDIA)
// ==========================================
export const clients = pgTable(
  'clients',
  {
    id: serial('id').primaryKey(),
    clientId: varchar('client_id', { length: 64 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 64 }).notNull(),
    province: varchar('province', { length: 100 }),
    district: varchar('district', { length: 100 }),
    address: text('address'),
    notes: text('notes'),
    totalSpent: numeric('total_spent', { precision: 12, scale: 2 }).notNull().default('0.00'),
    orderCount: integer('order_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('clients_client_id_idx').on(table.clientId),
    index('clients_phone_idx').on(table.phone),
    check('clients_total_spent_check', sql`${table.totalSpent} >= 0`),
    check('clients_order_count_check', sql`${table.orderCount} >= 0`),
  ]
);

// ==========================================
// 2. Orders table (Encomendas DELFILÂNDIA)
// ==========================================
export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 32 }).notNull().unique(), // e.g. "AO-160166"
    clientId: varchar('client_id', { length: 64 }).references(() => clients.clientId, { onDelete: 'set null' }),
    clientName: varchar('client_name', { length: 255 }).notNull(),
    clientPhone: varchar('client_phone', { length: 64 }),
    clientProvince: varchar('client_province', { length: 100 }),
    clientDistrict: varchar('client_district', { length: 100 }),
    clientAddress: text('client_address'),
    productName: varchar('product_name', { length: 255 }).notNull(),
    productDescription: text('product_description'),
    productImageUrl: text('product_image_url'),
    productImageUrls: jsonb('product_image_urls').notNull().default(sql`'[]'::jsonb`),
    quantity: integer('quantity').notNull().default(1),
    resalePrice: numeric('resale_price', { precision: 12, scale: 2 }).notNull().default('0.00'),
    amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).notNull().default('0.00'),
    amountPending: numeric('amount_pending', { precision: 12, scale: 2 }).notNull().default('0.00'),
    paymentStatus: varchar('payment_status', { length: 32 }).notNull().default('PENDENTE'),
    paymentMethod: varchar('payment_method', { length: 32 }).default('TRANSFERENCIA'),
    status: varchar('status', { length: 32 }).notNull().default('AGUARDANDO_PAGAMENTO'),
    estimatedDeliveryDate: varchar('estimated_delivery_date', { length: 64 }),
    purchaseCost: numeric('purchase_cost', { precision: 12, scale: 2 }).notNull().default('0.00'),
    purchaseLocation: varchar('purchase_location', { length: 100 }),
    deliveryCost: numeric('delivery_cost', { precision: 12, scale: 2 }).notNull().default('0.00'),
    otherCosts: numeric('other_costs', { precision: 12, scale: 2 }).notNull().default('0.00'),
    grossProfit: numeric('gross_profit', { precision: 12, scale: 2 }).notNull().default('0.00'),
    netProfit: numeric('net_profit', { precision: 12, scale: 2 }).notNull().default('0.00'),
    adminNotes: text('admin_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('orders_code_idx').on(table.code),
    index('orders_client_id_idx').on(table.clientId),
    index('orders_status_idx').on(table.status),
    index('orders_created_at_idx').on(table.createdAt),
    check('orders_quantity_check', sql`${table.quantity} > 0`),
    check('orders_resale_price_check', sql`${table.resalePrice} >= 0`),
    check('orders_amount_paid_check', sql`${table.amountPaid} >= 0`),
    check('orders_amount_pending_check', sql`${table.amountPending} >= 0`),
    check('orders_purchase_cost_check', sql`${table.purchaseCost} >= 0`),
    check('orders_delivery_cost_check', sql`${table.deliveryCost} >= 0`),
    check('orders_other_costs_check', sql`${table.otherCosts} >= 0`),
  ]
);

// ==========================================
// 3. Settings table (Configurações Gerais da Loja)
// ==========================================
export const appSettings = pgTable(
  'app_settings',
  {
    id: serial('id').primaryKey(),
    key: varchar('key', { length: 64 }).notNull().unique(), // e.g. "global_settings"
    data: jsonb('data').notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('app_settings_key_idx').on(table.key),
  ]
);

// ==========================================
// 4. Audit Logs table (Auditoria do Sistema)
// ==========================================
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    logId: varchar('log_id', { length: 64 }).notNull().unique(),
    orderCode: varchar('order_code', { length: 32 }),
    user: varchar('user', { length: 100 }).notNull().default('Admin'),
    action: varchar('action', { length: 100 }).notNull(),
    details: text('details'),
    previousStatus: varchar('previous_status', { length: 32 }),
    newStatus: varchar('new_status', { length: 32 }),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('audit_logs_timestamp_idx').on(table.timestamp),
    index('audit_logs_order_code_idx').on(table.orderCode),
  ]
);
