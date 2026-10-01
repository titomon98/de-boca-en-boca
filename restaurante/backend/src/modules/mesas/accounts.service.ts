import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { RestaurantTable } from './entities/table.entity';
import { Order } from '../comandas/entities/order.entity';
import { Payment } from '../pos/entities/payment.entity';
import { OpenAccountDto } from './dto/open-account.dto';
import { JoinTablesDto } from './dto/join-tables.dto';
import { recomputeTableStatus } from './table-status.util';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { lockAccount } from '../../common/lock-account';
import { round2 } from '../../common/utils/money';
import { VenuesService } from '../venues/venues.service';

/** Cada salón es independiente: no se pueden unir mesas de salones distintos. */
function assertSameSalon(tables: RestaurantTable[]): void {
  const salones = new Set(
    tables
      .filter((t) => !t.isTakeout && t.number !== 0)
      .map((t) => t.salon),
  );
  if (salones.size > 1) {
    throw new BadRequestException(
      'No se pueden unir mesas de salones distintos; cada salón es independiente',
    );
  }
}

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly venues: VenuesService,
  ) {}

  /**
   * Abre una cuenta sobre una o varias mesas.
   * - Varias mesas => se unen en una sola cuenta.
   * - Abrir otra cuenta sobre una mesa ya ocupada => cuenta separada.
   */
  async open(dto: OpenAccountDto, user: AuthUser): Promise<Account> {
    const id = await this.dataSource.transaction(async (manager) => {
      const tables = await manager.find(RestaurantTable, {
        where: { id: In(dto.tableIds) },
      });
      if (tables.length !== dto.tableIds.length) {
        throw new NotFoundException('Una o más mesas no existen');
      }
      assertSameSalon(tables);

      const account = manager.create(Account, {
        label: dto.label,
        status: 'open',
        waiterId: dto.waiterId ?? user.id ?? null,
        total: 0,
        tables,
        venueId: await this.venues.defaultVenueId(),
      });
      await manager.save(account);

      for (const table of tables) {
        await recomputeTableStatus(manager, table.id);
      }

      await this.audit.log(
        {
          action: 'cuenta_abierta',
          user,
          accountId: account.id,
          detail: `Mesa(s): ${tables.map((t) => t.number).join(', ')}`,
        },
        manager,
      );
      return account.id;
    });

    return this.findOne(id);
  }

  /**
   * Marca la cuenta como envío a domicilio y registra el efectivo que sale de
   * caja para el motorista (courierFee). Sirve para cuadrar la caja.
   */
  async setDelivery(
    accountId: number,
    isDelivery: boolean,
    courierFee: number,
    user: AuthUser,
  ): Promise<Account> {
    const account = await this.findOne(accountId);
    if (account.status === 'paid' || account.status === 'cancelled') {
      throw new BadRequestException('La cuenta ya está cerrada');
    }
    account.isDelivery = !!isDelivery;
    account.courierFee = isDelivery ? round2(Number(courierFee) || 0) : 0;
    await this.accountsRepository.save(account);
    await this.audit.log({
      action: 'envio_marcado',
      user,
      accountId,
      detail: isDelivery
        ? `Envío a domicilio · efectivo motorista Q${account.courierFee.toFixed(2)}`
        : 'Envío desmarcado',
    });
    return this.findOne(accountId);
  }

  /**
   * Marca la entrega de una orden (para llevar) como entregada o pendiente.
   * Independiente del cobro: se puede entregar sin cobrar y viceversa.
   */
  async setDelivered(
    accountId: number,
    delivered: boolean,
    user: AuthUser,
  ): Promise<Account> {
    const account = await this.findOne(accountId);
    account.deliveredAt = delivered ? new Date() : null;
    await this.accountsRepository.save(account);
    await this.audit.log({
      action: delivered ? 'orden_entregada' : 'orden_pendiente_entrega',
      user,
      accountId,
    });
    return this.findOne(accountId);
  }

  /** Bitácora de auditoría de la cuenta. */
  getLogs(accountId: number) {
    return this.audit.findByAccount(accountId);
  }

  /** Une mesas adicionales a una cuenta abierta. */
  async joinTables(accountId: number, dto: JoinTablesDto): Promise<Account> {
    await this.dataSource.transaction(async (manager) => {
      await lockAccount(manager, accountId);
      const account = await manager.findOne(Account, {
        where: { id: accountId },
        relations: { tables: true },
      });
      if (!account) {
        throw new NotFoundException('Cuenta no encontrada');
      }
      if (account.status !== 'open') {
        throw new BadRequestException(
          'Sólo se pueden unir mesas a una cuenta abierta',
        );
      }

      const newTables = await manager.find(RestaurantTable, {
        where: { id: In(dto.tableIds) },
      });
      if (newTables.length !== dto.tableIds.length) {
        throw new NotFoundException('Una o más mesas no existen');
      }

      const existingIds = new Set(account.tables.map((t) => t.id));
      const merged = [...account.tables];
      for (const table of newTables) {
        if (!existingIds.has(table.id)) {
          merged.push(table);
        }
      }
      assertSameSalon(merged);
      account.tables = merged;
      await manager.save(account);

      for (const table of merged) {
        await recomputeTableStatus(manager, table.id);
      }
    });

    return this.findOne(accountId);
  }

  /**
   * Aplica un descuento a la cuenta (a criterio del mesero). Requiere descripción
   * y queda en la bitácora. Reduce el neto a pagar (neto = total - discount).
   */
  async setDiscount(
    accountId: number,
    amount: number,
    reason: string,
    user: AuthUser,
  ): Promise<Account> {
    await this.dataSource.transaction(async (manager) => {
      await lockAccount(manager, accountId);
      const account = await manager.findOne(Account, {
        where: { id: accountId },
        relations: { tables: true },
      });
      if (!account) throw new NotFoundException('Cuenta no encontrada');
      if (account.status === 'paid' || account.status === 'cancelled') {
        throw new BadRequestException('La cuenta ya está cerrada');
      }
      const discount = round2(Number(amount));
      if (discount < 0) throw new BadRequestException('El descuento no puede ser negativo');
      if (discount > Number(account.total)) {
        throw new BadRequestException('El descuento no puede superar el total de la cuenta');
      }
      if (discount > 0 && !reason?.trim()) {
        throw new BadRequestException('El descuento requiere una descripción');
      }

      account.discount = discount;
      account.discountReason = discount > 0 ? reason.trim() : null;
      await manager.save(account);

      await this.audit.log(
        {
          action: 'descuento_aplicado',
          user,
          accountId: account.id,
          detail: discount > 0 ? `Q${discount.toFixed(2)} - ${reason.trim()}` : 'Descuento removido',
        },
        manager,
      );

      // Si el descuento cubre el saldo pendiente, cerrar la cuenta.
      const paidRow = await manager
        .getRepository(Payment)
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount),0)', 'paid')
        .where('p.accountId = :id', { id: account.id })
        .getRawOne<{ paid: string }>();
      const paid = round2(Number(paidRow?.paid || 0));
      const net = round2(
        Number(account.total) - discount + (account.isDelivery ? Number(account.courierFee || 0) : 0),
      );
      if (net <= paid + 0.001 && account.status !== 'paid') {
        account.status = 'paid';
        account.closedAt = new Date();
        await manager.save(account);
        for (const table of account.tables) {
          await recomputeTableStatus(manager, table.id);
        }
        await this.audit.log(
          { action: 'cuenta_pagada', user, accountId: account.id, detail: `Neto Q${net.toFixed(2)}` },
          manager,
        );
      }
    });
    return this.findOne(accountId);
  }

  /** Marca la cuenta como "cobrando" antes de cerrarla. */
  async markBilling(accountId: number, user: AuthUser): Promise<Account> {
    await this.dataSource.transaction(async (manager) => {
      await lockAccount(manager, accountId);
      const account = await manager.findOne(Account, {
        where: { id: accountId },
        relations: { tables: true },
      });
      if (!account) {
        throw new NotFoundException('Cuenta no encontrada');
      }
      if (account.status !== 'open') {
        throw new BadRequestException(
          'Sólo una cuenta abierta puede pasar a cobro',
        );
      }
      if (Number(account.total) <= 0) {
        throw new BadRequestException(
          'No hay nada que cobrar: la cuenta está en Q0',
        );
      }
      account.status = 'billing';
      await manager.save(account);

      for (const table of account.tables) {
        await recomputeTableStatus(manager, table.id);
      }

      await this.audit.log(
        { action: 'cuenta_en_cobro', user, accountId: account.id },
        manager,
      );
    });

    return this.findOne(accountId);
  }

  /** Anula una cuenta (no liquidada) y libera sus mesas. */
  async cancel(accountId: number, user: AuthUser): Promise<Account> {
    await this.dataSource.transaction(async (manager) => {
      await lockAccount(manager, accountId);
      const account = await manager.findOne(Account, {
        where: { id: accountId },
        relations: { tables: true },
      });
      if (!account) {
        throw new NotFoundException('Cuenta no encontrada');
      }
      if (account.status === 'paid') {
        throw new BadRequestException('No se puede anular una cuenta pagada');
      }
      account.status = 'cancelled';
      account.closedAt = new Date();
      await manager.save(account);

      for (const table of account.tables) {
        await recomputeTableStatus(manager, table.id);
      }

      await this.audit.log(
        { action: 'cuenta_anulada', user, accountId: account.id },
        manager,
      );
    });

    return this.findOne(accountId);
  }

  /**
   * Elimina una cuenta por completo (borrado permanente). Destructivo.
   * Sólo permite cuentas sin cobros. Borra sus comandas, quita la cuenta y libera mesas.
   * Restringido a administrador.
   */
  async remove(accountId: number, user: AuthUser): Promise<{ deleted: true; id: number }> {
    await this.dataSource.transaction(async (manager) => {
      await lockAccount(manager, accountId);
      const account = await manager.findOne(Account, {
        where: { id: accountId },
        relations: { tables: true },
      });
      if (!account) {
        throw new NotFoundException('Cuenta no encontrada');
      }

      if (account.status === 'paid') {
        throw new BadRequestException(
          'Una cuenta pagada no puede eliminarse; anule sus cobros primero',
        );
      }
      const paymentCount = await manager.count(Payment, { where: { accountId } });
      if (paymentCount > 0) {
        throw new BadRequestException(
          'La cuenta tiene cobros registrados; anúlelos antes de eliminarla',
        );
      }

      const tableIds = account.tables.map((t) => t.id);

      // Registrar en bitácora ANTES de borrar (los audit_logs de esta cuenta se
      // eliminan en cascada al borrar la cuenta, pero dejamos el detalle a nivel usuario).
      await this.audit.log(
        {
          action: 'cuenta_eliminada',
          user,
          detail: `Cuenta #${accountId} (${account.label}) eliminada permanentemente`,
        },
        manager,
      );

      // orders.account_id no tiene ON DELETE CASCADE; order_items sí cae en
      // cascada al borrar sus orders.
      await manager.delete(Order, { accountId });

      // account_tables y audit_logs (de la cuenta) caen en cascada al borrar la cuenta.
      await manager.delete(Account, { id: accountId });

      // Recalcular estado de las mesas que quedaron libres.
      for (const id of tableIds) {
        await recomputeTableStatus(manager, id);
      }
    });

    return { deleted: true, id: accountId };
  }

  /**
   * Órdenes "para llevar": las que están sobre la mesa is_takeout y aún no
   * concluyen. Una orden concluye sólo cuando está cobrada Y entregada, así que
   * sigue visible si le falta cualquiera de las dos (a diferencia de findOpen,
   * que oculta las pagadas). No incluye anuladas.
   */
  findTakeout(): Promise<Account[]> {
    return this.takeoutQuery(false).getMany();
  }

  /** Órdenes a domicilio (misma mesa virtual, marcadas como envío). */
  findDelivery(): Promise<Account[]> {
    return this.takeoutQuery(true).getMany();
  }

  /** Query base de órdenes sobre la mesa is_takeout, filtrando por envío (sí/no). */
  private takeoutQuery(delivery: boolean) {
    return this.accountsRepository
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.tables', 't')
      .where('t.isTakeout = true')
      .andWhere('a.isDelivery = :delivery', { delivery })
      .andWhere('a.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere(`NOT (a.status = 'paid' AND a.deliveredAt IS NOT NULL)`)
      .orderBy('a.openedAt', 'ASC');
  }

  /** Cuentas activas (abiertas o en cobro). */
  findOpen(): Promise<Account[]> {
    return this.accountsRepository.find({
      where: { status: In(['open', 'billing']) },
      order: { openedAt: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Account> {
    const account = await this.accountsRepository.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException('Cuenta no encontrada');
    }
    return account;
  }
}
