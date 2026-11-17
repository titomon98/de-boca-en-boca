-- Revisión (SOLO LECTURA) de tarjeta del 16/11/2026 contra la liquidación NeoNet
-- (lote 000085, 14 vouchers, Q2,925.00). El voucher incluye la propina, así que
-- se compara contra monto + propina de cada cobro con tarjeta.
\pset footer off
\set dia '2026-11-16'

\echo '===== 1. Totales del día por método (hora Guatemala) ====='
SELECT payment_method AS metodo, count(*) AS cobros,
       sum(amount) AS ventas, sum(tip) AS propinas, sum(amount + tip) AS total_con_propina
FROM restaurante.payments
WHERE (date AT TIME ZONE 'America/Guatemala')::date = :'dia'
GROUP BY payment_method ORDER BY payment_method;

\echo '===== 2. Cobros con tarjeta del día ====='
SELECT p.id, to_char(p.date AT TIME ZONE 'America/Guatemala', 'HH24:MI') AS hora,
       p.account_id AS cuenta, p.amount AS monto, p.tip AS propina,
       p.amount + p.tip AS total, u.name AS cobro
FROM restaurante.payments p LEFT JOIN restaurante.users u ON u.id = p.user_id
WHERE (p.date AT TIME ZONE 'America/Guatemala')::date = :'dia' AND p.payment_method = 'card'
ORDER BY p.date;

-- Vouchers de la liquidación NeoNet (en orden).
CREATE TEMP TABLE vouchers (rec int, monto numeric);
INSERT INTO vouchers VALUES (1,165),(2,90),(3,220),(4,145),(5,185),(6,265),(7,125),
  (8,340),(9,370),(10,180),(11,175),(12,185),(13,245),(14,235);

-- Empareja voucher con cobro de igual monto (montos repetidos, uno a uno).
CREATE TEMP TABLE v AS SELECT rec, monto, row_number() OVER (PARTITION BY monto ORDER BY rec) AS n FROM vouchers;
CREATE TEMP TABLE c AS
  SELECT p.id, p.account_id, p.amount + p.tip AS monto, p.date,
         row_number() OVER (PARTITION BY p.amount + p.tip ORDER BY p.date) AS n
  FROM restaurante.payments p
  WHERE (p.date AT TIME ZONE 'America/Guatemala')::date = :'dia' AND p.payment_method = 'card';

\echo '===== 3. Vouchers SIN cobro con tarjeta en el sistema ====='
SELECT v.rec AS voucher, v.monto FROM v LEFT JOIN c ON c.monto = v.monto AND c.n = v.n
WHERE c.id IS NULL ORDER BY v.rec;

\echo '===== 4. Cobros con tarjeta en el sistema SIN voucher ====='
SELECT c.id AS cobro, c.account_id AS cuenta, c.monto,
       to_char(c.date AT TIME ZONE 'America/Guatemala', 'HH24:MI') AS hora
FROM c LEFT JOIN v ON v.monto = c.monto AND v.n = c.n
WHERE v.rec IS NULL ORDER BY c.date;

\echo '===== 5. Cobros en EFECTIVO/TRANSFERENCIA del día con el mismo monto que un voucher faltante (posible método equivocado) ====='
SELECT p.id AS cobro, p.account_id AS cuenta, p.payment_method AS metodo,
       p.amount AS monto, p.tip AS propina, p.amount + p.tip AS total,
       to_char(p.date AT TIME ZONE 'America/Guatemala', 'HH24:MI') AS hora
FROM restaurante.payments p
WHERE (p.date AT TIME ZONE 'America/Guatemala')::date = :'dia' AND p.payment_method <> 'card'
  AND (p.amount + p.tip IN (SELECT v.monto FROM v LEFT JOIN c ON c.monto = v.monto AND c.n = v.n WHERE c.id IS NULL)
       OR p.amount IN (SELECT v.monto FROM v LEFT JOIN c ON c.monto = v.monto AND c.n = v.n WHERE c.id IS NULL))
ORDER BY p.date;

\echo '===== 6. Cuentas del día que quedaron sin pagar completas (abiertas/cobrando) ====='
SELECT a.id AS cuenta, a.status, a.total - a.discount + a.courier_fee AS neto,
       COALESCE((SELECT sum(amount) FROM restaurante.payments WHERE account_id = a.id), 0) AS pagado
FROM restaurante.accounts a
WHERE (a.opened_at AT TIME ZONE 'America/Guatemala')::date = :'dia' AND a.status IN ('open', 'billing')
ORDER BY a.id;

\echo '===== 7. Bitácora del día: cobros anulados/editados y cuentas anuladas/eliminadas ====='
SELECT to_char(created_at AT TIME ZONE 'America/Guatemala', 'HH24:MI') AS hora,
       account_id AS cuenta, user_name AS usuario, action AS accion, detail AS detalle
FROM restaurante.audit_logs
WHERE (created_at AT TIME ZONE 'America/Guatemala')::date = :'dia'
  AND action IN ('cobro_anulado', 'cobro_editado', 'cuenta_anulada', 'cuenta_eliminada')
ORDER BY created_at;

\echo '===== 8. Cierres de caja del 16 y 17/11 ====='
SELECT id, to_char(date AT TIME ZONE 'America/Guatemala', 'DD/MM HH24:MI') AS fecha,
       total_sales AS ventas, total_cash AS efectivo, total_card AS tarjeta,
       total_transfer AS transferencia, total_tips AS propinas, difference AS diferencia, notes AS notas
FROM restaurante.cash_closings
WHERE (date AT TIME ZONE 'America/Guatemala')::date IN ('2026-11-16', '2026-11-17')
ORDER BY date;
