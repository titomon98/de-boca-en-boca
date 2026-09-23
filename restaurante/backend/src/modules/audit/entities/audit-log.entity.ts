import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Bitácora de auditoría. Registra acciones sobre cuentas y comandas junto al
 * usuario que las realizó (nombre y rol denormalizados para legibilidad).
 */
@Entity({ schema: 'restaurante', name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id', type: 'int', nullable: true })
  accountId: number | null;

  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @Column({ name: 'user_name', type: 'varchar', length: 150, nullable: true })
  userName: string | null;

  @Column({ name: 'user_role', type: 'varchar', length: 30, nullable: true })
  userRole: string | null;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  detail: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
