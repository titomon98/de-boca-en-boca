/**
 * Imprime una comanda como ticket de 80mm usando un iframe oculto (no lo bloquea
 * el navegador, a diferencia de window.open). La impresora térmica debe estar
 * configurada como predeterminada en el sistema operativo del equipo.
 */
export function printTicket(order, opts = {}) {
  const restaurante = opts.restaurante || 'De Boca en Boca';
  // Estación: si se indica `type` ('food'/'drink'), sólo se imprimen los
  // renglones de esa estación (comida -> Cocina, bebida -> Barra).
  const station = opts.station || 'COCINA';
  const mesas = (order.account?.tables || [])
    .map((t) => (t.isTakeout || t.number === 0 ? 'Para llevar' : t.name || t.number))
    .join(', ');
  const fecha = new Date(order.createdAt || Date.now()).toLocaleString('es-GT');

  const items = (order.items || []).filter(
    (it) => !opts.type || (it.menuItem?.type || 'food') === opts.type,
  );
  // Nada para esta estación: no se imprime.
  if (items.length === 0) return;

  const rows = items
    .map(
      (it) => `
      <tr>
        <td class="q">${it.quantity}x</td>
        <td class="n">${escapeHtml(it.menuItem?.name || '')}${
          it.notes ? `<div class="note">${escapeHtml(it.notes)}</div>` : ''
        }</td>
      </tr>`,
    )
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Comanda #${order.id}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: 80mm; margin: 0; padding: 6px 8px; font-family: 'Courier New', monospace; color: #000; }
    h1 { font-size: 15px; text-align: center; margin: 0 0 2px; }
    .sub { text-align: center; font-size: 11px; margin-bottom: 6px; }
    .meta { font-size: 12px; margin-bottom: 6px; }
    hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { font-size: 13px; vertical-align: top; padding: 2px 0; }
    td.q { width: 34px; font-weight: bold; }
    .note { font-size: 11px; padding-left: 4px; }
    .foot { text-align: center; font-size: 11px; margin-top: 8px; }
  </style></head><body>
    <h1>${escapeHtml(restaurante)}</h1>
    <div class="sub">COMANDA #${order.id}</div>
    <div class="meta">
      Mesa(s): ${mesas || '-'}<br/>
      Mesero: ${escapeHtml(order.waiter?.name || '-')}<br/>
      ${fecha}
    </div>
    <hr/>
    <table>${rows}</table>
    <hr/>
    ${order.notes ? `<div class="meta">Nota: ${escapeHtml(order.notes)}</div>` : ''}
    <div class="foot">*** ${escapeHtml(station)} ***</div>
  </body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  const done = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      /* noop */
    }
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };

  if (iframe.contentWindow.document.readyState === 'complete') {
    setTimeout(done, 150);
  } else {
    iframe.onload = () => setTimeout(done, 150);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
