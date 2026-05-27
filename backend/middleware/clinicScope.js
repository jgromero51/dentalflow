/**
 * DentalFlow — Middleware: Clinic Data Scope
 *
 * Cuando un miembro de la clínica (doctor/receptionist) hace una petición,
 * redirige el user_id al del owner para que compartan los mismos datos.
 *
 * Resultado: secretaria y doctor ven exactamente los mismos pacientes,
 * citas, proformas, etc. sin tocar ninguna ruta existente.
 */
const { knex } = require('../db/database');

async function clinicScope(req, res, next) {
  if (!req.user) return next();

  // Owner y admin ya tienen scope correcto
  if (req.user.role === 'owner' || req.user.role === 'admin' || !req.user.clinic_id) {
    return next();
  }

  try {
    // Para doctor/receptionist: usar el user_id del owner de su clínica
    const owner = await knex('users')
      .where({ clinic_id: req.user.clinic_id, role: 'owner' })
      .select('id')
      .first();

    if (owner) {
      req.user._own_id     = req.user.id; // ID real del miembro (para logs)
      req.user._own_role   = req.user.role;
      req.user.id          = owner.id;    // Scope de datos → owner
    }
  } catch (err) {
    console.error('[clinicScope] Error:', err.message);
  }
  next();
}

/**
 * Restringe una ruta a roles específicos.
 * Usa _own_role para miembros de clínica (no el id redirigido).
 */
function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?._own_role || req.user?.role;
    if (roles.includes(role)) return next();
    res.status(403).json({ error: 'No tenés permisos para esta acción.' });
  };
}

module.exports = { clinicScope, requireRole };
