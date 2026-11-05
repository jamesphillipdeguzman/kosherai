import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

async function inspect() {
  const tables = ['users', 'shopping_trips', 'grocery_purchases', 'food_waste_logs', 'scans', 'recipe_comments'];
  for (const t of tables) {
    const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ${t}`;
    console.log(`Columns for ${t}:`, cols.map(c => `${c.column_name} (${c.data_type})`).join(', '));
  }
  const users = await sql`SELECT * FROM users`;
  console.log('Existing users count:', users.length, users);
  const tripsCount = await sql`SELECT COUNT(*), user_id FROM shopping_trips GROUP BY user_id`;
  console.log('Trips by user_id:', tripsCount);
}

inspect().catch(console.error);
