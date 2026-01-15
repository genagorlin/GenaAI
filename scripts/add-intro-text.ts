import { pool } from '../server/db';

async function addIntroTextColumn() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE guided_exercises ADD COLUMN IF NOT EXISTS intro_text text DEFAULT ''`);
    console.log('Added intro_text column to guided_exercises');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

addIntroTextColumn();
