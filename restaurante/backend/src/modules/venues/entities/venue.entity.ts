import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Sede/local. Infraestructura para operar más de un local (ej. un foodtruck
 * además del restaurante). Por ahora sólo existe la sede "Restaurante".
 */
@Entity({ schema: 'restaurante', name: 'venues' })
export class Venue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** 'restaurant' | 'foodtruck' */
  @Column({ type: 'varchar', length: 20, default: 'restaurant' })
  type: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
