import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { CashClosing } from './entities/cash-closing.entity';
import { Payment } from '../pos/entities/payment.entity';
import { CreateCashClosingDto } from './dto/create-cash-closing.dto';
import { UpdateCashClosingDto } from './dto/update-cash-closing.dto';
import { round2 } from '../../common/utils/money';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

/** Métodos de pago que se contabilizan como efectivo / tarjeta / transferencia. */
const CASH_METHODS = ['cash', 'efectivo'];
const CARD_METHODS = ['card', 'tarjeta'];
const TRANSFER_METHODS = ['transfer', 'transferencia'];

export interface CashSummary {
  since: Date | null;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  totalOther: number;
  totalTips: number;
  courierCash: number;
  expectedCash: number;
  paymentsCount: number;
}

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(CashClosing)
    private readonly closingsRepository: Repository<CashClosing>,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    private readonly audit: AuditService,
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

    // Ventas por método (sin propina) y propina por método. La propina se
    // reporta aparte de las ventas, pero es dinero real que entró por el mismo
    // método, así que el "esperado" físico de cada método la incluye.
    let salesCash = 0;
    let salesCard = 0;
    let salesTransfer = 0;
    let salesOther = 0;
    let tipCash = 0;
    let tipCard = 0;
    let tipTransfer = 0;
    let tipOther = 0;

    for (const payment of payments) {
      const method = (payment.paymentMethod || '').toLowerCase();
      const amount = Number(payment.amount);
      const tip = Number(payment.tip || 0);
      if (CASH_METHODS.includes(method)) { salesCash += amount; tipCash += tip; }
      else if (CARD_METHODS.includes(method)) { salesCard += amount; tipCard += tip; }
      else if (TRANSFER_METHODS.includes(method)) { salesTransfer += amount; tipTransfer += tip; }
      else { salesOther += amount; tipOther += tip; }
    }

    // Esperado por método = ventas + propina de ese método.
    const totalCash = salesCash + tipCash;
    const totalCard = salesCard + tipCard;
    const totalTransfer = salesTransfer + tipTransfer;
    const totalOther = salesOther + tipOther;
    const totalTips = tipCash + tipCard + tipTransfer + tipOther;
    const totalSales = salesCash + salesCard + salesTransfer + salesOther;

    // Efectivo entregado a motoristas (sale de caja) en envíos ENTREGADOS del
    // período: el efectivo sale al entregar la orden, no al cobrarla.
    const accountsRepo = this.paymentsRepository.manager.getRepository('Account');
    const courierQb = accountsRepo
      .createQueryBuilder('a')
      .select('COALESCE(SUM(a.courier_fee), 0)', 'sum')
      .where('a.is_delivery = true')
      .andWhere('a.delivered_at IS NOT NULL');
    if (since) courierQb.andWhere('a.delivered_at > :since', { since });
    const courierRow = await courierQb.getRawOne<{ sum: string }>();
    const courierCash = round2(Number(courierRow?.sum || 0));

    return {
      since,
      totalSales: round2(totalSales),
      totalCash: round2(totalCash),
      totalCard: round2(totalCard),
      totalTransfer: round2(totalTransfer),
      totalOther: round2(totalOther),
      totalTips: round2(totalTips),
      courierCash,
      // Efectivo que debería haber en caja = efectivo cobrado - salidas a motoristas.
      expectedCash: round2(totalCash - courierCash),
      paymentsCount: payments.length,
    };
  }

  /** Registra un cierre de caja con los totales calculados. */
  async create(
    dto: CreateCashClosingDto,
    userId: number,
  ): Promise<CashClosing> {
    const summary = await this.currentSummary();

    // La diferencia se mide contra el efectivo ESPERADO (cobrado - motoristas).
    const difference =
      dto.countedCash != null
        ? round2(dto.countedCash - summary.expectedCash)
        : 0;

    const closing = this.closingsRepository.create({
      userId,
      totalSales: summary.totalSales,
      totalCash: summary.totalCash,
      totalCard: summary.totalCard,
      totalTransfer: summary.totalTransfer,
      totalTips: summary.totalTips,
      courierCash: summary.courierCash,
      difference,
      countedCash: dto.countedCash ?? null,
      countedCard: dto.countedCard ?? null,
      countedTransfer: dto.countedTransfer ?? null,
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

  /**
   * Edita un cierre (solo el conteo y la nota) y recalcula la diferencia contra
   * el efectivo esperado. Queda registrado en la bitácora quién y qué cambió.
   */
  async update(
    id: number,
    dto: UpdateCashClosingDto,
    user: AuthUser,
  ): Promise<CashClosing> {
    const closing = await this.closingsRepository.findOne({ where: { id } });
    if (!closing) throw new NotFoundException('Cierre no encontrado');

    const before = {
      countedCash: closing.countedCash,
      countedCard: closing.countedCard,
      countedTransfer: closing.countedTransfer,
      notes: closing.notes,
    };

    if (dto.countedCash !== undefined) closing.countedCash = round2(dto.countedCash);
    if (dto.countedCard !== undefined) closing.countedCard = round2(dto.countedCard);
    if (dto.countedTransfer !== undefined) closing.countedTransfer = round2(dto.countedTransfer);
    if (dto.notes !== undefined) closing.notes = dto.notes || null;

    // Diferencia vs. efectivo esperado (cobrado en efectivo - salidas a motoristas).
    const expectedCash = round2(Number(closing.totalCash) - Number(closing.courierCash || 0));
    closing.difference =
      closing.countedCash != null ? round2(Number(closing.countedCash) - expectedCash) : 0;

    const saved = await this.closingsRepository.save(closing);

    await this.audit.log({
      action: 'cierre_editado',
      user,
      detail:
        `Cierre #${id}. Contado efectivo ${before.countedCash ?? '-'} -> ${saved.countedCash ?? '-'}, ` +
        `tarjeta ${before.countedCard ?? '-'} -> ${saved.countedCard ?? '-'}, ` +
        `transfer ${before.countedTransfer ?? '-'} -> ${saved.countedTransfer ?? '-'}`,
    });

    return saved;
  }
}
