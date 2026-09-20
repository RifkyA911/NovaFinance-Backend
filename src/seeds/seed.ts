import { db } from '../auth/config';
import * as schema from '../db/schema';
import * as authSchema from '../db/auth-schema';
import { auth } from '../auth';

async function seed() {
  console.log('🌱 Starting comprehensive database seed for NovaFinance...');

  try {
    // 1. Clean existing data in dependency order
    console.log('🧹 Cleaning existing data...');
    await db.delete(schema.goals);
    await db.delete(schema.liabilities);
    await db.delete(schema.invoices);
    await db.delete(schema.transactions);
    await db.delete(schema.categories);
    await db.delete(schema.accounts);
    await db.delete(schema.collaborators);
    await db.delete(schema.menus);
    await db.delete(schema.workspaces);
    await db.delete(authSchema.user);
    await db.delete(authSchema.session);
    await db.delete(authSchema.account);
    console.log('✅ Database cleaned');

    // 2. Create users with better-auth API
    const users = [
      { email: 'admin@example.com', password: 'admin123', name: 'Alexander Vance' },
      { email: 'test@example.com', password: 'password123', name: 'Sofia Lestari' },
      { email: 'user@example.com', password: 'password123', name: 'Budi Pratama' },
      { email: 'staff@example.com', password: 'staff123', name: 'Siti Rahma' },
    ];

    const userIds: Record<string, string> = {};

    for (const userData of users) {
      const result = await auth.api.signUpEmail({
        body: {
          email: userData.email,
          password: userData.password,
          name: userData.name,
        },
      });

      if (result.user) {
        userIds[userData.email] = result.user.id;
        console.log('✅ User created:', userData.email);
      } else {
        console.error('❌ Failed to create user:', userData.email);
      }
    }

    const adminId = userIds['admin@example.com'];
    const testId = userIds['test@example.com'];
    const userId = userIds['user@example.com'];
    const staffId = userIds['staff@example.com'];

    // 3. Define 5 diverse, realistic workspaces (All accessible by admin)
    const workspaceDefs = [
      {
        ownerId: adminId,
        name: 'PT Nova Solusi Finansial',
        type: 'pt',
        currency: 'IDR',
        planTier: 'enterprise',
        entityType: 'PT',
        taxId: '01.234.567.8-012.000',
        websiteUrl: 'https://novafinance.id',
        customBrandLogo: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=280&auto=format&fit=crop&q=80',
        customBrandName: 'Nova Solusi Finansial',
        customBrandDescription: 'Holding Treasury Korporat & Manajemen Kas Terdesentralisasi',
        customBrandJargon: 'Corporate Cashflow Intelligence',
        customBrandMode: 'wide',
        customBrandDisplay: 'logo-and-text',
      },
      {
        ownerId: adminId,
        name: 'CV Starlight Media Kreatif',
        type: 'umkm',
        currency: 'IDR',
        planTier: 'pro',
        entityType: 'CV',
        taxId: '02.345.678.9-034.000',
        websiteUrl: 'https://starlightstudio.id',
        customBrandLogo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80',
        customBrandName: 'Starlight Creative Studio',
        customBrandDescription: 'Digital Production, Interactive Web & Design System Agency',
        customBrandJargon: 'Design Driven Growth',
        customBrandMode: 'square',
        customBrandDisplay: 'logo-and-text',
      },
      {
        ownerId: adminId,
        name: 'Nexus Venture Partners LP',
        type: 'pt',
        currency: 'USD',
        planTier: 'enterprise',
        entityType: 'LLC',
        taxId: 'US-EIN-98-7654321',
        websiteUrl: 'https://nexusvp.fund',
        customBrandLogo: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=280&auto=format&fit=crop&q=80',
        customBrandName: 'Nexus Global Ventures',
        customBrandDescription: 'Cross-Border Early Stage AI & Enterprise Infrastructure Fund',
        customBrandJargon: 'Backing Frontier Founders',
        customBrandMode: 'wide',
        customBrandDisplay: 'full-banner',
      },
      {
        ownerId: adminId,
        name: 'Vance Family Private Wealth',
        type: 'personal',
        currency: 'IDR',
        planTier: 'pro',
        entityType: 'Personal',
        taxId: '09.876.543.2-098.000',
        websiteUrl: '',
        customBrandLogo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&auto=format&fit=crop&q=80',
        customBrandName: 'Vance Wealth & Trust',
        customBrandDescription: 'Pengelolaan Portofolio Keluarga, Tabungan Pendidikan & Dana Pensiun',
        customBrandJargon: 'Preserve & Flourish',
        customBrandMode: 'square',
        customBrandDisplay: 'logo-and-text',
      },
      {
        ownerId: adminId,
        name: 'Kopi Selaras Nusantara',
        type: 'umkm',
        currency: 'IDR',
        planTier: 'basic',
        entityType: 'UMKM',
        taxId: '03.456.789.0-056.000',
        websiteUrl: 'https://kopiselaras.co.id',
        customBrandLogo: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=128&auto=format&fit=crop&q=80',
        customBrandName: 'Kopi Selaras',
        customBrandDescription: 'Kedai Kopi Spesialis & Roastery Artisan Nusantara',
        customBrandJargon: 'Dari Petani ke Cangkir',
        customBrandMode: 'square',
        customBrandDisplay: 'logo-only',
      },
    ];

    const createdWorkspaces: any[] = [];

    for (const wsData of workspaceDefs) {
      const [workspace] = await db.insert(schema.workspaces).values(wsData).returning();
      createdWorkspaces.push(workspace);

      // Add owner as collaborator
      await db.insert(schema.collaborators).values({
        workspaceId: workspace.id,
        userId: wsData.ownerId,
        role: 'owner',
        invitedBy: wsData.ownerId,
      });

      console.log(`✅ Workspace created: ${workspace.name} (${workspace.type.toUpperCase()} · ${workspace.currency})`);
    }

    const [wsCorp, wsStudio, wsFund, wsPersonal, wsCoffee] = createdWorkspaces;

    // Add collaborators to corporate and studio workspaces
    await db.insert(schema.collaborators).values([
      { workspaceId: wsCorp.id, userId: userId, role: 'admin', invitedBy: adminId },
      { workspaceId: wsCorp.id, userId: staffId, role: 'staff', invitedBy: adminId },
      { workspaceId: wsStudio.id, userId: testId, role: 'admin', invitedBy: adminId },
      { workspaceId: wsStudio.id, userId: userId, role: 'staff', invitedBy: adminId },
      { workspaceId: wsFund.id, userId: testId, role: 'viewer', invitedBy: adminId },
      { workspaceId: wsCoffee.id, userId: staffId, role: 'admin', invitedBy: adminId },
    ]);
    console.log('✅ Collaborators added across workspaces');

    // 4. Seed Dynamic Menus for ALL workspaces
    const fullMenuItems = [
      // Overview Group
      { name: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard', group: 'overview', order: 1 },
      { name: 'transactions', label: 'Transaksi', icon: 'Wallet', path: '/transactions', group: 'overview', order: 2 },
      { name: 'wallets', label: 'Dompet & Rekening', icon: 'Landmark', path: '/wallets', group: 'overview', order: 3 },
      { name: 'analytics', label: 'Analitik Keuangan', icon: 'PieChart', path: '/analytics', group: 'overview', order: 4 },

      // Planning & Assets Group
      { name: 'goals', label: 'Target & Impian', icon: 'Target', path: '/goals', group: 'planning', order: 5 },
      { name: 'liabilities', label: 'Liabilities Matrix', icon: 'Scale', path: '/liabilities', group: 'planning', order: 6 },
      { name: 'moneyflow', label: 'Topologi Arus Kas', icon: 'Workflow', path: '/money-flow', group: 'planning', order: 7 },
      { name: 'portfolio', label: 'Portofolio & Saham', icon: 'TrendingUp', path: '/portfolio', group: 'planning', order: 8 },
      { name: 'workspaces', label: 'Workspaces', icon: 'Building2', path: '/workspaces', group: 'planning', order: 9 },

      // Settings & Configuration Group
      { name: 'settings', label: 'Settings Hub', icon: 'Settings', path: '/settings', group: 'configuration', order: 10 },
      { name: 'profile', label: 'Profil Pengguna', icon: 'UserCheck', path: '/profile', group: 'configuration', order: 11 },
      { name: 'brand', label: 'Identitas Brand', icon: 'Crown', path: '/brand', group: 'configuration', order: 12 },
      { name: 'appearance', label: 'Tampilan & Tema', icon: 'Palette', path: '/appearance', group: 'configuration', order: 13 },
      { name: 'aihub', label: 'AI Hub & Copilot', icon: 'Cpu', path: '/ai-hub', group: 'configuration', order: 14 },
      { name: 'security', label: 'Keamanan & Vault', icon: 'ShieldCheck', path: '/security', group: 'configuration', order: 15 },

      // Governance & Access Group
      { name: 'users', label: 'Users & RBAC', icon: 'Users', path: '/users', group: 'governance', order: 16 },
      { name: 'logs', label: 'Audit Logs', icon: 'ScrollText', path: '/logs', group: 'governance', order: 17 },
    ];

    for (const ws of createdWorkspaces) {
      for (const menuItem of fullMenuItems) {
        await db.insert(schema.menus).values({
          workspaceId: ws.id,
          name: menuItem.name,
          label: menuItem.label,
          icon: menuItem.icon,
          path: menuItem.path,
          group: menuItem.group,
          order: menuItem.order,
          permissions: JSON.stringify(['read']),
          isActive: true,
        }).onConflictDoNothing();
      }
    }
    console.log(`✅ Menus created for all ${createdWorkspaces.length} workspaces`);

    // =========================================================================
    // 5. HELPER TO SEED WORKSPACE ECOSYSTEM
    // =========================================================================
    async function seedWorkspaceData(config: {
      workspaceId: string;
      currency: string;
      accounts: Array<{ name: string; type: string; balance: string; bankName?: string; accountNumber?: string }>;
      categories: Array<{ name: string; type: 'income' | 'expense'; color: string; icon: string }>;
      transactions: Array<{ cat: string; amount: string; type: 'income' | 'expense'; desc: string; daysAgo: number; platform?: string; invested?: string }>;
      goals: Array<{ title: string; category: string; target: string; current: string; priority: string; status: string; monthly: string; targetDays: number; notes: string }>;
      liabilities: Array<{ name: string; type: string; principal: string; remaining: string; rate: string; monthly: string; tenor: number; remTenor: number; dueDay: number; lender: string; notes: string }>;
      invoices?: Array<{ invNum: string; client: string; email: string; subtotal: string; tax: string; total: string; status: string; daysOffset: number }>;
    }) {
      const { workspaceId, currency } = config;

      // Seed Accounts
      const accMap: Record<string, string> = {};
      for (const acc of config.accounts) {
        const [inserted] = await db.insert(schema.accounts).values({
          workspaceId,
          name: acc.name,
          type: acc.type,
          balance: acc.balance,
          currency,
          bankName: acc.bankName || null,
          accountNumber: acc.accountNumber || null,
        }).returning();
        accMap[acc.name] = inserted.id;
      }

      // Seed Categories
      const catMap: Record<string, string> = {};
      for (const c of config.categories) {
        const [inserted] = await db.insert(schema.categories).values({
          workspaceId,
          name: c.name,
          type: c.type,
          color: c.color,
          icon: c.icon,
        }).returning();
        catMap[c.name] = inserted.id;
      }

      // Seed Transactions
      const now = Date.now();
      const accNames = Object.keys(accMap);
      const txRows: any[] = [];
      for (const tx of config.transactions) {
        const categoryId = catMap[tx.cat];
        const accountId = accMap[accNames[Math.floor(Math.random() * accNames.length)]];
        if (categoryId && accountId) {
          const txDate = new Date(now - tx.daysAgo * 24 * 60 * 60 * 1000);
          txRows.push({
            workspaceId,
            accountId,
            categoryId,
            amount: tx.amount,
            type: tx.type,
            description: tx.desc,
            date: txDate,
            invested: tx.invested || '0',
            platform: tx.platform || null,
            notes: `${tx.desc} · Transaksi terverifikasi`,
          });
        }
      }
      if (txRows.length > 0) {
        await db.insert(schema.transactions).values(txRows);
      }

      // Seed Goals
      let goalOrder = 1;
      for (const g of config.goals) {
        await db.insert(schema.goals).values({
          workspaceId,
          title: g.title,
          category: g.category,
          targetAmount: g.target,
          currentAmount: g.current,
          priority: g.priority,
          status: g.status,
          monthlyContributionPlanned: g.monthly,
          targetDate: new Date(now + g.targetDays * 24 * 60 * 60 * 1000),
          order: goalOrder++,
          notes: g.notes,
        });
      }

      // Seed Liabilities
      for (const l of config.liabilities) {
        await db.insert(schema.liabilities).values({
          workspaceId,
          name: l.name,
          type: l.type,
          principalAmount: l.principal,
          remainingAmount: l.remaining,
          interestRate: l.rate,
          monthlyPayment: l.monthly,
          tenorMonths: l.tenor,
          remainingTenorMonths: l.remTenor,
          dueDate: l.dueDay,
          status: 'active',
          lenderName: l.lender,
          notes: l.notes,
        });
      }

      // Seed Invoices (if any)
      if (config.invoices) {
        for (const inv of config.invoices) {
          await db.insert(schema.invoices).values({
            workspaceId,
            invoiceNumber: inv.invNum,
            clientName: inv.client,
            clientEmail: inv.email,
            status: inv.status,
            subtotal: inv.subtotal,
            tax: inv.tax,
            total: inv.total,
            items: [{ description: 'Professional Services', quantity: 1, price: inv.subtotal }],
            dueDate: new Date(now + inv.daysOffset * 24 * 60 * 60 * 1000),
            notes: `Faktur resmi diterbitkan untuk ${inv.client}`,
          });
        }
      }
    }

    // =========================================================================
    // WORKSPACE 1: PT NOVA SOLUSI FINANSIAL (ENTERPRISE CORPORATE TREASURY)
    // =========================================================================
    console.log('💼 Seeding PT Nova Solusi Finansial...');
    await seedWorkspaceData({
      workspaceId: wsCorp.id,
      currency: 'IDR',
      accounts: [
        { name: 'BCA Giro Utama Korporat', type: 'bank', balance: '4250000000', bankName: 'BCA', accountNumber: '7829-102-999' },
        { name: 'Mandiri Valas Treasury', type: 'bank', balance: '1850000000', bankName: 'Bank Mandiri', accountNumber: '138-00-9821-44' },
        { name: 'CIMB Niaga Payroll Escrow', type: 'bank', balance: '650000000', bankName: 'CIMB Niaga', accountNumber: '800-112-990-10' },
        { name: 'Brankas Kas Operasional', type: 'cash', balance: '45000000' },
      ],
      categories: [
        { name: 'Lisensi SaaS Enterprise', type: 'income', color: '#10B981', icon: '🏢' },
        { name: 'Konsultasi Cloud AI', type: 'income', color: '#3B82F6', icon: '🤖' },
        { name: 'Maintenance SLA Q3', type: 'income', color: '#8B5CF6', icon: '🛠️' },
        { name: 'Gaji & Payroll Engineering', type: 'expense', color: '#EF4444', icon: '👥' },
        { name: 'Server Infra AWS & GCP', type: 'expense', color: '#F59E0B', icon: '☁️' },
        { name: 'Sewa Gedung Menara Sudirman', type: 'expense', color: '#6366F1', icon: '🏬' },
        { name: 'Pajak PPh 21/23 & PPN', type: 'expense', color: '#EC4899', icon: '📑' },
        { name: 'Marketing & Strategic Event', type: 'expense', color: '#14B8A6', icon: '📢' },
      ],
      transactions: [
        { cat: 'Lisensi SaaS Enterprise', amount: '450000000', type: 'income', desc: 'Kontrak Tahunan PT Bank Nusantara', daysAgo: 3 },
        { cat: 'Lisensi SaaS Enterprise', amount: '280000000', type: 'income', desc: 'Perpanjangan Lisensi Telco Solusindo', daysAgo: 14 },
        { cat: 'Konsultasi Cloud AI', amount: '125000000', type: 'income', desc: 'Milestone 2 AI Predictive Pipeline', daysAgo: 21 },
        { cat: 'Maintenance SLA Q3', amount: '85000000', type: 'income', desc: 'SLA Support Bulanan Enterprise', daysAgo: 35 },
        { cat: 'Gaji & Payroll Engineering', amount: '320000000', type: 'expense', desc: 'Payroll 28 Karyawan Tech & Finance', daysAgo: 5 },
        { cat: 'Server Infra AWS & GCP', amount: '78000000', type: 'expense', desc: 'Biaya Compute Cluster & Vector DB', daysAgo: 9 },
        { cat: 'Sewa Gedung Menara Sudirman', amount: '110000000', type: 'expense', desc: 'Sewa Ruang Kantor Lantai 32', daysAgo: 18 },
        { cat: 'Pajak PPh 21/23 & PPN', amount: '64000000', type: 'expense', desc: 'Setoran Masa Pajak Kantor KPP Pratama', daysAgo: 28 },
        { cat: 'Marketing & Strategic Event', amount: '42000000', type: 'expense', desc: 'Sponsorship Fintech Summit Jakarta', daysAgo: 45 },
      ],
      goals: [
        { title: 'Cadangan Kas Operasional 12 Bulan', category: 'emergency', target: '3000000000', current: '2400000000', priority: 'urgent', status: 'in_progress', monthly: '200000000', targetDays: 180, notes: 'Liquidity buffer menghadapi volatilitas pasar.' },
        { title: 'Ekspansi Data Center On-Premises Tier 3', category: 'property', target: '1500000000', current: '850000000', priority: 'high', status: 'in_progress', monthly: '150000000', targetDays: 240, notes: 'Pengadaan server rack Dell PowerEdge & HSM.' },
        { title: 'Alokasi Bonus Deviden Saham 2026', category: 'investment', target: '2000000000', current: '1100000000', priority: 'medium', status: 'in_progress', monthly: '180000000', targetDays: 320, notes: 'Dividen payout untuk jajaran pemegang saham.' },
      ],
      liabilities: [
        { name: 'Kredit Sindikasi Bank Mandiri', type: 'business_loan', principal: '1200000000', remaining: '780000000', rate: '7.85', monthly: '38500000', tenor: 36, remTenor: 22, dueDay: 20, lender: 'Bank Mandiri', notes: 'Fasilitas kredit modal kerja pengembangan SaaS platform.' },
        { name: 'Lease Kontrak Hardware Rack Server', type: 'business_loan', principal: '450000000', remaining: '180000000', rate: '5.20', monthly: '16200000', tenor: 24, remTenor: 11, dueDay: 10, lender: 'PT Tokyo Leasing Indonesia', notes: 'Leasing GPU cluster server H100.' },
      ],
      invoices: [
        { invNum: 'INV/2026/NSF-091', client: 'PT Nusantara Sentra Logistik', email: 'finance@nusantara-logistics.com', subtotal: '180000000', tax: '19800000', total: '199800000', status: 'paid', daysOffset: -5 },
        { invNum: 'INV/2026/NSF-092', client: 'Bank Arthaland Digital', email: 'ap@arthaland.co.id', subtotal: '350000000', tax: '38500000', total: '388500000', status: 'unpaid', daysOffset: 12 },
      ],
    });

    // =========================================================================
    // WORKSPACE 2: CV STARLIGHT MEDIA KREATIF (CREATIVE & DESIGN STUDIO)
    // =========================================================================
    console.log('🎨 Seeding CV Starlight Media Kreatif...');
    await seedWorkspaceData({
      workspaceId: wsStudio.id,
      currency: 'IDR',
      accounts: [
        { name: 'BCA Bisnis Starlight', type: 'bank', balance: '340000000', bankName: 'BCA', accountNumber: '527-091-8822' },
        { name: 'Bank Jago Bisnis Kolaborasi', type: 'bank', balance: '85000000', bankName: 'Bank Jago', accountNumber: '1099-281-992' },
        { name: 'Dana Tim & Petty Cash', type: 'cash', balance: '12500000' },
      ],
      categories: [
        { name: 'Web & UI/UX Development', type: 'income', color: '#3B82F6', icon: '💻' },
        { name: 'Retainer Branding Desain', type: 'income', color: '#10B981', icon: '🎨' },
        { name: 'Produksi Video Animasi 3D', type: 'income', color: '#F59E0B', icon: '🎥' },
        { name: 'Gaji & Fee Freelancer', type: 'expense', color: '#EF4444', icon: '✍️' },
        { name: 'Langganan Adobe CC & Figma', type: 'expense', color: '#8B5CF6', icon: '⚡' },
        { name: 'Sewa Studio & Listrik', type: 'expense', color: '#6366F1', icon: '🏠' },
        { name: 'Snack, Kopi & Team Dinner', type: 'expense', color: '#EC4899', icon: '☕' },
      ],
      transactions: [
        { cat: 'Web & UI/UX Development', amount: '75000000', type: 'income', desc: 'Pelunasan Website E-Commerce Brand Fashion', daysAgo: 4 },
        { cat: 'Retainer Branding Desain', amount: '35000000', type: 'income', desc: 'Retainer Bulanan Social Media & Visual Brand', daysAgo: 11 },
        { cat: 'Produksi Video Animasi 3D', amount: '50000000', type: 'income', desc: 'DP 50% Video Explainer Launching Produk', daysAgo: 19 },
        { cat: 'Gaji & Fee Freelancer', amount: '48000000', type: 'expense', desc: 'Honor Desainer 3D & Frontend Dev Freelance', daysAgo: 6 },
        { cat: 'Langganan Adobe CC & Figma', amount: '7200000', type: 'expense', desc: 'Langganan Tim Figma Org & Adobe Suite', daysAgo: 15 },
        { cat: 'Sewa Studio & Listrik', amount: '18500000', type: 'expense', desc: 'Sewa Coworking Studio Senopati & AC', daysAgo: 22 },
        { cat: 'Snack, Kopi & Team Dinner', amount: '3800000', type: 'expense', desc: 'Dinner Perayaan Rilis Aplikasi Klien', daysAgo: 27 },
      ],
      goals: [
        { title: 'Upgrade Workstation Apple M4 Max', category: 'gadget', target: '95000000', current: '68000000', priority: 'high', status: 'in_progress', monthly: '12000000', targetDays: 90, notes: '2 unit workstation untuk rendering blender.' },
        { title: 'Dana Liburan Tim Studio ke Bali', category: 'travel', target: '45000000', current: '32000000', priority: 'medium', status: 'in_progress', monthly: '6000000', targetDays: 120, notes: 'Team outing akhir tahun di Canggu.' },
      ],
      liabilities: [
        { name: 'Cicilan Kamera Sony FX6 & Lensa G-Master', type: 'credit_card', principal: '60000000', remaining: '22000000', rate: '0.00', monthly: '5000000', tenor: 12, remTenor: 5, dueDay: 15, lender: 'BCA Blibli 0%', notes: 'Kamera sinematik studio profesional.' },
      ],
      invoices: [
        { invNum: 'INV/SL/2026-033', client: 'PT Makmur Lestari Retail', email: 'marketing@makmurlestari.com', subtotal: '65000000', tax: '7150000', total: '72150000', status: 'unpaid', daysOffset: 10 },
      ],
    });

    // =========================================================================
    // WORKSPACE 3: NEXUS GLOBAL VENTURE PARTNERS (CROSS-BORDER VC FUND - USD)
    // =========================================================================
    console.log('🚀 Seeding Nexus Venture Partners LP (USD)...');
    await seedWorkspaceData({
      workspaceId: wsFund.id,
      currency: 'USD',
      accounts: [
        { name: 'Silicon Valley Bank (SVB) Operating', type: 'bank', balance: '1240000.00', bankName: 'First Citizens SVB', accountNumber: 'US-SVB-99210-44' },
        { name: 'JPMorgan Chase Fund Treasury', type: 'bank', balance: '4850000.00', bankName: 'JPMorgan Chase', accountNumber: 'JPMC-00192-882' },
        { name: 'Stripe Treasury Reserve', type: 'bank', balance: '185000.00', bankName: 'Stripe Treasury', accountNumber: 'STR-USD-10291' },
      ],
      categories: [
        { name: 'LP Capital Calls', type: 'income', color: '#10B981', icon: '🏛️' },
        { name: 'Management Fees Q3', type: 'income', color: '#3B82F6', icon: '💼' },
        { name: 'Syndicate Portfolio Exit', type: 'income', color: '#8B5CF6', icon: '🚀' },
        { name: 'Seed Stage Investment Payout', type: 'expense', color: '#EF4444', icon: '🌱' },
        { name: 'Legal Due Diligence & Audit', type: 'expense', color: '#F59E0B', icon: '⚖️' },
        { name: 'Global Founder Sourcing Travel', type: 'expense', color: '#6366F1', icon: '✈️' },
        { name: 'Fund Administration & Carta', type: 'expense', color: '#EC4899', icon: '📊' },
      ],
      transactions: [
        { cat: 'LP Capital Calls', amount: '750000.00', type: 'income', desc: 'Drawdown Capital Call Tranche 4 Sovereign LP', daysAgo: 8 },
        { cat: 'Management Fees Q3', amount: '95000.00', type: 'income', desc: '2% Annual Management Fee Drawdown', daysAgo: 20 },
        { cat: 'Syndicate Portfolio Exit', amount: '420000.00', type: 'income', desc: 'Series B Secondary Exit Payout (Fintech Seed)', daysAgo: 38, platform: 'AngelList', invested: '100000.00' },
        { cat: 'Seed Stage Investment Payout', amount: '250000.00', type: 'expense', desc: 'SAFE Round AI Agent Orchestrator Tech', daysAgo: 5, platform: 'SAFE Note', invested: '250000.00' },
        { cat: 'Seed Stage Investment Payout', amount: '150000.00', type: 'expense', desc: 'Pre-seed Check to Open-Source DevTools Co', daysAgo: 16, platform: 'SAFE Note', invested: '150000.00' },
        { cat: 'Legal Due Diligence & Audit', amount: '28000.00', type: 'expense', desc: 'Latham & Watkins Delaware Fund Counsel', daysAgo: 24 },
        { cat: 'Global Founder Sourcing Travel', amount: '14500.00', type: 'expense', desc: 'Flights & Hotel TechCrunch Disrupt San Francisco', daysAgo: 30 },
        { cat: 'Fund Administration & Carta', amount: '8500.00', type: 'expense', desc: 'Carta Cap Table & Tax K-1 Preparation', daysAgo: 40 },
      ],
      goals: [
        { title: 'Fund II Deployment Target ($10M)', category: 'investment', target: '10000000', current: '6250000', priority: 'high', status: 'in_progress', monthly: '400000', targetDays: 360, notes: 'Deploying into early stage Enterprise AI startups.' },
        { title: 'Follow-On Reserve Pool Fund I', category: 'emergency', target: '2500000', current: '1850000', priority: 'urgent', status: 'in_progress', monthly: '150000', targetDays: 180, notes: 'Pro-rata defense for Series A portfolio winners.' },
      ],
      liabilities: [
        { name: 'Silicon Valley Capital Call Line of Credit', type: 'business_loan', principal: '1000000.00', remaining: '320000.00', rate: '6.25', monthly: '45000.00', tenor: 24, remTenor: 8, dueDay: 28, lender: 'SVB First Citizens', notes: 'Short-term bridge facility for fast portfolio funding.' },
      ],
      invoices: [
        { invNum: 'NVP-LP-CALL-2026-04', client: 'Horizon Family Office Singapore', email: 'lp@horizonfo.sg', subtotal: '250000.00', tax: '0.00', total: '250000.00', status: 'paid', daysOffset: -10 },
      ],
    });

    // =========================================================================
    // WORKSPACE 4: VANCE FAMILY PRIVATE WEALTH (PERSONAL & WEALTH MANAGEMENT)
    // =========================================================================
    console.log('🏡 Seeding Vance Family Private Wealth...');
    await seedWorkspaceData({
      workspaceId: wsPersonal.id,
      currency: 'IDR',
      accounts: [
        { name: 'BCA Prioritas Tabungan', type: 'bank', balance: '185000000', bankName: 'BCA', accountNumber: '210-992-182' },
        { name: 'BNI Deposito Berjangka', type: 'bank', balance: '300000000', bankName: 'BNI', accountNumber: '088-291-0021' },
        { name: 'Bibit Reksadana & SBN', type: 'ewallet', balance: '145000000', bankName: 'Bibit / Bareksa' },
        { name: 'Dompet Tunai & Safe Deposit', type: 'cash', balance: '8500000' },
      ],
      categories: [
        { name: 'Gaji Eksekutif & Direksi', type: 'income', color: '#10B981', icon: '💰' },
        { name: 'Dividen Saham BBCA & BMRI', type: 'income', color: '#3B82F6', icon: '📈' },
        { name: 'Sewa Ruko & Properti Pasif', type: 'income', color: '#8B5CF6', icon: '🏬' },
        { name: 'Belanja Dapur & Supermarket', type: 'expense', color: '#EF4444', icon: '🛒' },
        { name: 'Sekolah Anak & Kursus', type: 'expense', color: '#F59E0B', icon: '🎓' },
        { name: 'Kuliner Akhir Pekan & Kafe', type: 'expense', color: '#EC4899', icon: '🍽️' },
        { name: 'Bensin & Servis Mobil Lexus', type: 'expense', color: '#6366F1', icon: '🚗' },
        { name: 'Asuransi Kesehatan Keluarga', type: 'expense', color: '#14B8A6', icon: '🏥' },
      ],
      transactions: [
        { cat: 'Gaji Eksekutif & Direksi', amount: '85000000', type: 'income', desc: 'Transfer Gaji Bulanan Direktur Utama', daysAgo: 2 },
        { cat: 'Dividen Saham BBCA & BMRI', amount: '42500000', type: 'income', desc: 'Dividen Tunai Interim Semester I', daysAgo: 15, platform: 'Ajaib / Stockbit', invested: '650000000' },
        { cat: 'Sewa Ruko & Properti Pasif', amount: '25000000', type: 'income', desc: 'Pendapatan Sewa Ruko Gading Serpong', daysAgo: 28 },
        { cat: 'Belanja Dapur & Supermarket', amount: '4800000', type: 'expense', desc: 'Belanja Mingguan Ranch Market & Segar', daysAgo: 4 },
        { cat: 'Sekolah Anak & Kursus', amount: '16500000', type: 'expense', desc: 'SPP Sekolah Internasional Jakarta', daysAgo: 10 },
        { cat: 'Kuliner Akhir Pekan & Kafe', amount: '2400000', type: 'expense', desc: 'Dinner Keluarga Senopati Steakhouse', daysAgo: 7 },
        { cat: 'Bensin & Servis Mobil Lexus', amount: '3600000', type: 'expense', desc: 'Servis Berkala & Bahan Bakar Pertamax Turbo', daysAgo: 18 },
        { cat: 'Asuransi Kesehatan Keluarga', amount: '8200000', type: 'expense', desc: 'Premi Asuransi Prudential Premier Hospital', daysAgo: 25 },
      ],
      goals: [
        { title: 'Dana Pensiun Mandiri 2035 (FIRE)', category: 'retirement', target: '2500000000', current: '820000000', priority: 'high', status: 'in_progress', monthly: '25000000', targetDays: 1400, notes: 'Portofolio dividen saham & emas batangan Antam.' },
        { title: 'Liburan Musim Dingin Tokyo & Hokkaido', category: 'travel', target: '65000000', current: '42000000', priority: 'medium', status: 'in_progress', monthly: '8000000', targetDays: 95, notes: 'Tiket business class ANA & JR Shinkansen pass.' },
        { title: 'Renovasi Interior Villa Ubud Bali', category: 'property', target: '180000000', current: '95000000', priority: 'low', status: 'in_progress', monthly: '15000000', targetDays: 180, notes: 'Kombinasi modern tropical villa private pool.' },
      ],
      liabilities: [
        { name: 'KPR BTN Syariah - Hunian Grand Menteng', type: 'mortgage', principal: '1400000000', remaining: '820000000', rate: '6.50', monthly: '11200000', tenor: 180, remTenor: 98, dueDay: 8, lender: 'BTN Syariah', notes: 'Pembiayaan rumah tinggal keluarga di Menteng.' },
      ],
    });

    // =========================================================================
    // WORKSPACE 5: KOPI SELARAS NUSANTARA (COFFEE SHOP UMKM CHAIN)
    // =========================================================================
    console.log('☕ Seeding Kopi Selaras Nusantara...');
    await seedWorkspaceData({
      workspaceId: wsCoffee.id,
      currency: 'IDR',
      accounts: [
        { name: 'BCA Kasir Toko Senopati', type: 'bank', balance: '68000000', bankName: 'BCA', accountNumber: '682-119-0021' },
        { name: 'QRIS & EDC ShopeePay / GoPay', type: 'ewallet', balance: '24500000', bankName: 'Midtrans QRIS' },
        { name: 'Laci Kasir Tunai Toko', type: 'cash', balance: '4500000' },
      ],
      categories: [
        { name: 'Omset Penjualan Minuman & Biji', type: 'income', color: '#10B981', icon: '☕' },
        { name: 'Pesanan Katering Kantor', type: 'income', color: '#3B82F6', icon: '🥐' },
        { name: 'Beli Biji Kopi Arabika Gayo & Flores', type: 'expense', color: '#EF4444', icon: '🌱' },
        { name: 'Susu Fresh Milk & Sirup', type: 'expense', color: '#F59E0B', icon: '🥛' },
        { name: 'Gaji Barista & Tim Dapur', type: 'expense', color: '#6366F1', icon: '🧑‍🍳' },
        { name: 'Sewa Outlet & Listrik', type: 'expense', color: '#EC4899', icon: '⚡' },
        { name: 'Cup, Sedotan & Packaging', type: 'expense', color: '#14B8A6', icon: '📦' },
      ],
      transactions: [
        { cat: 'Omset Penjualan Minuman & Biji', amount: '8400000', type: 'income', desc: 'Rekap Settlement POS Hari Ini (142 Cup)', daysAgo: 1 },
        { cat: 'Omset Penjualan Minuman & Biji', amount: '9200000', type: 'income', desc: 'Rekap POS Weekend (168 Cup + Pastry)', daysAgo: 2 },
        { cat: 'Pesanan Katering Kantor', amount: '14500000', type: 'income', desc: 'Coffee Break Event Workshop Startup', daysAgo: 6 },
        { cat: 'Beli Biji Kopi Arabika Gayo & Flores', amount: '12000000', type: 'expense', desc: 'Restock Green Beans 60kg dari Roastery', daysAgo: 5 },
        { cat: 'Susu Fresh Milk & Sirup', amount: '4600000', type: 'expense', desc: 'Pasokan Fresh Milk Greenfields 8 Karton', daysAgo: 8 },
        { cat: 'Gaji Barista & Tim Dapur', amount: '16000000', type: 'expense', desc: 'Gaji 4 Barista & Staff Outlet', daysAgo: 12 },
        { cat: 'Cup, Sedotan & Packaging', amount: '3200000', type: 'expense', desc: 'Cetak Paper Cup Logo Emboss 3000 pcs', daysAgo: 17 },
      ],
      goals: [
        { title: 'Buka Cabang 02 di BSD Rawa Buntu', category: 'property', target: '120000000', current: '75000000', priority: 'high', status: 'in_progress', monthly: '15000000', targetDays: 150, notes: 'Sewa ruko strategis dekat stasiun commuter line.' },
        { title: 'Beli Mesin Espresso La Marzocco Linea PB', category: 'gadget', target: '185000000', current: '110000000', priority: 'medium', status: 'in_progress', monthly: '20000000', targetDays: 120, notes: 'Mesin 2-group untuk volume tinggi.' },
      ],
      liabilities: [
        { name: 'KUR Bank BRI Modal Usaha Kopi', type: 'business_loan', principal: '50000000', remaining: '21000000', rate: '6.00', monthly: '2350000', tenor: 24, remTenor: 9, dueDay: 18, lender: 'Bank BRI', notes: 'Kredit Usaha Rakyat renovasi kedai pertama.' },
      ],
    });

    console.log('🎉 Seed completed successfully!');
    console.log('📊 Master Summary:');
    console.log(`   - Users: 4 users`);
    console.log(`   - Workspaces: ${createdWorkspaces.length} realistic workspaces`);
    console.log(`   - Menus: ${fullMenuItems.length} per workspace`);
    console.log(`   - Status: All workspaces linked to admin@example.com (Password: admin123)`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
