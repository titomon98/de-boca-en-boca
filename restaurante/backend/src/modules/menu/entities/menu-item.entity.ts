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
   * Extras que el platillo YA incluye (no se cobran). Si un incluido trae
   * `options`, al agregar el platillo se pregunta cuál (ej. sabor del aderezo).
   */
  @Column({ type: 'jsonb', nullable: true })
  includes: { label: string; options?: string[]; choose?: number }[] | null;

  /**
   * Si no es null, el platillo es un COMBO: sus componentes se ligan a productos
   * reales del menú y el precio del platillo es el precio de paquete. Los
   * condimentos a elegir (aderezos) siguen en `includes`.
   */
  @Column({ type: 'jsonb', nullable: true })
  combo: { components: { itemId: number; quantity: number }[] } | null;

  /**
   * Grupos de elección ligados a productos reales (ej. "elige 2 aderezos").
   * Los elegidos se agregan como componentes a Q0 y se cuentan en analítica.
   */
  @Column({ name: 'choice_groups', type: 'jsonb', nullable: true })
  choiceGroups:
    | { label: string; choose: number; optionItemIds: number[] }[]
    | null;

  /**
   * Foto del platillo en base64 (data URL). `select: false` para no cargarla en
   * consultas pesadas (comandas/cocina); el menú la incluye con addSelect.
   */
  @Column({ type: 'text', nullable: true, select: false })
  image: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
