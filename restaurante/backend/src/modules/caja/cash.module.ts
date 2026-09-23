import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashClosing } from './entities/cash-closing.entity';
import { Payment } from '../pos/entities/payment.entity';
import { CashService } from './cash.service';
import { CashController } from './cash.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CashClosing, Payment])],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}
