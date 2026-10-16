import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PosService } from './pos.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PayItemsDto } from './dto/pay-items.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

/** Punto de venta: cobro de cuentas. Cajero y administrador. */
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post()
  @Roles(Role.ADMINISTRATOR, Role.CASHIER)
  pay(@Body() dto: CreatePaymentDto, @CurrentUser() user: AuthUser) {
    return this.posService.pay(dto, user);
  }

  /** Cobro por producto (división de cuenta). */
  @Post('items')
  @Roles(Role.ADMINISTRATOR, Role.CASHIER)
  payItems(@Body() dto: PayItemsDto, @CurrentUser() user: AuthUser) {
    return this.posService.payItems(dto, user);
  }

  /** Cobros registrados en un rango de fechas (para corregir o anular). */
  @Get('list')
  @Roles(Role.ADMINISTRATOR, Role.CASHIER)
  findAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.posService.findAll(from, to);
  }

  /** Corrige un cobro (monto, método o propina). Queda en la bitácora. */
  @Patch(':id')
  @Roles(Role.ADMINISTRATOR, Role.CASHIER)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.posService.update(id, dto, user);
  }

  @Get()
  @Roles(Role.ADMINISTRATOR, Role.CASHIER)
  findByAccount(@Query('accountId', ParseIntPipe) accountId: number) {
    return this.posService.findByAccount(accountId);
  }

  /** Anula un cobro (revierte el pago). Cajero o administrador. */
  @Post(':id/void')
  @Roles(Role.ADMINISTRATOR, Role.CASHIER)
  voidPayment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.posService.voidPayment(id, user);
  }
}
