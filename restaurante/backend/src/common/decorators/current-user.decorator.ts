import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  name: string;
}

/**
 * Inyecta el usuario autenticado (payload del JWT ya validado) en el handler.
 * Uso: metodo(@CurrentUser() user: AuthUser)
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthUser = request.user;
    return data ? user?.[data] : user;
  },
);
