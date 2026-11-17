-- Bebidas duplicadas (mismo nombre salvo mayúsculas, tildes, "de" y espacios,
-- ej. "Smoothie Frutos Rojos" y "Smoothie de frutos rojos"): se queda la que
-- tiene FOTO (si ninguna o ambas, la más antigua) y recibe el grupo, precio y
-- categoría de la más nueva (la que dejó bebidas_agrupadas.sql). Las demás se
-- borran, o se deshabilitan si ya tienen ventas. Idempotente.
BEGIN;

CREATE TEMP TABLE dup ON COMMIT DROP AS
WITH d AS (
  SELECT id, image IS NOT NULL AS has_img,
         regexp_replace(regexp_replace(lower(translate(name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')), '\mde\M', '', 'g'), '[^a-z0-9]', '', 'g') AS k
  FROM restaurante.menu_items
  WHERE type = 'drink' AND available
)
SELECT k,
       (array_agg(id ORDER BY has_img DESC, id ASC))[1] AS keep_id,
       max(id) AS newest_id,
       array_agg(id) AS ids
FROM d GROUP BY k HAVING count(*) > 1;

-- La que se queda toma grupo/precio/categoría de la más nueva.
UPDATE restaurante.menu_items k
SET grupo = n.grupo, price = n.price, category_id = n.category_id
FROM dup, restaurante.menu_items n
WHERE k.id = dup.keep_id AND n.id = dup.newest_id AND dup.keep_id <> dup.newest_id
RETURNING k.id, k.name AS se_queda, k.grupo, k.price;

-- Las demás: deshabilitar si tienen ventas, borrar si no.
UPDATE restaurante.menu_items m SET available = false
FROM dup
WHERE m.id = ANY(dup.ids) AND m.id <> dup.keep_id
  AND EXISTS (SELECT 1 FROM restaurante.order_items oi WHERE oi.menu_item_id = m.id)
RETURNING m.id, m.name AS deshabilitada_tiene_ventas;

DELETE FROM restaurante.menu_items m
USING dup
WHERE m.id = ANY(dup.ids) AND m.id <> dup.keep_id
  AND NOT EXISTS (SELECT 1 FROM restaurante.order_items oi WHERE oi.menu_item_id = m.id)
RETURNING m.id, m.name AS borrada;

COMMIT;
