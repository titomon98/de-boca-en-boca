-- =====================================================
-- Sistema: Restaurante
-- Schema: restaurante
-- Incluye: mapa de mesas (15), cuentas (con unión de mesas y cuentas
--          separadas por mesa), comandas a cocina, POS y cierre de caja.
-- Idempotente: seguro de ejecutar varias veces.
-- =====================================================

CREATE SCHEMA IF NOT EXISTS restaurante;

-- Usuarios y roles del sistema.
--  administrator: acceso total
--  waiter (mesero): mesas, cuentas y comandas
--  cashier (cajero): POS y cierre de caja
--  kitchen (cocina): sólo comandas activas (tiempo real)
CREATE TABLE IF NOT EXISTS restaurante.users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('administrator','waiter','cashier','kitchen')),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Mesas físicas del salón. Maqueta inicial: 15 mesas (ver seed).
-- status refleja el mapa visual y se deriva de las cuentas abiertas sobre la mesa.
CREATE TABLE IF NOT EXISTS restaurante.tables (
  id SERIAL PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  capacity INTEGER NOT NULL DEFAULT 4,
  status VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (status IN ('free','occupied','billing')),
  is_takeout BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
-- is_takeout: mesa virtual "Para llevar". Admite varias órdenes en paralelo y
-- nunca se ocupa. ALTER idempotente + una sola fila garantizada (número 0).
ALTER TABLE restaurante.tables ADD COLUMN IF NOT EXISTS is_takeout BOOLEAN NOT NULL DEFAULT false;
INSERT INTO restaurante.tables (number, capacity, status, is_takeout)
SELECT 0, 0, 'free', true
WHERE NOT EXISTS (SELECT 1 FROM restaurante.tables WHERE is_takeout);

-- Catálogo del menú.
CREATE TABLE IF NOT EXISTS restaurante.menu_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS restaurante.menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(255),
  category_id INTEGER REFERENCES restaurante.menu_categories(id),
  price NUMERIC(10,2) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'food' CHECK (type IN ('food','drink')),
  available BOOLEAN NOT NULL DEFAULT true,
  image TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
-- image: foto del platillo en base64 (data URL). ALTER idempotente:
ALTER TABLE restaurante.menu_items ADD COLUMN IF NOT EXISTS image TEXT;

-- Cuenta (comanda de cobro). Una cuenta puede abarcar VARIAS mesas (unión)
-- y una misma mesa puede tener VARIAS cuentas abiertas (cuentas separadas).
-- La relación N:M se resuelve en account_tables.
CREATE TABLE IF NOT EXISTS restaurante.accounts (
  id SERIAL PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','billing','paid','cancelled')),
  waiter_id INTEGER REFERENCES restaurante.users(id),
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  opened_at TIMESTAMP NOT NULL DEFAULT now(),
  closed_at TIMESTAMP
);

-- Relación cuenta <-> mesas (soporta unión de mesas y cuentas separadas por mesa).
CREATE TABLE IF NOT EXISTS restaurante.account_tables (
  account_id INTEGER NOT NULL REFERENCES restaurante.accounts(id) ON DELETE CASCADE,
  table_id INTEGER NOT NULL REFERENCES restaurante.tables(id),
  PRIMARY KEY (account_id, table_id)
);

-- Comanda: lote de platillos que el mesero envía a cocina.
CREATE TABLE IF NOT EXISTS restaurante.orders (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES restaurante.accounts(id),
  waiter_id INTEGER NOT NULL REFERENCES restaurante.users(id),
  cook_id INTEGER REFERENCES restaurante.users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_preparation','ready','delivered','cancelled')),
  notes VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
-- cook_id: cocinero que atendió la comanda (se registra al pasarla a preparación/lista).
-- ALTER idempotente para bases ya existentes:
ALTER TABLE restaurante.orders ADD COLUMN IF NOT EXISTS cook_id INTEGER REFERENCES restaurante.users(id);
-- Ya no se usa el estado 'pending': las comandas nacen 'in_preparation'.
UPDATE restaurante.orders SET status = 'in_preparation' WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS restaurante.order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES restaurante.orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES restaurante.menu_items(id),
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  notes VARCHAR(255)
);

-- Pagos (POS). Una cuenta puede liquidarse con uno o varios pagos.
CREATE TABLE IF NOT EXISTS restaurante.payments (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES restaurante.accounts(id),
  user_id INTEGER NOT NULL REFERENCES restaurante.users(id),
  amount NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(30) NOT NULL,
  date TIMESTAMP NOT NULL DEFAULT now()
);

-- Bitácora de auditoría: quién hizo qué sobre cada cuenta/comanda.
-- Guarda nombre y rol del usuario (denormalizado) para que el log siga siendo
-- legible aunque el usuario cambie o se elimine después.
CREATE TABLE IF NOT EXISTS restaurante.audit_logs (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES restaurante.accounts(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES restaurante.orders(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES restaurante.users(id),
  user_name VARCHAR(150),
  user_role VARCHAR(30),
  action VARCHAR(50) NOT NULL,
  detail VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_restaurante_audit_account ON restaurante.audit_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_restaurante_audit_order ON restaurante.audit_logs(order_id);

-- Configuración del sistema (clave/valor). Ej: impresión de comandas.
CREATE TABLE IF NOT EXISTS restaurante.settings (
  key VARCHAR(60) PRIMARY KEY,
  value VARCHAR(255),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
INSERT INTO restaurante.settings (key, value)
  VALUES ('print_comandas', 'false')
  ON CONFLICT (key) DO NOTHING;

-- Cierre de caja diario.
CREATE TABLE IF NOT EXISTS restaurante.cash_closings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES restaurante.users(id),
  date TIMESTAMP NOT NULL DEFAULT now(),
  total_sales NUMERIC(12,2) NOT NULL,
  total_cash NUMERIC(12,2) NOT NULL,
  total_card NUMERIC(12,2) NOT NULL,
  difference NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_restaurante_accounts_status ON restaurante.accounts(status);
CREATE INDEX IF NOT EXISTS idx_restaurante_account_tables_table ON restaurante.account_tables(table_id);
CREATE INDEX IF NOT EXISTS idx_restaurante_orders_account ON restaurante.orders(account_id);
CREATE INDEX IF NOT EXISTS idx_restaurante_orders_status ON restaurante.orders(status);
CREATE INDEX IF NOT EXISTS idx_restaurante_order_items_order ON restaurante.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_restaurante_payments_account ON restaurante.payments(account_id);

-- Idempotencia persistente para POST (compartida entre instancias).
CREATE TABLE IF NOT EXISTS restaurante.idempotency_keys (
  key_hash VARCHAR(64) PRIMARY KEY,
  identity VARCHAR(160) NOT NULL,
  route VARCHAR(255) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  state VARCHAR(20) NOT NULL CHECK (state IN ('processing', 'completed')),
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_restaurante_idempotency_expiry ON restaurante.idempotency_keys(expires_at);

-- Guardas de integridad monetaria (idempotentes).
DO $$ BEGIN
  ALTER TABLE restaurante.payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE restaurante.order_items ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
