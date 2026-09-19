import { db } from './auth/config';
import * as schema from './db/schema';
import * as authSchema from './db/auth-schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { auth } from './auth';

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Clean existing data
    console.log('🧹 Cleaning existing data...');
    await db.delete(schema.goals);
    await db.delete(schema.liabilities);
    await db.delete(schema.invoices);
    await db.delete(schema.transactions);
    await db.delete(schema.categories);
    await db.delete(schema.collaborators);
    await db.delete(schema.menus);
    await db.delete(schema.workspaces);
    await db.delete(authSchema.user);
    await db.delete(authSchema.session);
    await db.delete(authSchema.account);
    console.log('✅ Database cleaned');

    // Create users with better-auth API using internal adapter
    const users = [
      { email: 'admin@example.com', password: 'admin123', name: 'Alexander Vance' },
      { email: 'test@example.com', password: 'password123', name: 'Sofia Lestari' },
      { email: 'user@example.com', password: 'password123', name: 'Budi Pratama' },
      { email: 'staff@example.com', password: 'staff123', name: 'Siti Rahma' },
    ];

    const userIds: Record<string, string> = {};

    for (const userData of users) {
      // Create user manually with better-auth password hashing
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

    // Create workspaces for admin and test user
    const workspaces = [
      { ownerId: adminId, name: 'Personal Finance', type: 'personal', currency: 'IDR' },
      { ownerId: adminId, name: 'Business Operations', type: 'umkm', currency: 'IDR' },
      { ownerId: testId, name: 'Test Workspace', type: 'personal', currency: 'IDR' },
    ];

    const workspaceIds: string[] = [];

    for (const wsData of workspaces) {
      const [workspace] = await db.insert(schema.workspaces).values(wsData).returning();
      workspaceIds.push(workspace.id);
      
      // Add owner as collaborator
      await db.insert(schema.collaborators).values({
        workspaceId: workspace.id,
        userId: wsData.ownerId,
        role: 'owner',
        invitedBy: wsData.ownerId,
      });

      console.log('✅ Workspace created:', workspace.name);
    }

    const personalWsId = workspaceIds[0];
    const businessWsId = workspaceIds[1];

    // Add collaborators to business workspace
    await db.insert(schema.collaborators).values([
      { workspaceId: businessWsId, userId: userId, role: 'admin', invitedBy: adminId },
      { workspaceId: businessWsId, userId: staffId, role: 'staff', invitedBy: adminId },
    ]);
    console.log('✅ Collaborators added');

    // Create comprehensive categories
    const incomeCategories = [
      { name: 'Salary', color: '#10B981', icon: '💰' },
      { name: 'Freelance', color: '#3B82F6', icon: '💻' },
      { name: 'Investment', color: '#8B5CF6', icon: '📈' },
      { name: 'Bonus', color: '#F59E0B', icon: '🎁' },
    ];

    const expenseCategories = [
      { name: 'Food & Dining', color: '#EF4444', icon: '🍔' },
      { name: 'Transportation', color: '#F59E0B', icon: '🚗' },
      { name: 'Utilities', color: '#3B82F6', icon: '💡' },
      { name: 'Shopping', color: '#8B5CF6', icon: '🛒' },
      { name: 'Entertainment', color: '#EC4899', icon: '🎬' },
      { name: 'Healthcare', color: '#10B981', icon: '🏥' },
      { name: 'Education', color: '#6366F1', icon: '�' },
      { name: 'Housing', color: '#F97316', icon: '🏠' },
    ];

    const categoryMap: Record<string, string> = {};

    for (const cat of incomeCategories) {
      const [category] = await db.insert(schema.categories).values({
        workspaceId: personalWsId,
        name: cat.name,
        type: 'income',
        color: cat.color,
        icon: cat.icon,
      }).onConflictDoNothing().returning();
      if (category) categoryMap[cat.name] = category.id;
    }

    for (const cat of expenseCategories) {
      const [category] = await db.insert(schema.categories).values({
        workspaceId: personalWsId,
        name: cat.name,
        type: 'expense',
        color: cat.color,
        icon: cat.icon,
      }).onConflictDoNothing().returning();
      if (category) categoryMap[cat.name] = category.id;
    }

    console.log('✅ Categories created');

    // Create multiple accounts
    const accounts = [
      { name: 'BCA Main', type: 'bank', balance: '15000000', accountNumber: '1234567890', bankName: 'BCA' },
      { name: 'Mandiri Savings', type: 'bank', balance: '8000000', accountNumber: '0987654321', bankName: 'Mandiri' },
      { name: 'GoPay', type: 'ewallet', balance: '2500000', accountNumber: '08123456789', bankName: 'GoPay' },
      { name: 'Cash', type: 'cash', balance: '1500000' },
    ];

    const accountIds: string[] = [];

    for (const accData of accounts) {
      try {
        const [account] = await db.insert(schema.accounts).values({
          workspaceId: personalWsId,
          ...accData,
          currency: 'IDR',
        }).onConflictDoNothing().returning();
        if (account) accountIds.push(account.id);
      } catch (e) {
        console.log('Skipping accounts table (not needed for auth)');
      }
    }

    console.log('✅ Accounts created');

    // Create realistic transactions over the past 3 years
    const transactionTemplates = [
      { category: 'Salary', amount: '15000000', type: 'income', description: 'Monthly Salary' },
      { category: 'Freelance', amount: '5000000', type: 'income', description: 'Web Development Project' },
      { category: 'Investment', amount: '2000000', type: 'income', description: 'Stock Dividend', invested: '5000000', platform: 'stocks' },
      { category: 'Investment', amount: '3000000', type: 'income', description: 'Crypto Profit', invested: '1000000', platform: 'crypto' },
      { category: 'Investment', amount: '1500000', type: 'income', description: 'Trading Profit', invested: '2000000', platform: 'trading' },
      { category: 'Food & Dining', amount: '75000', type: 'expense', description: 'Lunch at Restaurant' },
      { category: 'Food & Dining', amount: '150000', type: 'expense', description: 'Grocery Shopping' },
      { category: 'Transportation', amount: '25000', type: 'expense', description: 'Gojek Ride' },
      { category: 'Transportation', amount: '500000', type: 'expense', description: 'Fuel' },
      { category: 'Utilities', amount: '350000', type: 'expense', description: 'Electricity Bill' },
      { category: 'Utilities', amount: '150000', type: 'expense', description: 'Internet Bill' },
      { category: 'Shopping', amount: '500000', type: 'expense', description: 'New Clothes' },
      { category: 'Entertainment', amount: '150000', type: 'expense', description: 'Netflix Subscription' },
      { category: 'Entertainment', amount: '300000', type: 'expense', description: 'Movie Tickets' },
      { category: 'Healthcare', amount: '200000', type: 'expense', description: 'Medicine' },
      { category: 'Education', amount: '500000', type: 'expense', description: 'Online Course' },
      { category: 'Housing', amount: '3000000', type: 'expense', description: 'Rent' },
    ];

    const now = new Date();
    const transactionsToInsert: any[] = [];
    
    for (let year = 2; year >= 0; year--) {
      for (let month = 11; month >= 0; month--) {
        const monthDate = new Date(now.getFullYear() - year, now.getMonth() - month, 1);
        
        for (const template of transactionTemplates) {
          const day = Math.floor(Math.random() * 28) + 1;
          const transactionDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
          
          const accountId = accountIds[Math.floor(Math.random() * accountIds.length)];
          const categoryId = categoryMap[template.category];
          
          if (categoryId && accountId) {
            transactionsToInsert.push({
              workspaceId: personalWsId,
              accountId,
              categoryId,
              amount: template.amount,
              type: template.type as any,
              description: template.description,
              date: transactionDate,
              invested: template.invested || '0',
              platform: template.platform || null,
              notes: `${template.description} - ${monthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
            });
          }
        }
      }
    }

    // Batch insert all transactions at once
    if (transactionsToInsert.length > 0) {
      await db.insert(schema.transactions).values(transactionsToInsert).onConflictDoNothing();
    }

    console.log('✅ Transactions created (3 years of data)');

    // Create dynamic menus
    const menuItems = [
      { name: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard', order: 1 },
      { name: 'transactions', label: 'Transactions', icon: 'ArrowLeftRight', path: '/transactions', order: 2 },
      { name: 'accounts', label: 'Accounts', icon: 'Wallet', path: '/accounts', order: 3 },
      { name: 'categories', label: 'Categories', icon: 'Tags', path: '/categories', order: 4 },
      { name: 'invoices', label: 'Invoices', icon: 'FileText', path: '/invoices', order: 5 },
      { name: 'reports', label: 'Reports', icon: 'BarChart3', path: '/reports', order: 6 },
      { name: 'settings', label: 'Settings', icon: 'Settings', path: '/settings', order: 7 },
    ];

    for (const menuItem of menuItems) {
      await db.insert(schema.menus).values({
        workspaceId: personalWsId,
        name: menuItem.name,
        label: menuItem.label,
        icon: menuItem.icon,
        path: menuItem.path,
        order: menuItem.order,
        permissions: JSON.stringify(['read']),
        isActive: true,
      }).onConflictDoNothing();
    }

    console.log('✅ Menus created');

    // Create sample invoices
    const invoices = [
      {
        invoiceNumber: 'INV-2024-001',
        clientName: 'PT Teknologi Maju',
        clientEmail: 'finance@teknologimaju.com',
        status: 'paid',
        subtotal: '15000000',
        tax: '1500000',
        total: '16500000',
        items: [
          { description: 'Web Development Services', quantity: 1, price: '15000000' },
        ],
        notes: 'Payment received via transfer',
        paidDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        invoiceNumber: 'INV-2024-002',
        clientName: 'CV Kreatif Digital',
        clientEmail: 'billing@kreatifdigital.com',
        status: 'unpaid',
        subtotal: '8000000',
        tax: '800000',
        total: '8800000',
        items: [
          { description: 'UI/UX Design', quantity: 1, price: '5000000' },
          { description: 'Mobile App Design', quantity: 1, price: '3000000' },
        ],
        notes: 'Payment due within 14 days',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    ];

    for (const invData of invoices) {
      await db.insert(schema.invoices).values({
        workspaceId: businessWsId,
        ...invData,
        dueDate: invData.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }).onConflictDoNothing();
    }

    console.log('✅ Invoices created');

    // Create Sample Goals
    const sampleGoals = [
      {
        workspaceId: personalWsId,
        title: 'Dana Darurat 6 Bulan (Emergency Vault)',
        category: 'emergency',
        targetAmount: '35000000',
        currentAmount: '24500000',
        priority: 'urgent',
        status: 'in_progress',
        monthlyContributionPlanned: '3500000',
        targetDate: new Date('2026-12-31'),
        order: 1,
        notes: 'Alokasi aman untuk kebutuhan operasional 6 bulan di instrumen likuid (Pasar Uang & Tabungan).',
      },
      {
        workspaceId: personalWsId,
        title: 'DP Rumah Tapak Modern Minimalis (BSD Cluster)',
        category: 'property',
        targetAmount: '120000000',
        currentAmount: '42000000',
        priority: 'high',
        status: 'in_progress',
        monthlyContributionPlanned: '6500000',
        targetDate: new Date('2027-12-31'),
        order: 2,
        notes: 'Target DP 20% + biaya notaris & BPHTB.',
      },
      {
        workspaceId: personalWsId,
        title: 'MacBook Pro M3 Max Workstation',
        category: 'gadget',
        targetAmount: '34000000',
        currentAmount: '28000000',
        priority: 'high',
        status: 'in_progress',
        monthlyContributionPlanned: '2000000',
        targetDate: new Date('2026-11-30'),
        order: 3,
        notes: 'Hardware refresh untuk workstation AI & dev.',
      },
      {
        workspaceId: personalWsId,
        title: 'Portofolio Index Fund & Dividen Saham',
        category: 'investment',
        targetAmount: '60000000',
        currentAmount: '38500000',
        priority: 'medium',
        status: 'in_progress',
        monthlyContributionPlanned: '3000000',
        targetDate: new Date('2027-06-30'),
        order: 4,
        notes: 'Akumulasi IHSG & S&P 500 ETF secara konsisten dollar cost averaging.',
      },
      {
        workspaceId: personalWsId,
        title: 'Liburan Musim Dingin Sapporo Hokkaido',
        category: 'travel',
        targetAmount: '28000000',
        currentAmount: '9500000',
        priority: 'medium',
        status: 'in_progress',
        monthlyContributionPlanned: '2500000',
        targetDate: new Date('2027-01-20'),
        order: 5,
        notes: 'Tiket ANA/JAL, Airbnb Sapporo, dan pass JR Hokkaido ski resort.',
      },
      {
        workspaceId: personalWsId,
        title: 'Dana Pensiun Dini (FIRE Phase 1)',
        category: 'retirement',
        targetAmount: '500000000',
        currentAmount: '92000000',
        priority: 'low',
        status: 'in_progress',
        monthlyContributionPlanned: '5000000',
        targetDate: new Date('2032-12-31'),
        order: 6,
        notes: 'Target dana kebebasan finansial jangka panjang.',
      },
      {
        workspaceId: personalWsId,
        title: 'Kamera Sony Alpha 7 IV + Lensa GM',
        category: 'gadget',
        targetAmount: '45000000',
        currentAmount: '6000000',
        priority: 'low',
        status: 'wishlist',
        monthlyContributionPlanned: '1500000',
        targetDate: new Date('2027-08-31'),
        order: 7,
        notes: 'Wishlist fotografi dan video dokumentasi profesional.',
      },
      {
        workspaceId: personalWsId,
        title: 'Sertifikasi Cloud Architect & Security',
        category: 'education',
        targetAmount: '8000000',
        currentAmount: '8000000',
        priority: 'high',
        status: 'completed',
        monthlyContributionPlanned: '0',
        targetDate: new Date('2026-08-15'),
        order: 8,
        notes: 'Target sertifikasi selesai dan lulus tepat waktu.',
      },
    ];

    for (const g of sampleGoals) {
      await db.insert(schema.goals).values(g as any);
    }
    console.log('✅ Goals created (8 items)');

    // Create Sample Liabilities
    const sampleLiabilities = [
      {
        workspaceId: personalWsId,
        name: 'KPR BTN Syariah - Cluster Grand BSD',
        type: 'mortgage',
        principalAmount: '650000000',
        remainingAmount: '520000000',
        interestRate: '6.75',
        monthlyPayment: '5250000',
        tenorMonths: 180,
        remainingTenorMonths: 142,
        dueDate: 10,
        status: 'active',
        lenderName: 'Bank BTN Syariah',
        notes: 'Fasilitas pembiayaan hunian tetap berskema murabahah.',
      },
      {
        workspaceId: personalWsId,
        name: 'Kredit Usaha Modal Kerja Mandiri',
        type: 'business_loan',
        principalAmount: '100000000',
        remainingAmount: '38000000',
        interestRate: '8.50',
        monthlyPayment: '4600000',
        tenorMonths: 24,
        remainingTenorMonths: 9,
        dueDate: 25,
        status: 'active',
        lenderName: 'Bank Mandiri',
        notes: 'Ekspansi modal operasional dan inventory software.',
      },
      {
        workspaceId: personalWsId,
        name: 'BCA Everyday Card & Cicilan 0%',
        type: 'credit_card',
        principalAmount: '25000000',
        remainingAmount: '7200000',
        interestRate: '1.75',
        monthlyPayment: '1850000',
        tenorMonths: 12,
        remainingTenorMonths: 4,
        dueDate: 15,
        status: 'active',
        lenderName: 'Bank BCA',
        notes: 'Cicilan 0% peralatan server kantor.',
      },
    ];

    for (const l of sampleLiabilities) {
      await db.insert(schema.liabilities).values(l as any);
    }
    console.log('✅ Liabilities created (3 active loans)');

    console.log('🎉 Seed completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Users: ${Object.keys(userIds).length}`);
    console.log(`   - Workspaces: ${workspaceIds.length}`);
    console.log(`   - Categories: ${Object.keys(categoryMap).length}`);
    console.log(`   - Accounts: ${accountIds.length}`);
    console.log(`   - Transactions: 6 months of data`);
    console.log(`   - Menus: ${menuItems.length}`);
    console.log(`   - Invoices: ${invoices.length}`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
