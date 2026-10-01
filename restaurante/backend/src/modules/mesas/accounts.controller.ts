import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { OpenAccountDto } from './dto/open-account.dto';
import { JoinTablesDto } from './dto/join-tables.dto';
import { SetDiscountDto } from './dto/set-discount.dto';
import { SetDeliveryDto } from './dto/set-delivery.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

/** Cuentas de mesa: apertura, unión de mesas, cuentas separadas y cobro. */
@Controller('accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @Roles(Role.ADMINISTRATOR, Role.WAITER)
  open(@Body() dto: OpenAccountDto, @CurrentUser() user: AuthUser) {
    return this.accountsService.open(dto, user);
  }

  @Get()
  @Roles(Role.ADMINISTRATOR, Role.WAITER, Role.CASHIER)
  findOpen() {
    return this.accountsService.findOpen();
  }

  /** Órdenes para llevar activas (hasta que estén cobradas y entregadas). */
  @Get('takeout')
  @Roles(Role.ADMINISTRATOR, Role.WAITER, Role.CASHIER)
  findTakeout() {
    return this.accountsService.findTakeout();
  }

  /** Órdenes a domicilio activas. */
  @Get('delivery')
  @Roles(Role.ADMINISTRATOR, Role.WAITER, Role.CASHIER)
  findDelivery() {
    return this.accountsService.findDelivery();
  }

  @Get(':id')
  @Roles(Role.ADMINISTRATOR, Role.WAITER, Role.CASHIER)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.findOne(id);
  }

  /** Bitácora de auditoría de la cuenta (quién hizo qué). */
  @Get(':id/logs')
  @Roles(Role.ADMINISTRATOR, Role.WAITER, Role.CASHIER)
  getLogs(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.getLogs(id);
  }

  @Post(':id/join-tables')
  @Roles(Role.ADMINISTRATOR, Role.WAITER)
  joinTables(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: JoinTablesDto,
  ) {
    return this.accountsService.joinTables(id, dto);
  }

  @Post(':id/bill')
  @Roles(Role.ADMINISTRATOR, Role.WAITER, Role.CASHIER)
  markBilling(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.accountsService.markBilling(id, user);
  }

  /** Marca la cuenta como envío a domicilio + efectivo para el motorista. */
  @Post(':id/delivery')
  @Roles(Role.ADMINISTRATOR, Role.WAITER, Role.CASHIER)
  setDelivery(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetDeliveryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.accountsService.setDelivery(id, dto.isDelivery, dto.courierFee ?? 0, user);
  }

  /** Descuento a criterio del mesero (requiere descripción). */
  @Post(':id/discount')
  @Roles(Role.ADMINISTRATOR, Role.WAITER, Role.CASHIER)
  setDiscount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetDiscountDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.accountsService.setDiscount(id, dto.amount, dto.reason ?? '', user);
  }

  /** Entrega de orden para llevar (entregada / pendiente). */
  @Post(':id/delivered')
  @Roles(Role.ADMINISTRATOR, Role.WAITER, Role.CASHIER)
  setDelivered(
    @Param('id', ParseIntPipe) id: number,
    @Body('delivered') delivered: boolean,
    @CurrentUser() user: AuthUser,
  ) {
    return this.accountsService.setDelivered(id, delivered !== false, user);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMINISTRATOR)
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.accountsService.cancel(id, user);
  }

  /** Elimina la cuenta por completo (borrado permanente). Solo administrador. */
  @Delete(':id')
  @Roles(Role.ADMINISTRATOR)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.accountsService.remove(id, user);
  }
}
