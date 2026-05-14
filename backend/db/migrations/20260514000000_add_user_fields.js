/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('users', table => {
    table.string('email').unique();
    table.string('oauth_provider'); // 'google', 'apple', etc.
    table.string('oauth_id').unique(); // ID from the provider
    table.string('reset_token');
    table.timestamp('reset_expires');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('users', table => {
    table.dropColumn('email');
    table.dropColumn('oauth_provider');
    table.dropColumn('oauth_id');
    table.dropColumn('reset_token');
    table.dropColumn('reset_expires');
  });
};
