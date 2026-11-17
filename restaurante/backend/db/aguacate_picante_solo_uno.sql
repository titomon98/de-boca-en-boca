-- "Agregar" (aguacate / picante): solo se puede elegir UNA de las dos (o ninguna).
-- Cambia choose 2 -> 1 en todos los productos y combos que ya lo tienen.
BEGIN;

UPDATE restaurante.menu_items m
SET choice_groups = (
  SELECT jsonb_agg(
    CASE WHEN g->>'label' = 'Agregar' AND (g->>'optional')::boolean
         THEN jsonb_set(g, '{choose}', '1') ELSE g END
    ORDER BY ord)
  FROM jsonb_array_elements(m.choice_groups) WITH ORDINALITY AS t(g, ord)
)
WHERE m.choice_groups @> '[{"label": "Agregar", "optional": true}]'
RETURNING m.id, m.name;

COMMIT;
