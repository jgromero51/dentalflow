/**
 * Migración: columna `active` en users.
 * Permite al super admin desactivar/reactivar cuentas sin borrarlas.
 */
exports.up = async function(knex) {
  const hasActive = await knex.schema.hasColumn('users', 'active');
  if (!hasActive) {
    await knex.schema.alterTable('users', table => {
      table.boolean('active').notNullable().defaultTo(true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.alterTable('users', table => table.dropColumn('active'));
};
