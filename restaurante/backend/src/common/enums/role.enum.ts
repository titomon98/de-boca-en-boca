/**
 * Roles del sistema. Coinciden con el CHECK de la tabla `restaurante.users`.
 * - administrator: acceso total
 * - waiter (mesero): mesas, cuentas y comandas
 * - cashier (cajero): punto de venta (POS) y cierre de caja
 * - kitchen (cocina): sólo comandas activas en tiempo real
 */
export enum Role {
  ADMINISTRATOR = 'administrator',
  WAITER = 'waiter',
  CASHIER = 'cashier',
  KITCHEN = 'kitchen',
}
