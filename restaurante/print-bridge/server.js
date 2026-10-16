/**
 * Puente de impresión para De Boca en Boca.
 * Corre en la computadora del restaurante. La impresora puede estar conectada
 * por puerto serial a esa computadora (COM3) o en la red local (IP:9100). Recibe el texto del
 * ticket desde las tablets (por HTTP) y lo envía a la impresora por su IP
 * (RAW / puerto 9100, ESC/POS).
 *
 * Uso:  node server.js        (configura las IPs en config.json)
 *
 * Impresión automática: si config.json trae `server` y `bridgeKey`, el puente
 * se conecta al servidor (WebSocket) y cada comanda nueva se imprime sola en la
 * impresora de su estación (comida -> cocina, bebida -> barra), sin depender de
 * que una tablet tenga abierta la pantalla de Cocina/Barra.
 */
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 7070;

let config = { printers: {} };
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch (e) {
  console.warn('[puente] No se encontró config.json; usa la variable PRINTER o crea config.json.');
}

/** IP:puerto de la impresora para una estación (cocina/barra/caja), con respaldo. */
function printerFor(station) {
  const p = config.printers || {};
  return p[station] || p.default || process.env.PRINTER || '';
}

/** Quita acentos (muchas térmicas no los imprimen bien por codepage). */
const FOLD = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', ñ: 'n', Ñ: 'N', ü: 'u', Ü: 'U', '¿': '?', '¡': '!', '°': ' ' };
function fold(s) {
  return String(s).replace(/[áéíóúÁÉÍÓÚñÑüÜ¿¡°]/g, (c) => FOLD[c] || c);
}

/** Impresora serial: "COM3", "COM3@19200" (Windows) o "/dev/ttyUSB0@9600" (Linux/Mac). */
const isSerial = (target) => /^(COM\d+|\/dev\/)/i.test(String(target));
/** Impresora instalada en Windows (USB001, etc.), compartida: "win:NOMBRE_COMPARTIDO". */
const winShare = (target) => (/^win:(.+)$/i.exec(String(target)) || [])[1] || '';

/** Envía texto crudo + corte a una impresora ESC/POS, por puerto serial o por red (TCP 9100). */
// Una impresión a la vez por impresora: cocina y barra llegan juntas y un
// puerto COM no se puede abrir dos veces al mismo tiempo.
const queues = {};
function sendToPrinter(target, text) {
  const payload = Buffer.from('\x1B@' + fold(text) + '\n\n\n\n\n\n' + '\x1Bd\x04' + '\x1DV\x00', 'latin1'); // reset + texto + avance + corte
  const run = () =>
    winShare(target) ? sendWindows(winShare(target), payload)
      : isSerial(target) ? sendSerial(target, payload)
        : sendTcp(target, payload);
  const job = (queues[target] || Promise.resolve()).then(run, run);
  queues[target] = job.catch(() => {});
  return job;
}

/** Envía los bytes tal cual (RAW) a la impresora compartida: copy /b archivo \\localhost\NOMBRE */
function sendWindows(share, payload) {
  const os = require('os');
  const { execFile } = require('child_process');
  const tmp = path.join(os.tmpdir(), 'dbeb-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.bin');
  fs.writeFileSync(tmp, payload);
  return new Promise((resolve, reject) => {
    execFile('cmd', ['/c', 'copy', '/b', tmp, '\\\\localhost\\' + share], { windowsHide: true }, (err, stdout, stderr) => {
      fs.unlink(tmp, () => {});
      if (err) return reject(new Error('no imprime en "' + share + '" (¿está compartida con ese nombre?): ' + (stderr || stdout || err.message).trim()));
      resolve();
    });
  });
}

function sendSerial(target, payload) {
  const [path, baud] = String(target).split('@');
  const { SerialPort } = require('serialport');
  return new Promise((resolve, reject) => {
    const port = new SerialPort({ path, baudRate: Number(baud) || 9600 }, (err) => {
      if (err) return reject(new Error('no abre ' + path + ': ' + err.message));
      port.write(payload, (e) => {
        if (e) { port.close(); return reject(e); }
        port.drain(() => port.close(() => resolve()));
      });
    });
  });
}

function sendTcp(target, payload) {
  return new Promise((resolve, reject) => {
    const [host, portStr] = String(target).split(':');
    const sock = net.connect(Number(portStr) || 9100, host, () => {
      sock.write(payload, () => sock.end());
    });
    sock.setTimeout(5000, () => { sock.destroy(); reject(new Error('timeout de la impresora')); });
    sock.on('error', reject);
    sock.on('close', () => resolve());
  });
}

// --- Comandas automáticas ------------------------------------------------------
const W = 42; // caracteres por línea en 80mm (fuente A)
const BIG = '\x1D\x21\x11'; // doble ancho + doble alto
const TALL = '\x1D\x21\x01'; // doble alto (mismo ancho: caben 42 caracteres)
const NORM = '\x1D\x21\x00';
const BOLD = '\x1B\x45\x01';
const UNBOLD = '\x1B\x45\x00';
const center = (s, w = W) => ' '.repeat(Math.max(0, Math.floor((w - s.length) / 2))) + s;
const rule = () => '-'.repeat(W);

/** Etiqueta grande: domicilio también es para llevar. Vacío si es mesa. */
function areaLines(order) {
  if (order.account && order.account.isDelivery) return ['A DOMICILIO', 'PARA LLEVAR'];
  const takeout = ((order.account && order.account.tables) || []).some((t) => t.isTakeout || t.number === 0);
  return takeout ? ['PARA LLEVAR'] : [];
}

/** Estación de una comanda (ya vienen separadas por estación desde el backend). */
function stationOf(order) {
  const item = (order.items || [])[0];
  return item && item.menuItem && item.menuItem.type === 'drink' ? 'barra' : 'cocina';
}

function comandaText(order) {
  const station = stationOf(order);
  const mesas = ((order.account && order.account.tables) || [])
    .map((t) => (t.isTakeout || t.number === 0 ? 'Para llevar' : t.name || t.number))
    .join(', ') || '-';
  const fecha = new Date(order.createdAt || Date.now()).toLocaleString('es-GT', { timeZone: 'America/Guatemala' });
  let t = center('De Boca en Boca') + '\n';
  t += BIG + center('COMANDA #' + order.id, W / 2) + NORM + '\n';
  for (const a of areaLines(order)) t += BIG + center(a, W / 2) + NORM + '\n';
  // Todo en letra grande (como PARA LLEVAR): 21 caracteres por línea, la
  // impresora parte solita las líneas largas.
  t += '\n' + BIG + 'Mesa: ' + mesas + NORM + '\n';
  t += TALL + 'Mesero: ' + ((order.waiter && order.waiter.name) || '-') + '\n' + fecha + NORM + '\n' + rule() + '\n';
  for (const it of order.items || []) {
    t += BIG + BOLD + it.quantity + 'x ' + ((it.menuItem && it.menuItem.name) || '') + UNBOLD + NORM + '\n';
    for (const c of it.components || []) t += BIG + ' - ' + (c.quantity ? c.quantity + 'x ' : '') + (c.name || '') + NORM + '\n';
    if (it.notes) t += BIG + ' ' + it.notes + NORM + '\n';
  }
  t += rule() + '\n';
  if (order.notes) t += BIG + 'Nota: ' + order.notes + NORM + '\n';
  t += '\n' + BIG + center(station.toUpperCase(), W / 2) + NORM + '\n' + rule() + '\n';
  return t;
}

function listenComandas() {
  if (!config.server || !config.bridgeKey) {
    console.warn('[puente] Sin "server"/"bridgeKey" en config.json: no hay impresión automática de comandas.');
    return;
  }
  const { io } = require('socket.io-client');
  const socket = io(config.server.replace(/\/$/, '') + '/comandas', {
    auth: { bridgeKey: config.bridgeKey },
    transports: ['websocket'],
  });
  socket.on('connect', () => console.log('[puente] conectado al servidor, esperando comandas'));
  socket.on('disconnect', (r) => console.warn('[puente] desconectado:', r));
  socket.on('connect_error', (e) => console.warn('[puente] no conecta al servidor:', e.message));
  // ponytail: si el puente está apagado cuando llega una comanda, esa no se imprime
  // (se reimprime desde la pantalla Cocina/Barra). Cola de pendientes si hace falta.
  // Tickets que mandan las tablets por el servidor (recibos de caja, reimpresiones).
  socket.on('imprimir', async ({ station, text } = {}) => {
    const target = printerFor(station || 'default');
    if (!target) return console.error('[puente] sin impresora para', station);
    try {
      await sendToPrinter(target, text || '');
      console.log('[puente] ticket -> ' + station + ' (' + target + ')');
    } catch (e) {
      console.error('[puente] error imprimiendo ticket de ' + station + ':', e.message);
    }
  });

  socket.on('comanda:nueva', async (order) => {
    const station = stationOf(order);
    const target = printerFor(station);
    if (!target) return console.error('[puente] sin impresora para', station);
    try {
      await sendToPrinter(target, comandaText(order));
      console.log('[puente] comanda #' + order.id + ' -> ' + station + ' (' + target + ')');
    } catch (e) {
      console.error('[puente] error imprimiendo comanda #' + order.id + ':', e.message);
    }
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, printers: Object.keys(config.printers || {}) }));
    return;
  }
  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      try {
        const { station, text } = JSON.parse(body || '{}');
        const target = printerFor(station || 'default');
        if (!target) throw new Error('No hay impresora configurada para "' + station + '"');
        await sendToPrinter(target, text || '');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, printer: target }));
      } catch (e) {
        console.error('[puente] error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }
  res.writeHead(404); res.end('not found');
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`[puente] escuchando en http://0.0.0.0:${PORT}`));
  listenComandas();
}

module.exports = { printerFor, fold, sendToPrinter, comandaText, stationOf, isSerial, winShare };
