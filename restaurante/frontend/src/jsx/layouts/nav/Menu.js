import { ROLES } from '../../../services/helpers';

const A = ROLES.ADMIN;
const W = ROLES.WAITER;
const C = ROLES.CASHIER;
const K = ROLES.KITCHEN;

/**
 * Menú lateral del sistema de restaurante. Cada entrada declara `roles`:
 * los roles que pueden verla. El SideBar filtra según el rol del usuario.
 */
export const MenuList = [
    {
        title: 'Inicio',
        to: 'dashboard',
        iconStyle: 'bi bi-grid',
        roles: [A, C],
    },
    {
        title: 'Mesas',
        to: 'mesas',
        iconStyle: 'bi bi-grid-3x3-gap',
        roles: [A, W, C],
    },
    {
        title: 'Cocina',
        to: 'cocina',
        iconStyle: 'bi bi-egg-fried',
        roles: [A, K],
    },
    {
        title: 'Caja',
        to: 'caja',
        iconStyle: 'bi bi-cash-stack',
        roles: [A, C],
    },
    {
        title: 'Cierre de caja',
        to: 'cierre-caja',
        iconStyle: 'bi bi-lock',
        roles: [A, C],
    },
    {
        title: 'Reportes',
        to: 'reportes',
        iconStyle: 'bi bi-pie-chart',
        roles: [A, C],
    },
    {
        title: 'Administración',
        classsChange: 'menu-title',
        roles: [A],
    },
    {
        title: 'Menú',
        to: 'menu-admin',
        iconStyle: 'bi bi-journal-text',
        roles: [A],
    },
    {
        title: 'Usuarios',
        to: 'usuarios',
        iconStyle: 'bi bi-people',
        roles: [A],
    },
    {
        title: 'Configuración',
        to: 'configuracion',
        iconStyle: 'fa-solid fa-gear',
        roles: [A],
    },
];
