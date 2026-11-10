import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('No DATABASE_URL in process.env');
    return;
  }
  const sql = neon(dbUrl.trim());
  try {
    const rows = await sql`
      SELECT id, protocol_id, ingredient_id, public_id, secure_url, status, updated_at
      FROM ingredient_images
      ORDER BY updated_at DESC;
    `;
    console.log('Total mappings in DB:', rows.length);
    const lidRows = rows.filter(r => r.protocol_id === 'lid');
    console.log('LID mappings in DB:', lidRows.length);
    console.log('LID rows:');
    for (const r of lidRows) {
      console.log(`- ${r.ingredient_id} (${r.status}): ${r.secure_url}`);
    }
  } catch (err) {
    console.error('DB query error:', err.message);
  }
}

main();

