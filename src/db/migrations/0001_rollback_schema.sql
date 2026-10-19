-- ==============================================================================
-- DELFILÂNDIA - MIGRATION ROLLBACK (DOWN): RESTORE PREVIOUS SCHEMA TYPES
-- Dialect: PostgreSQL
-- Description: Reverts types to text and double precision, drops custom constraints and indexes.
-- ==============================================================================

BEGIN;

-- 1. Rollback indexes
DROP INDEX IF EXISTS "orders_client_id_idx";
DROP INDEX IF EXISTS "orders_status_idx";
DROP INDEX IF EXISTS "orders_created_at_idx";
DROP INDEX IF EXISTS "clients_phone_idx";
DROP INDEX IF EXISTS "audit_logs_timestamp_idx";
DROP INDEX IF EXISTS "audit_logs_order_code_idx";

-- 2. Rollback constraints
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_client_id_fkey";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_quantity_check";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_resale_price_check";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_amount_paid_check";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_amount_pending_check";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_purchase_cost_check";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_delivery_cost_check";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_other_costs_check";

ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_total_spent_check";
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_order_count_check";

-- 3. Rollback audit_logs columns
ALTER TABLE "audit_logs"
  ALTER COLUMN "log_id" TYPE text,
  ALTER COLUMN "order_code" TYPE text,
  ALTER COLUMN "user" TYPE text,
  ALTER COLUMN "user" DROP NOT NULL,
  ALTER COLUMN "action" TYPE text,
  ALTER COLUMN "details" DROP NOT NULL,
  ALTER COLUMN "previous_status" TYPE text,
  ALTER COLUMN "new_status" TYPE text,
  ALTER COLUMN "timestamp" TYPE text USING to_char("timestamp", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  ALTER COLUMN "timestamp" DROP DEFAULT;

-- 4. Rollback app_settings columns
ALTER TABLE "app_settings"
  ALTER COLUMN "key" TYPE text,
  ALTER COLUMN "data" TYPE text USING "data"::text,
  ALTER COLUMN "data" DROP DEFAULT,
  ALTER COLUMN "updated_at" TYPE text USING to_char("updated_at", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  ALTER COLUMN "updated_at" DROP DEFAULT;

-- 5. Rollback orders columns
ALTER TABLE "orders"
  ALTER COLUMN "code" TYPE text,
  ALTER COLUMN "client_id" TYPE text,
  ALTER COLUMN "client_name" TYPE text,
  ALTER COLUMN "client_phone" TYPE text,
  ALTER COLUMN "client_province" TYPE text,
  ALTER COLUMN "client_district" TYPE text,
  ALTER COLUMN "product_name" TYPE text,
  ALTER COLUMN "payment_status" TYPE text,
  ALTER COLUMN "payment_status" DROP NOT NULL,
  ALTER COLUMN "payment_method" TYPE text,
  ALTER COLUMN "status" TYPE text,
  ALTER COLUMN "estimated_delivery_date" TYPE text,
  ALTER COLUMN "purchase_location" TYPE text,
  ALTER COLUMN "quantity" TYPE integer,
  ALTER COLUMN "quantity" DROP NOT NULL,
  ALTER COLUMN "resale_price" TYPE double precision USING "resale_price"::double precision,
  ALTER COLUMN "resale_price" DROP NOT NULL,
  ALTER COLUMN "amount_paid" TYPE double precision USING "amount_paid"::double precision,
  ALTER COLUMN "amount_paid" DROP NOT NULL,
  ALTER COLUMN "amount_pending" TYPE double precision USING "amount_pending"::double precision,
  ALTER COLUMN "amount_pending" DROP NOT NULL,
  ALTER COLUMN "purchase_cost" TYPE double precision USING "purchase_cost"::double precision,
  ALTER COLUMN "purchase_cost" DROP NOT NULL,
  ALTER COLUMN "delivery_cost" TYPE double precision USING "delivery_cost"::double precision,
  ALTER COLUMN "delivery_cost" DROP NOT NULL,
  ALTER COLUMN "other_costs" TYPE double precision USING "other_costs"::double precision,
  ALTER COLUMN "other_costs" DROP NOT NULL,
  ALTER COLUMN "gross_profit" TYPE double precision USING "gross_profit"::double precision,
  ALTER COLUMN "gross_profit" DROP NOT NULL,
  ALTER COLUMN "net_profit" TYPE double precision USING "net_profit"::double precision,
  ALTER COLUMN "net_profit" DROP NOT NULL,
  ALTER COLUMN "product_image_urls" TYPE text USING "product_image_urls"::text,
  ALTER COLUMN "product_image_urls" DROP DEFAULT,
  ALTER COLUMN "product_image_urls" DROP NOT NULL,
  ALTER COLUMN "created_at" TYPE text USING to_char("created_at", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  ALTER COLUMN "created_at" DROP DEFAULT,
  ALTER COLUMN "updated_at" TYPE text USING to_char("updated_at", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  ALTER COLUMN "updated_at" DROP DEFAULT;

-- 6. Rollback clients columns
ALTER TABLE "clients"
  ALTER COLUMN "client_id" TYPE text,
  ALTER COLUMN "name" TYPE text,
  ALTER COLUMN "phone" TYPE text,
  ALTER COLUMN "phone" DROP NOT NULL,
  ALTER COLUMN "province" TYPE text,
  ALTER COLUMN "district" TYPE text,
  ALTER COLUMN "total_spent" TYPE double precision USING "total_spent"::double precision,
  ALTER COLUMN "total_spent" DROP NOT NULL,
  ALTER COLUMN "order_count" TYPE integer,
  ALTER COLUMN "order_count" DROP NOT NULL,
  ALTER COLUMN "created_at" TYPE text USING to_char("created_at", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  ALTER COLUMN "created_at" DROP DEFAULT,
  ALTER COLUMN "updated_at" TYPE text USING to_char("updated_at", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  ALTER COLUMN "updated_at" DROP DEFAULT;

COMMIT;
