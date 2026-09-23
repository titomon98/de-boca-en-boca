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
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  difference: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;
}
