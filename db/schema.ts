import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const ledger = sqliteTable('ledger', { id: integer('id').primaryKey(), revision: integer('revision').notNull(), stamp: text('stamp').notNull(), data: text('data').notNull() });
export const accounts = sqliteTable('accounts', { wallet: text('wallet').primaryKey(), data: text('data').notNull() });
export const operations = sqliteTable('operations', { id: text('id').primaryKey(), fingerprint: text('fingerprint').notNull(), result: text('result').notNull() });
export const challenges = sqliteTable('challenges', { id: text('id').primaryKey(), wallet: text('wallet').notNull(), message: text('message').notNull(), expires: integer('expires').notNull() });
export const sessions = sqliteTable('sessions', { hash: text('hash').primaryKey(), wallet: text('wallet').notNull(), expires: integer('expires').notNull() });
export const limits = sqliteTable('limits', { id: text('id').primaryKey(), count: integer('count').notNull(), expires: integer('expires').notNull() });
