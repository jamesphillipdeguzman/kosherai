import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function auditTables() {
  const sql = neon(process.env.DATABASE_URL);
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log('PUBLIC TABLES (' + tables.length + '):', tables.map(t => t.table_name).join(', '));

  for (const { table_name } of tables) {
    const cols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = ${table_name}
      ORDER BY ordinal_position;
    `;
    let count = 'unknown';
    try {
      const c = await sql.query(`SELECT COUNT(*) as count FROM "${table_name}";`);
      count = c[0]?.count ?? c.rows?.[0]?.count;
    } catch (e) {
      count = `ERR: ${e.message}`;
    }
    console.log(`\n========================================`);
    console.log(`TABLE: "${table_name}" (Rows: ${count})`);
    console.log(`========================================`);
    for (const c of cols) {
      console.log(`  - ${c.column_name}: ${c.data_type} (${c.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'})`);
    }
  }
  console.log('\n--- SAMPLE USERS ---');
  const sampleUsers = await sql`SELECT id, name, email FROM "user" LIMIT 5;`;
  console.log(sampleUsers);

  console.log('\n--- SAMPLE TRIPS ---');
  const sampleTrips = await sql`SELECT id, user_id, date, store_name, total_amount_paid, items_count FROM shopping_trips LIMIT 10;`;
  console.log(sampleTrips);

  console.log('\n--- SAMPLE GROCERY PURCHASES ---');
  const samplePurchases = await sql`SELECT id, user_id, trip_id, name, unit_price, total_price, quantity FROM grocery_purchases LIMIT 10;`;
  console.log(samplePurchases);
  console.log('\n--- TARGET USER O60CsFIZ1P1Qiv7oQID1vlhN55vJmcrL ---');
  const targetUser = await sql`SELECT * FROM "user" WHERE id = 'O60CsFIZ1P1Qiv7oQID1vlhN55vJmcrL';`;
  console.log(targetUser);
  const targetUserInUsers = await sql`SELECT * FROM users WHERE id = 'O60CsFIZ1P1Qiv7oQID1vlhN55vJmcrL';`;
  console.log('In users table:', targetUserInUsers);
  const userTrips = await sql`SELECT * FROM shopping_trips WHERE user_id = 'O60CsFIZ1P1Qiv7oQID1vlhN55vJmcrL';`;
  console.log('Trips for user:', userTrips);
  const userWaste = await sql`SELECT * FROM food_waste_logs WHERE user_id = 'O60CsFIZ1P1Qiv7oQID1vlhN55vJmcrL';`;
  console.log('Waste for user:', userWaste);
  const userScans = await sql`SELECT * FROM scans WHERE user_id = 'O60CsFIZ1P1Qiv7oQID1vlhN55vJmcrL';`;
  console.log('Scans for user:', userScans);
  console.log('\n--- CHECK NULL USER_ID ROWS ---');
  const nullTrips = await sql`SELECT COUNT(*) FROM shopping_trips WHERE user_id IS NULL;`;
  console.log('Null user_id in shopping_trips:', nullTrips);
  const nullPurchases = await sql`SELECT COUNT(*) FROM grocery_purchases WHERE user_id IS NULL;`;
  console.log('Null user_id in grocery_purchases:', nullPurchases);
  const nullWaste = await sql`SELECT COUNT(*) FROM food_waste_logs WHERE user_id IS NULL;`;
  console.log('Null user_id in food_waste_logs:', nullWaste);
  const nullScans = await sql`SELECT COUNT(*) FROM scans WHERE user_id IS NULL;`;
  console.log('Null user_id in scans:', nullScans);
}

auditTables().catch(console.error);
