import { pgTable, text, timestamp, boolean, doublePrecision, primaryKey, unique, uniqueIndex, integer, index, bigint, pgSequence, jsonb, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/** Server-assigned monotonic cursor source — bumped on every item/list upsert in the sync CTE. */
export const syncSeq = pgSequence('sync_seq');

export const users = pgTable('users', {
	id: text('id').primaryKey(),
	email: text('email').unique(),
	email_verified: boolean('email_verified').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	lastActivityAt: timestamp('last_activity_at', { withTimezone: true })
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
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
}, (t) => ({
	userIdToMergeIdx: index('magic_links_user_id_to_merge_idx').on(t.userIdToMerge)
}));

export const lists = pgTable(
	'lists',
	{
		id: text('id').primaryKey(),
		slug: text('slug').notNull(),
		name: text('name').notNull(),
		createdBy: text('created_by')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		updatedSeq: bigint('updated_seq', { mode: 'number' }).notNull().default(sql`nextval('sync_seq')`)
	},
	(t) => ({
		unq: unique().on(t.createdBy, t.slug),
		createdByIdx: index('lists_created_by_idx').on(t.createdBy),
		updatedSeqIdx: index('lists_updated_seq_idx').on(t.updatedSeq)
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
	expiresAt: timestamp('expires_at', { withTimezone: true }) // Nullable for permanent links
}, (t) => ({
	listIdIdx: index('list_invites_list_id_idx').on(t.listId)
}));

export const items = pgTable('items', {
	id: text('id').primaryKey(),
	listId: text('list_id')
		.notNull()
		.references(() => lists.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	groupName: text('group_name'),
	rank: doublePrecision('rank').notNull(),
	done: boolean('done').notNull().default(false),
	deletedAt: timestamp('deleted_at', { withTimezone: true }),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	updatedSeq: bigint('updated_seq', { mode: 'number' }).notNull().default(sql`nextval('sync_seq')`)
}, (t) => ({
	listIdIdx: index('items_list_id_idx').on(t.listId),
	updatedSeqIdx: index('items_updated_seq_idx').on(t.updatedSeq)
}));

export const rateLimits = pgTable('rate_limits', {
	key: text('key').primaryKey(),
	count: integer('count').notNull().default(0),
	resetAt: timestamp('reset_at', { withTimezone: true }).notNull()
});

export const aiConnections = pgTable('ai_connections', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	clientId: text('client_id').notNull(),
	scopes: text('scopes').array().notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	activatedAt: timestamp('activated_at', { withTimezone: true }),
	revokedAt: timestamp('revoked_at', { withTimezone: true })
}, (t) => ({
	activeConnection: uniqueIndex('ai_connections_active_user_client').on(t.userId, t.clientId)
		.where(sql`${t.activatedAt} is not null and ${t.revokedAt} is null`)
})).enableRLS();

export const aiOAuthRequests = pgTable('ai_oauth_requests', {
	hash: text('hash').primaryKey(),
	sessionHash: text('session_hash'),
	loginTokenHash: text('login_token_hash'),
	clientId: text('client_id').notNull(),
	query: jsonb('query').$type<Record<string, string>>().notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	consumedAt: timestamp('consumed_at', { withTimezone: true })
}).enableRLS();

export const aiOAuthCodes = pgTable('ai_oauth_codes', {
	hash: text('hash').primaryKey(),
	connectionId: text('connection_id').notNull().references(() => aiConnections.id, { onDelete: 'cascade' }),
	redirectUri: text('redirect_uri').notNull(),
	challenge: text('challenge').notNull(),
	resource: text('resource').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	consumedAt: timestamp('consumed_at', { withTimezone: true })
}).enableRLS();

export const aiOAuthTokens = pgTable('ai_oauth_tokens', {
	hash: text('hash').primaryKey(),
	connectionId: text('connection_id').notNull().references(() => aiConnections.id, { onDelete: 'cascade' }),
	kind: text('kind').$type<'access' | 'refresh'>().notNull(),
	resource: text('resource').notNull(),
	scopes: text('scopes').array().notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	consumedAt: timestamp('consumed_at', { withTimezone: true })
}, (t) => ({
	connectionIdx: index('ai_oauth_tokens_connection_idx').on(t.connectionId),
	expiryIdx: index('ai_oauth_tokens_expiry_idx').on(t.expiresAt),
	kindCheck: check('ai_oauth_tokens_kind_check', sql`${t.kind} in ('access', 'refresh')`)
})).enableRLS();

export const aiProposals = pgTable('ai_proposals', {
 id: text('id').primaryKey(),
 connectionId: text('connection_id').references(() => aiConnections.id, { onDelete: 'set null' }),
 requestId: text('request_id'),
 requestHash: text('request_hash'),
 listId: text('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
 items: jsonb('items').$type<import('$lib/validations').AiProposal['items']>().notNull(),
 version: integer('version').notNull().default(1),
 status: text('status').$type<import('$lib/validations').AiProposal['status']>().notNull().default('pending'),
 expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
 createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
 listIdx: index('ai_proposals_list_status_idx').on(t.listId, t.status),
 requestIdx: uniqueIndex('ai_proposals_connection_request_idx').on(t.connectionId, t.requestId),
 statusCheck: check('ai_proposals_status_check', sql`${t.status} in ('pending', 'accepted', 'rejected', 'expired')`),
 versionCheck: check('ai_proposals_version_check', sql`${t.version} > 0`)
})).enableRLS();
