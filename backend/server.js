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
const settingsRouter         = require('./routes/settings');
const authRouter             = require('./routes/auth');
const messagesRouter         = require('./routes/messages');
const odontogramRouter       = require('./routes/odontogram');
const { requireAuth }          = require('./middleware/auth');
const { requireSubscription }  = require('./middleware/subscription');
const { clinicScope }          = require('./middleware/clinicScope');
const { initializeDatabase } = require('./db/database');
const { startScheduler }     = require('./services/scheduler');
const adminRouter            = require('./routes/admin');
const catalogRouter          = require('./routes/catalog');
const proformasRouter        = require('./routes/proformas');
const clinicRouter           = require('./routes/clinic');
const recallRouter           = require('./routes/recall');
const notificationsRouter    = require('./routes/notifications');
const exportRouter           = require('./routes/export');
const pushRouter             = require('./routes/push');

const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---- Guardas anti-caída: el proceso NO debe morir por un error no atrapado ----
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

// Aviso de configuración insegura en producción
if (process.env.NODE_ENV === 'production' && !process.env.WHATSAPP_APP_SECRET) {
  console.warn('[SEGURIDAD] ⚠️  Falta WHATSAPP_APP_SECRET — el webhook NO valida la firma de Meta (cualquiera podría enviar eventos falsos).');
}

// ---- Rate limiters ----
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ventana de 15 minutos
  max: 10,                   // máx 10 intentos por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Esperá 15 minutos.' },
  skipSuccessfulRequests: true, // no cuenta los logins exitosos
});

const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // ventana de 1 hora
  max: 5,                    // máx 5 creaciones de usuario por IP por hora
  message: { error: 'Demasiadas solicitudes de registro. Intentá más tarde.' },
});

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

// La API autentica con tokens Bearer (Authorization header), no con cookies de sesión,
// por lo que restringir el origin no aporta seguridad real (CORS no frena un Bearer-token API)
// y sí rompería la app móvil. Se refleja el origin de la petición.
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: true }));

// Servir panel de control maestro independiente
app.use('/admin-portal', express.static(path.join(__dirname, '../frontend/admin')));

// Servir frontend estático principal (App odontológica)
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// ---- Rutas API ----
// Públicas (no requieren token)
app.use('/api/auth/login',   loginLimiter);
app.use('/api/auth/setup',   setupLimiter);
app.use('/api/auth',         authRouter);
app.use('/api/webhook',      webhookRouter); // WhatsApp llama sin token

// Protegidas (requieren JWT + suscripción activa + scope de clínica)
app.use('/api/appointments', requireAuth, clinicScope, requireSubscription, appointmentsRouter);
app.use('/api/patients',     requireAuth, clinicScope, requireSubscription, patientsRouter);
app.use('/api/settings',     requireAuth, clinicScope, requireSubscription, settingsRouter);
app.use('/api/messages',     requireAuth, clinicScope, requireSubscription, messagesRouter);
app.use('/api/odontogram',   requireAuth, clinicScope, requireSubscription, odontogramRouter);
app.use('/api/catalog',      requireAuth, clinicScope, requireSubscription, catalogRouter);
app.use('/api/proformas',    requireAuth, clinicScope, requireSubscription, proformasRouter);
app.use('/api/clinic',       requireAuth, clinicScope, requireSubscription, clinicRouter);
app.use('/api/recall',       requireAuth, clinicScope, requireSubscription, recallRouter);
app.use('/api/notifications',requireAuth, clinicScope, requireSubscription, notificationsRouter);
app.use('/api/export',       requireAuth, clinicScope, requireSubscription, exportRouter);
app.use('/api/push',         requireAuth, pushRouter);
app.use('/api/admin',        adminRouter);

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
