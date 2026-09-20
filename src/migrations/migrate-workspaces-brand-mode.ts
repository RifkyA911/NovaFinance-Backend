import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Blackbird911@localhost:5432/novafinance_dev';
const sql = postgres(connectionString);

async function migrateWorkspacesBrandMode() {
  console.log("Running workspaces brand mode & display migration on novafinance_dev...");
  await sql`
    ALTER TABLE "workspaces"
      ADD COLUMN IF NOT EXISTS "custom_brand_mode" varchar(30) DEFAULT 'square',
      ADD COLUMN IF NOT EXISTS "custom_brand_display" varchar(30) DEFAULT 'logo-and-text';
  `;
  console.log("✅ Workspaces brand mode migration completed successfully!");
  await sql.end();
  process.exit(0);
}

migrateWorkspacesBrandMode().catch((err) => {
  console.error("❌ Workspaces brand mode migration failed:", err);
  process.exit(1);
});
