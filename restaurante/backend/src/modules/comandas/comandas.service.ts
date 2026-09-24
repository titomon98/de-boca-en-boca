import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Account } from '../mesas/entities/account.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { ComandasGateway } from '../../gateways/comandas.gateway';
import { round2 } from '../../common/utils/money';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { lockAccount } from '../../common/lock-account';

/** Etiqueta de acción de auditoría por estado de comanda. */
const STATUS_ACTION: Record<string, string> = {
  in_preparation: 'comanda_en_preparacion',
  ready: 'comanda_lista',
  delivered: 'comanda_entregada',
  cancelled: 'comanda_cancelada',
  pending: 'comanda_reabierta',
};

/** Estados que cocina considera "activos". */
const ACTIVE_STATUSES = ['pending', 'in_preparation', 'ready'];

@Injectable()
export class ComandasService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly gateway: ComandasGateway,
    private readonly audit: AuditService,
  ) {}

  /**
   * Crea una comanda para una cuenta abierta, en una sola transacción:
   *  1. Valida que la cuenta esté abierta.
   *  2. Toma el precio de cada platillo desde el menú (no del cliente).
   *  3. Crea la comanda y sus renglones, y suma el total a la cuenta.
   * Al confirmar, emite 'comanda:nueva' por WebSocket hacia cocina.
   */
  async create(dto: CreateOrderDto, user: AuthUser): Promise<Order> {
    const orderId = await this.dataSource.transaction(async (manager) => {
      await lockAccount(manager, dto.accountId);
      const account = await manager.findOne(Account, {
        where: { id: dto.accountId },
      });
      if (!account) {
        throw new NotFoundException('Cuenta no encontrada');
      }
      if (account.status !== 'open') {
        throw new BadRequestException(
          'Sólo se pueden agregar comandas a una cuenta abierta',
        );
      }

      const menuItemIds = dto.items.map((i) => i.menuItemId);
      const menuItems = await manager.find(MenuItem, {
        where: { id: In(menuItemIds) },
      });
      const menuById = new Map(menuItems.map((m) => [m.id, m]));

      // Nombres de los productos que aparecen como componentes: los fijos del
      // combo y los elegidos en grupos de elección (aderezos), para desglosarlos
      // en analítica.
      const componentIds = [
        ...menuItems.flatMap((m) => m.combo?.components ?? []).map((c) => c.itemId),
        ...dto.items.flatMap((i) => i.chosenItemIds ?? []),
      ];
      const componentById = new Map<number, MenuItem>();
      if (componentIds.length) {
        const comps = await manager.find(MenuItem, {
          where: { id: In(componentIds) },
        });
        comps.forEach((c) => componentById.set(c.id, c));
      }

      const order = manager.create(Order, {
        accountId: account.id,
        waiterId: user.id,
        // Las comandas nacen directamente en preparación (ya no hay "pendiente").
        status: 'in_preparation',
        notes: dto.notes ?? null,
      });
      await manager.save(order);

      let orderTotal = 0;
      for (const line of dto.items) {
        const menuItem = menuById.get(line.menuItemId);
        if (!menuItem) {
          throw new NotFoundException(
            `Platillo ${line.menuItemId} no encontrado`,
          );
        }
        if (!menuItem.available) {
          throw new BadRequestException(
            `El platillo "${menuItem.name}" no está disponible`,
          );
        }

        const unitPrice = round2(Number(menuItem.price));
        const subtotal = round2(unitPrice * line.quantity);
        orderTotal += subtotal;

        // Componentes del renglón (a Q0, para analítica): los fijos del combo
        // más los elegidos en grupos de elección (aderezos). Todo x cantidad.
        const nameOf = (id: number) => componentById.get(id)?.name ?? `#${id}`;
        const components: { itemId: number; name: string; quantity: number }[] = [];

        for (const c of menuItem.combo?.components ?? []) {
          components.push({
            itemId: c.itemId,
            name: nameOf(c.itemId),
            quantity: c.quantity * line.quantity,
          });
        }

        // Validar los elegidos contra los grupos de elección del platillo.
        const chosen = line.chosenItemIds ?? [];
        const groups = menuItem.choiceGroups ?? [];
        if (groups.length > 0) {
          const remaining = [...chosen];
          for (const g of groups) {
            const picked = remaining.filter((id) => g.optionItemIds.includes(id));
            if (picked.length !== g.choose) {
              throw new BadRequestException(
                `"${menuItem.name}": debe elegir ${g.choose} de "${g.label}"`,
              );
            }
            // quitar los usados por este grupo
            for (const id of picked) remaining.splice(remaining.indexOf(id), 1);
          }
          if (remaining.length > 0) {
            throw new BadRequestException(
              `"${menuItem.name}": opción elegida no válida`,
            );
          }
        }
        // Agregar los elegidos como componentes (agrupando repetidos), x cantidad.
        const chosenCounts = new Map<number, number>();
        for (const id of chosen) chosenCounts.set(id, (chosenCounts.get(id) ?? 0) + 1);
        for (const [id, count] of chosenCounts) {
          components.push({ itemId: id, name: nameOf(id), quantity: count * line.quantity });
        }

        const item = manager.create(OrderItem, {
          orderId: order.id,
          menuItemId: menuItem.id,
          quantity: line.quantity,
          unitPrice,
          subtotal,
          notes: line.notes ?? null,
          components: components.length ? components : null,
        });
        await manager.save(item);
      }

      account.total = round2(Number(account.total) + orderTotal);
      await manager.save(account);

      await this.audit.log(
        {
          action: 'comanda_creada',
          user,
          accountId: account.id,
          orderId: order.id,
          detail: `${dto.items.length} platillo(s) enviados a cocina`,
        },
        manager,
      );

      return order.id;
    });

    const order = await this.findOne(orderId);
    this.gateway.emitNewOrder(order);
    return order;
  }

  /** Cambia el estado de una comanda, registra al responsable y notifica por WS. */
  async updateStatus(
    id: number,
    dto: UpdateOrderStatusDto,
    user: AuthUser,
  ): Promise<Order> {
    const order = await this.findOne(id);
    order.status = dto.status;
    // Registrar al cocinero que atiende la comanda la primera vez que la
    // toma (a preparación o lista).
    if (
      (dto.status === 'in_preparation' || dto.status === 'ready') &&
      !order.cookId
    ) {
      order.cookId = user.id;
    }
    await this.ordersRepository.save(order);

    await this.audit.log({
      action: STATUS_ACTION[dto.status] || 'comanda_actualizada',
      user,
      accountId: order.accountId,
      orderId: order.id,
    });

    const updated = await this.findOne(id);
    this.gateway.emitOrderUpdated(updated);
    return updated;
  }

  /**
   * Anula una comanda completa: descuenta su importe de la cuenta y la marca
   * como cancelada. Registra en auditoría.
   */
  async cancelOrder(id: number, user: AuthUser): Promise<Order> {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id },
        relations: { items: true },
      });
      if (!order) throw new NotFoundException('Comanda no encontrada');
      if (order.status === 'cancelled') {
        throw new BadRequestException('La comanda ya está anulada');
      }

      const orderTotal = (order.items || []).reduce(
        (s, it) => s + Number(it.subtotal),
        0,
      );

      await lockAccount(manager, order.accountId);
      const account = await manager.findOne(Account, {
        where: { id: order.accountId },
      });
      if (account && account.status !== 'paid' && account.status !== 'cancelled') {
        account.total = round2(Math.max(Number(account.total) - orderTotal, 0));
        await manager.save(account);
      }

      order.status = 'cancelled';
      await manager.save(order);

      await this.audit.log(
        {
          action: 'comanda_cancelada',
          user,
          accountId: order.accountId,
          orderId: order.id,
          detail: `Comanda anulada (-Q${round2(orderTotal).toFixed(2)})`,
        },
        manager,
      );
    });

    const updated = await this.findOne(id);
    this.gateway.emitOrderUpdated(updated);
    return updated;
  }

  /**
   * Anula un solo platillo (renglón) de una comanda: lo elimina y descuenta su
   * importe de la cuenta. Si la comanda queda vacía, se anula por completo.
   */
  async cancelItem(
    orderId: number,
    itemId: number,
    user: AuthUser,
  ): Promise<Order> {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        relations: { items: true },
      });
      if (!order) throw new NotFoundException('Comanda no encontrada');
      const item = (order.items || []).find((i) => i.id === itemId);
      if (!item) throw new NotFoundException('Platillo no encontrado en la comanda');

      await lockAccount(manager, order.accountId);
      const account = await manager.findOne(Account, {
        where: { id: order.accountId },
      });
      if (account && account.status !== 'paid' && account.status !== 'cancelled') {
        account.total = round2(
          Math.max(Number(account.total) - Number(item.subtotal), 0),
        );
        await manager.save(account);
      }

      const itemName = item.menuItem?.name || `#${item.menuItemId}`;
      await manager.remove(item);

      const remaining = (order.items || []).filter((i) => i.id !== itemId);
      if (remaining.length === 0) {
        order.status = 'cancelled';
        await manager.save(order);
      }

      await this.audit.log(
        {
          action: 'plato_anulado',
          user,
          accountId: order.accountId,
          orderId: order.id,
          detail: `${itemName} x${item.quantity} (-Q${round2(Number(item.subtotal)).toFixed(2)})`,
        },
        manager,
      );
    });

    const updated = await this.findOne(orderId);
    this.gateway.emitOrderUpdated(updated);
    return updated;
  }

  /** Vista de cocina: comandas activas, más antiguas primero. */
  findActive(): Promise<Order[]> {
    return this.ordersRepository.find({
      where: { status: In(ACTIVE_STATUSES) },
      relations: { items: true },
      order: { createdAt: 'ASC' },
    });
  }

  findByAccount(accountId: number): Promise<Order[]> {
    return this.ordersRepository.find({
      where: { accountId },
      relations: { items: true },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Comanda no encontrada');
    }
    return order;
  }
}
