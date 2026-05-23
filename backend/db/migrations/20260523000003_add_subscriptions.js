exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('subscriptions');
  if (exists) return;

  await knex.schema.createTable('subscriptions', t => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().unique();
    t.enu('plan', ['starter', 'pro', 'clinica', 'cortesia']).defaultTo('starter');
    t.enu('status', ['trialing', 'active', 'past_due', 'cancelled']).defaultTo('trialing');
    t.timestamp('trial_ends_at').nullable();
    t.timestamp('cortesia_hasta').nullable();
    t.string('stripe_customer_id').nullable();
    t.string('stripe_subscription_id').nullable();
    t.timestamp('current_period_end').nullable();
    t.timestamps(true, true);
  });

  // Crear subscription trialing para usuarios ya existentes
  const users = await knex('users').select('id');
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);
  for (const user of users) {
    await knex('subscriptions').insert({
      user_id: user.id,
      plan: 'starter',
      status: 'trialing',
      trial_ends_at: trialEnd,
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('subscriptions');
};
