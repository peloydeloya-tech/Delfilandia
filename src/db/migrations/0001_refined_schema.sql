-- ==============================================================================
-- DELFILÂNDIA - MIGRATION 0001: REFINED SCHEMA (ETAPA 3 - FASE 2A.1)
-- Dialect: PostgreSQL (Safe Alteration on Existing Schema)
-- Description: Converts numeric fields to numeric(12,2), timestamps to timestamptz,
--              jsonb columns, adds non-redundant indexes, check constraints,
--              and sets up the foreign key from orders.client_id to clients.client_id.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Table: clients
-- ------------------------------------------------------------------------------
-- Ensure columns have appropriate lengths and constraints
ALTER TABLE "clients" 
  ALTER COLUMN "client_id" TYPE varchar(64),
  ALTER COLUMN "name" TYPE varchar(255),
  ALTER COLUMN "phone" TYPE varchar(64),
  ALTER COLUMN "phone" SET NOT NULL,
  ALTER COLUMN "province" TYPE varchar(100),
  ALTER COLUMN "district" TYPE varchar(100);

-- Convert numeric fields
ALTER TABLE "clients"
  ALTER COLUMN "total_spent" TYPE numeric(12, 2) USING ROUND(COALESCE("total_spent", 0)::numeric, 2),
  ALTER COLUMN "total_spent" SET DEFAULT '0.00',
  ALTER COLUMN "total_spent" SET NOT NULL;

ALTER TABLE "clients"
  ALTER COLUMN "order_count" TYPE integer USING COALESCE("order_count", 0)::integer,
  ALTER COLUMN "order_count" SET DEFAULT 0,
  ALTER COLUMN "order_count" SET NOT NULL;

-- Convert timestamps
ALTER TABLE "clients"
  ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at"::timestamptz,
  ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE "clients"
  ALTER COLUMN "updated_at" TYPE timestamp with time zone USING "updated_at"::timestamptz,
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updated_at" SET NOT NULL;

-- Add check constraints on clients
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_total_spent_check') THEN
    ALTER TABLE "clients" ADD CONSTRAINT "clients_total_spent_check" CHECK ("total_spent" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_order_count_check') THEN
    ALTER TABLE "clients" ADD CONSTRAINT "clients_order_count_check" CHECK ("order_count" >= 0);
  END IF;
END $$;

-- Non-redundant indexes for clients
-- Note: clients.client_id already has a UNIQUE index (clients_client_id_key).
CREATE INDEX IF NOT EXISTS "clients_phone_idx" ON "clients" ("phone");


-- ------------------------------------------------------------------------------
-- 2. Table: orders
-- ------------------------------------------------------------------------------
-- String types and lengths
ALTER TABLE "orders"
  ALTER COLUMN "code" TYPE varchar(32),
  ALTER COLUMN "client_id" TYPE varchar(64),
  ALTER COLUMN "client_name" TYPE varchar(255),
  ALTER COLUMN "client_phone" TYPE varchar(64),
  ALTER COLUMN "client_province" TYPE varchar(100),
  ALTER COLUMN "client_district" TYPE varchar(100),
  ALTER COLUMN "product_name" TYPE varchar(255),
  ALTER COLUMN "payment_status" TYPE varchar(32),
  ALTER COLUMN "payment_status" SET DEFAULT 'PENDENTE',
  ALTER COLUMN "payment_status" SET NOT NULL,
  ALTER COLUMN "payment_method" TYPE varchar(32),
  ALTER COLUMN "status" TYPE varchar(32),
  ALTER COLUMN "status" SET DEFAULT 'AGUARDANDO_PAGAMENTO',
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "estimated_delivery_date" TYPE varchar(64),
  ALTER COLUMN "purchase_location" TYPE varchar(100);

-- Integer quantity
ALTER TABLE "orders"
  ALTER COLUMN "quantity" TYPE integer USING COALESCE("quantity", 1)::integer,
  ALTER COLUMN "quantity" SET DEFAULT 1,
  ALTER COLUMN "quantity" SET NOT NULL;

-- Numeric fields
ALTER TABLE "orders"
  ALTER COLUMN "resale_price" TYPE numeric(12, 2) USING ROUND(COALESCE("resale_price", 0)::numeric, 2),
  ALTER COLUMN "resale_price" SET DEFAULT '0.00',
  ALTER COLUMN "resale_price" SET NOT NULL;

ALTER TABLE "orders"
  ALTER COLUMN "amount_paid" TYPE numeric(12, 2) USING ROUND(COALESCE("amount_paid", 0)::numeric, 2),
  ALTER COLUMN "amount_paid" SET DEFAULT '0.00',
  ALTER COLUMN "amount_paid" SET NOT NULL;

ALTER TABLE "orders"
  ALTER COLUMN "amount_pending" TYPE numeric(12, 2) USING ROUND(COALESCE("amount_pending", 0)::numeric, 2),
  ALTER COLUMN "amount_pending" SET DEFAULT '0.00',
  ALTER COLUMN "amount_pending" SET NOT NULL;

ALTER TABLE "orders"
  ALTER COLUMN "purchase_cost" TYPE numeric(12, 2) USING ROUND(COALESCE("purchase_cost", 0)::numeric, 2),
  ALTER COLUMN "purchase_cost" SET DEFAULT '0.00',
  ALTER COLUMN "purchase_cost" SET NOT NULL;

ALTER TABLE "orders"
  ALTER COLUMN "delivery_cost" TYPE numeric(12, 2) USING ROUND(COALESCE("delivery_cost", 0)::numeric, 2),
  ALTER COLUMN "delivery_cost" SET DEFAULT '0.00',
  ALTER COLUMN "delivery_cost" SET NOT NULL;

ALTER TABLE "orders"
  ALTER COLUMN "other_costs" TYPE numeric(12, 2) USING ROUND(COALESCE("other_costs", 0)::numeric, 2),
  ALTER COLUMN "other_costs" SET DEFAULT '0.00',
  ALTER COLUMN "other_costs" SET NOT NULL;

ALTER TABLE "orders"
  ALTER COLUMN "gross_profit" TYPE numeric(12, 2) USING ROUND(COALESCE("gross_profit", 0)::numeric, 2),
  ALTER COLUMN "gross_profit" SET DEFAULT '0.00',
  ALTER COLUMN "gross_profit" SET NOT NULL;

ALTER TABLE "orders"
  ALTER COLUMN "net_profit" TYPE numeric(12, 2) USING ROUND(COALESCE("net_profit", 0)::numeric, 2),
  ALTER COLUMN "net_profit" SET DEFAULT '0.00',
  ALTER COLUMN "net_profit" SET NOT NULL;

-- JSONB product_image_urls
ALTER TABLE "orders"
  ALTER COLUMN "product_image_urls" TYPE jsonb USING (
    CASE 
      WHEN "product_image_urls" IS NULL OR "product_image_urls" = '' THEN '[]'::jsonb
      ELSE "product_image_urls"::jsonb
    END
  ),
  ALTER COLUMN "product_image_urls" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "product_image_urls" SET NOT NULL;

-- Timestamps
ALTER TABLE "orders"
  ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at"::timestamptz,
  ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE "orders"
  ALTER COLUMN "updated_at" TYPE timestamp with time zone USING "updated_at"::timestamptz,
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updated_at" SET NOT NULL;

-- Check constraints on orders
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_quantity_check') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_quantity_check" CHECK ("quantity" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_resale_price_check') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_resale_price_check" CHECK ("resale_price" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_amount_paid_check') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_amount_paid_check" CHECK ("amount_paid" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_amount_pending_check') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_amount_pending_check" CHECK ("amount_pending" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_purchase_cost_check') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_purchase_cost_check" CHECK ("purchase_cost" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_cost_check') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_cost_check" CHECK ("delivery_cost" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_other_costs_check') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_other_costs_check" CHECK ("other_costs" >= 0);
  END IF;
END $$;

-- Foreign key: orders.client_id -> clients.client_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_client_id_fkey') THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_client_id_fkey"
      FOREIGN KEY ("client_id")
      REFERENCES "clients"("client_id")
      ON DELETE SET NULL;
  END IF;
END $$;

-- Non-redundant indexes on orders
-- Note: orders.code already has a UNIQUE index (orders_code_key).
CREATE INDEX IF NOT EXISTS "orders_client_id_idx" ON "orders" ("client_id");
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" ("status");
CREATE INDEX IF NOT EXISTS "orders_created_at_idx" ON "orders" ("created_at");


-- ------------------------------------------------------------------------------
-- 3. Table: app_settings
-- ------------------------------------------------------------------------------
ALTER TABLE "app_settings"
  ALTER COLUMN "key" TYPE varchar(64),
  ALTER COLUMN "data" TYPE jsonb USING "data"::jsonb,
  ALTER COLUMN "data" SET DEFAULT '{}'::jsonb,
  ALTER COLUMN "data" SET NOT NULL,
  ALTER COLUMN "updated_at" TYPE timestamp with time zone USING "updated_at"::timestamptz,
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updated_at" SET NOT NULL;

-- Note: app_settings.key already has a UNIQUE index (app_settings_key_key). No redundant index needed.


-- ------------------------------------------------------------------------------
-- 4. Table: audit_logs
-- ------------------------------------------------------------------------------
ALTER TABLE "audit_logs"
  ALTER COLUMN "log_id" TYPE varchar(64),
  ALTER COLUMN "order_code" TYPE varchar(32),
  ALTER COLUMN "user" TYPE varchar(100),
  ALTER COLUMN "user" SET DEFAULT 'Admin',
  ALTER COLUMN "user" SET NOT NULL,
  ALTER COLUMN "action" TYPE varchar(100),
  ALTER COLUMN "action" SET NOT NULL,
  ALTER COLUMN "details" SET NOT NULL,
  ALTER COLUMN "previous_status" TYPE varchar(32),
  ALTER COLUMN "new_status" TYPE varchar(32),
  ALTER COLUMN "timestamp" TYPE timestamp with time zone USING "timestamp"::timestamptz,
  ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "timestamp" SET NOT NULL;

-- Non-redundant indexes on audit_logs
-- Note: audit_logs.log_id already has a UNIQUE index (audit_logs_log_id_key).
CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs" ("timestamp");
CREATE INDEX IF NOT EXISTS "audit_logs_order_code_idx" ON "audit_logs" ("order_code");

COMMIT;
