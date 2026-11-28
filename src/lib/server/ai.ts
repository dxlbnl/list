import { createHash } from 'node:crypto';
import { and, asc, count, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './db/schema';
import { aiConnections, aiProposals, items, lists, listUsers } from './db/schema';
import { error } from '@sveltejs/kit';
import { nanoid } from '$lib/utils';
import {
	aiProposalSchema, syncOperationSchema, type AiDecision, type AiProposal,
	type McpListCursor, type McpProposalInput
} from '$lib/validations';
import { processSyncBatch } from './sync';

const MAX_PENDING_PROPOSALS = 100;
const PAGE_SIZE = 100;

export type ListDb = PgDatabase<PgQueryResultHKT, typeof schema>;
export type AiDb = Pick<ListDb, 'select' | 'selectDistinct' | 'insert' | 'update' | 'execute'>;

export async function requireMember(db: AiDb, listId: string, userId?: string) {
	if (!userId) error(401, 'Unauthorized');
	const [member] = await db.select().from(listUsers)
		.where(and(eq(listUsers.listId, listId), eq(listUsers.userId, userId))).for('share');
	if (!member) error(404, 'List not found');
}

export async function requireActiveConnection(
	db: AiDb, id: string, userId: string, scope: 'lists:read' | 'proposals:create'
) {
	const [connection] = await db.select({ scopes: aiConnections.scopes }).from(aiConnections)
		.where(and(eq(aiConnections.id, id), eq(aiConnections.userId, userId),
			isNotNull(aiConnections.activatedAt), isNull(aiConnections.revokedAt))).for('share');
	if (!connection || !connection.scopes.includes(scope)) error(403, 'AI connection is unavailable');
}

export async function listConnectedUserLists(db: AiDb, userId: string, cursor?: string) {
	const page = await db.select({ id: lists.id, name: lists.name }).from(listUsers)
		.innerJoin(lists, eq(listUsers.listId, lists.id))
		.where(and(eq(listUsers.userId, userId), cursor ? gt(lists.id, cursor) : undefined))
		.orderBy(asc(lists.id)).limit(PAGE_SIZE + 1);
	const results = page.slice(0, PAGE_SIZE);
	return { lists: results, nextCursor: page.length > PAGE_SIZE ? results.at(-1)!.id : null };
}

async function currentGroups(db: AiDb, listId: string) {
	const groups = await db.selectDistinct({ name: items.groupName }).from(items)
		.where(and(eq(items.listId, listId), isNull(items.deletedAt))).orderBy(asc(items.groupName));
	return groups.flatMap(({ name }) => name ? [name] : []);
}

export async function getListContext(db: AiDb, userId: string, listId: string, cursor?: McpListCursor) {
	await requireMember(db, listId, userId);
	const [list] = await db.select({ id: lists.id, name: lists.name }).from(lists).where(eq(lists.id, listId));
	if (!list || (cursor && cursor.listId !== listId)) error(404, 'List not found');
	const groups = await currentGroups(db, listId);
	const page = await db.select({
		id: items.id, rank: items.rank, name: items.name, groupName: items.groupName, done: items.done
	}).from(items).where(and(
		eq(items.listId, listId), isNull(items.deletedAt),
		cursor ? or(gt(items.rank, cursor.rank), and(eq(items.rank, cursor.rank), gt(items.id, cursor.id))) : undefined
	)).orderBy(asc(items.rank), asc(items.id)).limit(PAGE_SIZE + 1);
	const results = page.slice(0, PAGE_SIZE);
	const last = results.at(-1);
	return {
		list, groups,
		items: results.map(({ name, groupName, done }) => ({ name, groupName: groupName ?? '', done })),
		nextCursor: page.length > PAGE_SIZE && last ? { listId, id: last.id, rank: last.rank } : null
	};
}

function activeProposals(listId: string) {
	return and(eq(aiProposals.listId, listId), eq(aiProposals.status, 'pending'),
		sql`${aiProposals.expiresAt} > statement_timestamp()`);
}

export class ProposalGroupConflict extends Error {
	constructor(public missingGroups: string[], public groups: string[]) {
		super('Choose an existing group or General.');
	}
}

async function validateGroups(db: AiDb, listId: string, proposed: AiProposal['items']) {
	const names = [...new Set(proposed.map(({ groupName }) => groupName).filter(Boolean))];
	if (!names.length) return;
	// Hold a row in each used group until commit so normal sync cannot rename or delete its last item.
	const valid = new Set<string>();
	for (const groupName of names.sort()) {
		const [witness] = await db.select({ id: items.id }).from(items).where(and(
			eq(items.listId, listId), isNull(items.deletedAt), eq(items.groupName, groupName)
		)).orderBy(asc(items.id)).limit(1).for('share');
		if (witness) valid.add(groupName);
	}
	const missing = names.filter((name) => !valid.has(name));
	if (missing.length) throw new ProposalGroupConflict(missing, await currentGroups(db, listId));
}

export async function createConnectedProposal(
	db: AiDb, connectionId: string, userId: string, input: McpProposalInput
) {
	const { listId, requestId } = input;
	await requireActiveConnection(db, connectionId, userId, 'proposals:create');
	await requireMember(db, listId, userId);
	const proposed = input.items.map(({ name, groupName }) => ({ name, groupName }));
	const requestHash = requestId ? createHash('sha256')
		.update(JSON.stringify([listId, proposed])).digest('hex') : null;
	if (requestId) {
		await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'ai-request:' + connectionId + ':' + requestId}, 0))`);
		const [previous] = await db.select().from(aiProposals).where(and(
			eq(aiProposals.connectionId, connectionId), eq(aiProposals.requestId, requestId)
		)).for('update');
		if (previous) {
			if (previous.requestHash !== requestHash) error(409, 'Request ID already used for different items');
			return aiProposalSchema.parse(await expireProposal(db, previous));
		}
	}
	await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'ai-proposals:' + listId}, 0))`);
	const [{ total }] = await db.select({ total: count() }).from(aiProposals).where(activeProposals(listId));
	if (total >= MAX_PENDING_PROPOSALS) error(409, 'This list already has 100 pending proposals');
	await validateGroups(db, listId, proposed);
	const [row] = await db.insert(aiProposals).values({
		id: nanoid(), listId, connectionId, requestId, requestHash, items: proposed,
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
	}).returning();
	return aiProposalSchema.parse(row);
}

async function expireProposal(db: AiDb, row: typeof aiProposals.$inferSelect) {
	if (row.status !== 'pending' || row.expiresAt.getTime() > Date.now()) return row;
	const [expired] = await db.update(aiProposals).set({ status: 'expired', version: row.version + 1 })
		.where(eq(aiProposals.id, row.id)).returning();
	return expired;
}

export async function decideProposal(
	db: AiDb, listId: string, userId: string | undefined, id: string, input: AiDecision
) {
	await requireMember(db, listId, userId);
	const [found] = await db.select().from(aiProposals).where(and(
		eq(aiProposals.id, id), eq(aiProposals.listId, listId)
	)).for('update');
	if (!found) error(404, 'Proposal not found');
	const row = await expireProposal(db, found);
	const { decision, version, groupOverrides } = input;
	if (row.status === decision && row.version === version + 1) return aiProposalSchema.parse(row);
	if (row.status !== 'pending' || row.version !== version) return null;

	let proposed = row.items;
	if (decision === 'accepted') {
		const replacements = new Map(groupOverrides?.map(({ from, to }) => [from, to]));
		if (groupOverrides?.length) {
			const existing = await currentGroups(db, listId);
			const source = new Set(row.items.map(({ groupName }) => groupName));
			if (replacements.size !== groupOverrides.length ||
				groupOverrides.some(({ from }) => !source.has(from) || existing.includes(from))) {
				error(409, 'The proposal groups changed. Refresh before reviewing');
			}
			proposed = row.items.map((item) => ({
				...item, groupName: replacements.get(item.groupName) ?? item.groupName
			}));
		}
		try {
			await validateGroups(db, listId, proposed);
		} catch (cause) {
			if (!(cause instanceof ProposalGroupConflict)) throw cause;
			const unresolved = [...new Set(row.items.flatMap(({ groupName }) =>
				cause.missingGroups.includes(replacements.get(groupName) ?? groupName) ? [groupName] : []
			))];
			throw new ProposalGroupConflict(unresolved, cause.groups);
		}
		const now = new Date();
		const operations = proposed.map((item, index) => syncOperationSchema.parse({
			id: nanoid(), entity: 'item', type: 'INSERT', data: {
				...item, id: nanoid(), listId, rank: now.getTime() + index,
				done: false, deletedAt: null, updatedAt: now
			}
		}));
		const result = await processSyncBatch(db, userId!, operations);
		if (result.results.some((operation) => operation.status !== 'success')) {
			throw new Error('AI acceptance sync failed');
		}
	}
	const [updated] = await db.update(aiProposals).set({ items: proposed, status: decision, version: version + 1 })
		.where(eq(aiProposals.id, id)).returning();
	return aiProposalSchema.parse(updated);
}

export async function pendingProposals(db: AiDb, listId: string, userId?: string) {
	await requireMember(db, listId, userId);
	await db.update(aiProposals).set({ status: 'expired', version: sql`${aiProposals.version} + 1` }).where(and(
		eq(aiProposals.listId, listId), eq(aiProposals.status, 'pending'), sql`${aiProposals.expiresAt} <= now()`
	));
	return (await db.select().from(aiProposals).where(activeProposals(listId))
		.orderBy(asc(aiProposals.createdAt), asc(aiProposals.id)).limit(MAX_PENDING_PROPOSALS)).map(publicProposal);
}

function publicProposal(row: typeof aiProposals.$inferSelect) {
	return aiProposalSchema.parse(row);
}
