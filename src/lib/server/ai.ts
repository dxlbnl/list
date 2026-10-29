import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, gt, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './db/schema';
import { aiLinks, aiProposals, listUsers } from './db/schema';
import { error } from '@sveltejs/kit';
import { nanoid } from '$lib/utils';
import { aiProposalSchema, syncOperationSchema, type AiProposal } from '$lib/validations';
import { processSyncBatch } from './sync';

// All functions run inside the caller's transaction. Link locks serialize revocation
// with agent requests; proposal locks serialize edits and human decisions.
export type AiDb = Pick<PgDatabase<PgQueryResultHKT, typeof schema>, 'select' | 'insert' | 'update' | 'execute'>;
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const secretToken = () => randomBytes(32).toString('base64url');
export const publicProposal = (row: unknown) => aiProposalSchema.parse(row);

export async function requireMember(db: AiDb, listId: string, userId?: string) {
 if (!userId) error(401, 'Unauthorized');
 const [member] = await db.select().from(listUsers).where(and(eq(listUsers.listId, listId), eq(listUsers.userId, userId))).for('share');
 if (!member) error(403, 'Forbidden');
}

export async function requireLink(db: AiDb, token: string) {
 const [link] = await db.select().from(aiLinks).where(and(eq(aiLinks.tokenHash, hashToken(token)), isNull(aiLinks.revokedAt))).for('update');
 if (!link) error(401, 'Invalid or revoked AI token');
 return link;
}

export async function createProposal(db: AiDb, token: string, items: AiProposal['items']) {
 const link = await requireLink(db, token);
 const editToken = secretToken();
 const [row] = await db.insert(aiProposals).values({
  id: nanoid(), listId: link.listId, linkId: link.id, editTokenHash: hashToken(editToken),
  items, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
 }).returning();
 return { ...publicProposal(row), editToken };
}

export async function agentProposal(db: AiDb, token: string, id: string, editToken: string) {
 const link = await requireLink(db, token);
 const [row] = await db.select().from(aiProposals).where(and(
  eq(aiProposals.id, id), eq(aiProposals.linkId, link.id),
  eq(aiProposals.editTokenHash, hashToken(editToken))
 )).for('update');
 if (!row) error(404, 'Proposal not found');
 return expireProposal(db, row);
}

async function expireProposal(db: AiDb, row: typeof aiProposals.$inferSelect) {
 if (row.status === 'pending' && row.expiresAt.getTime() <= Date.now()) {
  const [expired] = await db.update(aiProposals).set({ status: 'expired', version: row.version + 1 }).where(eq(aiProposals.id, row.id)).returning();
  return expired;
 }
 return row;
}

export async function patchProposal(db: AiDb, token: string, id: string, editToken: string, version: number, items: AiProposal['items']) {
 const row = await agentProposal(db, token, id, editToken);
 // Return conflicts as data so the expiration transition can commit.
 if (row.status !== 'pending' || row.version !== version) return null;
 const [updated] = await db.update(aiProposals).set({ items, version: version + 1 }).where(eq(aiProposals.id, id)).returning();
 return publicProposal(updated);
}

export async function decideProposal(db: AiDb, listId: string, userId: string | undefined, id: string, version: number, decision: 'accepted' | 'rejected') {
 await requireMember(db, listId, userId);
 const [found] = await db.select().from(aiProposals).where(and(eq(aiProposals.id, id), eq(aiProposals.listId, listId))).for('update');
 if (!found) error(404, 'Proposal not found');
 const row = await expireProposal(db, found);
 // Retries of an already completed decision are harmless, even with the old version.
 if (row.status === decision) return publicProposal(row);
 if (row.status !== 'pending' || row.version !== version) return null;
 if (decision === 'accepted') {
  const now = new Date();
  const operations = row.items.map((item, index) => syncOperationSchema.parse({
   id: nanoid(), entity: 'item', type: 'INSERT', data: {
    ...item, id: nanoid(), listId, rank: now.getTime() + index,
    done: false, deletedAt: null, updatedAt: now
   }
  }));
  const result = await processSyncBatch(db, userId!, operations);
  if (result.results.some((r) => r.status !== 'success')) throw new Error('AI acceptance sync failed');
 }
 const [updated] = await db.update(aiProposals).set({ status: decision, version: version + 1 }).where(eq(aiProposals.id, id)).returning();
 return publicProposal(updated);
}

export async function pendingProposals(db: AiDb, listId: string, userId?: string) {
 await requireMember(db, listId, userId);
 await db.update(aiProposals).set({ status: 'expired', version: sql`${aiProposals.version} + 1` }).where(and(
  eq(aiProposals.listId, listId), eq(aiProposals.status, 'pending'), sql`${aiProposals.expiresAt} <= now()`
 ));
 return (await db.select().from(aiProposals).where(and(eq(aiProposals.listId, listId), eq(aiProposals.status, 'pending'), gt(aiProposals.expiresAt, new Date()))).limit(100)).map(publicProposal);
}
