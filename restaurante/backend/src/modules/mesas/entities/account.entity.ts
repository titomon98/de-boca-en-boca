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
}
