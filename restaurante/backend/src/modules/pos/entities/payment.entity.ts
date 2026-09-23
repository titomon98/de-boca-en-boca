import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from '../../mesas/entities/account.entity';
import { User } from '../../usuarios/entities/user.entity';
import { numericTransformer } from '../../../common/transformers/numeric.transformer';

/** Pago aplicado a una cuenta. Una cuenta puede liquidarse en varios pagos. */
@Entity({ schema: 'restaurante', name: 'payments' })
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id', type: 'int' })
  accountId: number;

  @ManyToOne(() => Account, { eager: true })
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  amount: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 30 })
  paymentMethod: string;

  @CreateDateColumn({ name: 'date', type: 'timestamp' })
  date: Date;
}
