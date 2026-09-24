import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { MenuItem } from '../../menu/entities/menu-item.entity';
import { numericTransformer } from '../../../common/transformers/numeric.transformer';

/** Renglón de comanda: un platillo del menú con cantidad y notas de cocina. */
@Entity({ schema: 'restaurante', name: 'order_items' })
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @ManyToOne(() => Order, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'menu_item_id', type: 'int' })
  menuItemId: number;

  @ManyToOne(() => MenuItem, { eager: true })
  @JoinColumn({ name: 'menu_item_id' })
  menuItem: MenuItem;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  unitPrice: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  subtotal: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  /**
   * Si el renglón es un combo, sus componentes ya resueltos (ligados a productos
   * reales) para desglosarlos en reportes. El renglón conserva el precio de
   * paquete; los componentes valen Q0.
   */
  @Column({ type: 'jsonb', nullable: true })
  components: { itemId: number; name: string; quantity: number }[] | null;
}
