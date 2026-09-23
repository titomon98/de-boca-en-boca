import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../pos/entities/payment.entity';
import { OrderItem } from '../comandas/entities/order-item.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { round2 } from '../../common/utils/money';

/**
 * Los reportes comparan por DÍA usando CAST(fecha AS DATE), tomando la fecha tal
 * como quedó guardada. Para que ese día coincida con el día de Guatemala tanto
 * en local como en el servidor (Render corre en UTC), el proceso debe arrancar
 * con TZ=America/Guatemala (ver main.ts / variables de entorno). Así se evita la
 * conversión implícita de objetos Date del driver de Postgres.
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(MenuItem)
    private readonly menuItemsRepository: Repository<MenuItem>,
  ) {}

  private range(from?: string, to?: string): { from: string; to: string } {
    return { from: from || '1970-01-01', to: to || '2999-12-31' };
  }

  /** Resumen de cobros en un rango, desglosado por método de pago. */
  async salesSummary(from?: string, to?: string) {
    const r = this.range(from, to);
    const payments = await this.paymentsRepository
      .createQueryBuilder('payment')
      .where('CAST(payment.date AS DATE) BETWEEN :from AND :to', r)
      .getMany();

    const byMethod: Record<string, { count: number; total: number }> = {};
    let total = 0;
    for (const payment of payments) {
      const method = payment.paymentMethod || 'otro';
      byMethod[method] = byMethod[method] || { count: 0, total: 0 };
      byMethod[method].count += 1;
      byMethod[method].total = round2(
        byMethod[method].total + Number(payment.amount),
      );
      total = round2(total + Number(payment.amount));
    }

    return {
      from: from ?? null,
      to: to ?? null,
      paymentsCount: payments.length,
      total: round2(total),
      byPaymentMethod: byMethod,
    };
  }

  /** Platillos más vendidos por cantidad e ingresos en un rango. */
  async topItems(from?: string, to?: string, limit = 10) {
    const r = this.range(from, to);
    const rows = await this.orderItemsRepository
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .innerJoin('item.menuItem', 'menuItem')
      .where('order.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere('CAST(order.created_at AS DATE) BETWEEN :from AND :to', r)
      .select('menuItem.id', 'menuItemId')
      .addSelect('menuItem.name', 'menuItemName')
      .addSelect('SUM(item.quantity)', 'quantity')
      .addSelect('SUM(item.subtotal)', 'revenue')
      .groupBy('menuItem.id')
      .addGroupBy('menuItem.name')
      .orderBy('quantity', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((r2) => ({
      menuItemId: Number(r2.menuItemId),
      menuItemName: r2.menuItemName,
      quantity: Number(r2.quantity),
      revenue: round2(Number(r2.revenue)),
    }));
  }

  /**
   * Estado del inventario (catálogo). El sistema no guarda cantidades en bodega,
   * así que "inventario" = estado del menú: disponible / agotado por platillo.
   * ponytail: sin cantidades de stock; si se necesita conteo real, agregar
   * columna stock a menu_items y descontarla al vender.
   */
  async inventory() {
    const items = await this.menuItemsRepository.find({
      relations: { category: true },
      order: { available: 'DESC', name: 'ASC' },
    });

    const rows = items.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category?.name ?? 'Sin categoría',
      type: i.type === 'drink' ? 'Bebida' : 'Platillo',
      price: round2(Number(i.price)),
      available: i.available,
    }));

    return {
      total: rows.length,
      available: rows.filter((r) => r.available).length,
      unavailable: rows.filter((r) => !r.available).length,
      items: rows,
    };
  }

  /** Cobros agrupados por día en un rango. */
  async salesByDay(from?: string, to?: string) {
    const r = this.range(from, to);
    const rows = await this.paymentsRepository
      .createQueryBuilder('payment')
      .where('CAST(payment.date AS DATE) BETWEEN :from AND :to', r)
      .select('CAST(payment.date AS DATE)', 'day')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(payment.amount)', 'total')
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany();

    return rows.map((row) => ({
      day:
        row.day instanceof Date
          ? row.day.toISOString().slice(0, 10)
          : String(row.day).slice(0, 10),
      count: Number(row.count),
      total: round2(Number(row.total)),
    }));
  }
}
