import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ComandasService } from './comandas.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComandasController {
  constructor(private readonly comandasService: ComandasService) {}

  /** El mesero envía una comanda a cocina. */
  @Post()
  @Roles(Role.ADMINISTRATOR, Role.WAITER)
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthUser) {
    return this.comandasService.create(dto, user);
  }

  /** Vista de cocina: sólo comandas activas. */
  @Get('kitchen')
  @Roles(Role.ADMINISTRATOR, Role.KITCHEN)
  findActive() {
    return this.comandasService.findActive();
  }

  @Get()
  @Roles(Role.ADMINISTRATOR, Role.WAITER, Role.CASHIER)
  findByAccount(@Query('accountId', ParseIntPipe) accountId: number) {
    return this.comandasService.findByAccount(accountId);
  }

  @Get(':id')
  @Roles(Role.ADMINISTRATOR, Role.WAITER, Role.CASHIER, Role.KITCHEN)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.comandasService.findOne(id);
  }

  /** Cocina o mesero actualizan el estado de la comanda. */
  @Patch(':id/status')
  @Roles(Role.ADMINISTRATOR, Role.KITCHEN, Role.WAITER)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comandasService.updateStatus(id, dto, user);
  }

  /** Anula una comanda completa (descuenta su importe de la cuenta). */
  @Post(':id/cancel')
  @Roles(Role.ADMINISTRATOR, Role.WAITER)
  cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comandasService.cancelOrder(id, user);
  }

  /** Anula un solo platillo de una comanda. */
  @Delete(':orderId/items/:itemId')
  @Roles(Role.ADMINISTRATOR, Role.WAITER)
  cancelItem(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comandasService.cancelItem(orderId, itemId, user);
  }
}
