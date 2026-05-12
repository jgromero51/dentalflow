/**
 * DentalFlow — Middleware de Autenticación JWT
 *
 * Verifica que cada petición a rutas protegidas incluya
 * un token JWT válido en el header Authorization.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET || 'dentalflow_jwt_secret_change_in_production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

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
