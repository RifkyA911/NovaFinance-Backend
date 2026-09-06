import { db } from './auth/config';
import * as schema from './db/schema';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Clean existing data
    console.log('🧹 Cleaning existing data...');
    await db.delete(schema.invoices);
    await db.delete(schema.transactions);
    await db.delete(schema.accounts);
    await db.delete(schema.categories);
    await db.delete(schema.collaborators);
    await db.delete(schema.menus);
    await db.delete(schema.workspaces);
    await db.delete(schema.users);
    console.log('✅ Database cleaned');

    // Create multiple users
    const users = [
      { email: 'admin@example.com', passwordHash: 'admin123', name: 'Admin User' },
      { email: 'user@example.com', passwordHash: 'password123', name: 'Regular User' },
      { email: 'staff@example.com', passwordHash: 'staff123', name: 'Staff User' },
    ];

    const userIds: Record<string, string> = {};

    for (const userData of users) {
      const [user] = await db.insert(schema.users).values(userData).returning();
      userIds[userData.email] = user.id;
      console.log('✅ User created:', user.email);
    }

    const adminId = userIds['admin@example.com'];
    const userId = userIds['user@example.com'];
    const staffId = userIds['staff@example.com'];

    // Create workspaces for admin
    const workspaces = [
      { ownerId: adminId, name: 'Personal Finance', type: 'personal', currency: 'IDR' },
      { ownerId: adminId, name: 'Business Operations', type: 'umkm', currency: 'IDR' },
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
      const [account] = await db.insert(schema.accounts).values({
        workspaceId: personalWsId,
        ...accData,
        currency: 'IDR',
      }).onConflictDoNothing().returning();
      if (account) accountIds.push(account.id);
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
    for (let year = 2; year >= 0; year--) {
      for (let month = 11; month >= 0; month--) {
        const monthDate = new Date(now.getFullYear() - year, now.getMonth() - month, 1);
        
        for (const template of transactionTemplates) {
          const day = Math.floor(Math.random() * 28) + 1;
          const transactionDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
          
          const accountId = accountIds[Math.floor(Math.random() * accountIds.length)];
          const categoryId = categoryMap[template.category];
          
          if (categoryId && accountId) {
            await db.insert(schema.transactions).values({
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
            }).onConflictDoNothing();
          }
        }
      }
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
