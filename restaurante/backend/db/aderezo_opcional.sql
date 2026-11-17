-- Nuggets, aros de cebolla y cheese balls: se les puede agregar UN aderezo (opcional, 0 o 1). Opciones: los
-- aderezos del menú (grupo 'Aderezos'). Se agrega al final, después del sabor.
-- Idempotente: si ya tenía el grupo "Aderezo", lo reemplaza.
BEGIN;

UPDATE restaurante.menu_items m
SET choice_groups = COALESCE((
    SELECT jsonb_agg(g) FROM jsonb_array_elements(COALESCE(m.choice_groups, '[]')::jsonb) g
    WHERE g->>'label' <> 'Aderezo'), '[]'::jsonb)
  || jsonb_build_array(jsonb_build_object(
       'label', 'Aderezo', 'choose', 1, 'optional', true,
       'optionItemIds', (SELECT jsonb_agg(a.id ORDER BY a.name) FROM restaurante.menu_items a
                         WHERE a.grupo = 'Aderezos' AND a.available)))
WHERE m.name ~* 'nugget|aros? de cebolla|cheese ?balls?|bolitas de queso' AND m.price > 0 AND m.combo IS NULL
RETURNING m.id, m.name, m.choice_groups;

COMMIT;
