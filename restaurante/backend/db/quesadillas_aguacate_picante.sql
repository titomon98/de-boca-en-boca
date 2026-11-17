-- Quesadilla MX y Quesadilla de pollo: opción (opcional) de aguacate O picante (solo una).
-- Las opciones son productos Q0 sin categoría (ocultos en el menú táctil) y salen
-- en la comanda como "1x Con aguacate". Idempotente: se puede correr dos veces.
BEGIN;

INSERT INTO restaurante.menu_items (name, price, type, available)
SELECT v.name, 0, 'food', true
FROM (VALUES ('Con aguacate'), ('Con picante')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM restaurante.menu_items m WHERE m.name = v.name);

UPDATE restaurante.menu_items q
SET choice_groups = COALESCE(q.choice_groups, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
  'label', 'Agregar',
  'choose', 1,
  'optional', true,
  'optionItemIds', (SELECT jsonb_agg(id ORDER BY name) FROM restaurante.menu_items
                    WHERE name IN ('Con aguacate', 'Con picante'))
))
WHERE q.name ILIKE '%quesadilla%'
  AND (q.name ILIKE '%mx%' OR q.name ILIKE '%pollo%')
  AND q.combo IS NULL
  AND q.price > 0
  AND NOT COALESCE(q.choice_groups, '[]'::jsonb) @> '[{"label": "Agregar"}]'
RETURNING q.id, q.name, q.choice_groups;

COMMIT;
