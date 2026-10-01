import api from './api';

/** Cliente de la API del restaurante. Cada método devuelve la data ya extraída. */
const unwrap = (p) => p.then((r) => r.data);

// --- Menú ---
export const MenuApi = {
  list: (onlyAvailable = false) =>
    unwrap(api.get('/menu/items', { params: onlyAvailable ? { available: true } : {} })),
  create: (dto) => unwrap(api.post('/menu/items', dto)),
  update: (id, dto) => unwrap(api.put(`/menu/items/${id}`, dto)),
  remove: (id) => unwrap(api.delete(`/menu/items/${id}`)),
  categories: () => unwrap(api.get('/menu/categories')),
  createCategory: (dto) => unwrap(api.post('/menu/categories', dto)),
  updateCategory: (id, dto) => unwrap(api.put(`/menu/categories/${id}`, dto)),
  removeCategory: (id) => unwrap(api.delete(`/menu/categories/${id}`)),
};

// --- Mesas ---
export const TablesApi = {
  list: () => unwrap(api.get('/tables')),
  create: (dto) => unwrap(api.post('/tables', dto)),
};

// --- Cuentas ---
export const AccountsApi = {
  open: (dto) => unwrap(api.post('/accounts', dto)),
  listOpen: () => unwrap(api.get('/accounts')),
  listTakeout: () => unwrap(api.get('/accounts/takeout')),
  listDelivery: () => unwrap(api.get('/accounts/delivery')),
  get: (id) => unwrap(api.get(`/accounts/${id}`)),
  joinTables: (id, tableIds) => unwrap(api.post(`/accounts/${id}/join-tables`, { tableIds })),
  bill: (id) => unwrap(api.post(`/accounts/${id}/bill`)),
  setDelivered: (id, delivered) => unwrap(api.post(`/accounts/${id}/delivered`, { delivered })),
  setDiscount: (id, amount, reason) => unwrap(api.post(`/accounts/${id}/discount`, { amount, reason })),
  setDelivery: (id, isDelivery, courierFee) => unwrap(api.post(`/accounts/${id}/delivery`, { isDelivery, courierFee })),
  cancel: (id) => unwrap(api.post(`/accounts/${id}/cancel`)),
  remove: (id) => unwrap(api.delete(`/accounts/${id}`)),
  logs: (id) => unwrap(api.get(`/accounts/${id}/logs`)),
};

// --- Comandas ---
export const OrdersApi = {
  create: (dto) => unwrap(api.post('/orders', dto)),
  kitchen: () => unwrap(api.get('/orders/kitchen')),
  byAccount: (accountId) => unwrap(api.get('/orders', { params: { accountId } })),
  updateStatus: (id, status) => unwrap(api.patch(`/orders/${id}/status`, { status })),
  cancel: (id) => unwrap(api.post(`/orders/${id}/cancel`)),
  cancelItem: (orderId, itemId) => unwrap(api.delete(`/orders/${orderId}/items/${itemId}`)),
};

// --- POS / Pagos ---
export const PaymentsApi = {
  pay: (dto) => unwrap(api.post('/payments', dto)),
  payItems: (accountId, itemIds, paymentMethod) =>
    unwrap(api.post('/payments/items', { accountId, itemIds, paymentMethod })),
  byAccount: (accountId) => unwrap(api.get('/payments', { params: { accountId } })),
  void: (id) => unwrap(api.post(`/payments/${id}/void`)),
};

// --- Caja ---
export const CashApi = {
  summary: () => unwrap(api.get('/cash-closings/summary')),
  create: (dto) => unwrap(api.post('/cash-closings', dto)),
  list: () => unwrap(api.get('/cash-closings')),
};

// --- Reportes ---
export const ReportsApi = {
  salesSummary: (from, to) => unwrap(api.get('/reports/sales-summary', { params: { from, to } })),
  topItems: (from, to, limit, categoryId, combo) =>
    unwrap(api.get('/reports/top-items', { params: { from, to, limit, categoryId, combo } })),
  salesByDay: (from, to) => unwrap(api.get('/reports/sales-by-day', { params: { from, to } })),
  inventory: () => unwrap(api.get('/reports/inventory')),
};

// --- Configuración ---
export const SettingsApi = {
  get: () => unwrap(api.get('/settings')),
  update: (values) => unwrap(api.put('/settings', values)),
};

// --- Usuarios ---
export const UsersApi = {
  list: () => unwrap(api.get('/users')),
  create: (dto) => unwrap(api.post('/users', dto)),
  update: (id, dto) => unwrap(api.put(`/users/${id}`, dto)),
  remove: (id) => unwrap(api.delete(`/users/${id}`)),
};
