import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('No DATABASE_URL');
    return;
  }
  const sql = neon(dbUrl.trim());
  try {
    const cols = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'ingredient_images'
      ORDER BY ordinal_position;
    `;
    console.log('Columns:');
    console.table(cols);

    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'ingredient_images';
    `;
    console.log('Indexes:');
    console.table(indexes);

    const constraints = await sql`
      SELECT conname, contype, pg_get_constraintdef(oid)
      FROM pg_constraint
      WHERE conrelid = 'ingredient_images'::regclass;
    `;
    console.log('Constraints:');
    console.table(constraints);

    const tables = await sql`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
    `;
    console.log('Tables:', tables.map(t => t.table_name));
    const counts = await sql`
      SELECT protocol_id, count(*) FROM ingredient_images GROUP BY protocol_id;
    `;
    console.log('Counts by protocol_id:', counts);
  } catch (e) {
    console.error(e);
  }
}

main();
