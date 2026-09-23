import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantTable } from './entities/table.entity';
import { Account } from './entities/account.entity';
import { TablesService } from './tables.service';
import { AccountsService } from './accounts.service';
import { TablesController } from './tables.controller';
import { AccountsController } from './accounts.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([RestaurantTable, Account]), AuditModule],
  controllers: [TablesController, AccountsController],
  providers: [TablesService, AccountsService],
  exports: [TablesService, AccountsService],
})
export class MesasModule {}
