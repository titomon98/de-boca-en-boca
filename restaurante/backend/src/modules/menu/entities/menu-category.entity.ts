import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'restaurante', name: 'menu_categories' })
export class MenuCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;
}
