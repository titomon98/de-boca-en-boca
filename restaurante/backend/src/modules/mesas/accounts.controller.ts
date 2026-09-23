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
