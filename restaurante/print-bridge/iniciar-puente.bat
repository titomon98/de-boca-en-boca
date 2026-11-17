@echo off
rem Arranca el puente de impresion y lo vuelve a levantar si se cae.
rem Todo lo que pasa queda en puente.log (en esta misma carpeta).
title Puente de impresion - De Boca en Boca (no cerrar)
cd /d "%~dp0"

rem Buscar node.exe: PATH y carpetas de instalacion comunes.
set "NODE="
for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODE set "NODE=%%i"
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE if exist "%APPDATA%\nvm\current\node.exe" set "NODE=%APPDATA%\nvm\current\node.exe"
if not defined NODE if exist "%NVM_SYMLINK%\node.exe" set "NODE=%NVM_SYMLINK%\node.exe"
if not defined NODE (
  echo [%date% %time%] ERROR: no se encontro Node.js. Instalarlo desde nodejs.org ^(version LTS^) y volver a abrir. >> puente.log
  echo ERROR: no se encontro Node.js. Instalarlo desde nodejs.org y volver a abrir.
  ping -n 31 127.0.0.1 >nul
  exit /b 1
)
echo Puente de impresion corriendo con "%NODE%". Mensajes en: %~dp0puente.log

:loop
echo [%date% %time%] Iniciando puente >> puente.log
"%NODE%" server.js >> puente.log 2>&1
echo [%date% %time%] El puente se detuvo, reiniciando en 5 segundos >> puente.log
ping -n 6 127.0.0.1 >nul
goto loop
