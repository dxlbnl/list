import { z } from 'zod';

export const syncOperationSchema = z.object({
	id: z.union([z.string(), z.number()]),
	entity: z.enum(['list', 'item']),
	entityId: z.string(),
	type: z.enum(['INSERT', 'UPDATE', 'DELETE']),
	data: z.any(),
	timestamp: z.number().optional()
});

export const syncRequestSchema = z.object({
	operations: z.array(syncOperationSchema),
	clientId: z.string().optional()
});

export const shareListRequestSchema = z.object({
	expiresAt: z.string().nullable().optional()
});

export const cloneSessionRequestSchema = z.object({}); // Currently empty but good for consistency
