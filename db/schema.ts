import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// Append-only checkpoints. One insert commits a complete accounting transaction.
// The primary key rejects concurrent stale writers without partial postings.
export const revisions = sqliteTable('workspace_revisions', {
  owner: text('owner').notNull(),
  workspace: text('workspace').notNull(),
  revision: integer('revision').notNull(),
  state: text('state').notNull(),
  createdAt: text('created_at').notNull(),
}, table => [primaryKey({ columns: [table.owner, table.workspace, table.revision] })]);
