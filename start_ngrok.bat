@echo off
echo ========================================================
echo   Iniciando ngrok para DentalFlow (WhatsApp Webhooks)
echo ========================================================
echo.
echo Esto expondra tu servidor local (puerto 3000) a internet.
echo Usa la URL HTTPS proporcionada por ngrok en el panel de Meta.
echo.
echo Asegurate de tener ngrok instalado y autenticado (ngrok config add-authtoken).
echo.
ngrok http 3000
