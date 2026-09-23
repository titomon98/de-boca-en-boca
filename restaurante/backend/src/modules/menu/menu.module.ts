import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItem } from './entities/menu-item.entity';
import { MenuCategory } from './entities/menu-category.entity';
import { OrderItem } from '../comandas/entities/order-item.entity';
import { MenuService } from './menu.service';
import { CategoriesService } from './categories.service';
import { MenuController } from './menu.controller';
import { CategoriesController } from './categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MenuItem, MenuCategory, OrderItem])],
  controllers: [MenuController, CategoriesController],
  providers: [MenuService, CategoriesService],
  exports: [MenuService],
})
export class MenuModule {}
