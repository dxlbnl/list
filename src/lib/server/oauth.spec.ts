import { createHash } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, type TestDb } from '$lib/test/pglite';
import { world } from '$lib/test/fixtures';
import { itemSchema, listSchema } from '$lib/validations';
import { aiOAuthCodes, aiOAuthRequests, aiOAuthTokens, items, lists, listUsers, users } from './db/schema';
import {
	beginOAuthConsent, disconnectAiConnection, exchangeOAuthToken, finishOAuthConsent, getAiConnections,
	getOAuthConsent, matchesOAuthSession, resumeOAuthLogin, revokeOAuthToken, stageOAuthLogin, verifyMcpAccessToken,
	type OAuthConfig
} from './oauth';
import { createListMcpHandler } from './mcp';

const issuer = 'https://list.test';
const client = {
	id: 'test-client', name: 'Test chat', secret: 's'.repeat(40), redirectUris: ['https://client.test/return'],
	authenticationMethod: 'client_secret_post', scopes: ['lists:read', 'proposals:create', 'offline_access']
} satisfies OAuthConfig['clients'][number];
const basic = {
	...client, id: 'basic-client', authenticationMethod: 'client_secret_basic', secret: '+:a'.repeat(13)
} satisfies OAuthConfig['clients'][number];
const config: OAuthConfig = { issuer, resource: issuer + '/mcp', clients: [client, basic] };
const verifier = 'v'.repeat(43);
const challenge = createHash('sha256').update(verifier).digest('base64url');
const session = 'browser-session';
const list = world.generate(listSchema);
const shared = world.generate(listSchema);
let h: TestDb;

beforeAll(async () => {
	h = await createTestDb();
	await h.db.insert(users).values([{ id: list.createdBy }, { id: shared.createdBy }]);
	await h.db.insert(lists).values([list, shared]);
	await h.db.insert(listUsers).values([
		{ listId: list.id, userId: list.createdBy },
		{ listId: shared.id, userId: shared.createdBy },
		{ listId: shared.id, userId: list.createdBy }
	]);
}, 30000);

afterAll(async () => { await h?.close(); });

function authorizationUrl(overrides: Record<string, string> = {}) {
	const url = new URL(issuer + '/oauth/authorize');
	url.search = new URLSearchParams({
		client_id: client.id, redirect_uri: client.redirectUris[0], response_type: 'code',
		state: 'caller-state', code_challenge: challenge, code_challenge_method: 'S256', resource: config.resource,
		...overrides
	}).toString();
	return url;
}

async function start(overrides?: Record<string, string>, sessionId: string | null = session) {
	const { ticket } = await beginOAuthConsent(h.db, config, authorizationUrl(overrides), sessionId ?? undefined);
	const pending = await getOAuthConsent(h.db, ticket);
	return { ticket: ticket!, intent: pending!.hash };
}

async function approve(overrides?: Record<string, string>) {
	const { ticket, intent } = await start(overrides);
	const callback = new URL(await finishOAuthConsent(h.db, config, ticket, intent, session, list.createdBy, true));
	expect(callback.searchParams.get('iss')).toBe(issuer);
	expect(callback.searchParams.get('state')).toBe('caller-state');
	return callback.searchParams.get('code')!;
}

function postForm(path: string, fields: Record<string, string>, authClient: OAuthConfig['clients'][number] = client) {
	const body = new URLSearchParams(fields);
	const headers = new Headers({ 'content-type': 'application/x-www-form-urlencoded' });
	if (authClient === basic) {
		const encode = (value: string) => new URLSearchParams({ value }).toString().slice('value='.length);
		headers.set('authorization', 'Basic ' + Buffer.from(encode(basic.id) + ':' + encode(basic.secret)).toString('base64'));
	} else {
		body.set('client_id', authClient.id);
		body.set('client_secret', authClient.secret);
	}
	return new Request(issuer + path, { method: 'POST', body, headers });
}

function exchange(fields: Record<string, string>, authClient: OAuthConfig['clients'][number] = client) {
	return exchangeOAuthToken(h.db, config, postForm('/oauth/token', fields, authClient));
}

function codeExchange(code: string, fields?: Record<string, string>, authClient: OAuthConfig['clients'][number] = client) {
	return exchange({
		grant_type: 'authorization_code', code, code_verifier: verifier,
		redirect_uri: authClient.redirectUris[0], ...fields
	}, authClient);
}

function refresh(token: string, authClient: OAuthConfig['clients'][number] = client) {
	return exchange({ grant_type: 'refresh_token', refresh_token: token }, authClient);
}

const bearer = (token: string) => 'Bearer ' + token;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

describe('OAuth authorization and grants', () => {
	it('validates exact callbacks, client, PKCE, resource and scope', async () => {
		await expect(beginOAuthConsent(h.db, config, authorizationUrl({ client_id: 'unknown' }), session))
			.rejects.toMatchObject({ status: 400 });
		await expect(beginOAuthConsent(h.db, config, authorizationUrl({ redirect_uri: 'https://unregistered.test' }), session))
			.rejects.toMatchObject({ status: 400 });
		for (const override of [
			{ code_challenge: '' }, { code_challenge_method: 'plain' },
			{ resource: 'https://unrelated.test/mcp' }, { scope: 'everything' }
		] as Record<string, string>[]) {
			const response = await beginOAuthConsent(h.db, config, authorizationUrl(override), session);
			const location = new URL(response.location!);
			expect(location.searchParams.get('error')).toBe('invalid_request');
			expect(location.searchParams.get('state')).toBe('caller-state');
		}
	});

	it('binds consent to its browser session and email, supports cancellation and expires', async () => {
		const { ticket, intent } = await start(undefined, null);
		expect(matchesOAuthSession((await getOAuthConsent(h.db, ticket))!, session)).toBe(false);
		await stageOAuthLogin(h.db, ticket, 'mail-token');
		expect(await resumeOAuthLogin(h.db, 'x'.repeat(43), 'mail-token', session)).toBe(false);
		expect(await resumeOAuthLogin(h.db, ticket, 'different-mail-token', session)).toBe(false);
		expect(await resumeOAuthLogin(h.db, ticket, 'mail-token', session)).toBe(true);
		await expect(finishOAuthConsent(h.db, config, ticket, intent, 'new-session', list.createdBy, true))
			.rejects.toMatchObject({ status: 400 });
		const denial = new URL(await finishOAuthConsent(h.db, config, ticket, intent, session, list.createdBy, false));
		expect(denial.searchParams.get('error')).toBe('access_denied');
		expect(denial.searchParams.get('state')).toBe('caller-state');
		expect(await getOAuthConsent(h.db, ticket)).toBeUndefined();
		const expired = await start();
		await h.db.update(aiOAuthRequests).set({ expiresAt: new Date(0) }).where(eq(aiOAuthRequests.hash, expired.intent));
		expect(await getOAuthConsent(h.db, expired.ticket)).toBeUndefined();
	});

	it('checks verifier, client and audience and spends each code only once', async () => {
		const invalid = await approve();
		expect((await codeExchange(invalid, { code_verifier: 'w'.repeat(43) })).status).toBe(400);
		expect((await codeExchange(invalid)).status).toBe(400);
		const expired = await approve();
		await h.db.update(aiOAuthCodes).set({ expiresAt: new Date(0) }).where(eq(aiOAuthCodes.hash, digest(expired)));
		expect((await codeExchange(expired)).status).toBe(400);
		const code = await approve();
		expect((await codeExchange(code, { resource: 'https://other.test/mcp' })).status).toBe(400);
		expect((await codeExchange(code, undefined, { ...client, secret: 'invalid' })).status).toBe(401);
		const concurrent = await approve();
		expect((await codeExchange(concurrent, undefined, basic)).status).toBe(400);
		const results = await Promise.all([codeExchange(concurrent), codeExchange(concurrent)]);
		expect(results.map(({ status }) => status).sort()).toEqual([200, 400]);
		const tokens = await results.find(({ ok }) => ok)!.json();
		expect(tokens).toMatchObject({ token_type: 'Bearer', access_token: expect.any(String), refresh_token: expect.any(String) });
		const grant = await verifyMcpAccessToken(h.db, config, bearer(tokens.access_token));
		expect(grant).toMatchObject({ userId: list.createdBy, clientId: client.id });
		expect(await verifyMcpAccessToken(h.db, { ...config, resource: issuer + '/other' }, bearer(tokens.access_token))).toBeUndefined();
		expect((await h.db.select().from(aiOAuthTokens)).some(({ hash }) => hash === digest(tokens.access_token))).toBe(true);
	});

	it('exchanges Basic credentials, honors client scope and enforces expiry', async () => {
		const code = await approve({ client_id: basic.id, scope: 'lists:read' });
		const result = await codeExchange(code, undefined, basic);
		const tokens = await result.json();
		expect(result.status).toBe(200);
		expect(tokens).not.toHaveProperty('refresh_token');
		expect(await verifyMcpAccessToken(h.db, config, bearer(tokens.access_token)))
			.toMatchObject({ scopes: ['lists:read'] });
		await h.db.update(aiOAuthTokens).set({ expiresAt: new Date(0) }).where(eq(aiOAuthTokens.hash, digest(tokens.access_token)));
		expect(await verifyMcpAccessToken(h.db, config, bearer(tokens.access_token))).toBeUndefined();
	});

	it('preserves the old connection until exchange and revokes a replayed refresh family', async () => {
		const original = await (await codeExchange(await approve())).json();
		const newCode = await approve();
		expect(await verifyMcpAccessToken(h.db, config, bearer(original.access_token))).toBeDefined();
		const current = await (await codeExchange(newCode)).json();
		expect(await verifyMcpAccessToken(h.db, config, bearer(original.access_token))).toBeUndefined();
		const refreshed = await Promise.all([refresh(current.refresh_token), refresh(current.refresh_token)]);
		expect(refreshed.map(({ status }) => status).sort()).toEqual([200, 400]);
		const tokens = await refreshed.find(({ ok }) => ok)!.json();
		expect(tokens.refresh_token).not.toBe(current.refresh_token);
		expect(await verifyMcpAccessToken(h.db, config, bearer(tokens.access_token))).toBeUndefined();
	});

	it('keeps the original refresh grant when a client asks for a narrower access token', async () => {
		const initial = await (await codeExchange(await approve())).json();
		const narrowed = await (await exchange({
			grant_type: 'refresh_token', refresh_token: initial.refresh_token, scope: 'lists:read'
		})).json();
		expect(await verifyMcpAccessToken(h.db, config, bearer(narrowed.access_token)))
			.toMatchObject({ scopes: ['lists:read'] });
		const restored = await (await refresh(narrowed.refresh_token)).json();
		expect(await verifyMcpAccessToken(h.db, config, bearer(restored.access_token)))
			.toMatchObject({ scopes: client.scopes });
	});

	it('revokes through Settings or the authenticated client and only for the connection owner', async () => {
		const tokens = await (await codeExchange(await approve())).json();
		const grant = (await verifyMcpAccessToken(h.db, config, bearer(tokens.access_token)))!;
		expect(await disconnectAiConnection(h.db, grant.connectionId, shared.createdBy)).toBe(false);
		expect(await disconnectAiConnection(h.db, grant.connectionId, list.createdBy)).toBe(true);
		expect(await getAiConnections(h.db, list.createdBy)).toContainEqual(expect.objectContaining({
			id: grant.connectionId, revoked: true
		}));
		expect(await verifyMcpAccessToken(h.db, config, bearer(tokens.access_token))).toBeUndefined();
		expect((await refresh(tokens.refresh_token)).status).toBe(400);

		const fresh = await (await codeExchange(await approve())).json();
		const revoke = (authClient: OAuthConfig['clients'][number] = client) => revokeOAuthToken(h.db, config, postForm('/oauth/revoke', { token: fresh.refresh_token }, authClient));
		expect((await revoke(basic)).status).toBe(200);
		expect(await verifyMcpAccessToken(h.db, config, bearer(fresh.access_token))).toBeDefined();
		expect((await revoke()).status).toBe(200);
		expect(await verifyMcpAccessToken(h.db, config, bearer(fresh.access_token))).toBeUndefined();
	});
});

describe('MCP over Streamable HTTP', () => {
	it('negotiates 2025-11-25 and securely reads and proposes with the published tools', async () => {
		const mcp = createListMcpHandler(h.db);
		const tokens = await (await codeExchange(await approve())).json();
		const send = (method: string, params = {}, token: string | null = tokens.access_token) => mcp(new Request(config.resource, {
			method: 'POST',
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
			headers: {
				'content-type': 'application/json', accept: 'application/json, text/event-stream',
				'mcp-protocol-version': '2025-11-25', ...(token ? { authorization: bearer(token) } : {})
			}
		}), config);
		async function decode(response: Response) {
			expect(response.status).toBe(200);
			const body = await response.text();
			return JSON.parse(response.headers.get('content-type')?.includes('text/event-stream')
				? body.split('\n').find((line) => line.startsWith('data: {'))!.slice(6)
				: body).result;
		}
		const unauthorized = await send('initialize', {}, null);
		expect(unauthorized.status).toBe(401);
		expect(unauthorized.headers.get('www-authenticate')).toContain('/.well-known/oauth-protected-resource/mcp');
		const initialized = await decode(await send('initialize', {
			protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' }
		}));
		expect(initialized.protocolVersion).toBe('2025-11-25');
		const tools = await decode(await send('tools/list'));
		expect(tools.tools.map(({ name }: { name: string }) => name)).toEqual([
			'list_my_lists', 'get_list_context', 'propose_items'
		]);
		const call = async (name: string, args: object) => {
			const result = await decode(await send('tools/call', { name, arguments: args }));
			expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
			return result.structuredContent;
		};
		const accessible = await call('list_my_lists', {});
		expect(accessible.lists).toEqual(expect.arrayContaining([{ id: list.id, name: list.name }, { id: shared.id, name: shared.name }]));
		const seeded = world.generate(itemSchema, { overrides: { listId: list.id, deletedAt: null } });
		await h.db.insert(items).values([
			...Array.from({ length: 101 }, (_, rank) => ({
				...seeded, id: `mcp-${rank}`, rank, name: `Item ${rank}`, groupName: 'super', done: rank === 100
			})),
			{ ...seeded, id: 'deleted', rank: 0, groupName: 'deleted', deletedAt: new Date() }
		]);
		const first = await call('get_list_context', { listId: list.id });
		expect(first.groups).toEqual(['super']);
		expect(first.items).toHaveLength(100);
		const next = await call('get_list_context', { listId: list.id, cursor: first.nextCursor });
		expect(next.items).toEqual([{ name: 'Item 100', groupName: 'super', done: true }]);
		expect(next.nextCursor).toBeNull();
		expect(await call('propose_items', { listId: list.id, items: [{ name: 'Boter', groupName: 'made-up' }] }))
			.toMatchObject({ code: 'GROUP_NOT_FOUND', groups: ['super'] });
		const proposed = await call('propose_items', { listId: list.id, items: [{ name: 'Boter', groupName: 'super' }] });
		expect(proposed).toMatchObject({ listId: list.id, itemCount: 1, status: 'pending' });
		expect(await h.db.select().from(items).where(eq(items.name, 'Boter'))).toHaveLength(0);
		await h.db.delete(listUsers).where(eq(listUsers.userId, list.createdBy));
		expect(await call('list_my_lists', {})).toMatchObject({ lists: [] });
		expect(await call('get_list_context', { listId: list.id })).toEqual({ error: 'List not found' });

		const readOnly = await (await codeExchange(await approve({ scope: 'lists:read' }))).json();
		const insufficient = await send('tools/call', {
			name: 'propose_items', arguments: { listId: list.id, items: [{ name: 'Boter' }] }
		}, readOnly.access_token);
		expect(insufficient.status).toBe(403);
		expect(insufficient.headers.get('www-authenticate')).toContain('proposals:create');
	});
});
