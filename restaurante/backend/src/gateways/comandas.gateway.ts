import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../modules/auth/strategies/jwt.strategy';

/**
 * Canal en tiempo real mesero -> cocina.
 *
 * Nombres de evento (documentados y estables):
 *   - 'comanda:nueva'        el mesero envió una comanda nueva
 *   - 'comanda:actualizada'  cambió el estado de una comanda (cocina o mesero)
 *
 * Autenticación: el cliente debe enviar el JWT en el handshake
 *   io(url, { auth: { token } })  ó  ?token=... en el query.
 * Los clientes con rol 'kitchen' se unen a la sala 'kitchen'; el resto del
 * personal (mesero/administrador) se une a 'staff'. Las comandas se emiten a
 * ambas salas para que cocina reciba en vivo y el mesero vea confirmaciones.
 */
@WebSocketGateway({
  namespace: '/comandas',
  cors: { origin: true, credentials: true },
})
export class ComandasGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('ComandasGateway');

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.query?.token as string);

    if (!token) {
      this.logger.warn(`Conexión rechazada (sin token): ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      client.data.user = payload;
      const room = payload.role === 'kitchen' ? 'kitchen' : 'staff';
      client.join(room);
      this.logger.log(
        `Conectado ${payload.email} (${payload.role}) -> sala '${room}'`,
      );
    } catch {
      this.logger.warn(`Conexión rechazada (token inválido): ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data?.user as JwtPayload | undefined;
    if (user) {
      this.logger.log(`Desconectado ${user.email}`);
    }
  }

  /** Emite una comanda nueva a cocina y al personal de salón. */
  emitNewOrder(order: unknown) {
    this.server.to('kitchen').to('staff').emit('comanda:nueva', order);
  }

  /** Emite el cambio de estado de una comanda. */
  emitOrderUpdated(order: unknown) {
    this.server.to('kitchen').to('staff').emit('comanda:actualizada', order);
  }
}
