import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PosService } from './pos.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PayItemsDto } from './dto/pay-items.dto';
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
