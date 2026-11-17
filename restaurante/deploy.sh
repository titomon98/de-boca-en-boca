#!/bin/bash
# Sube todo a producción: columnas nuevas, backend, frontend e imágenes.
# Pide la contraseña del servidor UNA sola vez (reusa la conexión SSH).
set -e
cd "$(dirname "$0")"
HOST=root@104.236.254.247
SOCK=/tmp/dbeb-deploy-ssh
SSH="ssh -o ControlPath=$SOCK"

echo "== Conectando (escribe la contraseña) =="
ssh -o ControlMaster=yes -o ControlPersist=10m -o ControlPath=$SOCK -fN $HOST
trap "ssh -o ControlPath=$SOCK -O exit $HOST 2>/dev/null" EXIT

echo "== 1/4 Base de datos: columnas nuevas =="
$SSH $HOST 'sudo -u postgres psql -d debocaenboca -v ON_ERROR_STOP=1 -c "ALTER TABLE restaurante.accounts ADD COLUMN IF NOT EXISTS tip_pending NUMERIC(12,2) NOT NULL DEFAULT 0;" -c "ALTER TABLE restaurante.orders ADD COLUMN IF NOT EXISTS comanda_no INTEGER;"'

echo "== 2/4 Backend =="
(cd backend && npm run build)
rsync -az -e "$SSH" backend/dist/ $HOST:/root/de-boca-en-boca/restaurante/backend/dist/
$SSH $HOST "pm2 restart debocaenboca-api"

echo "== 3/4 Frontend =="
(cd frontend && npm run build)
rsync -az --delete -e "$SSH" frontend/build/ $HOST:/var/www/debocaenboca/

echo "== 4/4 Imágenes de bebidas y aderezos =="
rsync -az -e "$SSH" backend/db/imagenes_bebidas_aderezos.sql $HOST:/root/
$SSH $HOST "sudo -u postgres psql -d debocaenboca -v ON_ERROR_STOP=1 < /root/imagenes_bebidas_aderezos.sql"

echo "== Nuggets, aros de cebolla y cheese balls: un aderezo opcional =="
rsync -az -e "$SSH" backend/db/aderezo_opcional.sql $HOST:/root/
$SSH $HOST "sudo -u postgres psql -d debocaenboca -v ON_ERROR_STOP=1 < /root/aderezo_opcional.sql"

echo "== Postres =="
rsync -az -e "$SSH" backend/db/postres.sql $HOST:/root/
$SSH $HOST "sudo -u postgres psql -d debocaenboca -v ON_ERROR_STOP=1 < /root/postres.sql"

echo "== Revisión: últimos logs del backend =="
sleep 3
$SSH $HOST "pm2 logs debocaenboca-api --lines 15 --nostream"
echo "== Listo. Recarga la app en las tablets. =="
