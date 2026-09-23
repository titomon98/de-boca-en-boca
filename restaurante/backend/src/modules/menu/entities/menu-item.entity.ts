import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MenuCategory } from './menu-category.entity';
import { numericTransformer } from '../../../common/transformers/numeric.transformer';

@Entity({ schema: 'restaurante', name: 'menu_items' })
export class MenuItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'category_id', type: 'int', nullable: true })
  categoryId: number | null;

  @ManyToOne(() => MenuCategory, { nullable: true, eager: true })
  @JoinColumn({ name: 'category_id' })
  category: MenuCategory | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  price: number;

  /** 'food' | 'drink' */
  @Column({ type: 'varchar', length: 20, default: 'food' })
  type: string;

  @Column({ type: 'boolean', default: true })
  available: boolean;

  /**
   * Foto del platillo en base64 (data URL). `select: false` para no cargarla en
   * consultas pesadas (comandas/cocina); el menú la incluye con addSelect.
   */
  @Column({ type: 'text', nullable: true, select: false })
  image: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
