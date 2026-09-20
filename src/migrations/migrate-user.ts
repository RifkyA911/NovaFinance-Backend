import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Blackbird911@localhost:5432/novafinance_dev';
const sql = postgres(connectionString);

async function migrateUser() {
  console.log("Running user profile migration on novafinance_dev...");
  await sql`
    ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "job_title" text,
      ADD COLUMN IF NOT EXISTS "department" text,
      ADD COLUMN IF NOT EXISTS "phone" text,
      ADD COLUMN IF NOT EXISTS "bio" text,
      ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'Asia/Jakarta',
      ADD COLUMN IF NOT EXISTS "lang" text DEFAULT 'id';
  `;
  console.log("✅ User profile migration completed successfully!");
  await sql.end();
  process.exit(0);
}

migrateUser().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
