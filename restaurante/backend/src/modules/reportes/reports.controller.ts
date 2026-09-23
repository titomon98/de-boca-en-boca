import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

/** Reportes de ventas. Administrador y cajero. */
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMINISTRATOR, Role.CASHIER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales-summary')
  salesSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.salesSummary(from, to);
  }

  @Get('top-items')
  topItems(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
  ) {
    return this.reportsService.topItems(from, to, limit);
  }

  @Get('sales-by-day')
  salesByDay(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.salesByDay(from, to);
  }

  @Get('inventory')
  inventory() {
    return this.reportsService.inventory();
  }
}
