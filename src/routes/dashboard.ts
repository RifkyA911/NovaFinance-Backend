import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, isNull, sql, gte, lte, desc } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';
import { auth } from '../auth';

export const dashboardRoutes = new Elysia({ prefix: '/api/dashboard' })
  .get('/summary', async ({ headers, query, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    if (!query.workspaceId) {
      set.status = 400;
      return { success: false, error: 'workspaceId query parameter is required', code: 'VALIDATION_ERROR' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, query.workspaceId, 'transactions.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
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
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
    detail: {
      tags: ['Dashboard'],
      summary: 'Get dashboard summary',
      description: 'Get financial summary for workspace including total balance, monthly income/expense, savings rate, account count, and transaction count. Requires workspace access (owner, admin, staff, member).\n\n**Query Parameters:**\n- `workspaceId` (required): Workspace UUID\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "totalBalance": 27000000,\n    "monthlyIncome": 20000000,\n    "monthlyExpense": 7500000,\n    "savingsRate": 62.5,\n    "accountCount": 4,\n    "transactionCount": 45\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/trends', async ({ headers, query, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    if (!query.workspaceId) {
      set.status = 400;
      return { success: false, error: 'workspaceId query parameter is required', code: 'VALIDATION_ERROR' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, query.workspaceId, 'transactions.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
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
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
      months: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Dashboard'],
      summary: 'Get financial trends',
      description: 'Get income/expense trends over specified number of months. Requires workspace access (owner, admin, staff, member).\n\n**Query Parameters:**\n- `workspaceId` (required): Workspace UUID\n- `months` (optional): Number of months to include (default: 6)\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "trends": [\n      {\n        "month": "Apr",\n        "income": 18000000,\n        "expense": 8000000\n      },\n      {\n        "month": "May",\n        "income": 20000000,\n        "expense": 9000000\n      },\n      {\n        "month": "Jun",\n        "income": 22000000,\n        "expense": 10000000\n      },\n      {\n        "month": "Jul",\n        "income": 19000000,\n        "expense": 8500000\n      },\n      {\n        "month": "Aug",\n        "income": 21000000,\n        "expense": 9500000\n      },\n      {\n        "month": "Sep",\n        "income": 20000000,\n        "expense": 7500000\n      }\n    ]\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/categories', async ({ headers, query, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    if (!query.workspaceId) {
      set.status = 400;
      return { success: false, error: 'workspaceId query parameter is required', code: 'VALIDATION_ERROR' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, query.workspaceId, 'transactions.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
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
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
      type: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Dashboard'],
      summary: 'Get category breakdown',
      description: 'Get category spending/income breakdown for current month. Requires workspace access (owner, admin, staff, member).\n\n**Query Parameters:**\n- `workspaceId` (required): Workspace UUID\n- `type` (optional): Transaction type - `income` or `expense` (default: `expense`)\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "categories": [\n      {\n        "name": "Food & Dining",\n        "value": 2500000,\n        "percentage": "33.3",\n        "color": "#EF4444"\n      },\n      {\n        "name": "Transportation",\n        "value": 2000000,\n        "percentage": "26.7",\n        "color": "#F59E0B"\n      },\n      {\n        "name": "Utilities",\n        "value": 1500000,\n        "percentage": "20.0",\n        "color": "#3B82F6"\n      },\n      {\n        "name": "Shopping",\n        "value": 1000000,\n        "percentage": "13.3",\n        "color": "#8B5CF6"\n      },\n      {\n        "name": "Entertainment",\n        "value": 500000,\n        "percentage": "6.7",\n        "color": "#EC4899"\n      }\n    ]\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/accounts', async ({ headers, query, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    if (!query.workspaceId) {
      set.status = 400;
      return { success: false, error: 'workspaceId query parameter is required', code: 'VALIDATION_ERROR' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, query.workspaceId, 'accounts.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
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
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
    detail: {
      tags: ['Dashboard'],
      summary: 'Get account balances',
      description: 'Get account balance breakdown by account type with color coding. Requires workspace access (owner, admin, staff, member).\n\n**Query Parameters:**\n- `workspaceId` (required): Workspace UUID\n\n**Account Type Colors:**\n- `bank`: Blue (#3B82F6)\n- `cash`: Green (#10B981)\n- `ewallet`: Purple (#8B5CF6)\n- `credit`: Red (#EF4444)\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "accounts": [\n      {\n        "name": "BCA Main",\n        "balance": 15000000,\n        "type": "bank",\n        "color": "#3B82F6"\n      },\n      {\n        "name": "Mandiri Savings",\n        "balance": 8000000,\n        "type": "bank",\n        "color": "#3B82F6"\n      },\n      {\n        "name": "GoPay",\n        "balance": 2500000,\n        "type": "ewallet",\n        "color": "#8B5CF6"\n      },\n      {\n        "name": "Cash",\n        "balance": 1500000,\n        "type": "cash",\n        "color": "#10B981"\n      }\n    ]\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  });
