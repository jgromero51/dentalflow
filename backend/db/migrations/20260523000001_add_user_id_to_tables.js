/**
 * Agrega user_id a patients, appointments, message_log y odontogram_marks
 * donde falte (idempotente).
 */
exports.up = async function(knex) {
  const tables = ['patients', 'appointments', 'message_log', 'odontogram_marks'];
  for (const table of tables) {
    const exists = await knex.schema.hasTable(table);
    if (!exists) continue;
    const hasUserId = await knex.schema.hasColumn(table, 'user_id');
    if (!hasUserId) {
      await knex.schema.alterTable(table, t => {
        t.integer('user_id').unsigned().nullable();
      });
    }
  }
};

exports.down = async function(knex) {};
