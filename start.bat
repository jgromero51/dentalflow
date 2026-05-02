@echo off
:: ============================================================
:: DentalFlow — Script de instalación y arranque (Windows)
:: Doble-click para ejecutar
:: ============================================================
title DentalFlow Setup
chcp 65001 >nul 2>&1

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║          🦷  DentalFlow Setup v1.1               ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: Verificar Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [!] Node.js NO encontrado.
    echo.
    echo  Por favor instalá Node.js desde:
    echo  https://nodejs.org  (versión LTS recomendada)
    echo.
    echo  Después de instalar, cerrá y volvé a ejecutar este script.
    echo.
    pause
    start https://nodejs.org
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  [✓] Node.js encontrado: %NODE_VER%

:: Verificar npm
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [!] npm no encontrado. Reinstalá Node.js.
    pause
    exit /b 1
)
echo  [✓] npm encontrado

:: Obtener IP local de la PC (para acceso desde iPhone)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1" ^| findstr /v "169.254"') do (
    set IP_RAW=%%a
    goto :got_ip
)
:got_ip
:: Quitar espacios del resultado
set LOCAL_IP=%IP_RAW: =%

:: Ir al directorio del script
cd /d "%~dp0"

:: Instalar dependencias del backend
echo.
echo  [→] Instalando dependencias del backend...
cd backend
npm install
if %ERRORLEVEL% NEQ 0 (
    echo  [!] Error al instalar dependencias
    pause
    exit /b 1
)
echo  [✓] Dependencias instaladas

:: Iniciar el servidor
echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║              DentalFlow está listo               ║
echo  ╠══════════════════════════════════════════════════╣
echo  ║                                                  ║
echo  ║  💻  Windows (este PC):                         ║
echo  ║      http://localhost:3000                       ║
echo  ║                                                  ║
echo  ║  📱  iPhone / iPad (misma red WiFi):             ║
if defined LOCAL_IP (
echo  ║      http://%LOCAL_IP%:3000
) else (
echo  ║      (No se detectó IP. Verificá WiFi)
)
echo  ║                                                  ║
echo  ║  ℹ️  En iPhone: Abrir Safari → ir a la URL →    ║
echo  ║     Compartir → "Añadir a pantalla de inicio"   ║
echo  ║                                                  ║
echo  ╚══════════════════════════════════════════════════╝
echo.
echo  Para cerrar el servidor presioná Ctrl+C
echo.

:: Abrir navegador en Windows
start http://localhost:3000

:: Iniciar servidor
node server.js

pause
