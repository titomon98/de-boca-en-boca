/**
 * Aplica el esquema `restaurante` (db/schema.sql) a la base de datos configurada
 * en .env. Idempotente: usa CREATE ... IF NOT EXISTS.
 *
 * Uso: npm run db:apply
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

async function main() {
  const sql = readFileSync(join(__dirname, '..', 'db', 'schema.sql'), 'utf8');

  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '6543', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'postgres',
    ssl:
      (process.env.DB_SSL || 'true') === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });

  await client.connect();
  console.log('Conectado. Aplicando esquema restaurante...');
  await client.query(sql);
  console.log('Esquema aplicado correctamente.');
  await client.end();
}

main().catch((err) => {
  console.error('Error aplicando el esquema:', err.message);
  process.exit(1);
});
