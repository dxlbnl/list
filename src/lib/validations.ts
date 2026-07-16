import { z } from 'zod';

/**
 * MASTER SCHEMAS
 * These define the source of truth for the entity shapes.
 */
export const itemSchema = z.object({
	id: z.string(),
	listId: z.string(),
	name: z.string(),
	groupName: z.string(),
	rank: z.number(),
	done: z.boolean(),
	deletedAt: z.coerce.date().nullable(),
	updatedAt: z.coerce.date(),
	isLocalOnly: z.boolean().optional(),
});

export const listSchema = z.object({
	id: z.string(),
	slug: z.string(),
	name: z.string(),
	createdBy: z.string(),
	createdAt: z.coerce.date(),
	isLocalOnly: z.boolean().optional(),
});

// Types for the local database
export type LocalItem = z.infer<typeof itemSchema>;
export type LocalList = z.infer<typeof listSchema>;

// These represent the JSON-serialized versions of our local types (Dates are strings over the wire)
export type ApiItem = Omit<LocalItem, 'updatedAt' | 'deletedAt' | 'createdAt'> & {
	updatedAt: string;
	deletedAt: string | null;
	createdAt?: string; // Optional for partial returns
};
export type ApiList = Omit<LocalList, 'createdAt'> & {
	createdAt: string;
};

/**
 * DATABASE SHAPES (Postgres snake_case)
 * Full versions for Realtime and full-row operations.
 */
export const itemDatabaseSchema = itemSchema.transform((val) => ({
	id: val.id,
	list_id: val.listId,
	name: val.name,
	group_name: val.groupName,
	rank: val.rank,
	done: val.done,
	deleted_at: val.deletedAt ? new Date(val.deletedAt).toISOString() : null,
	updated_at: val.updatedAt ? new Date(val.updatedAt).toISOString() : new Date().toISOString()
}));

export const listDatabaseSchema = listSchema.transform((val) => ({
	id: val.id,
	slug: val.slug,
	name: val.name,
	created_by: val.createdBy,
	created_at: val.createdAt ? new Date(val.createdAt).toISOString() : new Date().toISOString()
}));

export type DatabaseItem = z.infer<typeof itemDatabaseSchema>;
export type DatabaseList = z.infer<typeof listDatabaseSchema>;

/**
 * SYNC SCHEMAS
 * Partial delta versions — types derived from DatabaseItem/DatabaseList so there's no duplication.
 */
type ItemSyncData = Partial<DatabaseItem> & Required<Pick<DatabaseItem, 'id' | 'updated_at'>>;
type ListSyncData = Partial<DatabaseList> & Required<Pick<DatabaseList, 'id'>>;

const itemSyncDataSchema = itemSchema.partial().extend({ id: z.string() }).transform((val): ItemSyncData => ({
	id: val.id,
	list_id: val.listId,
	name: val.name,
	group_name: val.groupName,
	rank: val.rank,
	done: val.done,
	deleted_at: val.deletedAt?.toISOString() ?? null,
	updated_at: val.updatedAt?.toISOString() ?? new Date().toISOString(),
}));

const listSyncDataSchema = listSchema.partial().extend({ id: z.string() }).transform((val): ListSyncData => ({
	id: val.id,
	slug: val.slug,
	name: val.name,
	created_by: val.createdBy,
	created_at: val.createdAt?.toISOString(),
}));

export const syncOperationSchema = z.discriminatedUnion('entity', [
	z.object({
		id: z.union([z.string(), z.number()]),
		entity: z.literal('item'),
		type: z.enum(['INSERT', 'UPDATE', 'DELETE']),
		data: itemSyncDataSchema,
		timestamp: z.number().optional()
	}),
	z.object({
		id: z.union([z.string(), z.number()]),
		entity: z.literal('list'),
		type: z.enum(['INSERT', 'UPDATE', 'DELETE']),
		data: listSyncDataSchema,
		timestamp: z.number().optional()
	})
]);

export const syncRequestSchema = z.object({
	operations: z.array(syncOperationSchema).max(500),
	clientId: z.string().optional(),
	cursor: z.number().optional()
});

export type SyncOperation = z.infer<typeof syncOperationSchema>;
export type ItemOperation = Extract<SyncOperation, { entity: 'item' }>;
export type ListOperation = Extract<SyncOperation, { entity: 'list' }>;

export type SyncOperationInput = z.input<typeof syncOperationSchema>;
export type ItemOperationInput = Extract<SyncOperationInput, { entity: 'item' }>;
export type ListOperationInput = Extract<SyncOperationInput, { entity: 'list' }>;

export const shareListRequestSchema = z.object({
	expiresAt: z.string().nullable().optional()
});

export const cloneSessionRequestSchema = z.object({});
