/**
 * DentalFlow — Servidor Principal
 */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');
const os      = require('os');

const appointmentsRouter     = require('./routes/appointments');
const patientsRouter         = require('./routes/patients');
const webhookRouter          = require('./routes/webhook');
const { initializeDatabase } = require('./db/database');
const { startScheduler }     = require('./services/scheduler');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---- Middleware ----
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
// Obtener IP local para acceso desde dispositivos móviles
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}
const LOCAL_IP = getLocalIP();

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : true, // Permitir cualquier origen en desarrollo (incluye iPhone en red local)
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// ---- Rutas API ----
app.use('/api/appointments', appointmentsRouter);
app.use('/api/patients',     patientsRouter);
app.use('/api/webhook',      webhookRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', app: 'DentalFlow', version: '1.0.0', demoMode: process.env.DEMO_MODE === 'true' });
});

// ---- SPA fallback ----
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Ruta no encontrada' });
  }
});

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Error interno' });
});

// ============================================================
// ARRANQUE ASYNC — espera inicialización de sql.js
// ============================================================
(async () => {
  try {
    await initializeDatabase();

    // Escuchar en 0.0.0.0 para ser accesible desde iPhone/Android en la misma red
    app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('  ╔══════════════════════════════════════════════════╗');
      console.log('  ║          🦷  DentalFlow API v1.0                 ║');
      console.log('  ╚══════════════════════════════════════════════════╝');
      console.log(`  💻 Windows (local):  http://localhost:${PORT}`);
      console.log(`  📱 iPhone / Android: http://${LOCAL_IP}:${PORT}`);
      console.log(`  💬 WhatsApp: ${process.env.DEMO_MODE === 'true' ? '🔶 SIMULADO' : '✅ ACTIVO'}`);
      console.log('');
      startScheduler();
    });
  } catch (err) {
    console.error('[FATAL] Error al iniciar:', err.message);
    process.exit(1);
  }
})();

module.exports = app;
