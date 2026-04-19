import { pgTable, text, timestamp, boolean, doublePrecision, primaryKey, unique, integer, index } from 'drizzle-orm/pg-core';

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
}, (t) => ({
	userIdIdx: index('sessions_user_id_idx').on(t.userId)
}));

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
		unq: unique().on(t.createdBy, t.slug),
		createdByIdx: index('lists_created_by_idx').on(t.createdBy)
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
		pk: primaryKey({ columns: [t.listId, t.userId] }),
		userIdIdx: index('list_users_user_id_idx').on(t.userId)
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
}, (t) => ({
	listIdIdx: index('items_list_id_idx').on(t.listId)
}));

export const rateLimits = pgTable('rate_limits', {
	key: text('key').primaryKey(),
	count: integer('count').notNull().default(0),
	resetAt: timestamp('reset_at').notNull()
});
