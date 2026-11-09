import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user';`;
  console.log('Columns in user:', cols.map(c => c.column_name));
  const users = await sql`SELECT id, name, email FROM "user" LIMIT 5;`;
  console.log('Sample users in user table:', users);
}

main().catch(console.error);
