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

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
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

      const account = manager.create(Account, {
        label: dto.label,
        status: 'open',
        waiterId: dto.waiterId ?? user.id ?? null,
        total: 0,
        tables,
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
      account.tables = merged;
      await manager.save(account);

      for (const table of merged) {
        await recomputeTableStatus(manager, table.id);
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
