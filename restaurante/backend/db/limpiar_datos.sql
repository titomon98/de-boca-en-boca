-- Borra TODOS los datos de operación (pruebas) y deja el sistema como nuevo.
-- Se conservan: usuarios, menú (categorías y productos), mesas, configuración y sedes.
-- Se borran: cuentas, comandas, cobros, bitácora, cierres de caja e idempotencia.
-- Los IDs vuelven a empezar en 1 (el recibo "orden No. 1").
BEGIN;

TRUNCATE
  restaurante.order_items,
  restaurante.orders,
  restaurante.payments,
  restaurante.account_tables,
  restaurante.audit_logs,
  restaurante.accounts,
  restaurante.cash_closings,
  restaurante.idempotency_keys
RESTART IDENTITY;

UPDATE restaurante.tables SET status = 'free';

COMMIT;
