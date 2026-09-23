/** Roles del sistema (coinciden con el backend). */
export const ROLES = {
  ADMIN: 'administrator',
  WAITER: 'waiter',
  CASHIER: 'cashier',
  KITCHEN: 'kitchen',
};

/** Etiquetas en español de los roles. */
export const ROLE_LABELS = {
  administrator: 'Administrador',
  waiter: 'Mesero',
  cashier: 'Cajero',
  kitchen: 'Cocina',
};

/** Devuelve los datos del usuario autenticado desde localStorage. */
export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('userDetails')) || {};
  } catch (e) {
    return {};
  }
}

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de Guatemala. */
export function todayGuatemala() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
  }).format(new Date());
}

/** Formatea un monto como Quetzales (Q). */
export function money(value) {
  const n = Number(value || 0);
  return `Q${n.toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Ruta de inicio según el rol. */
export function homeForRole(role) {
  switch (role) {
    case ROLES.KITCHEN:
      return '/cocina';
    case ROLES.CASHIER:
      return '/caja';
    case ROLES.WAITER:
      return '/mesas';
    default:
      return '/dashboard';
  }
}

/** Metadatos de estado de mesa (color de badge y etiqueta). */
export const TABLE_STATUS = {
  free: { label: 'Libre', badge: 'badge-success', color: 'success' },
  occupied: { label: 'Ocupada', badge: 'badge-warning', color: 'warning' },
  billing: { label: 'Cobrando', badge: 'badge-danger', color: 'danger' },
};

/** Etiquetas legibles de las acciones de la bitácora de auditoría. */
export const AUDIT_ACTIONS = {
  cuenta_abierta: 'Cuenta abierta',
  comanda_creada: 'Comanda enviada a cocina',
  comanda_en_preparacion: 'Comanda en preparación',
  comanda_lista: 'Comanda lista',
  comanda_entregada: 'Comanda entregada',
  comanda_cancelada: 'Comanda cancelada',
  comanda_reabierta: 'Comanda reabierta',
  cuenta_en_cobro: 'Cuenta en cobro',
  pago_registrado: 'Pago registrado',
  cuenta_pagada: 'Cuenta pagada',
  cuenta_anulada: 'Cuenta anulada',
};

/** Metadatos de estado de comanda. */
export const ORDER_STATUS = {
  pending: { label: 'Pendiente', badge: 'badge-danger' },
  in_preparation: { label: 'En preparación', badge: 'badge-warning' },
  ready: { label: 'Lista', badge: 'badge-info' },
  delivered: { label: 'Entregada', badge: 'badge-success' },
  cancelled: { label: 'Cancelada', badge: 'badge-dark' },
};
