/**
 * Agrega invite_role a clinics para soporte de roles en invitaciones
 */
exports.up = async function(knex) {
  const has = await knex.schema.hasColumn('clinics', 'invite_role');
  if (!has) {
    await knex.schema.alterTable('clinics', t => {
      t.string('invite_role').defaultTo('doctor');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.alterTable('clinics', t => t.dropColumn('invite_role'));
};
