import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

/**
 * Construye las opciones de conexión de TypeORM a partir de variables de entorno.
 * Se conecta a la instancia compartida de Supabase (PostgreSQL) usando el
 * schema propio del sistema: `restaurante`.
 *
 * Nota: el puerto 6543 corresponde al Transaction Pooler (PgBouncer) de Supabase.
 * TypeORM no usa prepared statements con nombre por defecto, por lo que es
 * compatible con el pooling en modo transacción.
 */
export function buildTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  const useSsl = config.get<string>('DB_SSL', 'true') === 'true';

  return {
    type: 'postgres',
    host: config.get<string>('DB_HOST'),
    port: parseInt(config.get<string>('DB_PORT', '6543'), 10),
    username: config.get<string>('DB_USER'),
    password: config.get<string>('DB_PASSWORD'),
    database: config.get<string>('DB_NAME', 'postgres'),
    schema: config.get<string>('DB_SCHEMA', 'restaurante'),
    autoLoadEntities: true,
    // Nunca en true sobre una instancia compartida: el esquema se gestiona vía SQL.
    synchronize: false,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    extra: {
      max: 10,
    },
  };
}
