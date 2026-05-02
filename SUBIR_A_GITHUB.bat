@echo off
cd /d "C:\Users\USUARIO\Desktop\antigravite\dentalflow"

git init
git checkout -b main 2>nul || git checkout main
git config user.email "usuario@dentalflow.local"
git config user.name "DentalFlow"
git add .
git commit -m "Lanzamiento DentalFlow"
git remote remove origin 2>nul
git remote add origin https://github.com/jgromeros51/dentalflow.git
git push -u origin main

echo.
echo PROCESO TERMINADO - Revisa si hubo errores arriba
pause
