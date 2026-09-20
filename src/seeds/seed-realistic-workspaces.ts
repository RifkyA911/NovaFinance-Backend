import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Blackbird911@localhost:5432/novafinance_dev';
const sql = postgres(connectionString);

async function seedRealisticWorkspaces() {
  console.log('🚀 Starting realistic workspace seeding (Personal Finance & Business Finance)...');

  // 1. Get or identify Personal and Business Workspaces
  const workspaces = await sql`SELECT id, name, type, owner_id FROM "workspaces" WHERE "deleted_at" IS NULL`;
  if (workspaces.length === 0) {
    console.error('No workspaces found in database. Run basic seed first.');
    process.exit(1);
  }

  let personalWs = workspaces.find((w) => w.type === 'personal') || workspaces[0];
  let businessWs = workspaces.find((w) => w.type === 'pt' || w.type === 'umkm') || workspaces[1] || workspaces[0];

  console.log(`👤 Personal Workspace: ${personalWs.name} (${personalWs.id})`);
  console.log(`🏢 Business Workspace: ${businessWs.name} (${businessWs.id})`);

  // =========================================================================
  // 1. SEED PERSONAL FINANCE
  // =========================================================================
  console.log('\n--- Seeding Personal Finance Data ---');

  // Personal Accounts
  const personalAccountsData = [
    { name: 'BCA Prioritas', type: 'bank', balance: '84500000', accountNumber: '8820194821', bankName: 'BCA' },
    { name: 'Mandiri Wealth RDN', type: 'bank', balance: '120000000', accountNumber: '137001827461', bankName: 'Mandiri' },
    { name: 'GoPay Premium', type: 'ewallet', balance: '2750000', accountNumber: '081298765432', bankName: 'GoPay' },
    { name: 'Dompet Tunai (Cash)', type: 'cash', balance: '3500000', accountNumber: null, bankName: 'Cash' },
  ];

  const personalAccountIds: Record<string, string> = {};
  for (const acc of personalAccountsData) {
    const [existing] = await sql`
      SELECT id FROM "accounts" 
      WHERE "workspace_id" = ${personalWs.id} AND "name" = ${acc.name} AND "deleted_at" IS NULL
    `;
    if (existing) {
      personalAccountIds[acc.name] = existing.id;
      await sql`
        UPDATE "accounts" 
        SET "balance" = ${acc.balance}, "updated_at" = NOW()
        WHERE "id" = ${existing.id}
      `;
    } else {
      const [inserted] = await sql`
        INSERT INTO "accounts" (
          "workspace_id", "name", "type", "balance", "currency", "account_number", "bank_name", "created_at", "updated_at"
        ) VALUES (
          ${personalWs.id}, ${acc.name}, ${acc.type}, ${acc.balance}, 'IDR', ${acc.accountNumber}, ${acc.bankName}, NOW(), NOW()
        ) RETURNING id
      `;
      personalAccountIds[acc.name] = inserted.id;
    }
  }
  console.log('✅ Personal Accounts verified & updated:', Object.keys(personalAccountIds));

  // Personal Categories
  const personalCategoriesData = [
    { name: 'Gaji & Bonus Eksekutif', type: 'income', color: '#10b981', icon: 'Briefcase' },
    { name: 'Dividen Saham Bluechip', type: 'income', color: '#06b6d4', icon: 'TrendingUp' },
    { name: 'Konsultasi Finansial', type: 'income', color: '#8b5cf6', icon: 'Sparkles' },
    { name: 'Cicilan KPR & Utang', type: 'expense', color: '#ef4444', icon: 'Home' },
    { name: 'Belanja & Supermarket', type: 'expense', color: '#f59e0b', icon: 'ShoppingCart' },
    { name: 'Makanan & Restoran', type: 'expense', color: '#f97316', icon: 'Coffee' },
    { name: 'Transportasi & Bensin', type: 'expense', color: '#3b82f6', icon: 'Car' },
    { name: 'Gadget & Langganan SaaS', type: 'expense', color: '#a855f7', icon: 'Cpu' },
    { name: 'Hiburan & Liburan', type: 'expense', color: '#ec4899', icon: 'Plane' },
    { name: 'Asuransi & Medis', type: 'expense', color: '#14b8a6', icon: 'Shield' },
  ];

  const personalCatIds: Record<string, string> = {};
  for (const cat of personalCategoriesData) {
    const [existing] = await sql`
      SELECT id FROM "categories" 
      WHERE "workspace_id" = ${personalWs.id} AND "name" = ${cat.name}
    `;
    if (existing) {
      personalCatIds[cat.name] = existing.id;
    } else {
      const [inserted] = await sql`
        INSERT INTO "categories" (
          "workspace_id", "name", "type", "color", "icon", "created_at", "updated_at"
        ) VALUES (
          ${personalWs.id}, ${cat.name}, ${cat.type}, ${cat.color}, ${cat.icon}, NOW(), NOW()
        ) RETURNING id
      `;
      personalCatIds[cat.name] = inserted.id;
    }
  }
  console.log('✅ Personal Categories verified:', Object.keys(personalCatIds).length);

  // Personal Goals
  const personalGoalsData = [
    {
      title: 'Dana Darurat Likuid 12 Bulan',
      category: 'emergency',
      targetAmount: '120000000',
      currentAmount: '85000000',
      priority: 'urgent',
      status: 'in_progress',
      monthlyContributionPlanned: '5000000',
      notes: 'Disimpan di Reksadana Pasar Uang & Deposito Berjangka',
    },
    {
      title: 'Down Payment Rumah BSD Foresta',
      category: 'property',
      targetAmount: '1200000000',
      currentAmount: '450000000',
      priority: 'high',
      status: 'in_progress',
      monthlyContributionPlanned: '15000000',
      notes: 'Target transaksi Q4 2027',
    },
    {
      title: 'Liburan Musim Dingin Swiss & Alps',
      category: 'travel',
      targetAmount: '65000000',
      currentAmount: '42000000',
      priority: 'medium',
      status: 'in_progress',
      monthlyContributionPlanned: '3500000',
      notes: 'Rencana keberangkatan akhir tahun Desember',
    },
  ];

  for (const g of personalGoalsData) {
    const [existing] = await sql`
      SELECT id FROM "goals" WHERE "workspace_id" = ${personalWs.id} AND "title" = ${g.title}
    `;
    if (!existing) {
      await sql`
        INSERT INTO "goals" (
          "workspace_id", "title", "category", "target_amount", "current_amount", "priority", "status", "monthly_contribution_planned", "notes", "created_at", "updated_at"
        ) VALUES (
          ${personalWs.id}, ${g.title}, ${g.category}, ${g.targetAmount}, ${g.currentAmount}, ${g.priority}, ${g.status}, ${g.monthlyContributionPlanned}, ${g.notes}, NOW(), NOW()
        )
      `;
    }
  }
  console.log('✅ Personal Goals verified');

  // Personal Liabilities (KPR)
  const [existingLiab] = await sql`
    SELECT id FROM "liabilities" WHERE "workspace_id" = ${personalWs.id} AND "name" = 'KPR Rumah Tinggal BCA'
  `;
  if (!existingLiab) {
    await sql`
      INSERT INTO "liabilities" (
        "workspace_id", "name", "type", "principal_amount", "remaining_amount", "interest_rate", "monthly_payment", "tenor_months", "remaining_tenor_months", "due_date", "status", "lender_name", "notes", "created_at", "updated_at"
      ) VALUES (
        ${personalWs.id}, 'KPR Rumah Tinggal BCA', 'mortgage', '850000000', '620000000', '7.25', '5250000', 180, 132, 22, 'active', 'Bank BCA', 'Suku bunga fixed 3 tahun pertama dilanjutkan floating capped', NOW(), NOW()
      )
    `;
    console.log('✅ Personal KPR Liability seeded');
  }

  // Personal Transactions (Recent Realistic Activity)
  const personalTxData = [
    { desc: 'Gaji Bulanan Alexander', cat: 'Gaji & Bonus Eksekutif', acc: 'BCA Prioritas', amount: '35000000', type: 'income', daysAgo: 1 },
    { desc: 'Dividen Saham BBCA Q3', cat: 'Dividen Saham Bluechip', acc: 'Mandiri Wealth RDN', amount: '4500000', type: 'income', daysAgo: 3 },
    { desc: 'Cicilan KPR BCA Bulan Ini', cat: 'Cicilan KPR & Utang', acc: 'BCA Prioritas', amount: '5250000', type: 'expense', daysAgo: 2 },
    { desc: 'Belanja Mingguan GrandLucky SCBD', cat: 'Belanja & Supermarket', acc: 'BCA Prioritas', amount: '1850000', type: 'expense', daysAgo: 4 },
    { desc: 'Dinner Japanese Omakase Senopati', cat: 'Makanan & Restoran', acc: 'GoPay Premium', amount: '1200000', type: 'expense', daysAgo: 5 },
    { desc: 'Bensin Shell V-Power & Tol Jagorawi', cat: 'Transportasi & Bensin', acc: 'GoPay Premium', amount: '650000', type: 'expense', daysAgo: 6 },
    { desc: 'Langganan ChatGPT Plus & Claude Pro', cat: 'Gadget & Langganan SaaS', acc: 'BCA Prioritas', amount: '640000', type: 'expense', daysAgo: 8 },
    { desc: 'Tarik Tunai Keperluan Harian', cat: 'Transportasi & Bensin', acc: 'Dompet Tunai (Cash)', amount: '1500000', type: 'expense', daysAgo: 10 },
  ];

  for (const tx of personalTxData) {
    const accId = personalAccountIds[tx.acc];
    const catId = personalCatIds[tx.cat];
    if (accId && catId) {
      const txDate = new Date();
      txDate.setDate(txDate.getDate() - tx.daysAgo);
      const [existing] = await sql`
        SELECT id FROM "transactions" 
        WHERE "workspace_id" = ${personalWs.id} AND "description" = ${tx.desc}
      `;
      if (!existing) {
        await sql`
          INSERT INTO "transactions" (
            "workspace_id", "account_id", "category_id", "amount", "type", "description", "date", "created_at", "updated_at"
          ) VALUES (
            ${personalWs.id}, ${accId}, ${catId}, ${tx.amount}, ${tx.type}, ${tx.desc}, ${txDate}, NOW(), NOW()
          )
        `;
      }
    }
  }
  console.log('✅ Personal Transactions verified');

  // =========================================================================
  // 2. SEED BUSINESS FINANCE (NovaTech Holdings / PT)
  // =========================================================================
  console.log('\n--- Seeding Business Finance Data ---');

  // Business Accounts
  const businessAccountsData = [
    { name: 'Bank Mandiri Giro Operasional', type: 'bank', balance: '450000000', accountNumber: '137000998811', bankName: 'Bank Mandiri' },
    { name: 'BCA Escrow Payroll & Staff', type: 'bank', balance: '185000000', accountNumber: '8820019201', bankName: 'Bank BCA' },
    { name: 'Stripe Gateway Multi-Currency', type: 'ewallet', balance: '295000000', accountNumber: 'acct_1Hq92NovaStripe', bankName: 'Stripe' },
    { name: 'Petty Cash Operasional Kantor', type: 'cash', balance: '12000000', accountNumber: null, bankName: 'Cash' },
  ];

  const businessAccountIds: Record<string, string> = {};
  for (const acc of businessAccountsData) {
    const [existing] = await sql`
      SELECT id FROM "accounts" 
      WHERE "workspace_id" = ${businessWs.id} AND "name" = ${acc.name} AND "deleted_at" IS NULL
    `;
    if (existing) {
      businessAccountIds[acc.name] = existing.id;
      await sql`
        UPDATE "accounts" 
        SET "balance" = ${acc.balance}, "updated_at" = NOW()
        WHERE "id" = ${existing.id}
      `;
    } else {
      const [inserted] = await sql`
        INSERT INTO "accounts" (
          "workspace_id", "name", "type", "balance", "currency", "account_number", "bank_name", "created_at", "updated_at"
        ) VALUES (
          ${businessWs.id}, ${acc.name}, ${acc.type}, ${acc.balance}, 'IDR', ${acc.accountNumber}, ${acc.bankName}, NOW(), NOW()
        ) RETURNING id
      `;
      businessAccountIds[acc.name] = inserted.id;
    }
  }
  console.log('✅ Business Accounts verified & updated:', Object.keys(businessAccountIds));

  // Business Categories
  const businessCategoriesData = [
    { name: 'B2B Enterprise SaaS License', type: 'income', color: '#10b981', icon: 'Cpu' },
    { name: 'Jasa Konsultasi & SLA Deployment', type: 'income', color: '#3b82f6', icon: 'Sparkles' },
    { name: 'Gaji Karyawan & Bonus Tahunan', type: 'expense', color: '#ef4444', icon: 'Users' },
    { name: 'Infrastruktur Cloud (AWS/GCP)', type: 'expense', color: '#f59e0b', icon: 'Server' },
    { name: 'Sewa Kantor & Coworking Hub', type: 'expense', color: '#8b5cf6', icon: 'Building' },
    { name: 'Konsultan Pajak & Audit Legal', type: 'expense', color: '#6366f1', icon: 'Scale' },
    { name: 'Digital Ads & Growth Marketing', type: 'expense', color: '#ec4899', icon: 'TrendingUp' },
    { name: 'Hardware & Pengadaan Server', type: 'expense', color: '#14b8a6', icon: 'HardDrive' },
  ];

  const businessCatIds: Record<string, string> = {};
  for (const cat of businessCategoriesData) {
    const [existing] = await sql`
      SELECT id FROM "categories" 
      WHERE "workspace_id" = ${businessWs.id} AND "name" = ${cat.name}
    `;
    if (existing) {
      businessCatIds[cat.name] = existing.id;
    } else {
      const [inserted] = await sql`
        INSERT INTO "categories" (
          "workspace_id", "name", "type", "color", "icon", "created_at", "updated_at"
        ) VALUES (
          ${businessWs.id}, ${cat.name}, ${cat.type}, ${cat.color}, ${cat.icon}, NOW(), NOW()
        ) RETURNING id
      `;
      businessCatIds[cat.name] = inserted.id;
    }
  }
  console.log('✅ Business Categories verified:', Object.keys(businessCatIds).length);

  // Business Goals
  const businessGoalsData = [
    {
      title: 'Ekspansi Edge Node Data Center SG',
      category: 'investment',
      targetAmount: '500000000',
      currentAmount: '320000000',
      priority: 'high',
      status: 'in_progress',
      monthlyContributionPlanned: '30000000',
      notes: 'Deployment server Equinix Singapore Q1',
    },
    {
      title: 'Cadangan Kas Operasional (6 Bulan Runway)',
      category: 'emergency',
      targetAmount: '1200000000',
      currentAmount: '850000000',
      priority: 'urgent',
      status: 'in_progress',
      monthlyContributionPlanned: '50000000',
      notes: 'Buffer likuiditas gaji dan server multi-region',
    },
  ];

  for (const g of businessGoalsData) {
    const [existing] = await sql`
      SELECT id FROM "goals" WHERE "workspace_id" = ${businessWs.id} AND "title" = ${g.title}
    `;
    if (!existing) {
      await sql`
        INSERT INTO "goals" (
          "workspace_id", "title", "category", "target_amount", "current_amount", "priority", "status", "monthly_contribution_planned", "notes", "created_at", "updated_at"
        ) VALUES (
          ${businessWs.id}, ${g.title}, ${g.category}, ${g.targetAmount}, ${g.currentAmount}, ${g.priority}, ${g.status}, ${g.monthlyContributionPlanned}, ${g.notes}, NOW(), NOW()
        )
      `;
    }
  }
  console.log('✅ Business Goals verified');

  // Business Transactions
  const businessTxData = [
    { desc: 'Pembayaran Kontrak SaaS Tahunan PT Bank Mega', cat: 'B2B Enterprise SaaS License', acc: 'Bank Mandiri Giro Operasional', amount: '145000000', type: 'income', daysAgo: 2 },
    { desc: 'Inflow Stripe Subscriptions Global Tier', cat: 'B2B Enterprise SaaS License', acc: 'Stripe Gateway Multi-Currency', amount: '48500000', type: 'income', daysAgo: 4 },
    { desc: 'Payroll Staf Rekayasa & Produk Bulan Ini', cat: 'Gaji Karyawan & Bonus Tahunan', acc: 'BCA Escrow Payroll & Staff', amount: '82000000', type: 'expense', daysAgo: 3 },
    { desc: 'Tagihan AWS Multi-AZ Cluster Us-East-1', cat: 'Infrastruktur Cloud (AWS/GCP)', acc: 'Bank Mandiri Giro Operasional', amount: '28400000', type: 'expense', daysAgo: 5 },
    { desc: 'Sewa Ruang Kerja Co-working Pacific Century Place', cat: 'Sewa Kantor & Coworking Hub', acc: 'Bank Mandiri Giro Operasional', amount: '18500000', type: 'expense', daysAgo: 7 },
    { desc: 'Retainer Konsultan Pajak PPh 21/23 Ernst & Partners', cat: 'Konsultan Pajak & Audit Legal', acc: 'Bank Mandiri Giro Operasional', amount: '9500000', type: 'expense', daysAgo: 9 },
  ];

  for (const tx of businessTxData) {
    const accId = businessAccountIds[tx.acc];
    const catId = businessCatIds[tx.cat];
    if (accId && catId) {
      const txDate = new Date();
      txDate.setDate(txDate.getDate() - tx.daysAgo);
      const [existing] = await sql`
        SELECT id FROM "transactions" 
        WHERE "workspace_id" = ${businessWs.id} AND "description" = ${tx.desc}
      `;
      if (!existing) {
        await sql`
          INSERT INTO "transactions" (
            "workspace_id", "account_id", "category_id", "amount", "type", "description", "date", "created_at", "updated_at"
          ) VALUES (
            ${businessWs.id}, ${accId}, ${catId}, ${tx.amount}, ${tx.type}, ${tx.desc}, ${txDate}, NOW(), NOW()
          )
        `;
      }
    }
  }
  console.log('✅ Business Transactions verified');

  console.log('\n🎉 Realistic Personal and Business Finance seeding completed successfully!');
  await sql.end();
  process.exit(0);
}

seedRealisticWorkspaces().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
