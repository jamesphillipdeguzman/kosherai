import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function main() {
  const userId = 'O60CsFIZ1P1Qiv7oQID1vlhN55vJmcrL';

  const trips = await sql`
    SELECT id, user_id, date, store_name, trip_type, total_amount_paid, total_scale_weight_kg, receipt_image_url, items_count, notes, created_at, is_draft
    FROM shopping_trips
    WHERE user_id = ${userId}
    ORDER BY created_at DESC;
  `;

  const purchases = await sql`
    SELECT id, user_id, trip_id, purchase_date, name, quantity, unit, unit_price, total_price, weight_grams, category, created_at
    FROM grocery_purchases
    WHERE user_id = ${userId}
    ORDER BY created_at DESC;
  `;

  console.log('--- RECENT 10 TRIPS ---');
  trips.slice(0, 10).forEach(t => {
    const linked = purchases.filter(p => p.trip_id === t.id);
    console.log(`Trip ${t.id} [${t.date}] Store: "${t.store_name}" Total: ₱${t.total_amount_paid} Weight: ${t.total_scale_weight_kg}kg Notes: "${t.notes}" Image: ${t.receipt_image_url ? t.receipt_image_url.slice(0, 60) : 'none'} Created: ${t.created_at}`);
    linked.forEach(p => {
      console.log(`   -> Item: ${p.id} Name: "${p.name}" Qty: ${p.quantity} ${p.unit} Price: ₱${p.unit_price} Total: ₱${p.total_price}`);
    });
  });

  console.log('\n--- ALL PURCHASES WITH "PATA" OR "PORK" ---');
  purchases.filter(p => /pata|pork/i.test(p.name)).forEach(p => {
    console.log(`Item ${p.id} [${p.purchase_date}] Name: "${p.name}" Qty: ${p.quantity} ${p.unit} Total: ₱${p.total_price} TripId: ${p.trip_id} Created: ${p.created_at}`);
  });
}

main().catch(console.error);
