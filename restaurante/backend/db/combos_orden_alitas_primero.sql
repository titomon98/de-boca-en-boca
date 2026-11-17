-- Combos: ordena los pasos de elección para que vaya primero lo de las alitas y
-- después lo de las quesadillas:
--   1. alitas (sabor, aderezo de alitas y cualquier otro grupo)
--   2. quesadilla (tipo: res/pollo, el grupo cuyas opciones son quesadillas)
--   3. "Agregar" (aguacate / picante de la quesadilla)
-- Dentro de cada bloque se respeta el orden que ya tenían. Idempotente.
BEGIN;

UPDATE restaurante.menu_items c
SET choice_groups = (
  SELECT jsonb_agg(g ORDER BY
    CASE
      WHEN g->>'label' = 'Agregar' THEN 2
      WHEN EXISTS (
        SELECT 1 FROM restaurante.menu_items q
        WHERE q.name ILIKE '%quesadilla%'
          AND q.id IN (SELECT jsonb_array_elements_text(g->'optionItemIds')::int)
      ) THEN 1
      ELSE 0
    END,
    ord)
  FROM jsonb_array_elements(c.choice_groups) WITH ORDINALITY AS t(g, ord)
)
WHERE c.combo IS NOT NULL
  AND jsonb_array_length(COALESCE(c.choice_groups, '[]'::jsonb)) > 1
RETURNING c.id, c.name,
  (SELECT string_agg(x->>'label', ' > ') FROM jsonb_array_elements(c.choice_groups) x) AS orden;

COMMIT;
