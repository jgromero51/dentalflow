/**
 * DentalFlow — Middleware de Autenticación JWT
 *
 * Verifica que cada petición a rutas protegidas incluya
 * un token JWT válido en el header Authorization.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';

if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET no está configurado en las variables de entorno.');
  console.error('[FATAL] Generá uno con: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

/**
 * Genera un token JWT para el usuario dado.
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/**
 * Middleware: bloquea el acceso si no hay token válido.
 * Se aplica a todas las rutas de la API excepto /api/auth y /api/health.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No autorizado. Iniciá sesión primero.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesión expirada o token inválido. Volvé a iniciar sesión.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
}

module.exports = { signToken, requireAuth, requireAdmin };
