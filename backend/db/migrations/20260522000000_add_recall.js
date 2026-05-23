exports.up = async function(knex) {
  const has = await knex.schema.hasColumn('patients', 'recall_enviado_at');
  if (!has) {
    await knex.schema.alterTable('patients', table => {
      table.string('recall_enviado_at').nullable();
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.alterTable('patients', table => {
    table.dropColumn('recall_enviado_at');
  });
};
