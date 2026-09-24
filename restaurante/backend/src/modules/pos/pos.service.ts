import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Account } from '../mesas/entities/account.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { recomputeTableStatus } from '../mesas/table-status.util';
import { round2 } from '../../common/utils/money';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { lockAccount } from '../../common/lock-account';

export interface PaymentResult {
  payment: Payment;
  accountTotal: number;
  paidTotal: number;
  remaining: number;
  accountStatus: string;
}

@Injectable()
export class PosService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /**
   * Registra un pago sobre una cuenta en una transacción:
   *  1. La cuenta debe estar abierta o en cobro.
   *  2. Inserta el pago.
   *  3. Si la suma de pagos cubre el total, marca la cuenta pagada, la cierra
   *     y libera sus mesas (recalcula el estado de cada una).
   */
  async pay(dto: CreatePaymentDto, user: AuthUser): Promise<PaymentResult> {
    const paymentId = await this.dataSource.transaction(async (manager) => {
      await lockAccount(manager, dto.accountId);
      const account = await manager.findOne(Account, {
        where: { id: dto.accountId },
        relations: { tables: true },
      });
      if (!account) {
        throw new NotFoundException('Cuenta no encontrada');
      }
      if (account.status === 'paid' || account.status === 'cancelled') {
        throw new BadRequestException('La cuenta ya está cerrada');
      }
      if (Number(account.total) <= 0) {
        throw new BadRequestException(
          'No hay nada que cobrar: la cuenta está en Q0',
        );
      }

      const amount = round2(dto.amount);
      const alreadyPaid = await this.sumPayments(manager, account.id);
      const remainingBeforePayment = round2(Number(account.total) - alreadyPaid);
      if (amount > remainingBeforePayment + 0.001) {
        throw new BadRequestException(
          `El pago excede el saldo pendiente de Q${Math.max(remainingBeforePayment, 0).toFixed(2)}`,
        );
      }
      const payment = manager.create(Payment, {
        accountId: account.id,
        userId: user.id,
        amount,
        paymentMethod: dto.paymentMethod,
      });
      await manager.save(payment);

      const method = dto.paymentMethod === 'cash' ? 'efectivo' : dto.paymentMethod === 'card' ? 'tarjeta' : dto.paymentMethod;
      await this.audit.log(
        {
          action: 'pago_registrado',
          user,
          accountId: account.id,
          detail: `Q${amount.toFixed(2)} (${method})`,
        },
        manager,
      );

      const paidTotal = await this.sumPayments(manager, account.id);
      if (paidTotal + 0.001 >= Number(account.total)) {
        account.status = 'paid';
        account.closedAt = new Date();
        await manager.save(account);
        for (const table of account.tables) {
          await recomputeTableStatus(manager, table.id);
        }
        await this.audit.log(
          {
            action: 'cuenta_pagada',
            user,
            accountId: account.id,
            detail: `Total Q${Number(account.total).toFixed(2)}`,
          },
          manager,
        );
      }

      return payment.id;
    });

    return this.buildResult(paymentId);
  }

  private async sumPayments(
    manager: EntityManager,
    accountId: number,
  ): Promise<number> {
    const row = await manager
      .getRepository(Payment)
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'paid')
      .where('payment.accountId = :accountId', { accountId })
      .getRawOne<{ paid: string }>();
    return round2(Number(row?.paid || 0));
  }

  private async buildResult(paymentId: number): Promise<PaymentResult> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }
    const account = payment.account;
    const paidTotal = await this.sumPayments(
      this.dataSource.manager,
      account.id,
    );
    const accountTotal = round2(Number(account.total));
    return {
      payment,
      accountTotal,
      paidTotal,
      remaining: round2(Math.max(accountTotal - paidTotal, 0)),
      accountStatus: account.status,
    };
  }

  /**
   * Anula (revierte) un cobro: elimina el pago y, si la cuenta había quedado
   * pagada, la reabre a estado "en cobro" y vuelve a ocupar sus mesas.
   * Queda registrado en la bitácora de auditoría.
   */
  async voidPayment(paymentId: number, user: AuthUser): Promise<{ ok: boolean }> {
    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        relations: { account: true },
      });
      if (!payment) throw new NotFoundException('Cobro no encontrado');

      await lockAccount(manager, payment.accountId);
      const account = await manager.findOne(Account, {
        where: { id: payment.accountId },
        relations: { tables: true },
      });

      const amount = round2(Number(payment.amount));
      const method =
        payment.paymentMethod === 'cash'
          ? 'efectivo'
          : payment.paymentMethod === 'card'
            ? 'tarjeta'
            : payment.paymentMethod;

      await manager.remove(payment);

      if (account) {
        const paidTotal = await this.sumPayments(manager, account.id);
        // Si la cuenta estaba pagada y ya no se cubre el total, reabrir a cobro.
        if (account.status === 'paid' && paidTotal + 0.001 < Number(account.total)) {
          account.status = 'billing';
          account.closedAt = null;
          await manager.save(account);
          for (const table of account.tables) {
            await recomputeTableStatus(manager, table.id);
          }
        }
        await this.audit.log(
          {
            action: 'cobro_anulado',
            user,
            accountId: account.id,
            detail: `Q${amount.toFixed(2)} (${method})`,
          },
          manager,
        );
      }
    });
    return { ok: true };
  }

  findByAccount(accountId: number): Promise<Payment[]> {
    return this.paymentsRepository.find({
      where: { accountId },
      order: { date: 'ASC' },
    });
  }
}
