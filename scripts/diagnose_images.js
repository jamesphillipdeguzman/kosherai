import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function main() {
  const userId = 'O60CsFIZ1P1Qiv7oQID1vlhN55vJmcrL';
  const trips = await sql`
    SELECT id, date, store_name, total_amount_paid, total_scale_weight_kg, receipt_image_url, notes, created_at
    FROM shopping_trips
    WHERE user_id = ${userId}
    ORDER BY created_at DESC;
  `;

  console.log(`User trips count: ${trips.length}`);
  const byImage = new Map();
  for (const t of trips) {
    const img = t.receipt_image_url || 'no_image';
    if (!byImage.has(img)) byImage.set(img, []);
    byImage.get(img).push(t);
  }

  console.log('--- TRIPS GROUPED BY RECEIPT IMAGE URL ---');
  for (const [img, list] of byImage.entries()) {
    if (list.length > 1) {
      console.log(`\nDuplicate Image (${list.length} trips share this image: ${img.slice(0, 75)}):`);
      list.forEach(t => console.log(`   Trip ${t.id} Date: ${t.date} Store: "${t.store_name}" Total: ${t.total_amount_paid} Created: ${t.created_at}`));
    }
  }

  console.log('\n--- ALL TRIPS WITH FULL IMAGE URLS ---');
  for (const t of trips) {
    console.log(`Trip ${t.id} | Date: ${t.date} | Store: ${t.store_name} | Total: ${t.total_amount_paid} | Weight: ${t.total_scale_weight_kg} | Img: ${t.receipt_image_url}`);
  }
}

main().catch(console.error);

