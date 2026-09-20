import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Blackbird911@localhost:5432/novafinance_dev';
const sql = postgres(connectionString);

const SYSTEM_MENUS = [
  // Overview
  { name: 'dashboard', label: 'Dashboard', labelEn: 'Dashboard', labelId: 'Dasbor', icon: 'LayoutDashboard', path: '/dashboard', group: 'overview', order: 1 },
  { name: 'transactions', label: 'Transactions', labelEn: 'Transactions', labelId: 'Transaksi', icon: 'Wallet', path: '/transactions', group: 'overview', order: 2 },
  { name: 'wallets', label: 'Wallets & Accounts', labelEn: 'Wallets & Accounts', labelId: 'Dompet & Rekening', icon: 'Landmark', path: '/wallets', group: 'overview', order: 3 },
  { name: 'analytics', label: 'Analytics', labelEn: 'Analytics', labelId: 'Analitik Keuangan', icon: 'PieChart', path: '/analytics', group: 'overview', order: 4 },

  // Planning & Assets
  { name: 'goals', label: 'Goals & Wishlist', labelEn: 'Goals & Wishlist', labelId: 'Target & Impian', icon: 'Target', path: '/goals', group: 'planning', order: 10 },
  { name: 'liabilities', label: 'Liabilities Matrix', labelEn: 'Liabilities Matrix', labelId: 'Matriks Utang & Cicilan', icon: 'Scale', path: '/liabilities', group: 'planning', order: 11 },
  { name: 'money-flow', label: 'Money Flow', labelEn: 'Money Flow', labelId: 'Alur Distribusi Kas', icon: 'Workflow', path: '/money-flow', group: 'planning', order: 12 },
  { name: 'portfolio', label: 'Portfolio', labelEn: 'Portfolio', labelId: 'Portofolio Investasi', icon: 'TrendingUp', path: '/portfolio', group: 'planning', order: 13 },
  { name: 'workspaces', label: 'Workspaces', labelEn: 'Workspaces', labelId: 'Manajemen Workspace', icon: 'Building2', path: '/workspaces', group: 'planning', order: 14 },

  // System & Governance
  { name: 'users', label: 'Users & RBAC', labelEn: 'Users & RBAC', labelId: 'Pengguna & Hak Akses', icon: 'Users', path: '/users', group: 'governance', order: 20 },
  { name: 'logs', label: 'Audit Logs', labelEn: 'Audit Logs', labelId: 'Log Audit & Forensik', icon: 'ScrollText', path: '/logs', group: 'governance', order: 21 },

  // Settings & Configuration
  { name: 'settings', label: 'Settings Hub', labelEn: 'Settings Hub', labelId: 'Pusat Pengaturan', icon: 'Settings', path: '/settings', group: 'configuration', order: 30 },
  { name: 'regional', label: 'Regional & Formatting', labelEn: 'Regional & Formatting', labelId: 'Format Regional & Waktu', icon: 'Globe', path: '/regional', group: 'configuration', order: 31 },
  { name: 'profile', label: 'User Profile', labelEn: 'User Profile', labelId: 'Profil Pengguna', icon: 'UserCheck', path: '/profile', group: 'configuration', order: 32 },
  { name: 'brand', label: 'Company Brand', labelEn: 'Company Brand', labelId: 'Identitas Brand', icon: 'Crown', path: '/brand', group: 'configuration', order: 33 },
  { name: 'appearance', label: 'Appearance', labelEn: 'Appearance', labelId: 'Tampilan & Tema', icon: 'Palette', path: '/appearance', group: 'configuration', order: 34 },
  { name: 'ai-hub', label: 'AI Hub & Copilot', labelEn: 'AI Hub & Copilot', labelId: 'AI Hub & Copilot', icon: 'Cpu', path: '/ai-hub', group: 'configuration', order: 35 },
  { name: 'security', label: 'Security & Vault', labelEn: 'Security & Vault', labelId: 'Keamanan & Vault', icon: 'ShieldCheck', path: '/security', group: 'configuration', order: 36 },
];

async function migrateAndSeedMenus() {
  console.log("Migrating menus table schema...");
  await sql`
    ALTER TABLE "menus"
      ADD COLUMN IF NOT EXISTS "label_en" varchar(100),
      ADD COLUMN IF NOT EXISTS "label_id" varchar(100);
  `;
  console.log("✅ menus table schema migrated successfully.");

  const workspaces = await sql`SELECT id, name FROM "workspaces" WHERE "deleted_at" IS NULL`;
  console.log(`Found ${workspaces.length} active workspaces.`);

  for (const ws of workspaces) {
    console.log(`Seeding menus for workspace: ${ws.name} (${ws.id})...`);
    // Delete existing menus for clean re-seed
    await sql`DELETE FROM "menus" WHERE "workspace_id" = ${ws.id}`;

    for (const m of SYSTEM_MENUS) {
      await sql`
        INSERT INTO "menus" (
          "workspace_id",
          "name",
          "label",
          "label_en",
          "label_id",
          "icon",
          "path",
          "group",
          "order",
          "is_active",
          "created_at",
          "updated_at"
        ) VALUES (
          ${ws.id},
          ${m.name},
          ${m.label},
          ${m.labelEn},
          ${m.labelId},
          ${m.icon},
          ${m.path},
          ${m.group},
          ${m.order},
          true,
          NOW(),
          NOW()
        );
      `;
    }
  }

  console.log("✅ All workspace menus successfully seeded with bilingual intl support!");
  await sql.end();
  process.exit(0);
}

migrateAndSeedMenus().catch((err) => {
  console.error("❌ Menu migration/seeding failed:", err);
  process.exit(1);
});
