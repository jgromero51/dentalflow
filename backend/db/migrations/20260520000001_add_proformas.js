exports.up = async function(knex) {
  const has = await knex.schema.hasTable('proformas');
  if (!has) {
    await knex.schema.createTable('proformas', table => {
      table.increments('id').primary();
      table.integer('patient_id').unsigned().notNullable();
      table.integer('user_id').unsigned().notNullable();
      table.string('estado').defaultTo('borrador'); // borrador | enviada
      table.text('items_json').notNullable();        // JSON array [{nombre, precio}]
      table.text('notas');
      table.float('total').defaultTo(0);
      table.timestamps(true, true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('proformas');
};
