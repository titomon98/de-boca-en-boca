@echo off
rem Arranca el puente de impresion y lo vuelve a levantar si se cae.
rem Poner un acceso directo a este archivo en la carpeta de Inicio (Win+R -> shell:startup).
title Puente de impresion - De Boca en Boca (no cerrar)
cd /d "%~dp0"
:loop
node server.js
echo El puente se detuvo. Reiniciando en 5 segundos...
ping -n 6 127.0.0.1 >nul
goto loop
