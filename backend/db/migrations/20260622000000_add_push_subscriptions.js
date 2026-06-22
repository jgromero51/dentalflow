/**
 * Migración: tabla `push_subscriptions` — suscripciones Web Push por usuario/dispositivo.
 */
exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('push_subscriptions');
  if (!exists) {
    await knex.schema.createTable('push_subscriptions', t => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable();
      t.text('endpoint').notNullable().unique();  // identifica la suscripción del dispositivo
      t.text('p256dh').notNullable();
      t.text('auth').notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.index('user_id');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('push_subscriptions');
};
