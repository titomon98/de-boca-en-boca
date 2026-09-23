import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { CashClosing } from './entities/cash-closing.entity';
import { Payment } from '../pos/entities/payment.entity';
import { CreateCashClosingDto } from './dto/create-cash-closing.dto';
import { round2 } from '../../common/utils/money';

/** Métodos de pago que se contabilizan como efectivo / tarjeta. */
const CASH_METHODS = ['cash', 'efectivo'];
const CARD_METHODS = ['card', 'tarjeta'];

export interface CashSummary {
  since: Date | null;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalOther: number;
  paymentsCount: number;
}

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(CashClosing)
    private readonly closingsRepository: Repository<CashClosing>,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
  ) {}

  /** Fecha del último cierre (o null si no hay ninguno). */
  private async lastClosingDate(): Promise<Date | null> {
    const last = await this.closingsRepository.findOne({
      where: {},
      order: { date: 'DESC' },
    });
    return last ? last.date : null;
  }

  /** Resumen de pagos desde el último cierre, desglosado por método. */
  async currentSummary(): Promise<CashSummary> {
    const since = await this.lastClosingDate();
    const payments = await this.paymentsRepository.find({
      where: since ? { date: MoreThan(since) } : {},
    });

    let totalCash = 0;
    let totalCard = 0;
    let totalOther = 0;

    for (const payment of payments) {
      const method = (payment.paymentMethod || '').toLowerCase();
      const amount = Number(payment.amount);
      if (CASH_METHODS.includes(method)) totalCash += amount;
      else if (CARD_METHODS.includes(method)) totalCard += amount;
      else totalOther += amount;
    }

    return {
      since,
      totalSales: round2(totalCash + totalCard + totalOther),
      totalCash: round2(totalCash),
      totalCard: round2(totalCard),
      totalOther: round2(totalOther),
      paymentsCount: payments.length,
    };
  }

  /** Registra un cierre de caja con los totales calculados. */
  async create(
    dto: CreateCashClosingDto,
    userId: number,
  ): Promise<CashClosing> {
    const summary = await this.currentSummary();

    const difference =
      dto.countedCash != null
        ? round2(dto.countedCash - summary.totalCash)
        : 0;

    const closing = this.closingsRepository.create({
      userId,
      totalSales: summary.totalSales,
      totalCash: summary.totalCash,
      totalCard: summary.totalCard,
      difference,
      notes: dto.notes ?? null,
    });
    return this.closingsRepository.save(closing);
  }

  findAll(): Promise<CashClosing[]> {
    return this.closingsRepository.find({
      order: { date: 'DESC' },
      take: 100,
    });
  }
}
