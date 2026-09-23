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

Cuando se llegue a esta fase, el módulo debe replicar (y eventualmente reemplazar)
ese informe: reporte de ventas por rango de fechas, estado de inventario, y
ranking de platillos/bebidas más vendidos. No es prioridad mientras se construye
el flujo de mesas y comandas, pero es el requisito funcional a cubrir cuando se
aborde.

## Convenciones de código
- Nombres de clases, variables y archivos en inglés.
- Textos de interfaz en español.

## Fuera de alcance (por ahora)
- Integración con plataformas de delivery (Pedido Ya, Uber Eats)
- Facturación electrónica ante entidades fiscales
- App móvil nativa
- Reservaciones en línea para clientes externos
