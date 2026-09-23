import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { ComandasService } from './comandas.service';
import { ComandasController } from './comandas.controller';
import { ComandasGateway } from '../../gateways/comandas.gateway';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    AuditModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [ComandasController],
  providers: [ComandasService, ComandasGateway],
  exports: [ComandasService],
})
export class ComandasModule {}
