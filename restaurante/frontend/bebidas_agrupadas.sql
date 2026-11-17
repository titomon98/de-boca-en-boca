-- Bebidas agrupadas (menú táctil) con precios. Cada fila: nombre, patrón para
-- encontrar el producto existente (regex sin distinguir mayúsculas), grupo y
-- precio. Si existe, se actualiza (grupo, precio, categoría Bebidas, tipo
-- bebida -> barra, disponible); si no existe, se crea. 7up queda deshabilitada.
-- Al final lista las bebidas disponibles que NO están en esta lista, para revisar.
-- Idempotente: se puede correr dos veces.
BEGIN;

INSERT INTO restaurante.menu_categories (name)
SELECT 'Bebidas'
WHERE NOT EXISTS (SELECT 1 FROM restaurante.menu_categories WHERE name ILIKE 'Bebidas');

DO $$
DECLARE
  r RECORD;
  cat INT := (SELECT id FROM restaurante.menu_categories WHERE name ILIKE 'Bebidas' ORDER BY id LIMIT 1);
  n INT;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    -- Gaseosas: todas Q10
    ('Coca',                     '^coca([ -]?cola)?$',                              'Gaseosas', 10),
    ('Pepsi',                    '^pepsi$',                                         'Gaseosas', 10),
    ('Grapette',                 '^grapp?ett?e$',                                   'Gaseosas', 10),
    ('Tiki',                     '^tiki$',                                          'Gaseosas', 10),
    ('Fresca',                   '^fresca$',                                        'Gaseosas', 10),
    ('Sprite',                   '^sprite$',                                        'Gaseosas', 10),
    ('Té frío',                  '^t[eé] fr[ií]o$',                                 'Gaseosas', 10),
    ('Coca Zero',                '^coca([ -]?cola)? zero$',                         'Gaseosas', 10),
    ('Agua pura',                '^agua( pura)?$',                                  'Gaseosas', 10),
    ('Mineral',                  '^(agua )?mineral$',                               'Gaseosas', 10),
    -- Cervezas
    ('Cabro',                    '^(cerveza )?cabro$',                              'Cervezas', 20),
    ('Indio',                    '^(cerveza )?indio$',                              'Cervezas', 25),
    ('Porter individual',        '^(cerveza )?porter( individual)?$',               'Cervezas', 25),
    ('3 Porter',                 '^3 ?(x )?porters?$',                              'Cervezas', 50),
    -- Naturales: todas Q15
    ('Jamaica',                  '^((fresco|agua) de )?jamaica$',                   'Naturales', 15),
    ('Horchata',                 '^((fresco|agua) de )?horchata$',                  'Naturales', 15),
    ('Mango',                    '^((fresco|agua) de )?mango$',                     'Naturales', 15),
    ('Crema',                    '^((fresco|agua) de )?crema$',                     'Naturales', 15),
    -- Bebidas preparadas con alcohol
    ('Tehuacán compuesto',       '^tehuac[aá]n compuesto$',                         'Bebidas con alcohol', 35),
    ('Micheladón',               '^michelad[oó]n$',                                 'Bebidas con alcohol', 45),
    ('Litro de sangría',         '^(litro de )?sangr[ií]a$',                        'Bebidas con alcohol', 90),
    ('Piña colada',              '^pi[ñn]a colada$',                                'Bebidas con alcohol', 30),
    ('Calimocho',                '^calimocho$',                                     'Bebidas con alcohol', 30),
    ('Mojito de fresas',         '^mojito( de fresas?)?$',                          'Bebidas con alcohol', 30),
    -- Frappés y smoothies
    ('Smoothie de frutos rojos', '^smoothie( de frutos rojos)?$',                   'Frappés y smoothies', 35),
    ('Frappé de chocomenta',     '^frapp?[eé] (de )?chocomenta$',                   'Frappés y smoothies', 35),
    ('Frappé de palomitas',      '^frapp?[eé] (de )?palomitas$',                    'Frappés y smoothies', 35),
    -- Otros
    ('Iced coffee',              '^iced? coff?ee?$',                                'Otros', 30),
    ('Café',                     '^caf[eé]$',                                       'Otros', 10),
    ('Té',                       '^t[eé]$',                                         'Otros', 10),
    ('Chocolate',                '^chocolate$',                                     'Otros', 15)
  ) AS v(name, pat, grupo, price)
  LOOP
    UPDATE restaurante.menu_items
    SET grupo = r.grupo, price = r.price, category_id = cat, type = 'drink', available = true
    WHERE trim(name) ~* r.pat;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN
      INSERT INTO restaurante.menu_items (name, price, type, category_id, grupo, available)
      VALUES (r.name, r.price, 'drink', cat, r.grupo, true);
      RAISE NOTICE 'CREADO      % (% Q%)', r.name, r.grupo, r.price;
    ELSIF n > 1 THEN
      RAISE NOTICE 'ACTUALIZADO % (% productos con ese nombre)', r.name, n;
    ELSE
      RAISE NOTICE 'actualizado %', r.name;
    END IF;
  END LOOP;
END $$;

-- 7up: deshabilitada (puede volver).
UPDATE restaurante.menu_items SET available = false
WHERE trim(name) ~* '^(7|seven) ?up$'
RETURNING id, name AS deshabilitada;

-- Revisar: bebidas disponibles que no quedaron en ningún grupo de esta lista.
SELECT id, name, price, grupo AS grupo_actual
FROM restaurante.menu_items
WHERE type = 'drink' AND available AND price > 0
  AND COALESCE(grupo, '') NOT IN ('Gaseosas', 'Cervezas', 'Naturales', 'Bebidas con alcohol', 'Frappés y smoothies', 'Otros')
ORDER BY name;

COMMIT;
