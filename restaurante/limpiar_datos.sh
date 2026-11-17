#!/bin/bash
# Limpia en producción las ventas y comandas (backend/db/limpiar_datos.sql).
# Conserva: usuarios, menú, mesas, configuración y sedes.
# Antes de borrar guarda un respaldo completo en el servidor (/root/respaldos/).
# Pide la contraseña del servidor UNA sola vez.
set -e
cd "$(dirname "$0")"
HOST=root@104.236.254.247
SOCK=/tmp/dbeb-limpiar-ssh
SSH="ssh -o ControlPath=$SOCK"
PSQL="sudo -u postgres psql -d debocaenboca -v ON_ERROR_STOP=1"

echo "== Conectando (escribe la contraseña) =="
ssh -o ControlMaster=yes -o ControlPersist=10m -o ControlPath=$SOCK -fN $HOST
trap "ssh -o ControlPath=$SOCK -O exit $HOST 2>/dev/null" EXIT

echo "== Datos que se van a borrar =="
$SSH $HOST "$PSQL -c \"SELECT (SELECT count(*) FROM restaurante.accounts) AS cuentas, (SELECT count(*) FROM restaurante.orders) AS comandas, (SELECT count(*) FROM restaurante.payments) AS cobros, (SELECT count(*) FROM restaurante.cash_closings) AS cierres_caja;\""

read -r -p "Escribe BORRAR para continuar: " ok
[ "$ok" = "BORRAR" ] || { echo "Cancelado, no se borró nada."; exit 1; }

echo "== Respaldo =="
F="/root/respaldos/debocaenboca_$(date +%Y%m%d_%H%M%S).sql.gz"
$SSH $HOST "mkdir -p /root/respaldos && sudo -u postgres pg_dump debocaenboca | gzip > $F && ls -lh $F"

echo "== Limpiando =="
rsync -az -e "$SSH" backend/db/limpiar_datos.sql $HOST:/root/
$SSH $HOST "$PSQL < /root/limpiar_datos.sql"
$SSH $HOST "$PSQL -c \"SELECT (SELECT count(*) FROM restaurante.accounts) AS cuentas, (SELECT count(*) FROM restaurante.users) AS usuarios, (SELECT count(*) FROM restaurante.menu_items) AS productos, (SELECT count(*) FROM restaurante.tables) AS mesas;\""
echo "== Listo. Respaldo en el servidor: $F =="
