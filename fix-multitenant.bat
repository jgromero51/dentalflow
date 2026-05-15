@echo off
cd /d "C:\Users\USUARIO\Desktop\dental\dentalflow"

if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock

echo Subiendo commit multi-tenant a GitHub...
git push origin main

echo.
echo LISTO - Render va a deployar automaticamente
pause
