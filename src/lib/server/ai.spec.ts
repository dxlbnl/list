import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, type TestDb } from '$lib/test/pglite';
import { world } from '$lib/test/fixtures';
import { listSchema, aiCreateSchema, aiPatchSchema } from '$lib/validations';
import { users, lists, listUsers, aiLinks, aiProposals, items } from './db/schema';
import { createProposal, agentProposal, patchProposal, decideProposal, hashToken, secretToken } from './ai';

const list = world.generate(listSchema);
const otherList = world.generate(listSchema);
const input = world.generate(aiCreateSchema, { overrides: { items: [{ name: 'Melk', groupName: '' }, { name: 'Brood', groupName: 'Bakker' }] } });
let h: TestDb;
let token: string;
let otherToken: string;
let linkId: string;
beforeAll(async () => {
 h = await createTestDb();
 await h.db.insert(users).values([{ id: list.createdBy }, { id: otherList.createdBy }]);
 await h.db.insert(lists).values([list, otherList]);
 await h.db.insert(listUsers).values([{ listId: list.id, userId: list.createdBy }, { listId: otherList.id, userId: otherList.createdBy }]);
 token = secretToken(); otherToken = secretToken(); linkId = secretToken();
 await h.db.insert(aiLinks).values([{ id: linkId, listId: list.id, tokenHash: hashToken(token) }, { id: secretToken(), listId: otherList.id, tokenHash: hashToken(otherToken) }]);
}, 30000);
afterAll(async () => { await h?.close(); });

describe('AI proposal capabilities and lifecycle', () => {
 it('stores hashes, scopes tokens, rejects invalid edit credentials and never directly adds items', async () => {
  const proposal = await h.db.transaction((tx) => createProposal(tx, token, input.items));
  const [stored] = await h.db.select().from(aiProposals).where(eq(aiProposals.id, proposal.id));
  expect(stored.editTokenHash).toBe(hashToken(proposal.editToken));
  expect(JSON.stringify(stored)).not.toContain(proposal.editToken);
  expect(proposal).not.toHaveProperty('editTokenHash');
  expect(proposal.status).toBe('pending');
  expect(await h.db.select().from(items)).toHaveLength(0);
  await expect(h.db.transaction((tx) => agentProposal(tx, otherToken, proposal.id, proposal.editToken))).rejects.toMatchObject({ status: 404 });
  await expect(h.db.transaction((tx) => agentProposal(tx, token, proposal.id, secretToken()))).rejects.toMatchObject({ status: 404 });
 });
 it('uses optimistic versions and accepts through sync exactly once, including concurrent retries', async () => {
  const proposal = await h.db.transaction((tx) => createProposal(tx, token, input.items));
  expect(await h.db.transaction((tx) => patchProposal(tx, token, proposal.id, proposal.editToken, 99, input.items))).toBeNull();
  const updated = await h.db.transaction((tx) => patchProposal(tx, token, proposal.id, proposal.editToken, 1, input.items));
  expect(updated?.version).toBe(2);
  expect(await h.db.transaction((tx) => decideProposal(tx, list.id, list.createdBy, proposal.id, 1, 'accepted'))).toBeNull();
  await expect(h.db.transaction((tx) => decideProposal(tx, list.id, otherList.createdBy, proposal.id, 2, 'accepted'))).rejects.toMatchObject({ status: 403 });
  const results = await Promise.all([1, 2].map(() => h.db.transaction((tx) => decideProposal(tx, list.id, list.createdBy, proposal.id, 2, 'accepted'))));
  expect(results.every((r) => r?.status === 'accepted')).toBe(true);
  const rows = await h.db.select().from(items).where(eq(items.listId, list.id));
  expect(rows).toHaveLength(input.items.length);
  expect(rows.every((r) => r.updatedSeq > 0)).toBe(true);
  expect(await h.db.transaction((tx) => patchProposal(tx, token, proposal.id, proposal.editToken, 3, input.items))).toBeNull();
  expect(await h.db.transaction((tx) => decideProposal(tx, list.id, list.createdBy, proposal.id, 3, 'rejected'))).toBeNull();
 });
 it('rejects permanently and expires proposals without extending their lifetime', async () => {
  const proposal = await h.db.transaction((tx) => createProposal(tx, token, input.items));
  expect((await h.db.transaction((tx) => decideProposal(tx, list.id, list.createdBy, proposal.id, 1, 'rejected')))?.status).toBe('rejected');
  expect(await h.db.transaction((tx) => patchProposal(tx, token, proposal.id, proposal.editToken, 2, input.items))).toBeNull();
  const expired = await h.db.transaction((tx) => createProposal(tx, token, input.items));
  await h.db.update(aiProposals).set({ expiresAt: new Date(0) }).where(eq(aiProposals.id, expired.id));
  expect(await h.db.transaction((tx) => decideProposal(tx, list.id, list.createdBy, expired.id, 1, 'accepted'))).toBeNull();
  expect((await h.db.transaction((tx) => agentProposal(tx, token, expired.id, expired.editToken))).status).toBe('expired');
 });
 it('rolls back both synchronized items and decision on transaction failure', async () => {
  const proposal = await h.db.transaction((tx) => createProposal(tx, token, input.items));
  const before = await h.db.select().from(items);
  await expect(h.db.transaction(async (tx) => {
   await decideProposal(tx, list.id, list.createdBy, proposal.id, 1, 'accepted');
   throw new Error('Simulated transaction failure');
  })).rejects.toThrow('Simulated transaction failure');
  expect(await h.db.select().from(items)).toHaveLength(before.length);
  expect((await h.db.transaction((tx) => agentProposal(tx, token, proposal.id, proposal.editToken))).status).toBe('pending');
 });
 it('revocation blocks creating, reading and editing proposals', async () => {
  const proposal = await h.db.transaction((tx) => createProposal(tx, token, input.items));
  await h.db.update(aiLinks).set({ revokedAt: new Date() }).where(eq(aiLinks.id, linkId));
  await expect(h.db.transaction((tx) => createProposal(tx, token, input.items))).rejects.toMatchObject({ status: 401 });
  await expect(h.db.transaction((tx) => agentProposal(tx, token, proposal.id, proposal.editToken))).rejects.toMatchObject({ status: 401 });
  await expect(h.db.transaction((tx) => patchProposal(tx, token, proposal.id, proposal.editToken, 1, input.items))).rejects.toMatchObject({ status: 401 });
 });
 it('validates bounded item payloads and excludes scope/status injection', () => {
  expect(aiCreateSchema.safeParse({ ...input, listId: otherList.id }).success).toBe(false);
  expect(aiCreateSchema.safeParse({ items: [] }).success).toBe(false);
  expect(aiCreateSchema.safeParse({ items: [{ name: '  ' }] }).success).toBe(false);
  expect(aiCreateSchema.safeParse({ items: Array(51).fill(input.items[0]) }).success).toBe(false);
  expect(aiPatchSchema.safeParse({ ...input, version: 0 }).success).toBe(false);
 });
});
