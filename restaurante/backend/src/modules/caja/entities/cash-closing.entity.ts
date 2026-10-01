import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../usuarios/entities/user.entity';
import { numericTransformer } from '../../../common/transformers/numeric.transformer';

@Entity({ schema: 'restaurante', name: 'cash_closings' })
export class CashClosing {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'date', type: 'timestamp' })
  date: Date;

  @Column({
    name: 'total_sales',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  totalSales: number;

  @Column({
    name: 'total_cash',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  totalCash: number;

  @Column({
    name: 'total_card',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  totalCard: number;

  @Column({
    name: 'total_transfer',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalTransfer: number;

  @Column({
    name: 'total_tips',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalTips: number;

  @Column({
    name: 'courier_cash',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  courierCash: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  difference: number;

  @Column({ name: 'counted_cash', type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numericTransformer })
  countedCash: number | null;

  @Column({ name: 'counted_card', type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numericTransformer })
  countedCard: number | null;

  @Column({ name: 'counted_transfer', type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numericTransformer })
  countedTransfer: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;
}
