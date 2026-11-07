import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function main() {
  const allPata = await sql`
    SELECT gp.id as item_id, gp.name as item_name, gp.quantity, gp.unit, gp.unit_price, gp.total_price, gp.purchase_date, gp.user_id,
           st.id as trip_id, st.store_name, st.total_amount_paid, st.total_scale_weight_kg, st.receipt_image_url, st.created_at as trip_created_at
    FROM grocery_purchases gp
    LEFT JOIN shopping_trips st ON gp.trip_id = st.id
    WHERE gp.name ILIKE '%pata%' OR gp.name ILIKE '%pork%' OR gp.name ILIKE '%adobo%' OR gp.name ILIKE '%chicken%' OR gp.name ILIKE '%belly%'
    ORDER BY gp.purchase_date DESC, gp.created_at DESC;
  `;

  console.log(`Found ${allPata.length} meat items:`);
  console.table(allPata.map(p => ({
    user_id: p.user_id ? p.user_id.slice(0, 8) : null,
    trip_id: p.trip_id,
    item_id: p.item_id,
    name: p.item_name,
    date: p.purchase_date,
    qty: `${p.quantity} ${p.unit}`,
    price: p.unit_price,
    total: p.total_price,
    trip_total: p.total_amount_paid,
    trip_weight: p.total_scale_weight_kg,
    created: p.trip_created_at
  })));
}

main().catch(console.error);

