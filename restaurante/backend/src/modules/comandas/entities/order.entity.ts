import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Account } from '../../mesas/entities/account.entity';
import { User } from '../../usuarios/entities/user.entity';
import { OrderItem } from './order-item.entity';

/**
 * Comanda: lote de platillos que el mesero envía a cocina.
 * Estados: pending -> in_preparation -> ready -> delivered (o cancelled).
 */
@Entity({ schema: 'restaurante', name: 'orders' })
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id', type: 'int' })
  accountId: number;

  @ManyToOne(() => Account, { eager: true })
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ name: 'waiter_id', type: 'int' })
  waiterId: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'waiter_id' })
  waiter: User;

  @Column({ name: 'cook_id', type: 'int', nullable: true })
  cookId: number | null;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'cook_id' })
  cook: User | null;

  /**
   * Número de comanda que ve el personal. Al partir una comanda en cocina y
   * barra, ambas órdenes llevan el mismo número (el id de la primera). Null en
   * comandas viejas: se muestra el id.
   */
  @Column({ name: 'comanda_no', type: 'int', nullable: true })
  comandaNo: number | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: false })
  items: OrderItem[];
}
