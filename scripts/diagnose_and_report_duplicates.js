import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function diagnose() {
  const sql = neon(process.env.DATABASE_URL);
  const userId = 'O60CsFIZ1P1Qiv7oQID1vlhN55vJmcrL';

  console.log('=== SHOPPING TRIPS FOR USER ===');
  const trips = await sql`
    SELECT id, date, project_week, store_name, trip_type, total_amount_paid, total_scale_weight_kg, items_count, notes, receipt_image_url, created_at
    FROM shopping_trips
    WHERE user_id = ${userId}
    ORDER BY date DESC, created_at DESC;
  `;
  console.log(`Total Trips: ${trips.length}`);

  const items = await sql`
    SELECT id, trip_id, name, quantity, unit, unit_price, total_price, weight_grams, created_at
    FROM grocery_purchases
    WHERE user_id = ${userId}
    ORDER BY created_at DESC;
  `;
  console.log(`Total Grocery Items: ${items.length}`);

  // Check for duplicate trips (same date, store, and total amount)
  const tripKeyMap = new Map();
  for (const t of trips) {
    const key = `${t.date}_${t.store_name}_${Number(t.total_amount_paid).toFixed(2)}_${Number(t.total_scale_weight_kg).toFixed(3)}`;
    if (!tripKeyMap.has(key)) tripKeyMap.set(key, []);
    tripKeyMap.get(key).push(t);
  }

  console.log('\n=== POTENTIAL DUPLICATE TRIPS (Identical date, store, amount, and weight) ===');
  let dupCount = 0;
  for (const [key, group] of tripKeyMap.entries()) {
    if (group.length > 1) {
      dupCount++;
      console.log(`\nDuplicate Group [${key}] (${group.length} records):`);
      for (const t of group) {
        const tripItems = items.filter(i => i.trip_id === t.id);
        console.log(`  - ID: ${t.id} | Created: ${t.created_at} | Image: ${t.receipt_image_url?.slice(0, 50)}...`);
        tripItems.forEach(i => console.log(`      Item: ${i.name} (${i.quantity} ${i.unit}) = ₱${i.total_price}`));
      }
    }
  }
  if (dupCount === 0) {
    console.log('No exact identical duplicate trips found.');
  }

  // Check for duplicate grocery items (same name, price, date across trips)
  const itemKeyMap = new Map();
  for (const i of items) {
    const key = `${i.name.trim().toLowerCase()}_${Number(i.total_price).toFixed(2)}`;
    if (!itemKeyMap.has(key)) itemKeyMap.set(key, []);
    itemKeyMap.get(key).push(i);
  }

  console.log('\n=== SAME-NAME SAME-PRICE GROCERY ITEMS ===');
  for (const [key, group] of itemKeyMap.entries()) {
    if (group.length > 1) {
      console.log(`Item "${key}" appeared ${group.length} times across trips:`);
      for (const i of group) {
        console.log(`  - ItemID: ${i.id} | TripID: ${i.trip_id} | Qty: ${i.quantity} | Total: ₱${i.total_price} | Created: ${i.created_at}`);
      }
    }
  }
}

diagnose().catch(console.error);

