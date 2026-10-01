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

  /** Salón del croquis: 'pequeno' o 'grande' (null para la de para llevar). */
  @Column({ type: 'varchar', length: 20, nullable: true })
  salon: string | null;

  /** Nombre de mesas con nombre (ej. "Barra", "Pequeña"). Las numeradas usan su número. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  name: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
