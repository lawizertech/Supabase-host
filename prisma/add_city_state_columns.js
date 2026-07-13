const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: DIRECT_URL or DATABASE_URL environment variable is missing.");
  process.exit(1);
}

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL database successfully.");

    console.log("Adding 'city' and 'state' columns if they do not exist...");
    await client.query("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;");
    await client.query("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state TEXT;");
    
    console.log("Database columns updated successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
