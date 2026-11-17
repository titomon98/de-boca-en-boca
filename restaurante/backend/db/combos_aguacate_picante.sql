-- Combos que llevan quesadilla (como componente fijo o como opción a elegir, ej.
-- tipo de quesadilla res/pollo): misma opción "Agregar" de aguacate / picante.
-- Requiere haber corrido antes quesadillas_aguacate_picante.sql (crea las opciones).
-- Idempotente: se puede correr dos veces.
BEGIN;

UPDATE restaurante.menu_items c
SET choice_groups = COALESCE(c.choice_groups, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
  'label', 'Agregar',
  'choose', 1,
  'optional', true,
  'optionItemIds', (SELECT jsonb_agg(id ORDER BY name) FROM restaurante.menu_items
                    WHERE name IN ('Con aguacate', 'Con picante'))
))
WHERE c.combo IS NOT NULL
  AND c.name !~* '^combo\s*(no\.?\s*|#\s*)?3\M'  -- el Combo 3 no lleva aguacate/picante
  AND NOT COALESCE(c.choice_groups, '[]'::jsonb) @> '[{"label": "Agregar"}]'
  AND EXISTS (
    SELECT 1 FROM restaurante.menu_items q
    WHERE q.name ILIKE '%quesadilla%'
      AND (
        q.id IN (SELECT (comp->>'itemId')::int FROM jsonb_array_elements(c.combo->'components') comp)
        OR q.id IN (SELECT jsonb_array_elements_text(g->'optionItemIds')::int
                    FROM jsonb_array_elements(COALESCE(c.choice_groups, '[]'::jsonb)) g)
      )
  )
RETURNING c.id, c.name;

COMMIT;
