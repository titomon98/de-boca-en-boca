import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CashService } from './cash.service';
import { CreateCashClosingDto } from './dto/create-cash-closing.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

/** Cierre de caja diario. Cajero y administrador. */
@Controller('cash-closings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMINISTRATOR, Role.CASHIER)
export class CashController {
  constructor(private readonly cashService: CashService) {}

  /** Totales cobrados desde el último cierre (previsualización). */
  @Get('summary')
  currentSummary() {
    return this.cashService.currentSummary();
  }

  @Post()
  create(@Body() dto: CreateCashClosingDto, @CurrentUser() user: AuthUser) {
    return this.cashService.create(dto, user.id);
  }

  @Get()
  findAll() {
    return this.cashService.findAll();
  }
}
