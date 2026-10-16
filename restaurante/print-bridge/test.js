// Self-check mínimo del puente (sin impresora). Corre: node test.js
const assert = require('assert');
const { fold, printerFor, comandaText, stationOf, isSerial, winShare } = require('./server');

// fold quita acentos
assert.strictEqual(fold('Limón Serrano'), 'Limon Serrano');
assert.strictEqual(fold('Micheladón ñ Ú'), 'Micheladon n U');

// printerFor usa estación, luego default, luego vacío
const saved = process.env.PRINTER;
delete process.env.PRINTER;
// sin config cargada en este proceso, cae a '' si no hay default
assert.strictEqual(typeof printerFor('cocina'), 'string');
if (saved !== undefined) process.env.PRINTER = saved;

// comanda a domicilio dice A DOMICILIO y PARA LLEVAR; bebida va a barra
const dom = { id: 7, items: [{ quantity: 2, menuItem: { name: 'Coca', type: 'drink' } }], account: { isDelivery: true, tables: [{ number: 0, isTakeout: true }] } };
assert.strictEqual(stationOf(dom), 'barra');
const txt = comandaText(dom);
assert.ok(txt.includes('A DOMICILIO') && txt.includes('PARA LLEVAR') && txt.includes('2x Coca'));
assert.ok(!comandaText({ id: 1, items: [{ quantity: 1, menuItem: { name: 'X', type: 'food' } }], account: { tables: [{ number: 3 }] } }).includes('PARA LLEVAR'));

// serial vs red
assert.ok(isSerial('COM3') && isSerial('com4@19200') && isSerial('/dev/ttyUSB0@9600'));
assert.ok(!isSerial('192.168.1.50:9100'));
assert.strictEqual(winShare('win:TERMICA'), 'TERMICA');
assert.strictEqual(winShare('COM3'), '');

console.log('OK: fold, printerFor, comandaText e isSerial funcionan');
