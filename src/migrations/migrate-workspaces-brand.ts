import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Blackbird911@localhost:5432/novafinance_dev';
const sql = postgres(connectionString);

async function migrateWorkspacesBrand() {
  console.log("Running workspaces brand columns migration on novafinance_dev...");
  await sql`
    ALTER TABLE "workspaces"
      ADD COLUMN IF NOT EXISTS "custom_brand_logo" text,
      ADD COLUMN IF NOT EXISTS "custom_brand_name" varchar(255),
      ADD COLUMN IF NOT EXISTS "custom_brand_description" text,
      ADD COLUMN IF NOT EXISTS "custom_brand_jargon" varchar(255),
      ADD COLUMN IF NOT EXISTS "entity_type" varchar(50),
      ADD COLUMN IF NOT EXISTS "tax_id" varchar(100),
      ADD COLUMN IF NOT EXISTS "website_url" varchar(255);
  `;
  console.log("✅ Workspaces brand migration completed successfully!");
  await sql.end();
  process.exit(0);
}

migrateWorkspacesBrand().catch((err) => {
  console.error("❌ Workspaces brand migration failed:", err);
  process.exit(1);
});
