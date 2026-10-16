import swal from 'sweetalert';
import api from './api';
import { toDate } from './helpers';

/**
 * Impresión de comandas y recibos (80mm) por el puente de impresión.
 * La tablet arma el texto ESC/POS y lo manda al servidor (POST /orders/print);
 * el servidor lo reenvía por WebSocket al puente de la computadora del
 * restaurante, que lo imprime en la impresora de la estación. No se abre el
 * diálogo de impresión del navegador.
 */
const W = 42; // ancho en caracteres de un ticket de 80mm (fuente A)
const center = (s, w = W) => ' '.repeat(Math.max(0, Math.floor((w - s.length) / 2))) + s;
const rule = () => '-'.repeat(W);
// ESC/POS: letra doble (ancho+alto), doble alto y normal.
const BIG = '\x1D\x21\x11';
const TALL = '\x1D\x21\x01';
const NORM = '\x1D\x21\x00';
// Etiqueta grande de la comanda: A DOMICILIO / PARA LLEVAR (vacío si es mesa).
// Domicilio también es para llevar (se empaca igual).
function areaLines(order) {
  if (order.account?.isDelivery) return ['A DOMICILIO', 'PARA LLEVAR'];
  const takeout = (order.account?.tables || []).some((t) => t.isTakeout || t.number === 0);
  return takeout ? ['PARA LLEVAR'] : [];
}
const money2 = (n) => `Q${Number(n || 0).toFixed(2)}`;
const lineLR = (label, right) => {
  const sp = Math.max(1, W - label.length - String(right).length);
  return label + ' '.repeat(sp) + String(right);
};
const priceRow = (label, value) => lineLR(label, money2(value));

/** Envía el ticket al puente por el servidor. Avisa si no se pudo. */
async function send(station, text) {
  try {
    await api.post('/orders/print', { station, text });
  } catch (e) {
    swal('No se imprimió', e?.response?.data?.message || 'No se pudo contactar el servidor.', 'error');
  }
}

function receiptText(data) {
  const fecha = data.fecha || new Date().toLocaleString('es-GT', { timeZone: 'America/Guatemala' });
  let t = center(data.restaurante || 'De Boca en Boca') + '\n';
  if (data.orderId) t += center('Recibo orden No. ' + data.orderId) + '\n';
  if (data.label) t += center(data.label) + '\n';
  t += center(fecha) + '\n' + rule() + '\n';
  for (const it of data.lines || []) t += priceRow(`${it.quantity}x ${it.name}`, it.subtotal) + '\n';
  t += rule() + '\n';
  t += priceRow('Productos', data.productTotal) + '\n';
  if (Number(data.discount) > 0) t += lineLR('Descuento', '-' + money2(data.discount)) + '\n';
  if (data.isDelivery) t += priceRow('Envio motorista', data.courierFee) + '\n';
  t += TALL + priceRow('TOTAL', data.total) + NORM + '\n';
  if (data.isDelivery) t += '\n' + center('El envio se paga en efectivo') + '\n';
  t += '\n' + center('Gracias por su compra') + '\n' + rule() + '\n';
  return t;
}

// Mismo formato que las comandas automáticas del puente (print-bridge/server.js).
function comandaText(order, items, station) {
  const mesas = (order.account?.tables || [])
    .map((t) => (t.isTakeout || t.number === 0 ? 'Para llevar' : t.name || t.number))
    .join(', ') || '-';
  const fecha = toDate(order.createdAt || Date.now()).toLocaleString('es-GT', { timeZone: 'America/Guatemala' });
  let t = center('De Boca en Boca') + '\n';
  t += BIG + center('COMANDA #' + order.id, W / 2) + NORM + '\n';
  for (const a of areaLines(order)) t += BIG + center(a, W / 2) + NORM + '\n';
  t += '\n' + BIG + 'Mesa: ' + mesas + NORM + '\n';
  t += TALL + 'Mesero: ' + (order.waiter?.name || '-') + '\n' + fecha + NORM + '\n' + rule() + '\n';
  for (const it of items) {
    t += `${BIG}${it.quantity}x ${it.menuItem?.name || ''}${NORM}\n`;
    for (const c of it.components || []) t += `${BIG} - ${c.quantity ? c.quantity + 'x ' : ''}${c.name || ''}${NORM}\n`;
    if (it.notes) t += BIG + ' ' + it.notes + NORM + '\n';
  }
  t += rule() + '\n';
  if (order.notes) t += BIG + 'Nota: ' + order.notes + NORM + '\n';
  t += '\n' + BIG + center(station.toUpperCase(), W / 2) + NORM + '\n' + rule() + '\n';
  return t;
}

/**
 * Imprime (reimprime) una comanda en su estación. Con `type` ('food'/'drink')
 * solo van los renglones de esa estación (comida -> cocina, bebida -> barra).
 */
export function printTicket(order, opts = {}) {
  const items = (order.items || []).filter(
    (it) => !opts.type || (it.menuItem?.type || 'food') === opts.type,
  );
  if (items.length === 0) return Promise.resolve();
  const station = (opts.station || (opts.type === 'drink' ? 'barra' : 'cocina')).toLowerCase();
  return send(station, comandaText(order, items, station));
}

/**
 * Imprime el RECIBO del cliente en la impresora de caja. En domicilio separa
 * productos y envío al motorista.
 * data: { orderId, label, lines:[{quantity,name,subtotal}], productTotal,
 *         discount, courierFee, isDelivery, total, fecha }
 */
export function printReceipt(data = {}) {
  return send('caja', receiptText(data));
}
