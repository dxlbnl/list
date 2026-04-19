import { pgTable, text, timestamp, boolean, doublePrecision, primaryKey, unique } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
	id: text('id').primaryKey(),
	email: text('email').unique(),
	email_verified: boolean('email_verified').notNull().default(false),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const sessions = pgTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' })
});

export const magicLinks = pgTable('magic_links', {
	token: text('token').primaryKey(),
	email: text('email'), // Nullable for session cloning
	userIdToMerge: text('user_id_to_merge').references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at').notNull()
});

export const lists = pgTable(
	'lists',
	{
		id: text('id').primaryKey(),
		slug: text('slug').notNull(),
		name: text('name').notNull(),
		createdBy: text('created_by')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(t) => ({
		unq: unique().on(t.createdBy, t.slug)
	})
);

export const listUsers = pgTable(
	'list_users',
	{
		listId: text('list_id')
			.notNull()
			.references(() => lists.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
	},
	(t) => ({
		pk: primaryKey({ columns: [t.listId, t.userId] })
	})
);

export const listInvites = pgTable('list_invites', {
	token: text('token').primaryKey(),
	listId: text('list_id')
		.notNull()
		.references(() => lists.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at') // Nullable for permanent links
});

export const items = pgTable('items', {
	id: text('id').primaryKey(),
	listId: text('list_id')
		.notNull()
		.references(() => lists.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	groupName: text('group_name'),
	rank: doublePrecision('rank').notNull(),
	done: boolean('done').notNull().default(false),
	deletedAt: timestamp('deleted_at'),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});
