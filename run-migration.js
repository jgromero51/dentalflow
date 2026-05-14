/**
 * Script de migracion manual — corre con: node run-migration.js
 */
const path = require('path');
const knexConfig = require('./knexfile');
const knex = require('knex')(knexConfig.development);

async function run() {
  try {
    console.log('Iniciando migracion multi-tenant...');

    const firstAdmin = await knex('users').orderBy('id', 'asc').first('id');
    const adminId = firstAdmin ? firstAdmin.id : 1;
    console.log('Admin ID:', adminId);

    // 1. patients
    const hasPatientsUID = await knex.schema.hasColumn('patients', 'user_id');
    if (!hasPatientsUID) {
      console.log('Agregando user_id a patients...');
      await knex.schema.alterTable('patients', table => {
        table.integer('user_id');
      });
      await knex('patients').whereNull('user_id').update({ user_id: adminId });
      console.log('  patients OK');
    } else {
      console.log('  patients ya tiene user_id, saltando');
    }

    // 2. appointments
    const hasApptsUID = await knex.schema.hasColumn('appointments', 'user_id');
    if (!hasApptsUID) {
      console.log('Agregando user_id a appointments...');
      await knex.schema.alterTable('appointments', table => {
        table.integer('user_id');
      });
      await knex('appointments').whereNull('user_id').update({ user_id: adminId });
      console.log('  appointments OK');
    } else {
      console.log('  appointments ya tiene user_id, saltando');
    }

    // 3. message_log
    const hasMsgUID = await knex.schema.hasColumn('message_log', 'user_id');
    if (!hasMsgUID) {
      console.log('Agregando user_id a message_log...');
      await knex.schema.alterTable('message_log', table => {
        table.integer('user_id');
      });
      await knex('message_log').whereNull('user_id').update({ user_id: adminId });
      console.log('  message_log OK');
    } else {
      console.log('  message_log ya tiene user_id, saltando');
    }

    // 4. odontogram_marks
    const hasOdoUID = await knex.schema.hasColumn('odontogram_marks', 'user_id');
    if (!hasOdoUID) {
      console.log('Agregando user_id a odontogram_marks...');
      await knex.schema.alterTable('odontogram_marks', table => {
        table.integer('user_id');
      });
      await knex('odontogram_marks').whereNull('user_id').update({ user_id: adminId });
      console.log('  odontogram_marks OK');
    } else {
      console.log('  odontogram_marks ya tiene user_id, saltando');
    }

    // 5. settings — recrear con PK compuesta (user_id, key)
    const hasSettingsUID = await knex.schema.hasColumn('settings', 'user_id');
    if (!hasSettingsUID) {
      console.log('Recreando settings con PK compuesta...');
      await knex.schema.createTable('settings_new', table => {
        table.integer('user_id').notNullable();
        table.string('key').notNullable();
        table.text('value');
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.primary(['user_id', 'key']);
      });
      await knex.raw(
        'INSERT INTO settings_new (user_id, key, value, updated_at) SELECT ?, key, value, updated_at FROM settings',
        [adminId]
      );
      const count = await knex('settings_new').count('* as n').first();
      console.log('  Filas migradas a settings_new:', count.n);
      await knex.schema.dropTable('settings');
      await knex.schema.renameTable('settings_new', 'settings');
      console.log('  settings OK');
    } else {
      console.log('  settings ya tiene user_id, saltando');
    }

    console.log('\nMigracion completada exitosamente!');
    console.log('Ahora reinicia el backend (npm start).');
  } catch (err) {
    console.error('Error en migracion:', err.message);
    console.error(err.stack);
  } finally {
    await knex.destroy();
  }
}

run();
