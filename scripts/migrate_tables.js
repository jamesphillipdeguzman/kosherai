import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function migrateTables() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('Ensuring user_id columns on shopping_trips, grocery_purchases, food_waste_logs, scans...');
  await sql`ALTER TABLE shopping_trips ADD COLUMN IF NOT EXISTS user_id TEXT;`;
  await sql`ALTER TABLE shopping_trips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;

  await sql`ALTER TABLE grocery_purchases ADD COLUMN IF NOT EXISTS user_id TEXT;`;
  await sql`ALTER TABLE grocery_purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;

  await sql`ALTER TABLE food_waste_logs ADD COLUMN IF NOT EXISTS user_id TEXT;`;
  await sql`ALTER TABLE food_waste_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;

  await sql`ALTER TABLE scans ADD COLUMN IF NOT EXISTS user_id TEXT;`;

  console.log('Ensuring household_inventory table exists...');
  await sql`
    CREATE TABLE IF NOT EXISTS household_inventory (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      category TEXT DEFAULT 'Other Perishables',
      quantity NUMERIC(10, 2) DEFAULT 1,
      original_quantity NUMERIC(10, 2) DEFAULT 1,
      consumed_quantity NUMERIC(10, 2) DEFAULT 0,
      wasted_quantity NUMERIC(10, 2) DEFAULT 0,
      unit TEXT DEFAULT 'pcs',
      purchase_date TEXT NOT NULL,
      expiration_date TEXT,
      storage_location TEXT DEFAULT 'Refrigerator',
      source TEXT DEFAULT 'manual',
      trip_id TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  await sql`ALTER TABLE household_inventory ADD COLUMN IF NOT EXISTS user_id TEXT;`;
  await sql`ALTER TABLE household_inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;

  console.log('Ensuring meal_plans table exists...');
  await sql`
    CREATE TABLE IF NOT EXISTS meal_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_week INTEGER DEFAULT 1,
      day_of_week TEXT DEFAULT 'Saturday',
      meal_type TEXT DEFAULT 'Dinner',
      dish_name TEXT NOT NULL,
      recipe_id TEXT,
      ingredients_needed JSONB DEFAULT '[]'::jsonb,
      allocated_grocery_item_ids JSONB DEFAULT '[]'::jsonb,
      lid_verified BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  console.log('Ensuring household_settings table exists...');
  await sql`
    CREATE TABLE IF NOT EXISTS household_settings (
      user_id TEXT PRIMARY KEY,
      household_members INTEGER DEFAULT 4,
      active_diet TEXT DEFAULT 'lid',
      theme TEXT DEFAULT 'dark',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  console.log('✅ All database tables and columns ensured successfully.');
}

migrateTables().catch(console.error);
