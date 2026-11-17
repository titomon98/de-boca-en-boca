-- Postres: categoría "Postres" con el producto "Postre" a Q25 (sin foto, va a cocina).
-- Idempotente: si ya existe, solo ajusta precio, categoría y disponibilidad.
BEGIN;

INSERT INTO restaurante.menu_categories (name)
SELECT 'Postres'
WHERE NOT EXISTS (SELECT 1 FROM restaurante.menu_categories WHERE name ILIKE 'Postres');

UPDATE restaurante.menu_items
SET price = 25, available = true, type = 'food',
    category_id = (SELECT id FROM restaurante.menu_categories WHERE name ILIKE 'Postres' ORDER BY id LIMIT 1)
WHERE trim(name) ~* '^postres?$';

INSERT INTO restaurante.menu_items (name, price, type, category_id, available)
SELECT 'Postre', 25, 'food', (SELECT id FROM restaurante.menu_categories WHERE name ILIKE 'Postres' ORDER BY id LIMIT 1), true
WHERE NOT EXISTS (SELECT 1 FROM restaurante.menu_items WHERE trim(name) ~* '^postres?$');

SELECT m.id, m.name, m.price, c.name AS categoria FROM restaurante.menu_items m
JOIN restaurante.menu_categories c ON c.id = m.category_id WHERE c.name ILIKE 'Postres';

COMMIT;
