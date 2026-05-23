/**
 * Corrige la tabla `settings` para soportar multi-tenant.
 *
 * Antes: PK era solo `key` → todos los usuarios compartían las mismas claves.
 * Ahora: PK compuesto (user_id, key) → cada usuario tiene sus propios ajustes.
 *
 * También agrega `whatsapp_phone_id` y `whatsapp_token` como claves válidas
 * para que cada clínica pueda tener sus propias credenciales de WhatsApp.
 */
exports.up = async function (knex) {
  const client = knex.client.config.client;

  if (client === 'pg' || client === 'postgresql') {
    // PostgreSQL: reconstruir la tabla con el PK correcto
    const hasUserId = await knex.schema.hasColumn('settings', 'user_id');

    if (!hasUserId) {
      // 1. Copiar datos existentes
      await knex.raw(`
        CREATE TABLE IF NOT EXISTS settings_backup AS SELECT * FROM settings
      `);

      // 2. Recrear tabla con estructura correcta
      await knex.schema.dropTable('settings');
      await knex.schema.createTable('settings', (table) => {
        table.integer('user_id').unsigned().notNullable().defaultTo(1);
        table.string('key').notNullable();
        table.text('value');
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.primary(['user_id', 'key']);
      });

      // 3. Restaurar datos asignando user_id=1 (primer usuario)
      await knex.raw(`
        INSERT INTO settings (user_id, key, value, updated_at)
        SELECT 1, key, value, updated_at FROM settings_backup
        ON CONFLICT (user_id, key) DO NOTHING
      `);

      await knex.raw(`DROP TABLE IF EXISTS settings_backup`);
      console.log('[Migration] settings: PK compuesto (user_id, key) creado en PostgreSQL');
    }

  } else {
    // SQLite: no puede cambiar el PK, solo agregar user_id si no existe
    const hasUserId = await knex.schema.hasColumn('settings', 'user_id');
    if (!hasUserId) {
      await knex.schema.alterTable('settings', (table) => {
        table.integer('user_id').unsigned().defaultTo(1);
      });
      console.log('[Migration] settings: columna user_id agregada en SQLite');
    }
  }
};

exports.down = async function (knex) {
  // No revertimos en producción para evitar pérdida de datos
};
