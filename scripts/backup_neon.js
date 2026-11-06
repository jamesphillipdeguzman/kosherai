import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';

async function backupNeonData() {
  const sql = neon(process.env.DATABASE_URL);
  
  const users = await sql`SELECT * FROM "user"`;
  const trips = await sql`SELECT * FROM shopping_trips`;
  const purchases = await sql`SELECT * FROM grocery_purchases`;
  const waste = await sql`SELECT * FROM food_waste_logs`;
  const scans = await sql`SELECT * FROM scans`;
  const inventory = await sql`SELECT * FROM household_inventory`.catch(() => []);

  const backup = {
    timestamp: new Date().toISOString(),
    usersCount: users.length,
    tripsCount: trips.length,
    purchasesCount: purchases.length,
    wasteCount: waste.length,
    scansCount: scans.length,
    inventoryCount: inventory.length,
    data: {
      users,
      trips,
      purchases,
      waste,
      scans,
      inventory
    }
  };

  const backupPath = 'scripts/neon_backup.json';
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');
  console.log(`✅ Neon backup successfully saved to ${backupPath}`);
  console.log(`Stats: ${trips.length} trips, ${purchases.length} purchases, ${waste.length} waste logs, ${scans.length} scans.`);
}

backupNeonData().catch(console.error);
