#!/bin/bash
# Revisa (SOLO LECTURA) la tarjeta del 16/11 contra la liquidación NeoNet.
# Pide la contraseña del servidor una vez. Guarda el resultado en revision_tarjeta.txt
set -e
cd "$(dirname "$0")"
HOST=root@104.236.254.247
SOCK=/tmp/dbeb-revisar-ssh
SSH="ssh -o ControlPath=$SOCK"
echo "== Conectando (escribe la contraseña) =="
ssh -o ControlMaster=yes -o ControlPersist=5m -o ControlPath=$SOCK -fN $HOST
trap "ssh -o ControlPath=$SOCK -O exit $HOST 2>/dev/null" EXIT
rsync -az -e "$SSH" backend/db/revisar_tarjeta_2026-11-16.sql $HOST:/root/
$SSH $HOST "sudo -u postgres psql -d debocaenboca -v ON_ERROR_STOP=1 < /root/revisar_tarjeta_2026-11-16.sql 2>&1 | grep -v 'perl: warning\|LANGUAGE\|LC_ALL\|LC_CTYPE\|LANG =\|are supported\|Please check'" | tee revision_tarjeta.txt
echo; echo "== Resultado guardado en: $(pwd)/revision_tarjeta.txt =="
