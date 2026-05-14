/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const hasPatients = await knex.schema.hasTable('patients');
  if (!hasPatients) {
    await knex.schema.createTable('patients', table => {
      table.increments('id').primary();
      table.string('nombre').notNullable();
      table.string('telefono').notNullable().unique();
      table.string('dni');
      table.text('notas');
      table.text('alergias');
      table.string('tipo_sangre');
      table.text('enfermedades_previas');
      table.timestamps(true, true);
    });
  }

  const hasAppointments = await knex.schema.hasTable('appointments');
  if (!hasAppointments) {
    await knex.schema.createTable('appointments', table => {
      table.increments('id').primary();
      table.integer('patient_id').unsigned().notNullable().references('id').inTable('patients').onDelete('CASCADE');
      table.string('fecha_hora_inicio').notNullable();
      table.integer('duracion_minutos').notNullable().defaultTo(30);
      table.text('descripcion');
      table.string('estado').notNullable().defaultTo('pendiente');
      table.integer('recordatorio_24h_enviado').notNullable().defaultTo(0);
      table.integer('recordatorio_4h_enviado').notNullable().defaultTo(0);
      table.float('costo_estimado').defaultTo(0);
      table.float('monto_pagado').defaultTo(0);
      table.timestamps(true, true);
    });
  }

  const hasMessageLog = await knex.schema.hasTable('message_log');
  if (!hasMessageLog) {
    await knex.schema.createTable('message_log', table => {
      table.increments('id').primary();
      table.integer('appointment_id');
      table.integer('patient_id');
      table.string('tipo').notNullable();
      table.text('mensaje').notNullable();
      table.integer('enviado').notNullable().defaultTo(0);
      table.text('error_detalle');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  const hasOdontogramMarks = await knex.schema.hasTable('odontogram_marks');
  if (!hasOdontogramMarks) {
    await knex.schema.createTable('odontogram_marks', table => {
      table.increments('id').primary();
      table.integer('patient_id').unsigned().notNullable().references('id').inTable('patients').onDelete('CASCADE');
      table.integer('diente_numero').notNullable();
      table.string('diagnostico').notNullable();
      table.text('notas');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  const hasSettings = await knex.schema.hasTable('settings');
  if (!hasSettings) {
    await knex.schema.createTable('settings', table => {
      table.string('key').primary();
      table.text('value');
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  const hasUsers = await knex.schema.hasTable('users');
  if (!hasUsers) {
    await knex.schema.createTable('users', table => {
      table.increments('id').primary();
      table.string('username').notNullable().unique();
      table.string('password_hash').notNullable();
      table.string('role').notNullable().defaultTo('admin');
      table.timestamps(true, true);
      table.timestamp('last_login');
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('users')
    .dropTableIfExists('settings')
    .dropTableIfExists('odontogram_marks')
    .dropTableIfExists('message_log')
    .dropTableIfExists('appointments')
    .dropTableIfExists('patients');
};
