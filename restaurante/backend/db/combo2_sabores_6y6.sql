-- Combo 2: los sabores de las 12 alitas se reparten en máximo DOS sabores de
-- 6 en 6 (6 y 6, o los 12 de un solo sabor). Convierte el grupo de sabores del
-- combo en uno de distribución: total 12, máximo 2 sabores, paso 6.
-- El grupo de sabores es el que comparte opciones con los sabores de las alitas
-- (grupos de distribución de 10/20/30/Sampler) o se llama "Sabor...".
-- Idempotente: se puede correr dos veces.
BEGIN;

WITH flavors AS (
  SELECT DISTINCT (jsonb_array_elements_text(g->'optionItemIds'))::int AS id
  FROM restaurante.menu_items m, jsonb_array_elements(m.choice_groups) g
  WHERE (g->>'distribute')::boolean
)
UPDATE restaurante.menu_items c
SET choice_groups = (
  SELECT jsonb_agg(
    CASE WHEN g->>'label' ILIKE '%sabor%'
           OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(g->'optionItemIds') o
                      WHERE o::int IN (SELECT id FROM flavors))
         THEN g || '{"distribute": true, "total": 12, "maxOptions": 2, "step": 6, "choose": 1}'::jsonb
         ELSE g END
    ORDER BY ord)
  FROM jsonb_array_elements(c.choice_groups) WITH ORDINALITY AS t(g, ord)
)
WHERE c.combo IS NOT NULL
  AND c.name ~* '^combo\s*(no\.?\s*|#\s*)?2\M'
  AND c.choice_groups IS NOT NULL
RETURNING c.id, c.name, jsonb_pretty(c.choice_groups) AS grupos;

COMMIT;
