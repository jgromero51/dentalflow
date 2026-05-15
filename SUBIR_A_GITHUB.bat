@echo off
cd /d "C:\Users\USUARIO\Desktop\dental\dentalflow"

git config user.email "joseromero5152@gmail.com"
git config user.name "DentalFlow"
git restore --staged . 2>nul
git add .
git commit -m "Actualizaciones: WhatsApp recordatorios, nombre clinica en header, nueva cita desde paciente"
git push -u origin main --force

echo.
echo PROCESO TERMINADO - Revisa si hubo errores arriba
pause
