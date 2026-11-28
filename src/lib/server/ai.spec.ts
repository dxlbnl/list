import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, type TestDb } from '$lib/test/pglite';
import { world } from '$lib/test/fixtures';
import { itemSchema, listSchema, mcpProposalInputSchema, aiDecisionSchema } from '$lib/validations';
import { users, lists, listUsers, aiConnections, aiProposals, items } from './db/schema';
import { createConnectedProposal, decideProposal, pendingProposals } from './ai';

const list = world.generate(listSchema);
const unrelated = world.generate(listSchema);
const seeded = world.generate(itemSchema, {
	overrides: { listId: list.id, name: 'Meel', groupName: 'Bakker', done: false, deletedAt: null }
});
const input = mcpProposalInputSchema.parse({
	listId: list.id, items: [{ name: 'Melk' }, { name: 'Brood', groupName: 'Bakker' }]
});
let h: TestDb;
const connection = 'connection';
const otherConnection = 'another-connection';

beforeAll(async () => {
	h = await createTestDb();
	await h.db.insert(users).values([{ id: list.createdBy }, { id: unrelated.createdBy }]);
	await h.db.insert(lists).values([list, unrelated]);
	await h.db.insert(listUsers).values([
		{ listId: list.id, userId: list.createdBy }, { listId: unrelated.id, userId: unrelated.createdBy }
	]);
	await h.db.insert(aiConnections).values([
		{ id: connection, userId: list.createdBy, clientId: 'client-a', scopes: ['proposals:create'], activatedAt: new Date() },
		{ id: otherConnection, userId: list.createdBy, clientId: 'client-b', scopes: ['proposals:create'], activatedAt: new Date() }
	]);
	await h.db.insert(items).values(seeded);
}, 30000);

afterAll(async () => { await h?.close(); });

const propose = (request = input, connectionId = connection) =>
	h.db.transaction((tx) => createConnectedProposal(tx, connectionId, list.createdBy, request));
const decide = (id: string, version = 1, decision: 'accepted' | 'rejected' = 'accepted') =>
	h.db.transaction((tx) => decideProposal(tx, list.id, list.createdBy, id, { version, decision }));

describe('AI proposal lifecycle', () => {
	it('keeps proposals separate, validates current groups and enforces membership and ownership', async () => {
		const proposal = await propose();
		expect(proposal.status).toBe('pending');
		expect(await h.db.select().from(items)).toHaveLength(1);
		await expect(propose({ ...input, listId: unrelated.id })).rejects.toMatchObject({ status: 404 });
		await expect(h.db.transaction((tx) =>
			createConnectedProposal(tx, connection, unrelated.createdBy, input)
		)).rejects.toMatchObject({ status: 403 });
		await expect(propose({ ...input, items: [{ name: 'Cadeau', groupName: 'New' }] }))
			.rejects.toMatchObject({ missingGroups: ['New'], groups: ['Bakker'] });
	});

	it('handles version conflicts, produces synchronized items once and replays a stable request', async () => {
		const request = { ...input, requestId: 'retry' };
		const [proposal, retry] = await Promise.all([propose(request), propose(request)]);
		expect(retry).toEqual(proposal);
		await expect(propose({ ...request, items: [{ name: 'Andere', groupName: '' }] }))
			.rejects.toMatchObject({ status: 409 });
		await expect(decide(proposal.id, 99)).resolves.toBeNull();
		const accepted = await Promise.all([decide(proposal.id), decide(proposal.id)]);
		expect(accepted.every((p) => p?.status === 'accepted' && p.version === 2)).toBe(true);
		const added = (await h.db.select().from(items)).filter(({ id }) => id !== seeded.id);
		expect(added).toHaveLength(2);
		expect(added.every(({ updatedSeq }) => updatedSeq > 0)).toBe(true);
		await expect(propose(request)).resolves.toMatchObject({ id: proposal.id, status: 'accepted' });
	});

	it('rejects and expires proposals without mutating items', async () => {
		const rejected = await propose();
		const expired = await propose();
		await h.db.update(aiProposals).set({ expiresAt: new Date(0) }).where(eq(aiProposals.id, expired.id));
		const before = await h.db.select().from(items);
		await expect(decide(rejected.id, 1, 'rejected')).resolves.toMatchObject({ status: 'rejected' });
		await expect(decide(expired.id)).resolves.toBeNull();
		expect(await h.db.select().from(items)).toEqual(before);
		expect((await h.db.select().from(aiProposals).where(eq(aiProposals.id, expired.id)))[0].status).toBe('expired');
	});

	it('keeps a proposal open across group changes and accepts an explicit replacement', async () => {
		await h.db.insert(items).values({ ...seeded, id: 'vegetables', groupName: 'Markt' });
		const proposal = await propose({ ...input, items: [{ name: 'Boon', groupName: 'Markt' }] });
		await h.db.update(items).set({ groupName: 'Super' }).where(eq(items.id, 'vegetables'));
		await expect(decide(proposal.id)).rejects.toMatchObject({ missingGroups: ['Markt'] });
		const reassign = (to: string) => h.db.transaction((tx) =>
			decideProposal(tx, list.id, list.createdBy, proposal.id, {
				version: 1, decision: 'accepted', groupOverrides: [{ from: 'Markt', to }]
			}));
		await expect(reassign('Vanished')).rejects.toMatchObject({ missingGroups: ['Markt'] });
		await expect(reassign('Super')).resolves.toMatchObject({
			status: 'accepted', items: [{ name: 'Boon', groupName: 'Super' }]
		});
	});

	it('rolls back synchronized items and the decision together on failure', async () => {
		const proposal = await propose();
		const before = await h.db.select().from(items);
		await expect(h.db.transaction(async (tx) => {
			await decideProposal(tx, list.id, list.createdBy, proposal.id, { version: 1, decision: 'accepted' });
			throw new Error('Simulated failure');
		})).rejects.toThrow('Simulated failure');
		expect(await h.db.select().from(items)).toEqual(before);
		expect((await h.db.select().from(aiProposals).where(eq(aiProposals.id, proposal.id)))[0].status).toBe('pending');
	});

	it('caps pending proposals across connections and frees capacity on expiry', async () => {
		const pending = await h.db.transaction((tx) => pendingProposals(tx, list.id, list.createdBy));
		const [seed] = await h.db.select().from(aiProposals).where(eq(aiProposals.id, pending[0].id));
		await h.db.insert(aiProposals).values(Array.from({ length: 99 - pending.length }, (_, index) =>
			({ ...seed, id: 'cap-' + index, requestId: null })
		));
		const submissions = await Promise.allSettled([propose(), propose(input, otherConnection)]);
		expect(submissions.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
		expect(submissions).toContainEqual(expect.objectContaining({
			status: 'rejected', reason: expect.objectContaining({ status: 409 })
		}));
		await h.db.update(aiProposals).set({ expiresAt: new Date(0) }).where(eq(aiProposals.id, seed.id));
		await expect(propose()).resolves.toMatchObject({ status: 'pending' });
	});

	it('keeps the item limit and excludes injection of decision fields', () => {
		expect(mcpProposalInputSchema.safeParse({ ...input, status: 'accepted' }).success).toBe(false);
		expect(mcpProposalInputSchema.safeParse({ ...input, items: [] }).success).toBe(false);
		expect(mcpProposalInputSchema.safeParse({ ...input, items: Array(51).fill(input.items[0]) }).success).toBe(false);
		expect(aiDecisionSchema.safeParse({ version: 0, decision: 'accepted' }).success).toBe(false);
	});
});
