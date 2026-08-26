import { query } from './src/database/db';

async function run() {
  try {
    console.log('Adding phone columns to users table...');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_phone TEXT');
    console.log('Success!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
