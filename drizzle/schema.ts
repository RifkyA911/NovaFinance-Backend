import { pgTable, unique, text, boolean, timestamp, index, foreignKey, uuid, varchar, integer, jsonb, numeric } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"




export const user = pgTable("user", {
	id: text("id").primaryKey().notNull(),
	name: text("name").notNull(),
	email: text("email").notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		userEmailUnique: unique("user_email_unique").on(table.email),
	}
});

export const documents = pgTable("documents", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	transactionId: uuid("transaction_id"),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	fileUrl: text("file_url").notNull(),
	fileType: varchar("file_type", { length: 100 }).notNull(),
	fileSize: integer("file_size"),
	minioKey: text("minio_key").notNull(),
	metadata: jsonb("metadata"),
	uploadedBy: text("uploaded_by").notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	deletedBy: text("deleted_by"),
},
(table) => {
	return {
		transactionIdIdx: index("documents_transaction_id_idx").using("btree", table.transactionId.asc().nullsLast()),
		uploadedByIdx: index("documents_uploaded_by_idx").using("btree", table.uploadedBy.asc().nullsLast()),
		workspaceIdIdx: index("documents_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast()),
		documentsWorkspaceIdWorkspacesIdFk: foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "documents_workspace_id_workspaces_id_fk"
		}).onDelete("cascade"),
		documentsTransactionIdTransactionsIdFk: foreignKey({
			columns: [table.transactionId],
			foreignColumns: [transactions.id],
			name: "documents_transaction_id_transactions_id_fk"
		}).onDelete("set null"),
		documentsUploadedByUserIdFk: foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [user.id],
			name: "documents_uploaded_by_user_id_fk"
		}).onDelete("cascade"),
		documentsDeletedByUserIdFk: foreignKey({
			columns: [table.deletedBy],
			foreignColumns: [user.id],
			name: "documents_deleted_by_user_id_fk"
		}),
	}
});

export const auditLogs = pgTable("audit_logs", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id"),
	userId: text("user_id"),
	action: varchar("action", { length: 100 }).notNull(),
	entityType: varchar("entity_type", { length: 100 }).notNull(),
	entityId: varchar("entity_id", { length: 128 }),
	oldData: jsonb("old_data"),
	newData: jsonb("new_data"),
	ipAddress: varchar("ip_address", { length: 64 }),
	userAgent: text("user_agent"),
	correlationId: varchar("correlation_id", { length: 64 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		actionIdx: index("audit_logs_action_idx").using("btree", table.action.asc().nullsLast()),
		createdAtIdx: index("audit_logs_created_at_idx").using("btree", table.createdAt.asc().nullsLast()),
		userIdIdx: index("audit_logs_user_id_idx").using("btree", table.userId.asc().nullsLast()),
		workspaceIdIdx: index("audit_logs_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast()),
		auditLogsWorkspaceIdWorkspacesIdFk: foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "audit_logs_workspace_id_workspaces_id_fk"
		}).onDelete("cascade"),
		auditLogsUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "audit_logs_user_id_user_id_fk"
		}).onDelete("set null"),
	}
});

export const categories = pgTable("categories", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	name: varchar("name", { length: 100 }).notNull(),
	type: varchar("type", { length: 20 }).notNull(),
	color: varchar("color", { length: 7 }).default('#000000'),
	icon: varchar("icon", { length: 50 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	deletedBy: text("deleted_by"),
	deletedReason: text("deleted_reason"),
},
(table) => {
	return {
		workspaceIdIdx: index("categories_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast()),
		categoriesWorkspaceIdWorkspacesIdFk: foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "categories_workspace_id_workspaces_id_fk"
		}).onDelete("cascade"),
		categoriesDeletedByUserIdFk: foreignKey({
			columns: [table.deletedBy],
			foreignColumns: [user.id],
			name: "categories_deleted_by_user_id_fk"
		}),
	}
});

export const collaborators = pgTable("collaborators", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	userId: text("user_id").notNull(),
	role: varchar("role", { length: 20 }).notNull(),
	invitedBy: text("invited_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		userIdIdx: index("collaborators_user_id_idx").using("btree", table.userId.asc().nullsLast()),
		workspaceIdIdx: index("collaborators_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast()),
		workspaceUserUnique: index("collaborators_workspace_user_unique").using("btree", table.workspaceId.asc().nullsLast(), table.userId.asc().nullsLast()),
		collaboratorsWorkspaceIdWorkspacesIdFk: foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "collaborators_workspace_id_workspaces_id_fk"
		}).onDelete("cascade"),
		collaboratorsUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "collaborators_user_id_user_id_fk"
		}).onDelete("cascade"),
		collaboratorsInvitedByUserIdFk: foreignKey({
			columns: [table.invitedBy],
			foreignColumns: [user.id],
			name: "collaborators_invited_by_user_id_fk"
		}),
	}
});

export const invoices = pgTable("invoices", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
	clientName: varchar("client_name", { length: 255 }),
	clientEmail: varchar("client_email", { length: 255 }),
	status: varchar("status", { length: 20 }).default('unpaid'),
	dueDate: timestamp("due_date", { mode: 'string' }),
	paidDate: timestamp("paid_date", { mode: 'string' }),
	subtotal: numeric("subtotal", { precision: 15, scale:  2 }).default('0').notNull(),
	tax: numeric("tax", { precision: 15, scale:  2 }).default('0').notNull(),
	total: numeric("total", { precision: 15, scale:  2 }).default('0').notNull(),
	items: jsonb("items").notNull(),
	notes: text("notes"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	deletedBy: text("deleted_by"),
	deletedReason: text("deleted_reason"),
},
(table) => {
	return {
		invoiceNumberIdx: index("invoices_invoice_number_idx").using("btree", table.invoiceNumber.asc().nullsLast()),
		workspaceIdIdx: index("invoices_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast()),
		invoicesWorkspaceIdWorkspacesIdFk: foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "invoices_workspace_id_workspaces_id_fk"
		}).onDelete("cascade"),
		invoicesDeletedByUserIdFk: foreignKey({
			columns: [table.deletedBy],
			foreignColumns: [user.id],
			name: "invoices_deleted_by_user_id_fk"
		}),
	}
});

export const menus = pgTable("menus", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id"),
	parentId: uuid("parent_id"),
	name: varchar("name", { length: 100 }).notNull(),
	label: varchar("label", { length: 100 }).notNull(),
	icon: varchar("icon", { length: 50 }),
	path: varchar("path", { length: 255 }),
	order: integer("order").default(0),
	isActive: boolean("is_active").default(true),
	permissions: jsonb("permissions"),
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		orderIdx: index("menus_order_idx").using("btree", table.order.asc().nullsLast()),
		parentIdIdx: index("menus_parent_id_idx").using("btree", table.parentId.asc().nullsLast()),
		workspaceIdIdx: index("menus_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast()),
		menusWorkspaceIdWorkspacesIdFk: foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "menus_workspace_id_workspaces_id_fk"
		}).onDelete("cascade"),
	}
});

export const transactions = pgTable("transactions", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	accountId: uuid("account_id").notNull(),
	categoryId: uuid("category_id"),
	amount: numeric("amount", { precision: 15, scale:  2 }).notNull(),
	type: varchar("type", { length: 20 }).notNull(),
	description: varchar("description", { length: 500 }),
	notes: text("notes"),
	date: timestamp("date", { mode: 'string' }).defaultNow().notNull(),
	invested: numeric("invested", { precision: 15, scale:  2 }).default('0'),
	platform: varchar("platform", { length: 100 }),
	metadata: jsonb("metadata"),
	isStaging: boolean("is_staging").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	deletedBy: text("deleted_by"),
	deletedReason: text("deleted_reason"),
},
(table) => {
	return {
		accountIdIdx: index("transactions_account_id_idx").using("btree", table.accountId.asc().nullsLast()),
		categoryIdIdx: index("transactions_category_id_idx").using("btree", table.categoryId.asc().nullsLast()),
		dateIdx: index("transactions_date_idx").using("btree", table.date.asc().nullsLast()),
		platformIdx: index("transactions_platform_idx").using("btree", table.platform.asc().nullsLast()),
		workspaceIdIdx: index("transactions_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast()),
		transactionsWorkspaceIdWorkspacesIdFk: foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "transactions_workspace_id_workspaces_id_fk"
		}).onDelete("cascade"),
		transactionsAccountIdAccountsIdFk: foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "transactions_account_id_accounts_id_fk"
		}).onDelete("restrict"),
		transactionsCategoryIdCategoriesIdFk: foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "transactions_category_id_categories_id_fk"
		}).onDelete("set null"),
		transactionsDeletedByUserIdFk: foreignKey({
			columns: [table.deletedBy],
			foreignColumns: [user.id],
			name: "transactions_deleted_by_user_id_fk"
		}),
	}
});

export const accounts = pgTable("accounts", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	type: varchar("type", { length: 20 }).notNull(),
	balance: numeric("balance", { precision: 15, scale:  2 }).default('0').notNull(),
	currency: varchar("currency", { length: 3 }).default('IDR'),
	accountNumber: varchar("account_number", { length: 50 }),
	bankName: varchar("bank_name", { length: 100 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	deletedBy: text("deleted_by"),
	deletedReason: text("deleted_reason"),
},
(table) => {
	return {
		workspaceIdIdx: index("accounts_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast()),
		accountsWorkspaceIdWorkspacesIdFk: foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "accounts_workspace_id_workspaces_id_fk"
		}).onDelete("cascade"),
		accountsDeletedByUserIdFk: foreignKey({
			columns: [table.deletedBy],
			foreignColumns: [user.id],
			name: "accounts_deleted_by_user_id_fk"
		}),
	}
});

export const account = pgTable("account", {
	id: text("id").primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text("scope"),
	password: text("password"),
	issuer: text("issuer"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
},
(table) => {
	return {
		userIdIdx: index("account_userId_idx").using("btree", table.userId.asc().nullsLast()),
		accountUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}).onDelete("cascade"),
	}
});

export const session = pgTable("session", {
	id: text("id").primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text("token").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
},
(table) => {
	return {
		userIdIdx: index("session_userId_idx").using("btree", table.userId.asc().nullsLast()),
		sessionUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}).onDelete("cascade"),
		sessionTokenUnique: unique("session_token_unique").on(table.token),
	}
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey().notNull(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		identifierIdx: index("verification_identifier_idx").using("btree", table.identifier.asc().nullsLast()),
	}
});

export const workspaces = pgTable("workspaces", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	ownerId: text("owner_id").notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	type: varchar("type", { length: 20 }).notNull(),
	currency: varchar("currency", { length: 3 }).default('IDR'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	deletedBy: text("deleted_by"),
	deletedReason: text("deleted_reason"),
},
(table) => {
	return {
		ownerIdIdx: index("workspaces_owner_id_idx").using("btree", table.ownerId.asc().nullsLast()),
		workspacesOwnerIdUserIdFk: foreignKey({
			columns: [table.ownerId],
			foreignColumns: [user.id],
			name: "workspaces_owner_id_user_id_fk"
		}).onDelete("cascade"),
		workspacesDeletedByUserIdFk: foreignKey({
			columns: [table.deletedBy],
			foreignColumns: [user.id],
			name: "workspaces_deleted_by_user_id_fk"
		}),
	}
});