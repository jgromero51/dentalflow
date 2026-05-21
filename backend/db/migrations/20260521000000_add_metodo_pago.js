exports.up = async function(knex) {
  const has = await knex.schema.hasColumn('appointments', 'metodo_pago');
  if (!has) {
    await knex.schema.alterTable('appointments', table => {
      table.string('metodo_pago'); // efectivo | tarjeta | transferencia | yape | plin
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.alterTable('appointments', table => {
    table.dropColumn('metodo_pago');
  });
};
