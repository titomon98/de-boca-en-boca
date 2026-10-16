# Puente de impresión (impresoras térmicas de red)

Las tablets (navegador) no imprimen bien directo a una térmica. Este puente
pequeño recibe el ticket de las tablets y lo manda a la impresora por su IP
(RAW, puerto 9100, ESC/POS). Corre en una máquina **de la misma red local** que
las impresoras: una mini PC, una laptop o una Raspberry Pi en el restaurante.

## 1. Requisitos
- Node.js 18+ instalado en esa máquina.
- Impresora(s) térmica(s) **de red** (LAN/WiFi) con una IP fija cada una.
  Averigua la IP de la impresora (imprime su auto-test o míralo en el router).

## 2. Configurar
Copia `config.example.json` a `config.json`:

```json
{
  "server": "https://debocaenboca.104.236.254.247.sslip.io",
  "bridgeKey": "la misma clave que PRINT_BRIDGE_KEY en el .env del servidor",
  "printers": {
    "cocina": "win:TERMICA",
    "barra":  "win:TERMICA",
    "caja":   "win:TERMICA",
    "default":"win:TERMICA"
  }
}
```
- `printers`: aquí se **elige la impresora** de cada estación.
  - **Instalada en Windows por USB** (su puerto dice `USB001`): `win:TERMICA`.
    Hay que **compartirla** una vez: Configuración -> Impresoras -> la térmica ->
    Propiedades de impresora -> pestaña *Compartir* -> marcar *Compartir esta
    impresora* y poner de nombre `TERMICA` (sin espacios). El puente le manda
    el ticket directo (RAW).
  - **Por puerto serial COM** (conectada a la computadora): `COM3@9600`. El número de
    COM se ve en Windows en *Administrador de dispositivos -> Puertos (COM y LPT)*;
    la velocidad (9600, 19200, 38400...) sale en la hoja de auto-test de la
    impresora. En Linux/Mac: `/dev/ttyUSB0@9600`.
  - **Por red**: `192.168.1.50:9100`.
  Si solo hay UNA impresora, pon la misma en todas.
- `server` + `bridgeKey`: con esto el puente se conecta al servidor y **cada
  comanda nueva se imprime sola** en su estación (comida a cocina, bebida a barra).
  No hace falta tener abierta la pantalla de Cocina/Barra en ninguna tablet.

## 3. Arrancar
```bash
cd print-bridge
npm install
node server.js
```
Debe decir `conectado al servidor, esperando comandas`. Deja esa máquina encendida.
**Windows, que arranque solo al prender la compu:**
1. Instala Node.js LTS desde nodejs.org (una sola vez).
2. Dentro de esta carpeta corre `npm install` (una sola vez).
3. Presiona `Win+R`, escribe `shell:startup` y Enter. Se abre la carpeta Inicio.
4. Arrastra ahí `iniciar-oculto.vbs` con clic derecho -> *Crear acceso directo aquí*.

Al iniciar sesión en Windows el puente arranca **oculto** (sin ventana, nadie lo
puede cerrar). Si se cae, se vuelve a levantar solo en 5 segundos. Los mensajes
quedan en `puente.log` (ábrelo con el Bloc de notas para ver errores).
Para detenerlo: Administrador de tareas -> *Node.js JavaScript Runtime* -> Finalizar
tarea (y también *Procesador de comandos de Windows*, o el .bat lo vuelve a abrir).
Para verlo en ventana (pruebas): doble clic en `iniciar-puente.bat`.
Para que no pida contraseña al prender, configura el inicio de sesión automático
de Windows (o usa una cuenta sin contraseña en esa compu).

## 4. Tablets
Las tablets ya no hablan con el puente directo: mandan el ticket al servidor
(`POST /orders/print`) y el servidor se lo pasa al puente por el WebSocket
(evento `imprimir`). Así:
- Las comandas se imprimen solas al enviarlas (cocina/barra).
- "Reimprimir" en Cocina/Barra y "Imprimir recibo" (impresora `caja`) imprimen
  directo, sin vista previa del navegador.
- En **Configuración** hay botones para probar cada impresora.
Si el puente está apagado, la tablet avisa "El puente de impresión no está conectado".

## 5. Probar sin la app
```bash
curl -X POST http://localhost:7070/print -H "Content-Type: application/json" \
  -d '{"station":"caja","text":"PRUEBA\n\nHola impresora\n"}'
```

Self-check del código (no imprime): `node test.js`.
