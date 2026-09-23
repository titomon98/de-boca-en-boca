import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';

/**
 * Restringe una ruta a uno o más roles.
 * Uso: @Roles(Role.ADMINISTRATOR, Role.WAITER)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
