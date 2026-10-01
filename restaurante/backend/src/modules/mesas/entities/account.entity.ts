import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RestaurantTable } from './table.entity';
import { User } from '../../usuarios/entities/user.entity';
import { numericTransformer } from '../../../common/transformers/numeric.transformer';

/**
 * Cuenta (comanda de cobro). Modela dos requisitos del salón:
 *  - Unión de mesas: una cuenta puede abarcar VARIAS mesas (relación N:M).
 *  - Cuentas separadas: una misma mesa puede tener VARIAS cuentas abiertas
 *    (ej. cliente A y cliente B ordenan por separado en la misma mesa).
 *
 * Estados:
 *  - open: recibiendo comandas
 *  - billing: marcada como "cobrando" antes de cerrar
 *  - paid: liquidada
 *  - cancelled: anulada
 */
@Entity({ schema: 'restaurante', name: 'accounts' })
export class Account {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 80 })
  label: string;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: string;

  @Column({ name: 'waiter_id', type: 'int', nullable: true })
  waiterId: number | null;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'waiter_id' })
  waiter: User | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  total: number;

  @ManyToMany(() => RestaurantTable, { eager: true })
  @JoinTable({
    name: 'account_tables',
    schema: 'restaurante',
    joinColumn: { name: 'account_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'table_id', referencedColumnName: 'id' },
  })
  tables: RestaurantTable[];

  @Column({ name: 'opened_at', type: 'timestamp', default: () => 'now()' })
  openedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt: Date | null;

  /**
   * Entrega (para llevar). Independiente del cobro: NULL = pendiente de entrega,
   * con fecha = entregada. Se combina libremente con el estado de pago.
   */
  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  /** Descuento aplicado (a criterio del mesero). Neto a pagar = total - discount. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  discount: number;

  @Column({ name: 'discount_reason', type: 'varchar', length: 255, nullable: true })
  discountReason: string | null;

  /** Sede/local al que pertenece la cuenta (infraestructura multi-local). */
  @Column({ name: 'venue_id', type: 'int', nullable: true })
  venueId: number | null;

  /** Envío a domicilio. */
  @Column({ name: 'is_delivery', type: 'boolean', default: false })
  isDelivery: boolean;

  /** Efectivo que sale de caja para el motorista (para cuadrar la caja). */
  @Column({
    name: 'courier_fee',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  courierFee: number;
}
