import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL.trim());
  await sql`
    INSERT INTO ingredient_images (
      id, protocol_id, ingredient_id, public_id, secure_url, asset_version, format, original_filename, status, updated_at
    ) VALUES (
      'img_lid_salt-kosher', 'lid', 'salt-kosher', 'kosherai/lid_protocol/ingredients/salt-kosher',
      'https://res.cloudinary.com/dego6hgcb/image/upload/v1794228286/kosherai/lid_protocol/ingredients/salt-kosher.webp',
      '1794228286', 'webp', 'salt-kosher.webp', 'active', NOW()
    )
    ON CONFLICT (protocol_id, ingredient_id) DO UPDATE SET
      public_id = EXCLUDED.public_id,
      secure_url = EXCLUDED.secure_url,
      asset_version = EXCLUDED.asset_version,
      format = EXCLUDED.format,
      original_filename = EXCLUDED.original_filename,
      status = EXCLUDED.status,
      updated_at = NOW();
  `;
  const count = await sql`SELECT count(*) FROM ingredient_images;`;
  console.log('Restored! Total mappings in DB:', count[0].count);
}

main();

