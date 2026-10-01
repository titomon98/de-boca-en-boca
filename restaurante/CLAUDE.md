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
