-- 1) Combo 3: NO lleva aguacate / picante (se quita el grupo "Agregar").
-- 2) Quesadilla MX y Quesadilla de pollo pasan a la categoría "Quesadillas"
--    (se crea si no existe). Si la categoría se llama distinto, cambiar el
--    nombre en las dos líneas marcadas con <<<.
-- Idempotente: se puede correr dos veces.
BEGIN;

UPDATE restaurante.menu_items c
SET choice_groups = (
  SELECT COALESCE(jsonb_agg(g ORDER BY ord), '[]'::jsonb)
  FROM jsonb_array_elements(c.choice_groups) WITH ORDINALITY AS t(g, ord)
  WHERE g->>'label' <> 'Agregar'
)
WHERE c.combo IS NOT NULL
  AND c.name ~* '^combo\s*(no\.?\s*|#\s*)?3\M'
  AND c.choice_groups @> '[{"label": "Agregar"}]'
RETURNING c.id, c.name AS sin_aguacate_picante;

INSERT INTO restaurante.menu_categories (name)
SELECT 'Quesadillas'                                                      -- <<<
WHERE NOT EXISTS (SELECT 1 FROM restaurante.menu_categories WHERE name ILIKE 'Quesadillas');

UPDATE restaurante.menu_items q
SET category_id = (SELECT id FROM restaurante.menu_categories
                   WHERE name ILIKE 'Quesadillas' ORDER BY id LIMIT 1)   -- <<<
WHERE q.name ILIKE '%quesadilla%'
  AND (q.name ILIKE '%mx%' OR q.name ILIKE '%pollo%')
  AND q.combo IS NULL
  AND q.price > 0
RETURNING q.id, q.name AS movida_a_quesadillas;

COMMIT;
