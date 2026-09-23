/**
 * Reinicia el schema `restaurante` por completo. DESTRUCTIVO.
 * Sólo para desarrollo: elimina el schema y todos sus objetos, luego reaplica
 * db/schema.sql. Úsalo cuando el schema quedó en un estado incompatible.
 *
 * Uso: npx ts-node scripts/reset-schema.ts
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
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Eliminando schema restaurante (CASCADE)...');
  await client.query('DROP SCHEMA IF EXISTS restaurante CASCADE');
  console.log('Reaplicando esquema...');
  await client.query(sql);
  console.log('Schema restaurante recreado correctamente.');
  await client.end();
}
main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
