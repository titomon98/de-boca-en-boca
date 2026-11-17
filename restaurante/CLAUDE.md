# CLAUDE.md — Sistema Restaurante "De Boca en Boca"

## Rol
Eres el desarrollador principal de este sistema. Trabajas siguiendo un patrón MVC
sobre NestJS. La plantilla base es FoodDesk, reorientada de "delivery" a
"pedidos en sala/mesas". Prioriza construir primero el flujo de mesas y comandas
antes que reportes o analítica.

## Identidad de marca
Basado en el logo oficial (boca/labios sobre fondo rojo, texto amarillo con contorno negro).

- Amarillo principal `#F5C518` — color dominante de la interfaz (fondos de header, sidebar, tarjetas destacadas, botones primarios neutros).
- Negro `#1A1A1A` — texto principal, contornos, íconos.
- Blanco `#FFFFFF` — texto sobre fondos oscuros/rojos, fondos de contraste.
- Rojo de detalle `#D62828` — uso puntual (acentos, bordes, badges), NO como color dominante.
- Verde de confirmación `#2E7D32` — exclusivo para acciones de confirmar/aceptar/guardar/cobrar (ej. "Confirmar comanda", "Cobrar cuenta").
- Rojo de cancelación `#D32F2F` — exclusivo para acciones de cancelar/eliminar/anular (ej. "Cancelar comanda", "Anular mesa").

Reglas de aplicación:

- Nunca mezclar el rojo de detalle con el rojo de cancelación en el mismo componente (son roles semánticos distintos, aunque el tono sea similar).
- El logo se usa en el header y como favicon; ajustar el layout para que conviva con el amarillo de fondo (usar la versión del logo sobre fondo claro si el contraste con el rojo del logo se pierde).
- Ajustar los hex exactos si al implementar no calzan bien con los componentes de FoodDesk; estos son el punto de partida.

## Stack
- Backend: NestJS + TypeScript
- ORM: TypeORM
- Base de datos: PostgreSQL (instancia compartida de Supabase), schema propio: `restaurante`
- Autenticación: JWT propio vía Passport
- Tiempo real: WebSocket Gateway de NestJS (Socket.io) — NO GraphQL. Se usa
  exclusivamente para el canal mesero → cocina; el resto de la API es REST normal.
- Frontend base: FoodDesk (Bootstrap)

## Mapeo MVC en este proyecto
- **Model**: Entidades TypeORM + Repositories + Services
- **View**: Plantilla FoodDesk, consumida vía REST + eventos WebSocket
- **Controller**: Controllers de NestJS + Gateway de WebSocket para eventos en tiempo real

## Estructura de carpetas (backend)
```
src/
  modules/
    mesas/                 # estado de mesas, unión de mesas, cuentas separadas
    menu/                  # catálogo de platillos/bebidas, categorías
    comandas/               # órdenes por mesa, estados, historial
    pos/                    # cobro, formas de pago
    caja/                    # cierre de caja diario
    reportes/
    usuarios/                 # roles: administrador, mesero, cajero, cocina
  gateways/
    comandas.gateway.ts        # WebSocket: mesero envía → cocina recibe en tiempo real
  common/
    guards/
    decorators/
  config/
```

## Módulo de Mesas (construir aunque la plantilla no lo tenga)
FoodDesk no trae un mapa visual de mesas — se construye desde cero usando los
componentes de tarjetas/grid que sí trae la plantilla.
- Maqueta inicial: 15 mesas.
- Estados por mesa: libre / ocupada / en espera de pago.
- Debe soportar:
  - Unir dos o más mesas en una sola cuenta.
  - Cuentas separadas dentro de una misma mesa mientras se sigue ordenando
    (ej. cliente A y cliente B piden por separado en la misma mesa).
  - Marcar una mesa como "cobrando" antes de cerrar la cuenta.
- Botón de "cobrar/confirmar cuenta" en verde; botón de "cancelar/anular" en rojo.

## Comandas en tiempo real
- El mesero crea/envía la comanda desde su vista → evento WebSocket → la vista
  de cocina se actualiza sin recargar la página.
- El rol "cocina" solo debe ver comandas activas en tiempo real, filtradas a
  su propia vista (no debe ver el módulo de caja, mesas administrativas, etc.)
  — aplicar guard de rol a nivel de módulo.
- Nombres de canal explícitos y documentados en el gateway
  (ej. `comanda:nueva`, `comanda:actualizada`).
- Botón de "confirmar comanda" en verde; botón de "cancelar comanda" en rojo.

## Módulo de Reportes (fase posterior, no prioritaria)
Actualmente el restaurante genera manualmente un informe en Excel que incluye:

- Ventas (por período).
- Inventario.
- Ranking de productos más vendidos.

El módulo replica ese informe: reporte de ventas por rango de fechas y ranking de
platillos/bebidas más vendidos, con filtros por categoría y por combos/no combos.
El ranking desglosa los componentes de combos. **Ya no se incluye inventario**
(el cliente no lo necesita). Exporta a PDF y Excel (con logo y timestamp).

## Convenciones de código
- Nombres de clases, variables y archivos en inglés.
- Textos de interfaz en español.
- No usar guiones largos en la interfaz ni ejemplos "ej." en los placeholders.

## Decisiones vigentes (actualizado 2026-09-25)
- **Roles: solo 3** — Administrador, Cajero, Mesero. NO hay usuario de cocina.
- **Métodos de pago:** efectivo (`cash`), tarjeta (`card`), transferencia (`transfer`).
  El cierre de caja desglosa los tres de forma exacta.
- **Sin inventario** de materia prima. (Se quitó el reporte de inventario.)
- **Cocina y Barra separadas:** las bebidas se envían a Barra y la comida a Cocina.
  Son pantallas de visualización (sin login de cocina); el ruteo depende del `type`
  del producto (`drink` -> barra, `food` -> cocina).
- **Combos (estadística):** el combo es un platillo con precio de paquete; sus
  componentes son productos reales que se registran a Q0 en `order_items.components`
  y se cuentan en el ranking. La estadística distingue si un producto (ej. alitas)
  se vendió individual o como parte de combo. Las opciones a elegir (aderezos) son
  productos reales ligados vía `choice_groups`; también se venden por separado.
- **Foodtruck / sedes (infraestructura hecha):** tabla `venues` (name, type
  'restaurant'|'foodtruck', active) con la sede inicial "Restaurante"; `GET /venues`.
  Cada cuenta guarda `venue_id` (por defecto la sede activa). Para agregar el
  foodtruck: insertar una fila en `venues` y, cuando se necesite, filtrar
  reportes/caja por sede y elegir la sede activa del dispositivo. No se construyó
  UI de sedes todavía (solo la base de datos y el modelo).
- **Caja como área propia:** la caja NO va en el croquis del salón pequeño (ahí va
  un baño). La caja es su propia área en el mapa de mesas y desde la vista **Caja**
  se hacen pedidos para llevar y se cobra (el cobro lleva al detalle de la cuenta,
  flujo completo con transferencia/propina/descuento/abonos).
- **Para llevar vs A domicilio:** son vistas separadas. Ambas usan la mesa virtual
  is_takeout, distinguidas por `is_delivery`. El botón/efectivo de **envío al
  motorista existe SOLO en "A domicilio"** (no en mesas ni en para llevar).
- **Salones independientes:** al abrir cuenta no se pueden unir mesas de salones
  distintos (validado en backend y en el modal, agrupado por salón).
- **Cocina/Barra impresión:** cada estación imprime SOLO sus renglones (comida ->
  Cocina, bebida -> Barra).
- **Menú del mesero:** cada producto ya agregado muestra un contador [N].
- **Cierre de caja:** conteo por método (efectivo, tarjeta/vouchers,
  transferencia/comprobantes) con esperado vs. contado y diferencia por método.
- **Mesas con croquis (hecho):** el mapa de mesas se dibuja como croquis de DOS
  salones. Cada mesa tiene `salon` ('pequeno'/'grande') y opcional `name` (mesas
  con nombre). Distribución según el plano del cliente:
  - Salón Pequeño: Pequeña, Barra, 1, 2, 3 (+ decoración Caja).
  - Salón Grande: 7, 6, 5, 4 (arriba); 8, 9, 10 (medio); 13, 12, 11 (abajo)
    (+ decoración Tele y Baño). Las posiciones del croquis están en `Mesas.js`.
- **Cocina/Barra (hecho):** mismo tablero, filtrado por tipo de producto
  (comida->Cocina, bebida->Barra). Vistas de visualización, sin login de cocina.
- **Envíos (hecho):** cuenta marcada como envío con `courier_fee` (efectivo que
  sale de caja para el motorista). El cierre de caja resta ese efectivo del
  esperado (`efectivo esperado = cobrado - salidas a motoristas`) para cuadrar.
- **Tablet con impresora:** el sistema se usará en tablet; el menú del mesero debe
  ser táctil (un toque agrega producto). La cotización de la tablet es externa.

- **Comanda dividida por estación:** al enviar una comanda con comida y bebida se
  crean DOS comandas (una de cocina, una de barra), cada una con su propio estado.
  Entregar las bebidas en barra no afecta a la comida en cocina. La cuenta suma el
  total de ambas. (En `comandas.service.create` se agrupa por `menu_items.type`.)
- **Propina al total:** la propina es dinero real que entra por el método de pago
  usado. En el cierre, el esperado de cada método (efectivo/tarjeta/transferencia)
  incluye su propina; las ventas se reportan sin propina y las propinas aparte.
  (ej. neto 375 + propina 15 = efectivo esperado 390.)

- **Agrupación visual del menú (`grupo`):** columna `menu_items.grupo`. Productos
  con el mismo valor se muestran como UNA tarjeta en el menú táctil (ej. "Cervezas",
  "Gaseosas", "Frappes", "Alitas"); al tocarla, un modal lista las variantes (cada
  una con su precio) y se eligen. Las bebidas simples se suman con contador sin
  cerrar el modal; las variantes con `choice_groups` (alitas) pasan al modal de
  Sabor/Aderezo una por una. No afecta precio ni analítica.
- **Opciones/sabores a Q0:** los sabores (alitas, nuggets, pan con pollo) son
  productos a Q0 sin categoría; el menú táctil oculta todo lo de precio 0, así solo
  sirven como opción de `choice_groups` y se cuentan en el ranking como componentes.
  Los aderezos (Q5) sí se venden sueltos y además son opción. "12 Alitas" es un
  producto Q0 usado solo como componente del Combo 2.
- **Combos con elección:** el tipo de quesadilla (res/pollo) de los combos 1 y 3 y
  el sabor/aderezo de las alitas en combos 2 y 3 se piden como `choice_groups` del
  propio combo. El buscador del menú (admin) filtra por nombre/categoría/descripción.

- **Cocina/Barra automáticas (2026-10-02):** ya NO se marca estado a mano. La
  comanda nace `delivered`; cada estación imprime (auto al llegar o reimprime) y
  se asume preparada/entregada. Las pantallas Cocina/Barra son un feed reciente
  (12h). El tiempo de mesa se mide ordenó -> pagó.
- **Notas por estación:** la comanda lleva `notesCocina` y `notesBarra`; cada una
  va con su orden (cocina/barra).
- **Hora local:** todas las vistas muestran hora de Guatemala
  (`timeZone: 'America/Guatemala'` vía helpers `fmtDateTime`/`fmtTime`).
- **Extras:** los aderezos están en la categoría "Extras" y agrupados (grupo
  "Aderezos") en el menú táctil.
- **Descuentos con autorización:** admin aplica directo; cajero/mesero solo
  "Solicitan" (monto+razón, queda en `accounts.discount_request*`); el admin ve
  el banner en la cuenta (y aviso en Caja) y pulsa Autorizar/Rechazar. Endpoints
  `/accounts/:id/discount-request|discount-approve|discount-reject`.
- **Historial de cuentas:** vista `historial-cuentas` (admin/cajero) con el
  registro de cada cuenta (estado, total, descuento, pagado, propina, tiempo
  ordenó->pagó); "Ver" abre el detalle. Endpoint `GET /accounts/history`.
- **Sabores de alitas repartidos (distribución):** el grupo "Sabor" de 10/20/30 y
  Sampler es de tipo `distribute` en `choice_groups` ({distribute, total,
  maxOptions, optionItemIds}). Reparte el total de alitas entre hasta N sabores,
  parejo y ajustable (10->10/1, 20->20/2, 30->30/3, Sampler->60/12). El backend
  valida suma==total y distintos<=maxOptions.
- **Recibo al cliente:** botón "Imprimir recibo" en la cuenta; en domicilio separa
  Productos y Envío motorista (printReceipt en printTicket.js).
- **Puente de impresión (`print-bridge/`):** servicio Node local (puerto 7070) que
  recibe el texto del ticket de las tablets y lo manda a la térmica de red por IP
  (ESC/POS, 9100). Cada tablet apunta al puente en Configuración (localStorage
  `printBridgeUrl`); si está vacío, imprime por navegador. Config de IPs por
  estación en `print-bridge/config.json`.

- **Ajustes 2026-10-05:** (1) sabores de alitas se ajustan por PASO: `step` en el
  grupo distribute (alitas 10, sampler 5); (2) hora: `toDate` trata timestamps sin
  zona como UTC y los muestra en Guatemala; (3) ticket y tablero de cocina muestran
  "PARA LLEVAR"/"A DOMICILIO" en grande y la nota en negrita; (4) modales con
  `backdrop="static" keyboard={false}` (solo X/Cancelar cierran); (5) efectivo al
  motorista se ingresa al ENTREGAR (ADomicilio); la caja lo cuenta por
  `delivered_at` (no por pago); (6) historial de caja EDITABLE (PATCH
  /cash-closings/:id, solo admin, queda en bitácora `cierre_editado`); (7) reportes:
  ranking por categoría (`GET /reports/category-ranking`, agrupa sabores/combos/
  bebidas, desglosa componentes) y (9) ventas por tipo (`/reports/sales-by-type`:
  Mesa/Para llevar/Domicilio); (8) fecha de reporte con formato dd/mm/yyyy +
  "Generado"; (10) impresión consolidada en `printHtml` robusto (limpia iframes
  previos, imprime una vez, limpia con onafterprint); (12) abrir cuenta en una mesa
  ya unida preselecciona todo el grupo de mesas.

- **Zona horaria de raíz (2026-10-05):** todas las columnas de fecha son
  `timestamptz` (instante absoluto). Antes eran `timestamp` sin zona + `TZ=GT` en
  el proceso, lo que corría la hora 6h. Migración idempotente en schema.sql (bloque
  DO que convierte lo que siga siendo `timestamp`, interpretando lo guardado como
  UTC). Los reportes agrupan por día con `AT TIME ZONE 'America/Guatemala'`. El
  frontend muestra todo con `fmtDateTime`/`fmtTime` (America/Guatemala) y el
  nombre de archivo de reportes también va en hora local.

- **Envío a domicilio (corrige 2026-10-05):** el efectivo al motorista se le cobra
  al cliente, así que se ingresa **al cobrar** (campo en el modal de cobro de
  cuentas a domicilio; recalcula productos + envío). Al **entregar**, si ya está
  cobrada, el envío queda fijo y solo se confirma (la caja lo descuenta por
  `delivered_at`). `setDelivery` rechaza cambios en cuentas cobradas (para cambiarlo:
  anular el cobro en Cobros) y no permite un envío que deje el neto bajo lo pagado.

- **Impresión automática (2026-10-15):** el sitio es HTTPS, así que el navegador
  bloquea llamar al puente local por HTTP. El puente ahora se conecta al servidor
  por WebSocket (`auth.bridgeKey` == `PRINT_BRIDGE_KEY` del .env) y escucha
  `comanda:nueva`; imprime cada comanda en la impresora de su estación
  (`config.json`). Domicilio se rotula "A DOMICILIO - PARA LLEVAR". Letra de
  comandas más grande (renglones doble alto en ESC/POS, 19px en navegador).

- **Todo por el puente (2026-10-16):** ya no se usa el diálogo de impresión del
  navegador. Reimprimir comanda y "Imprimir recibo" arman el texto ESC/POS en la
  tablet y lo mandan a `POST /orders/print` {station: cocina|barra|caja, text};
  el gateway lo reenvía al puente (sala `bridge`, evento `imprimir`). 503 si no
  hay puente conectado. Cocina/Barra ya no auto-imprimen (lo hace el puente).

- **Mesero cobra (2026-10-16):** el mesero puede cobrar (total/abono y por
  producto); anular/corregir cobros sigue siendo de admin y cajero.
- **Grupos opcionales en `choice_groups`:** `optional: true` permite elegir de 0
  hasta `choose`, cada opción una vez (ej. Quesadilla MX/pollo y combos con quesadilla: "Agregar", choose 1, con
  "Con aguacate"/"Con picante", Q0). Script `db/quesadillas_aguacate_picante.sql`.
  El DTO del menú ya declara `optional/distribute/total/maxOptions/step` (antes
  el whitelist los borraba al editar un producto en Menú).

- **Menú CRUD (2026-10-16):** `category` es relación eager; al editar, el objeto
  cargado pisaba `categoryId` (el cambio de categoría no se guardaba). `update`
  ahora reemplaza también la relación. MenuAdmin conserva los campos extra de
  `choice_groups` al editar y manda `null` para quitar categoría/descripción/foto.
  El Combo 3 no lleva "Agregar" (aguacate/picante).

- **Impresos sin nombre de cuenta (2026-10-16):** el nombre (label) de la cuenta
  NUNCA se imprime: ni en comandas ni en recibos. Combos en comanda: "1x Combo
  (Q95)" sin número ni componentes; sabores repartidos con cantidad ("6 BBQ, 6
  Búfalo"). Cocina y barra comparten número (`orders.comanda_no`).

- **Cambiar mesa (2026-11-17):** botón morado "Cambiar mesa" en la cuenta (no en
  para llevar/domicilio). `POST /accounts/:id/move-tables` {tableIds}: la cuenta deja
  sus mesas y queda en las nuevas (mismo salón), comandas y cobros intactos;
  bitácora `mesa_cambiada`. Cajero también agrega comida (rol en abrir cuenta,
  unir mesas, comandas). La nota del renglón ya no lleva las elecciones
  (`stripChoiceNotes` en comandas.service): salen con guiones.

## Lotes completados
Menú táctil, abonos/saldos y pago por producto, propinas, descuentos por mesero,
cocina/barra, envíos con alerta de efectivo al motorista, croquis de mesas (dos
salones), caja como área para pedidos para llevar, e infraestructura de sedes
(venues) para un futuro foodtruck. Toda la hoja de ruta inicial está cubierta.

## Hoja de ruta / pendientes (por lote)
1. **Menú del mesero táctil** (referencia: pantalla tipo grid): categorías arriba
   (incluida "Todos"), grid de productos con foto y descripción breve; un toque
   agrega; abajo la lista de lo ya agregado; para quitar, tocar en la lista de abajo.
2. **Pagos por abonos y saldos en una sola cuenta:** debe registrarse lo pagado y
   lo pendiente. Dos modalidades posibles: (a) por monto (un amigo abona Q100, otro
   Q150...) y (b) producto por producto (un amigo paga 3 bebidas y un platillo).
   Ambas conviven con el pago total.
3. **Propina:** input por monto o por porcentaje; sugerida por rangos o para cuadrar
   (ej. se pagó 62, sugerir 8). No obligatoria (checkbox para incluir/quitar al
   pagar). Se contabiliza en su propio espacio, aparte de las ventas.
4. **Descuentos:** a criterio del mesero (cualquier mesero puede ingresarlos).
   Obligatoria una descripción y queda en la bitácora.
5. **Envíos a domicilio:** el cliente transfiere el total; desde caja se saca
   efectivo para el motorista. Si el pago fue transferencia, mostrar una alerta de
   que se pagó en efectivo de caja al motorista, para evitar descuadre.
6. **Cocina/Barra:** ruteo de comandas por tipo (bebida -> barra).
7. **Foodtruck / segundo local:** infraestructura de sedes.
8. **Mesas con croquis** (cuando llegue el croquis).

## Fuera de alcance (por ahora)
- Integración con plataformas de delivery de terceros (Pedido Ya, Uber Eats).
  (El envío propio del restaurante SÍ está en la hoja de ruta.)
- Facturación electrónica ante entidades fiscales
- App móvil nativa
- Reservaciones en línea para clientes externos
