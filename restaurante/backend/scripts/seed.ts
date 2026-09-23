/**
 * Datos semilla del sistema de restaurante. Idempotente.
 * Uso: npm run db:seed
 *
 * Crea:
 *  - Usuario administrador inicial (si no existe).
 *  - 15 mesas (maqueta inicial del salón), si aún no hay mesas.
 *  - Un menú de demostración (categorías + platillos), si el menú está vacío.
 *
 * Credenciales por defecto (cambiar tras el primer inicio de sesión):
 *   email:    admin@restaurante.local
 *   password: Admin123!
 */
import 'dotenv/config';
import { Client } from 'pg';
import * as bcrypt from 'bcryptjs';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@restaurante.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Administrador';
const TABLE_COUNT = 15;

async function main() {
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

  // --- Usuario administrador ---
  const existingAdmin = await client.query(
    'SELECT id FROM restaurante.users WHERE email = $1',
    [ADMIN_EMAIL],
  );
  if (existingAdmin.rowCount && existingAdmin.rowCount > 0) {
    console.log(`El usuario administrador ya existe (${ADMIN_EMAIL}).`);
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await client.query(
      `INSERT INTO restaurante.users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'administrator')`,
      [ADMIN_NAME, ADMIN_EMAIL, passwordHash],
    );
    console.log('Usuario administrador creado:');
    console.log(`  email:    ${ADMIN_EMAIL}`);
    console.log(`  password: ${ADMIN_PASSWORD}`);
    console.log('  (Cambie la contraseña tras el primer inicio de sesión.)');
  }

  // --- 15 mesas ---
  const tableCount = await client.query(
    'SELECT COUNT(*)::int AS c FROM restaurante.tables WHERE is_takeout = false',
  );
  if (tableCount.rows[0].c > 0) {
    console.log(`Las mesas ya existen (${tableCount.rows[0].c}).`);
  } else {
    for (let n = 1; n <= TABLE_COUNT; n++) {
      await client.query(
        `INSERT INTO restaurante.tables (number, capacity, status)
         VALUES ($1, $2, 'free')`,
        [n, 4],
      );
    }
    console.log(`${TABLE_COUNT} mesas creadas.`);
  }

  // --- Menú de demostración ---
  const menuCount = await client.query(
    'SELECT COUNT(*)::int AS c FROM restaurante.menu_items',
  );
  if (menuCount.rows[0].c > 0) {
    console.log(`El menú ya tiene ${menuCount.rows[0].c} platillos.`);
  } else {
    const categories: Record<string, number> = {};
    for (const name of ['Entradas', 'Platos fuertes', 'Bebidas', 'Postres', 'Extras']) {
      const res = await client.query(
        `INSERT INTO restaurante.menu_categories (name) VALUES ($1) RETURNING id`,
        [name],
      );
      categories[name] = res.rows[0].id;
    }

    const items: [string, string, number, 'food' | 'drink'][] = [
      ['Nachos con queso', 'Entradas', 35, 'food'],
      ['Sopa de tortilla', 'Entradas', 30, 'food'],
      ['Carne asada', 'Platos fuertes', 85, 'food'],
      ['Pollo a la plancha', 'Platos fuertes', 70, 'food'],
      ['Pasta Alfredo', 'Platos fuertes', 65, 'food'],
      ['Limonada', 'Bebidas', 18, 'drink'],
      ['Refresco', 'Bebidas', 15, 'drink'],
      ['Cerveza nacional', 'Bebidas', 25, 'drink'],
      ['Flan de caramelo', 'Postres', 28, 'food'],
      ['Pastel de chocolate', 'Postres', 32, 'food'],
      ['Extra guacamole', 'Extras', 12, 'food'],
      ['Extra tocino', 'Extras', 10, 'food'],
      ['Extra queso', 'Extras', 8, 'food'],
      ['Extra aderezo', 'Extras', 5, 'food'],
    ];
    for (const [name, cat, price, type] of items) {
      await client.query(
        `INSERT INTO restaurante.menu_items (name, category_id, price, type, available)
         VALUES ($1, $2, $3, $4, true)`,
        [name, categories[cat], price, type],
      );
    }
    console.log(`Menú de demostración creado (${items.length} platillos).`);
  }

  await client.end();
  console.log('Seed completado.');
}

main().catch((err) => {
  console.error('Error en el seed:', err.message);
  process.exit(1);
});
