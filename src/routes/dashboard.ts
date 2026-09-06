import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, isNull, sql, gte, lte, desc } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';

export const dashboardRoutes = new Elysia({ prefix: '/api/dashboard' })
  .get('/summary', async ({ headers, query }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    if (!query.workspaceId) {
      return { error: 'workspaceId query parameter is required' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, query.workspaceId, 'transactions.read');
    if (access.error) {
      return { error: access.error };
    }
    
    try {
      // Get total balance from all accounts
      const accounts = await db.select({ balance: schema.accounts.balance }).from(schema.accounts)
        .where(and(
          eq(schema.accounts.workspaceId, query.workspaceId),
          isNull(schema.accounts.deletedAt)
        ));
      
      const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);
      
      // Get current month's income and expenses
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const transactions = await db.select({ 
        amount: schema.transactions.amount,
        type: schema.transactions.type 
      }).from(schema.transactions)
        .where(and(
          eq(schema.transactions.workspaceId, query.workspaceId),
          gte(schema.transactions.date, startOfMonth),
          lte(schema.transactions.date, endOfMonth),
          isNull(schema.transactions.deletedAt)
        ));
      
      const monthlyIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const monthlyExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const savingsRate = monthlyIncome > 0 
        ? ((monthlyIncome - monthlyExpense) / monthlyIncome * 100).toFixed(1)
        : '0';
      
      return { 
        success: true, 
        data: {
          totalBalance,
          monthlyIncome,
          monthlyExpense,
          savingsRate: parseFloat(savingsRate),
          accountCount: accounts.length,
          transactionCount: transactions.length
        }
      };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
  })

  .get('/trends', async ({ headers, query }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    if (!query.workspaceId) {
      return { error: 'workspaceId query parameter is required' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, query.workspaceId, 'transactions.read');
    if (access.error) {
      return { error: access.error };
    }
    
    try {
      const months = parseInt(query.months || '6');
      const now = new Date();
      const trends = [];
      
      for (let i = months - 1; i >= 0; i--) {
        const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        
        const transactions = await db.select({ 
          amount: schema.transactions.amount,
          type: schema.transactions.type 
        }).from(schema.transactions)
          .where(and(
            eq(schema.transactions.workspaceId, query.workspaceId),
            gte(schema.transactions.date, startDate),
            lte(schema.transactions.date, endDate),
            isNull(schema.transactions.deletedAt)
          ));
        
        const monthName = startDate.toLocaleString('default', { month: 'short' });
        const income = transactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        const expense = transactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        trends.push({ month: monthName, income, expense });
      }
      
      return { success: true, data: { trends } };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
      months: t.Optional(t.String()),
    }),
  })

  .get('/categories', async ({ headers, query }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    if (!query.workspaceId) {
      return { error: 'workspaceId query parameter is required' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, query.workspaceId, 'transactions.read');
    if (access.error) {
      return { error: access.error };
    }
    
    try {
      const type = query.type || 'expense';
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const transactions = await db.select({
        categoryId: schema.transactions.categoryId,
        amount: schema.transactions.amount
      }).from(schema.transactions)
        .where(and(
          eq(schema.transactions.workspaceId, query.workspaceId),
          eq(schema.transactions.type, type),
          gte(schema.transactions.date, startOfMonth),
          lte(schema.transactions.date, endOfMonth),
          isNull(schema.transactions.deletedAt)
        ));
      
      // Group by category
      const categoryTotals: Record<string, number> = {};
      transactions.forEach(t => {
        if (t.categoryId) {
          categoryTotals[t.categoryId] = (categoryTotals[t.categoryId] || 0) + parseFloat(t.amount);
        }
      });
      
      // Get category details
      const categoryIds = Object.keys(categoryTotals);
      const categories = await db.select().from(schema.categories)
        .where(and(
          eq(schema.categories.workspaceId, query.workspaceId),
          eq(schema.categories.type, type),
          isNull(schema.categories.deletedAt)
        ));
      
      const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
      
      const result = categories
        .filter(c => categoryTotals[c.id])
        .map(c => ({
          name: c.name,
          value: categoryTotals[c.id],
          percentage: total > 0 ? (categoryTotals[c.id] / total * 100).toFixed(1) : '0',
          color: c.color || '#3B82F6'
        }))
        .sort((a, b) => b.value - a.value);
      
      return { success: true, data: { categories: result } };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
      type: t.Optional(t.String()),
    }),
  })

  .get('/accounts', async ({ headers, query }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    if (!query.workspaceId) {
      return { error: 'workspaceId query parameter is required' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, query.workspaceId, 'accounts.read');
    if (access.error) {
      return { error: access.error };
    }
    
    try {
      const accounts = await db.select().from(schema.accounts)
        .where(and(
          eq(schema.accounts.workspaceId, query.workspaceId),
          isNull(schema.accounts.deletedAt)
        ));
      
      const typeColors: Record<string, string> = {
        bank: '#3B82F6',
        cash: '#10B981',
        ewallet: '#8B5CF6',
        credit: '#EF4444'
      };
      
      const result = accounts.map(a => ({
        name: a.name,
        balance: parseFloat(a.balance),
        type: a.type,
        color: typeColors[a.type] || '#6B7280'
      }));
      
      return { success: true, data: { accounts: result } };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
  });
