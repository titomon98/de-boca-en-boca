# Backend — Sistema de Restaurante

Backend REST + WebSocket construido con **NestJS + TypeORM** sobre PostgreSQL
(instancia compartida de Supabase, schema propio `restaurante`).

Prioriza el flujo de **mesas** y **comandas en tiempo real** (mesero → cocina),
como indica el `CLAUDE.md` del sistema.

## Requisitos

- Node.js 18+
- Acceso a la instancia de Supabase (pooler de transacciones, puerto 6543)

## Configuración

1. Copiar variables de entorno y completar la contraseña de la base de datos:

   ```bash
   cp .env.example .env
   ```

   El `.env` ya está ignorado por git. Variables relevantes:

   | Variable | Descripción |
   |----------|-------------|
   | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión Supabase (pooler 6543) |
   | `DB_SCHEMA` | `restaurante` |
   | `JWT_SECRET`, `JWT_EXPIRES_IN` | Firma de tokens |
   | `PORT` | Puerto HTTP (por defecto `3002`) |
   | `CORS_ORIGIN` | Origen del frontend (por defecto `http://localhost:3000`) |

2. Instalar dependencias:

   ```bash
   npm install
   ```

3. Aplicar el esquema y sembrar datos iniciales:

   ```bash
   npm run db:apply
   npm run db:seed
   ```

   El seed crea:
   - Usuario administrador `admin@restaurante.local` / `Admin123!`
   - 15 mesas (maqueta inicial del salón)
   - Un menú de demostración (categorías y platillos)

## Ejecutar

```bash
npm run start:dev
```

API disponible en `http://localhost:3002/api`.

## Roles

| Rol (`role`) | Alcance |
|--------------|---------|
| `administrator` | Acceso total |
| `waiter` (mesero) | Mesas, cuentas y comandas |
| `cashier` (cajero) | POS y cierre de caja |
| `kitchen` (cocina) | Sólo comandas activas (tiempo real) |

## Endpoints principales (`/api`)

### Autenticación
- `POST /auth/login` — `{ email, password }` → `{ accessToken, user }`
- `GET /auth/me` — usuario del token

### Menú
- `GET /menu/items` (`?available=true`), `GET /menu/items/:id`
- `POST/PUT/DELETE /menu/items` (admin)
- `GET /menu/categories`, `POST/PUT/DELETE /menu/categories` (admin)

### Mesas
- `GET /tables` — mapa de mesas con estado (`free` / `occupied` / `billing`)
- `POST/PUT/DELETE /tables` (admin)

### Cuentas (mesero/admin)
- `POST /accounts` — abrir cuenta `{ label, tableIds[], waiterId? }`
  - varias `tableIds` → **unir mesas** en una sola cuenta
  - abrir otra cuenta sobre una mesa ocupada → **cuenta separada**
- `GET /accounts` — cuentas activas
- `GET /accounts/:id`
- `POST /accounts/:id/join-tables` — `{ tableIds[] }`
- `POST /accounts/:id/bill` — marcar "cobrando"
- `POST /accounts/:id/cancel` (admin)

### Comandas (tiempo real)
- `POST /orders` — el mesero envía `{ accountId, notes?, items:[{menuItemId, quantity, notes?}] }`
- `GET /orders/kitchen` — comandas activas (cocina/admin)
- `GET /orders?accountId=`
- `PATCH /orders/:id/status` — `{ status }` (`pending|in_preparation|ready|delivered|cancelled`)

### POS
- `POST /payments` — `{ accountId, amount, paymentMethod }`; al cubrir el total,
  cierra la cuenta y libera las mesas
- `GET /payments?accountId=`

### Caja
- `GET /cash-closings/summary` — totales desde el último cierre
- `POST /cash-closings` — `{ countedCash?, notes? }`
- `GET /cash-closings`

### Reportes (admin/cajero)
- `GET /reports/sales-summary?from=&to=`
- `GET /reports/top-items?from=&to=&limit=`
- `GET /reports/sales-by-day?from=&to=`

## WebSocket — canal mesero → cocina

Namespace **`/comandas`** (Socket.io). El cliente debe autenticarse con el JWT
en el handshake:

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:3002/comandas', {
  auth: { token: accessToken },
});
socket.on('comanda:nueva', (order) => { /* cocina recibe en vivo */ });
socket.on('comanda:actualizada', (order) => { /* cambio de estado */ });
```

Eventos emitidos por el servidor:

| Evento | Cuándo |
|--------|--------|
| `comanda:nueva` | El mesero envía una comanda (`POST /orders`) |
| `comanda:actualizada` | Cambia el estado de una comanda (`PATCH /orders/:id/status`) |

Los clientes con rol `kitchen` se unen a la sala `kitchen`; el resto del personal
a `staff`. Ambas salas reciben los eventos.

## Notas de arquitectura

- **MVC**: entidades TypeORM + servicios (Model), controllers/gateway (Controller),
  la plantilla FoodDesk consume vía REST + WebSocket (View).
- **Transacciones**: crear comanda y registrar pago se ejecutan en una sola
  transacción; el estado de cada mesa se recalcula dentro de la misma transacción.
- **Zona horaria**: los reportes usan límites de fecha amplios por defecto para
  evitar excluir cobros recientes (la máquina es UTC-6 y `pg` devuelve los
  `timestamp` sin zona como hora local).
- `synchronize` está **desactivado**: el esquema se gestiona por SQL
  (`db/schema.sql`) sobre la instancia compartida.
