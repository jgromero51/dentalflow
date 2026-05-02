#!/bin/bash
# DentalFlow — Script de inicio (macOS/Linux)
echo "🦷 DentalFlow — Iniciando..."
cd "$(dirname "$0")/backend"
if ! command -v node &> /dev/null; then
  echo "❌ Node.js no encontrado. Instalá desde https://nodejs.org"
  exit 1
fi
npm install && node server.js
