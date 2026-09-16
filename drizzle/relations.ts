import { relations } from "drizzle-orm/relations";
import { workspaces, documents, transactions, user, auditLogs, categories, collaborators, invoices, menus, accounts, account, session } from "./schema";

export const documentsRelations = relations(documents, ({one}) => ({
	workspace: one(workspaces, {
		fields: [documents.workspaceId],
		references: [workspaces.id]
	}),
	transaction: one(transactions, {
		fields: [documents.transactionId],
		references: [transactions.id]
	}),
	user_uploadedBy: one(user, {
		fields: [documents.uploadedBy],
		references: [user.id],
		relationName: "documents_uploadedBy_user_id"
	}),
	user_deletedBy: one(user, {
		fields: [documents.deletedBy],
		references: [user.id],
		relationName: "documents_deletedBy_user_id"
	}),
}));

export const workspacesRelations = relations(workspaces, ({one, many}) => ({
	documents: many(documents),
	auditLogs: many(auditLogs),
	categories: many(categories),
	collaborators: many(collaborators),
	invoices: many(invoices),
	menus: many(menus),
	transactions: many(transactions),
	accounts: many(accounts),
	user_ownerId: one(user, {
		fields: [workspaces.ownerId],
		references: [user.id],
		relationName: "workspaces_ownerId_user_id"
	}),
	user_deletedBy: one(user, {
		fields: [workspaces.deletedBy],
		references: [user.id],
		relationName: "workspaces_deletedBy_user_id"
	}),
}));

export const transactionsRelations = relations(transactions, ({one, many}) => ({
	documents: many(documents),
	workspace: one(workspaces, {
		fields: [transactions.workspaceId],
		references: [workspaces.id]
	}),
	account: one(accounts, {
		fields: [transactions.accountId],
		references: [accounts.id]
	}),
	category: one(categories, {
		fields: [transactions.categoryId],
		references: [categories.id]
	}),
	user: one(user, {
		fields: [transactions.deletedBy],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	documents_uploadedBy: many(documents, {
		relationName: "documents_uploadedBy_user_id"
	}),
	documents_deletedBy: many(documents, {
		relationName: "documents_deletedBy_user_id"
	}),
	auditLogs: many(auditLogs),
	categories: many(categories),
	collaborators_userId: many(collaborators, {
		relationName: "collaborators_userId_user_id"
	}),
	collaborators_invitedBy: many(collaborators, {
		relationName: "collaborators_invitedBy_user_id"
	}),
	invoices: many(invoices),
	transactions: many(transactions),
	accounts_deletedBy: many(accounts),
	accounts_userId: many(account),
	sessions: many(session),
	workspaces_ownerId: many(workspaces, {
		relationName: "workspaces_ownerId_user_id"
	}),
	workspaces_deletedBy: many(workspaces, {
		relationName: "workspaces_deletedBy_user_id"
	}),
}));

export const auditLogsRelations = relations(auditLogs, ({one}) => ({
	workspace: one(workspaces, {
		fields: [auditLogs.workspaceId],
		references: [workspaces.id]
	}),
	user: one(user, {
		fields: [auditLogs.userId],
		references: [user.id]
	}),
}));

export const categoriesRelations = relations(categories, ({one, many}) => ({
	workspace: one(workspaces, {
		fields: [categories.workspaceId],
		references: [workspaces.id]
	}),
	user: one(user, {
		fields: [categories.deletedBy],
		references: [user.id]
	}),
	transactions: many(transactions),
}));

export const collaboratorsRelations = relations(collaborators, ({one}) => ({
	workspace: one(workspaces, {
		fields: [collaborators.workspaceId],
		references: [workspaces.id]
	}),
	user_userId: one(user, {
		fields: [collaborators.userId],
		references: [user.id],
		relationName: "collaborators_userId_user_id"
	}),
	user_invitedBy: one(user, {
		fields: [collaborators.invitedBy],
		references: [user.id],
		relationName: "collaborators_invitedBy_user_id"
	}),
}));

export const invoicesRelations = relations(invoices, ({one}) => ({
	workspace: one(workspaces, {
		fields: [invoices.workspaceId],
		references: [workspaces.id]
	}),
	user: one(user, {
		fields: [invoices.deletedBy],
		references: [user.id]
	}),
}));

export const menusRelations = relations(menus, ({one}) => ({
	workspace: one(workspaces, {
		fields: [menus.workspaceId],
		references: [workspaces.id]
	}),
}));

export const accountsRelations = relations(accounts, ({one, many}) => ({
	transactions: many(transactions),
	workspace: one(workspaces, {
		fields: [accounts.workspaceId],
		references: [workspaces.id]
	}),
	user: one(user, {
		fields: [accounts.deletedBy],
		references: [user.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));