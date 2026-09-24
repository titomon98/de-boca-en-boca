import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { buildTypeOrmOptions } from './config/data-source';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/usuarios/users.module';
import { MenuModule } from './modules/menu/menu.module';
import { MesasModule } from './modules/mesas/mesas.module';
import { ComandasModule } from './modules/comandas/comandas.module';
import { PosModule } from './modules/pos/pos.module';
import { CashModule } from './modules/caja/cash.module';
import { ReportsModule } from './modules/reportes/reports.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<string>('DB_PORT', '5432')),
        database: configService.get<string>('DB_NAME', 'postgres'),
        username: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASSWORD'),
        schema: configService.get<string>('DB_SCHEMA') || 'restaurante',
        autoLoadEntities: true,
        synchronize: false, // En producción/Supabase siempre usar false
        // SSL solo cuando DB_SSL=true (Supabase). En local Postgres va sin SSL.
        ssl:
          configService.get<string>('DB_SSL', 'false') === 'true'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),
    AuthModule,
    UsersModule,
    MenuModule,
    MesasModule,
    ComandasModule,
    PosModule,
    CashModule,
    ReportsModule,
    SettingsModule,
  ],
  providers: [
    // Idempotencia global: colapsa POST duplicados por doble clic.
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
