/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const has = await knex.schema.hasTable('treatment_catalog');
  if (!has) {
    await knex.schema.createTable('treatment_catalog', table => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable();
      table.string('nombre').notNullable();
      table.string('categoria').defaultTo('General');
      table.float('precio').notNullable().defaultTo(0);
      table.text('descripcion');
      table.timestamps(true, true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('treatment_catalog');
};
