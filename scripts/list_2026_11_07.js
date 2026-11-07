import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT t.id, t.date, t.store_name, t.total_amount_paid, t.total_scale_weight_kg, t.created_at, 
           p.id as item_id, p.name, p.quantity, p.unit, p.unit_price, p.total_price 
    FROM shopping_trips t 
    LEFT JOIN grocery_purchases p ON p.trip_id = t.id 
    WHERE t.user_id = 'O60CsFIZ1P1Qiv7oQID1vlhN55vJmcrL' AND t.date = '2026-11-07' 
    ORDER BY t.created_at ASC;
  `;
  console.log(`Found ${rows.length} purchase rows on 2026-11-07:`);
  for (const r of rows) {
    console.log(`Trip ${r.id} | Store: ${r.store_name} | Amount: ₱${r.total_amount_paid} | Weight: ${r.total_scale_weight_kg}kg | Created: ${r.created_at}`);
    console.log(`   -> Item: ${r.name} | Qty: ${r.quantity} ${r.unit} | UnitPrice: ₱${r.unit_price} | LineTotal: ₱${r.total_price}`);
  }
}

run().catch(console.error);

