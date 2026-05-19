/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const hasLeido = await knex.schema.hasColumn('message_log', 'leido');
  if (!hasLeido) {
    await knex.schema.alterTable('message_log', table => {
      table.integer('leido').defaultTo(0);
    });
  }
};

exports.down = function(knex) {
  return knex.schema.alterTable('message_log', table => {
    table.dropColumn('leido');
  });
};
