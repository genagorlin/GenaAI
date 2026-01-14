import { pool } from '../server/db';

async function createTables() {
  const client = await pool.connect();
  try {
    // Add timezone to clients
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York'`);
    console.log('Added timezone to clients');

    // Create reminder_templates
    await client.query(`
      CREATE TABLE IF NOT EXISTS reminder_templates (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        title text NOT NULL,
        subject text NOT NULL,
        body text NOT NULL,
        category text,
        is_active integer DEFAULT 1 NOT NULL,
        sort_order integer DEFAULT 0 NOT NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    console.log('Created reminder_templates');

    // Create client_reminders
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_reminders (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        client_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        template_id varchar NOT NULL REFERENCES reminder_templates(id) ON DELETE CASCADE,
        schedule_type text NOT NULL,
        schedule_days jsonb,
        schedule_time text NOT NULL,
        custom_interval_days integer,
        timezone text DEFAULT 'America/New_York' NOT NULL,
        is_enabled integer DEFAULT 1 NOT NULL,
        is_paused integer DEFAULT 0 NOT NULL,
        paused_until timestamp,
        last_sent_at timestamp,
        next_scheduled_at timestamp,
        subject_override text,
        body_override text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    console.log('Created client_reminders');

    // Create reminder_history
    await client.query(`
      CREATE TABLE IF NOT EXISTS reminder_history (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        client_reminder_id varchar NOT NULL REFERENCES client_reminders(id) ON DELETE CASCADE,
        client_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        template_id varchar REFERENCES reminder_templates(id) ON DELETE SET NULL,
        subject text NOT NULL,
        body text NOT NULL,
        recipient_email text NOT NULL,
        status text NOT NULL,
        error_message text,
        sent_at timestamp DEFAULT now()
      )
    `);
    console.log('Created reminder_history');

    console.log('All tables created successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

createTables();
