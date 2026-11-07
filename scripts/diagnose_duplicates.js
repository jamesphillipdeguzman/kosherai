import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('Connecting to Neon PostgreSQL...');
  const trips = await sql`
    SELECT id, user_id, date, store_name, trip_type, total_amount_paid, total_scale_weight_kg, receipt_image_url, items_count, notes, created_at, is_draft
    FROM shopping_trips
    ORDER BY created_at DESC
    LIMIT 50;
  `;

  console.log(`Retrieved ${trips.length} recent shopping trips.`);
  console.log('--- RECENT SHOPPING TRIPS ---');
  console.log(JSON.stringify(trips.map(t => ({
    id: t.id,
    user_id: t.user_id,
    date: t.date,
    store_name: t.store_name,
    total_amount_paid: t.total_amount_paid,
    total_scale_weight_kg: t.total_scale_weight_kg,
    receipt_image_url: t.receipt_image_url ? t.receipt_image_url.slice(0, 50) + '...' : null,
    items_count: t.items_count,
    notes: t.notes,
    created_at: t.created_at,
    is_draft: t.is_draft
  })), null, 2));

  const allPurchases = await sql`
    SELECT id, user_id, trip_id, purchase_date, name, quantity, unit, unit_price, total_price, weight_grams, category, created_at
    FROM grocery_purchases
    ORDER BY created_at DESC
    LIMIT 100;
  `;

  console.log(`\nRetrieved ${allPurchases.length} recent grocery purchases.`);
  console.log('--- RECENT GROCERY PURCHASES ---');
  console.log(JSON.stringify(allPurchases, null, 2));
}

main().catch(console.error);

