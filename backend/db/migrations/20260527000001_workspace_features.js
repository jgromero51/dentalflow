/**
 * DentalFlow — Workspace features
 * - llegada_at en appointments (paciente llegó a la clínica)
 * - nota_recepcion en appointments (nota de secretaria para el doctor)
 * - en_consulta en users (doctor está en consulta activa)
 * - estado 'atendida' ya funciona como string en el campo existente
 */
exports.up = async function(knex) {
  // llegada_at y nota_recepcion en appointments
  const hasLlegada = await knex.schema.hasColumn('appointments', 'llegada_at');
  if (!hasLlegada) {
    await knex.schema.alterTable('appointments', t => {
      t.timestamp('llegada_at').nullable();
    });
  }

  const hasNota = await knex.schema.hasColumn('appointments', 'nota_recepcion');
  if (!hasNota) {
    await knex.schema.alterTable('appointments', t => {
      t.text('nota_recepcion').nullable();
    });
  }

  // en_consulta en users
  const hasConsulta = await knex.schema.hasColumn('users', 'en_consulta');
  if (!hasConsulta) {
    await knex.schema.alterTable('users', t => {
      t.boolean('en_consulta').defaultTo(false);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.alterTable('appointments', t => {
    t.dropColumn('llegada_at');
    t.dropColumn('nota_recepcion');
  });
  await knex.schema.alterTable('users', t => {
    t.dropColumn('en_consulta');
  });
};
