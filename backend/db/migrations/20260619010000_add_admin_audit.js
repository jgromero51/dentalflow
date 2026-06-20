/**
 * Migración: tabla `admin_audit` — registro de acciones del super admin.
 */
exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('admin_audit');
  if (!exists) {
    await knex.schema.createTable('admin_audit', t => {
      t.increments('id').primary();
      t.integer('admin_id').unsigned();
      t.string('admin_username');
      t.string('action').notNullable();      // create_user, reset_password, toggle_active, ...
      t.string('target_type');               // user, clinic, subscription
      t.integer('target_id');
      t.text('detail');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('admin_audit');
};
