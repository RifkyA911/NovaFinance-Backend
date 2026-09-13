import { pgTable, uuid, varchar, decimal, timestamp, integer, boolean, jsonb, text, index } from 'drizzle-orm/pg-core';

// Users table (for Better Auth)
export const users = pgTable('user', {
  id: text('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  emailVerified: timestamp('email_verified'),
  image: varchar('image', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
}));

// Workspaces table
export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'personal', 'umkm', 'pt'
  currency: varchar('currency', { length: 3 }).default('IDR'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by').references(() => users.id),
  deletedReason: text('deleted_reason'),
}, (table) => ({
  ownerIdIdx: index('workspaces_owner_id_idx').on(table.ownerId),
}));

// Collaborators table (for RBAC)
export const collaborators = pgTable('collaborators', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(), // 'owner', 'admin', 'staff', 'viewer'
  invitedBy: text('invited_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index('collaborators_workspace_id_idx').on(table.workspaceId),
  userIdIdx: index('collaborators_user_id_idx').on(table.userId),
  uniqueWorkspaceUser: index('collaborators_workspace_user_unique').on(table.workspaceId, table.userId),
}));

// Categories table
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'income', 'expense'
  color: varchar('color', { length: 7 }).default('#000000'),
  icon: varchar('icon', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by').references(() => users.id),
  deletedReason: text('deleted_reason'),
}, (table) => ({
  workspaceIdIdx: index('categories_workspace_id_idx').on(table.workspaceId),
}));

// Accounts (wallets) table
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'bank', 'cash', 'ewallet', 'credit'
  balance: decimal('balance', { precision: 15, scale: 2 }).default('0').notNull(),
  currency: varchar('currency', { length: 3 }).default('IDR'),
  accountNumber: varchar('account_number', { length: 50 }),
  bankName: varchar('bank_name', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by').references(() => users.id),
  deletedReason: text('deleted_reason'),
}, (table) => ({
  workspaceIdIdx: index('accounts_workspace_id_idx').on(table.workspaceId),
}));

// Transactions table
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'income', 'expense'
  description: varchar('description', { length: 500 }),
  notes: text('notes'),
  date: timestamp('date').defaultNow().notNull(),
  invested: decimal('invested', { precision: 15, scale: 2 }).default('0'), // investment amount
  platform: varchar('platform', { length: 100 }), // platform source (e.g., 'trading', 'crypto', 'stocks')
  metadata: jsonb('metadata'), // stores OCR result ref or AI log raw
  isStaging: boolean('is_staging').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by').references(() => users.id),
  deletedReason: text('deleted_reason'),
}, (table) => ({
  workspaceIdIdx: index('transactions_workspace_id_idx').on(table.workspaceId),
  accountIdIdx: index('transactions_account_id_idx').on(table.accountId),
  categoryIdIdx: index('transactions_category_id_idx').on(table.categoryId),
  dateIdx: index('transactions_date_idx').on(table.date),
  platformIdx: index('transactions_platform_idx').on(table.platform),
}));

// Invoices table
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  clientName: varchar('client_name', { length: 255 }),
  clientEmail: varchar('client_email', { length: 255 }),
  status: varchar('status', { length: 20 }).default('unpaid'), // 'draft', 'unpaid', 'paid', 'overdue', 'cancelled'
  dueDate: timestamp('due_date'),
  paidDate: timestamp('paid_date'),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).default('0').notNull(),
  tax: decimal('tax', { precision: 15, scale: 2 }).default('0').notNull(),
  total: decimal('total', { precision: 15, scale: 2 }).default('0').notNull(),
  items: jsonb('items').notNull(), // array of {desc, qty, price}
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by').references(() => users.id),
  deletedReason: text('deleted_reason'),
}, (table) => ({
  workspaceIdIdx: index('invoices_workspace_id_idx').on(table.workspaceId),
  invoiceNumberIdx: index('invoices_invoice_number_idx').on(table.invoiceNumber),
}));

// Audit Logs table
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(), // 'create', 'update', 'delete', 'login', 'logout', etc.
  entityType: varchar('entity_type', { length: 100 }).notNull(), // 'transaction', 'workspace', 'invoice', etc.
  entityId: varchar('entity_id', { length: 128 }),
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: text('user_agent'),
  correlationId: varchar('correlation_id', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index('audit_logs_workspace_id_idx').on(table.workspaceId),
  userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
  actionIdx: index('audit_logs_action_idx').on(table.action),
  createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
}));

// Dynamic Menu table
export const menus = pgTable('menus', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  name: varchar('name', { length: 100 }).notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 50 }),
  path: varchar('path', { length: 255 }),
  order: integer('order').default(0),
  isActive: boolean('is_active').default(true),
  permissions: jsonb('permissions'), // array of required permissions
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index('menus_workspace_id_idx').on(table.workspaceId),
  parentIdIdx: index('menus_parent_id_idx').on(table.parentId),
  orderIdx: index('menus_order_idx').on(table.order),
}));
