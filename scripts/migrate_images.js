import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function migrateImagesToCloudinary() {
  const sql = neon(process.env.DATABASE_URL);
  const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const trips = await sql`
    SELECT id, store_name, receipt_image_url
    FROM shopping_trips
    WHERE receipt_image_url LIKE 'data:image%'
  `;

  console.log(`Found ${trips.length} trips with base64 images to migrate.`);

  for (const trip of trips) {
    try {
      console.log(`Uploading image for trip ${trip.id} (${trip.store_name})...`);
      const formData = new FormData();
      formData.append('file', trip.receipt_image_url);
      formData.append('upload_preset', preset);
      formData.append('folder', 'kosherai/receipts');

      const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;
      const res = await fetch(url, { method: 'POST', body: formData });
      
      if (!res.ok) {
        console.warn(`Failed to upload trip ${trip.id}: status ${res.status}`);
        continue;
      }

      const data = await res.json();
      const secureUrl = data.secure_url || data.url;
      console.log(`Uploaded: ${secureUrl}`);

      await sql`
        UPDATE shopping_trips 
        SET receipt_image_url = ${secureUrl}, updated_at = NOW() 
        WHERE id = ${trip.id}
      `;
      console.log(`Updated trip ${trip.id} in Neon with Cloudinary URL.`);
    } catch (err) {
      console.error(`Error migrating trip ${trip.id}:`, err);
    }
  }

  console.log('✅ Image migration complete.');
}

migrateImagesToCloudinary().catch(console.error);
