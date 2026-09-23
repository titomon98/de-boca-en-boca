import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Mesa física del salón. `status` refleja el mapa visual:
 *  - free: sin cuentas abiertas
 *  - occupied: con al menos una cuenta abierta
 *  - billing: alguna de sus cuentas está en proceso de cobro
 * Se recalcula a partir de las cuentas (ver table-status.util.ts).
 */
@Entity({ schema: 'restaurante', name: 'tables' })
export class RestaurantTable {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  number: number;

  @Column({ type: 'int', default: 4 })
  capacity: number;

  @Column({ type: 'varchar', length: 20, default: 'free' })
  status: string;

  /** Mesa virtual "Para llevar": admite varias órdenes y nunca se ocupa. */
  @Column({ name: 'is_takeout', type: 'boolean', default: false })
  isTakeout: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
