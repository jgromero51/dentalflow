/**
 * Migración: sistema de clínicas y roles multi-doctor
 *
 * - Crea tabla `clinics`
 * - Añade `clinic_id` y `doctor_name` a `users`
 * - Añade `clinic_id` a `patients` (pacientes compartidos por clínica)
 * - Añade `clinic_id` a `appointments`, `odontogram_marks`, `message_log`, `proformas`, `treatment_catalog`
 * - Crea una clínica por cada usuario existente (compatibilidad hacia atrás)
 */
exports.up = async function(knex) {
  // 1. Crear tabla clinics
  const hasClinics = await knex.schema.hasTable('clinics');
  if (!hasClinics) {
    await knex.schema.createTable('clinics', table => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.integer('owner_id').unsigned();
      table.string('invite_code').unique();
      table.timestamps(true, true);
    });
  }

  // 2. Añadir campos a users
  const hasClinicId = await knex.schema.hasColumn('users', 'clinic_id');
  if (!hasClinicId) {
    await knex.schema.alterTable('users', table => {
      table.integer('clinic_id').unsigned();
      table.string('doctor_name');
    });
  }

  // 3. Añadir clinic_id a patients
  const patientHasClinic = await knex.schema.hasColumn('patients', 'clinic_id');
  if (!patientHasClinic) {
    await knex.schema.alterTable('patients', table => {
      table.integer('clinic_id').unsigned();
    });
  }

  // 4. Añadir clinic_id a appointments
  const apptHasClinic = await knex.schema.hasColumn('appointments', 'clinic_id');
  if (!apptHasClinic) {
    await knex.schema.alterTable('appointments', table => {
      table.integer('clinic_id').unsigned();
    });
  }

  // 5. Añadir clinic_id a odontogram_marks
  const odontoHasClinic = await knex.schema.hasColumn('odontogram_marks', 'clinic_id');
  if (!odontoHasClinic) {
    await knex.schema.alterTable('odontogram_marks', table => {
      table.integer('clinic_id').unsigned();
    });
  }

  // 6. Añadir clinic_id a message_log
  const msgHasClinic = await knex.schema.hasColumn('message_log', 'clinic_id');
  if (!msgHasClinic) {
    await knex.schema.alterTable('message_log', table => {
      table.integer('clinic_id').unsigned();
    });
  }

  // 7. Añadir clinic_id a proformas (si existe)
  const hasProformas = await knex.schema.hasTable('proformas');
  if (hasProformas) {
    const proformaHasClinic = await knex.schema.hasColumn('proformas', 'clinic_id');
    if (!proformaHasClinic) {
      await knex.schema.alterTable('proformas', table => {
        table.integer('clinic_id').unsigned();
      });
    }
  }

  // 8. Añadir clinic_id a treatment_catalog (si existe)
  const hasCatalog = await knex.schema.hasTable('treatment_catalog');
  if (hasCatalog) {
    const catalogHasClinic = await knex.schema.hasColumn('treatment_catalog', 'clinic_id');
    if (!catalogHasClinic) {
      await knex.schema.alterTable('treatment_catalog', table => {
        table.integer('clinic_id').unsigned();
      });
    }
  }

  // 9. Para cada usuario existente sin clinic_id: crear su clínica y asignársela
  const users = await knex('users').whereNull('clinic_id').orWhere('clinic_id', 0);
  for (const user of users) {
    const clinicName = user.doctor_name || user.username;
    const [clinicId] = await knex('clinics').insert({
      name: clinicName,
      owner_id: user.id,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('id');
    const cid = typeof clinicId === 'object' ? clinicId.id : clinicId;

    await knex('users').where('id', user.id).update({ clinic_id: cid, role: 'owner' });

    // Propagar clinic_id a todos los datos del usuario
    await knex('patients').where('user_id', user.id).update({ clinic_id: cid });
    await knex('appointments').where('user_id', user.id).update({ clinic_id: cid });
    await knex('odontogram_marks').where('user_id', user.id).update({ clinic_id: cid });
    await knex('message_log').where('user_id', user.id).update({ clinic_id: cid });
    if (hasProformas) await knex('proformas').where('user_id', user.id).update({ clinic_id: cid });
    if (hasCatalog)  await knex('treatment_catalog').where('user_id', user.id).update({ clinic_id: cid });
  }
};

exports.down = async function(knex) {
  await knex.schema.alterTable('users', t => { t.dropColumn('clinic_id'); t.dropColumn('doctor_name'); });
  await knex.schema.alterTable('patients', t => t.dropColumn('clinic_id'));
  await knex.schema.alterTable('appointments', t => t.dropColumn('clinic_id'));
  await knex.schema.alterTable('odontogram_marks', t => t.dropColumn('clinic_id'));
  await knex.schema.alterTable('message_log', t => t.dropColumn('clinic_id'));
  await knex.schema.dropTableIfExists('clinics');
};
