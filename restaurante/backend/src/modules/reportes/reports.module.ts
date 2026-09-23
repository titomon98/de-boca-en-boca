import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../pos/entities/payment.entity';
import { OrderItem } from '../comandas/entities/order-item.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, OrderItem, MenuItem])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
