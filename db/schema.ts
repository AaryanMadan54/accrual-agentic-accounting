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

export const agentRuns = sqliteTable('agent_runs', {
  owner: text('owner').notNull(),
  workspace: text('workspace').notNull(),
  id: text('id').notNull(),
  action: text('action').notNull(),
  inputHash: text('input_hash').notNull(),
  source: text('source').notNull(),
  output: text('output'),
  status: text('status').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
}, table => [primaryKey({ columns: [table.owner, table.workspace, table.id] })]);
