import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import OAuth2Server, { Request as OAuthRequest, Response as OAuthResponse, OAuthError } from '@node-oauth/oauth2-server';
import { z } from 'zod';
import { aiConnections, aiOAuthCodes, aiOAuthRequests, aiOAuthTokens, users } from './db/schema';
import type { AiDb, ListDb } from './ai';

export const oauthCookie = 'list_oauth_request';
export const oauthCookieOptions = { path: '/', maxAge: 15 * 60, httpOnly: true, sameSite: 'lax', secure: !dev } as const;
export const listScopes = ['lists:read', 'proposals:create', 'offline_access'] as const;
export const ACCESS_SECONDS = 15 * 60;
const CODE_SECONDS = 5 * 60;
const REFRESH_SECONDS = 30 * 24 * 60 * 60;
const secretPattern = /^[A-Za-z0-9_-]{43}$/;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
// MCP verifies token audience and connection status independently of the grant handlers.
const unusedOAuthOperation = async () => false as const;

const clientAuthenticationMethods = ['client_secret_basic', 'client_secret_post'] as const;
const clientsSchema = z.array(z.object({
	id: z.string().min(1).max(128),
	name: z.string().min(1).max(100),
	secret: z.string().regex(/^[\x21-\x7e]{32,512}$/),
	redirectUris: z.array(z.url()).min(1),
	authenticationMethod: z.enum(clientAuthenticationMethods),
	scopes: z.array(z.enum(listScopes)).min(1)
})).min(1);
type RegisteredClient = z.infer<typeof clientsSchema>[number];

export function oauthConfig(origin: string) {
	if (!env.LIST_OAUTH_ISSUER || !env.LIST_MCP_RESOURCE || !env.LIST_OAUTH_CLIENTS) {
		error(503, 'List OAuth is not configured');
	}
	let issuer: URL;
	let resource: URL;
	let clients: RegisteredClient[];
	try {
		issuer = new URL(env.LIST_OAUTH_ISSUER);
		resource = new URL(env.LIST_MCP_RESOURCE);
		clients = clientsSchema.parse(JSON.parse(env.LIST_OAUTH_CLIENTS));
		if (origin !== issuer.origin || issuer.href !== issuer.origin + '/' ||
			resource.href !== issuer.origin + '/mcp' ||
			(issuer.protocol !== 'https:' && !(dev && issuer.hostname === 'localhost')) ||
			new Set(clients.map(({ id }) => id)).size !== clients.length ||
			clients.some(({ redirectUris }) => redirectUris.some((uri) => {
				const url = new URL(uri);
				return url.protocol !== 'https:' || !!(url.username || url.password || url.hash);
			}))) throw new Error();
	} catch {
		error(503, 'List OAuth configuration does not match this address');
	}
	return { issuer: issuer.origin, resource: resource.href, clients };
}

export type OAuthConfig = ReturnType<typeof oauthConfig>;
type Consent = typeof aiOAuthRequests.$inferSelect;
type Principal = { id: string; connectionId: string };
type TokenClient = { id: string; grants: string[]; redirectUris: string[] };
type LibraryToken = {
	accessToken: string; accessTokenExpiresAt?: Date; refreshToken?: string;
	refreshTokenExpiresAt?: Date; scope?: string[];
};
type LibraryCode = Pick<OAuth2Server.AuthorizationCode, 'authorizationCode' | 'expiresAt' | 'redirectUri' | 'scope' | 'codeChallenge' | 'codeChallengeMethod'>;

export function protectedResource(config: OAuthConfig) {
	return {
		resource: config.resource, authorization_servers: [config.issuer],
		scopes_supported: [...new Set(config.clients.flatMap(({ scopes }) => scopes))],
		bearer_methods_supported: ['header']
	};
}

export function authorizationMetadata(config: OAuthConfig) {
	return {
		issuer: config.issuer,
		authorization_endpoint: config.issuer + '/oauth/authorize',
		token_endpoint: config.issuer + '/oauth/token',
		revocation_endpoint: config.issuer + '/oauth/revoke',
		authorization_response_iss_parameter_supported: true,
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code', 'refresh_token'],
		code_challenge_methods_supported: ['S256'],
		scopes_supported: [...new Set(config.clients.flatMap(({ scopes }) => scopes))],
		token_endpoint_auth_methods_supported: [...new Set(config.clients.map((client) => client.authenticationMethod))],
		revocation_endpoint_auth_methods_supported: [...new Set(config.clients.map((client) => client.authenticationMethod))]
	};
}

export const privateHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

export function oauthChallenge(config: OAuthConfig, invalidToken: boolean) {
	const metadata = config.issuer + '/.well-known/oauth-protected-resource/mcp';
	const challenge = `Bearer resource_metadata="${metadata}"`;
	return json({ error: invalidToken ? 'invalid_token' : 'authorization_required' }, {
		status: 401,
		headers: { ...privateHeaders, 'WWW-Authenticate': invalidToken ? challenge + ', error="invalid_token"' : challenge }
	});
}

function matchingSecret(a: string, b: string) {
	return timingSafeEqual(Buffer.from(hash(a), 'hex'), Buffer.from(hash(b), 'hex'));
}

function selectClient(config: OAuthConfig, id: string) {
	return config.clients.find((client) => client.id === id);
}

function allowedScopes(client: RegisteredClient, scopes: string[]) {
	return scopes.length > 0 && scopes.every((scope) => client.scopes.some((allowed) => allowed === scope));
}

function authorizeQuery(config: OAuthConfig, params: URLSearchParams) {
	const allowed = ['client_id', 'redirect_uri', 'response_type', 'state', 'scope', 'resource', 'code_challenge', 'code_challenge_method'];
	for (const key of allowed) {
		if (params.getAll(key).length > 1) error(400, 'Duplicate OAuth authorization parameter');
	}
	const client = selectClient(config, params.get('client_id') ?? '');
	const redirectUri = params.get('redirect_uri');
	if (!client || !redirectUri || !client.redirectUris.includes(redirectUri)) {
		error(400, 'Unknown OAuth client or invalid callback address');
	}
	const state = params.get('state');
	const challenge = params.get('code_challenge');
	const scopes = [...new Set((params.get('scope') || client.scopes.join(' ')).split(/\s+/).filter(Boolean))];
	if (params.get('response_type') !== 'code' || !state || state.length > 1024 ||
		!challenge || !secretPattern.test(challenge) || params.get('code_challenge_method') !== 'S256' ||
		(params.has('resource') && params.get('resource') !== config.resource) ||
		!allowedScopes(client, scopes)) {
		const location = new URL(redirectUri);
		location.searchParams.set('error', 'invalid_request');
		if (state && state.length <= 1024) location.searchParams.set('state', state);
		location.searchParams.set('iss', config.issuer);
		return { location: location.href };
	}
	return { client, query: {
		client_id: client.id, redirect_uri: redirectUri, response_type: 'code', state,
		scope: scopes.join(' '), resource: config.resource,
		code_challenge: challenge, code_challenge_method: 'S256'
	} };
}

export async function beginOAuthConsent(db: AiDb, config: OAuthConfig, url: URL, sessionId?: string) {
	const parsed = authorizeQuery(config, url.searchParams);
	if ('location' in parsed) return { location: parsed.location! } as const;
	const ticket = secret();
	const expiresAt = new Date(Date.now() + oauthCookieOptions.maxAge * 1000);
	await db.insert(aiOAuthRequests).values({
		hash: hash(ticket), sessionHash: sessionId ? hash(sessionId) : null,
		clientId: parsed.client.id, query: parsed.query, expiresAt
	});
	return { ticket } as const;
}

export async function getOAuthConsent(db: AiDb, ticket?: string) {
	if (!ticket || !secretPattern.test(ticket)) return;
	const [row] = await db.select().from(aiOAuthRequests).where(and(
		eq(aiOAuthRequests.hash, hash(ticket)), isNull(aiOAuthRequests.consumedAt),
		gt(aiOAuthRequests.expiresAt, new Date())
	));
	return row;
}

export function matchesOAuthSession(consent: Consent, sessionId?: string) {
	return !!sessionId && consent.sessionHash === hash(sessionId);
}

export async function stageOAuthLogin(db: AiDb, ticket: string, magicLink: string) {
	if (!secretPattern.test(ticket)) return;
	await db.update(aiOAuthRequests).set({ loginTokenHash: hash(magicLink) }).where(and(
		eq(aiOAuthRequests.hash, hash(ticket)), isNull(aiOAuthRequests.sessionHash),
		isNull(aiOAuthRequests.consumedAt), gt(aiOAuthRequests.expiresAt, new Date())
	));
}

export async function resumeOAuthLogin(db: AiDb, ticket: string, magicLink: string, sessionId: string) {
	if (!secretPattern.test(ticket)) return false;
	const [bound] = await db.update(aiOAuthRequests).set({ sessionHash: hash(sessionId), loginTokenHash: null })
		.where(and(eq(aiOAuthRequests.hash, hash(ticket)), eq(aiOAuthRequests.loginTokenHash, hash(magicLink)),
			isNull(aiOAuthRequests.sessionHash), isNull(aiOAuthRequests.consumedAt), gt(aiOAuthRequests.expiresAt, new Date())))
		.returning({ hash: aiOAuthRequests.hash });
	return !!bound;
}

function clientModel(client: RegisteredClient): TokenClient {
	return { id: client.id, redirectUris: client.redirectUris, grants: ['authorization_code', 'refresh_token'] };
}

export async function finishOAuthConsent(
	db: ListDb, config: OAuthConfig, ticket: string, intent: string, sessionId: string, userId: string, approved: boolean
) {
	if (!secretPattern.test(ticket) || !matchingSecret(hash(ticket), intent)) error(400, 'OAuth request was replaced');
	return db.transaction(async (tx) => {
		const [pending] = await tx.update(aiOAuthRequests).set({ consumedAt: new Date() }).where(and(
			eq(aiOAuthRequests.hash, intent), eq(aiOAuthRequests.sessionHash, hash(sessionId)),
			isNull(aiOAuthRequests.consumedAt), gt(aiOAuthRequests.expiresAt, new Date())
		)).returning();
		const client = pending && selectClient(config, pending.clientId);
		if (!client || !client.redirectUris.includes(pending.query.redirect_uri) ||
			pending.query.resource !== config.resource || !allowedScopes(client, pending.query.scope.split(' '))) error(400, 'OAuth request expired or changed');
		const location = new URL(pending.query.redirect_uri);
		location.searchParams.set('state', pending.query.state);
		location.searchParams.set('iss', config.issuer);
		if (!approved) {
			location.searchParams.set('error', 'access_denied');
			return location.href;
		}
		const connectionId = secret();
		const scopes = pending.query.scope.split(' ');
		await tx.insert(aiConnections).values({ id: connectionId, userId, clientId: client.id, scopes });
		const model = {
			getClient: async (id: string) => id === client.id ? clientModel(client) : false,
			saveToken: unusedOAuthOperation,
			getAccessToken: unusedOAuthOperation,
			validateScope: async () => scopes,
			generateAuthorizationCode: async () => secret(),
			saveAuthorizationCode: async (code: LibraryCode, codeClient: TokenClient, user: Principal) => {
				await tx.insert(aiOAuthCodes).values({
					hash: hash(code.authorizationCode), connectionId,
					redirectUri: pending.query.redirect_uri, challenge: pending.query.code_challenge,
					resource: config.resource, expiresAt: code.expiresAt
				});
				return { ...code, client: codeClient, user };
			}
		} satisfies OAuth2Server.ExtensionModel & Pick<OAuth2Server.AuthorizationCodeModel,
			'validateScope' | 'generateAuthorizationCode' | 'saveAuthorizationCode'>;
		const oauth = new OAuth2Server({ requirePKCE: true, authorizationCodeLifetime: CODE_SECONDS, model });
		const request = new OAuthRequest({ method: 'POST', headers: {}, query: pending.query, body: {} });
		const response = new OAuthResponse();
		const code = await oauth.authorize(request, response, {
			authenticateHandler: { handle: async () => ({ id: userId, connectionId }) }
		});
		location.searchParams.set('code', code.authorizationCode);
		return location.href;
	});
}

async function lockConnection(db: AiDb, id: string, clientId: string) {
	const [connection] = await db.select().from(aiConnections).where(and(
		eq(aiConnections.id, id), eq(aiConnections.clientId, clientId), isNull(aiConnections.revokedAt)
	)).for('update');
	return connection;
}

function tokenError(code: string, status = 400) {
	return json({ error: code }, {
		status,
		headers: status === 401 ? { ...privateHeaders, 'WWW-Authenticate': 'Basic realm="List OAuth"' } : privateHeaders
	});
}

async function readOAuthForm(request: Request) {
	if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') {
		return null;
	}
	const reader = request.body?.getReader();
	if (!reader) return null;
	const decoder = new TextDecoder();
	let size = 0;
	let form = '';
	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		size += value.length;
		if (size > 8192) {
			void reader.cancel().catch(() => {});
			return null;
		}
		form += decoder.decode(value, { stream: true });
	}
	const params = new URLSearchParams(form + decoder.decode());
	if (new Set(params.keys()).size !== [...params.keys()].length) return null;
	return Object.fromEntries(params);
}

function clientCredentials(request: Request, body: Record<string, string>) {
	const authorization = request.headers.get('authorization');
	if (!authorization) return { id: body.client_id, secret: body.client_secret, method: 'client_secret_post' };
	if (body.client_id || body.client_secret || !/^Basic [A-Za-z0-9+/=]+$/i.test(authorization)) return;
	const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
	const index = decoded.indexOf(':');
	if (index <= 0) return;
	const decode = (value: string) => decodeURIComponent(value.replace(/\+/g, ' '));
	try {
		return { id: decode(decoded.slice(0, index)), secret: decode(decoded.slice(index + 1)), method: 'client_secret_basic' };
	} catch {
		return;
	}
}

export async function exchangeOAuthToken(db: ListDb, config: OAuthConfig, request: Request) {
	const body = await readOAuthForm(request);
	if (!body) return tokenError('invalid_request');
	if (Object.hasOwn(body, 'resource') && body.resource !== config.resource) return tokenError('invalid_target');
	if (body.grant_type !== 'authorization_code' && body.grant_type !== 'refresh_token') {
		return tokenError('unsupported_grant_type');
	}
	const credentials = clientCredentials(request, body);
	const authenticated = selectClient(config, credentials?.id ?? '');
	if (!authenticated || !credentials?.secret || credentials.method !== authenticated.authenticationMethod ||
		!matchingSecret(authenticated.secret, credentials.secret)) {
		return tokenError('invalid_client', 401);
	}
	const clientId = authenticated.id;
	try {
		return await db.transaction(async (tx) => {
			let replay = false;
			let codeSpent = false;
			let originalRefreshScopes: string[] | undefined;
			const model = {
				getClient: async () => clientModel(authenticated),
				getAccessToken: unusedOAuthOperation,
				getAuthorizationCode: async (value: string) => {
					if (!secretPattern.test(value)) return false;
					const [code] = await tx.select().from(aiOAuthCodes).where(and(
						eq(aiOAuthCodes.hash, hash(value)), isNull(aiOAuthCodes.consumedAt),
						eq(aiOAuthCodes.resource, config.resource), gt(aiOAuthCodes.expiresAt, new Date())
					)).for('update');
					if (!code || !authenticated.redirectUris.includes(code.redirectUri)) return false;
					const [connection] = await tx.select().from(aiConnections).where(and(
						eq(aiConnections.id, code.connectionId), eq(aiConnections.clientId, clientId),
						isNull(aiConnections.revokedAt), isNull(aiConnections.activatedAt)
					));
					const client = selectClient(config, clientId);
					if (!connection || !client || !allowedScopes(client, connection.scopes)) return false;
					return {
						authorizationCode: value, expiresAt: code.expiresAt, redirectUri: code.redirectUri,
						codeChallenge: code.challenge, codeChallengeMethod: 'S256',
						scope: connection.scopes, client: clientModel(client),
						user: { id: connection.userId, connectionId: connection.id }
					};
				},
				revokeAuthorizationCode: async (code: OAuth2Server.AuthorizationCode) => {
					const [used] = await tx.update(aiOAuthCodes).set({ consumedAt: new Date() }).where(and(
						eq(aiOAuthCodes.hash, hash(code.authorizationCode)), isNull(aiOAuthCodes.consumedAt)
					)).returning({ hash: aiOAuthCodes.hash });
					codeSpent = !!used;
					return codeSpent;
				},
				getRefreshToken: async (value: string) => {
					if (!secretPattern.test(value)) return false;
					const digest = hash(value);
					const [match] = await tx.select({ connectionId: aiOAuthTokens.connectionId })
						.from(aiOAuthTokens).where(and(eq(aiOAuthTokens.hash, digest), eq(aiOAuthTokens.kind, 'refresh')));
					if (!match) return false;
					const connection = await lockConnection(tx, match.connectionId, clientId);
					const client = selectClient(config, clientId);
					if (!connection?.activatedAt || !client) return false;
					const [token] = await tx.select().from(aiOAuthTokens).where(and(
						eq(aiOAuthTokens.hash, digest), eq(aiOAuthTokens.resource, config.resource)
					));
					if (!token || token.expiresAt <= new Date() || !allowedScopes(client, token.scopes)) return false;
					if (token.consumedAt) {
						await tx.update(aiConnections).set({ revokedAt: new Date() }).where(eq(aiConnections.id, connection.id));
						replay = true;
						return false;
					}
					originalRefreshScopes = token.scopes;
					return {
						refreshToken: value, refreshTokenExpiresAt: token.expiresAt, scope: token.scopes,
						client: clientModel(client), user: { id: connection.userId, connectionId: connection.id }
					};
				},
				revokeToken: async (token: { refreshToken: string }) => {
					const [used] = await tx.update(aiOAuthTokens).set({ consumedAt: new Date() }).where(and(
						eq(aiOAuthTokens.hash, hash(token.refreshToken)), isNull(aiOAuthTokens.consumedAt)
					)).returning({ hash: aiOAuthTokens.hash });
					return !!used;
				},
				validateScope: async (user: Principal, client: TokenClient, scopes?: string[]) => {
					const connection = await lockConnection(tx, user.connectionId, client.id);
					return connection && scopes && scopes.every((scope) => connection.scopes.includes(scope)) ? scopes : false;
				},
				generateAccessToken: async () => secret(),
				generateRefreshToken: async () => secret(),
				saveToken: async (token: LibraryToken, client: TokenClient, user: Principal) => {
					if (body.grant_type === 'authorization_code') {
						// Serialize activation for the same account. An abandoned consent leaves the older connection active.
						await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
						const pending = await lockConnection(tx, user.connectionId, client.id);
						if (!pending || pending.activatedAt || pending.userId !== user.id) {
							throw new OAuthError('Connection is unavailable', { name: 'invalid_grant', code: 400 });
						}
						const now = new Date();
						await tx.update(aiConnections).set({ revokedAt: now }).where(and(
							eq(aiConnections.userId, user.id), eq(aiConnections.clientId, client.id),
							isNotNull(aiConnections.activatedAt), isNull(aiConnections.revokedAt)
						));
						await tx.update(aiConnections).set({ activatedAt: now }).where(eq(aiConnections.id, pending.id));
					}
					const scopes = token.scope ?? [];
					await tx.insert(aiOAuthTokens).values({
						hash: hash(token.accessToken), connectionId: user.connectionId, kind: 'access',
						resource: config.resource, scopes, expiresAt: token.accessTokenExpiresAt!
					});
					const refreshScopes = originalRefreshScopes ?? scopes;
					if (refreshScopes.includes('offline_access') && token.refreshToken && token.refreshTokenExpiresAt) {
						await tx.insert(aiOAuthTokens).values({
							hash: hash(token.refreshToken), connectionId: user.connectionId, kind: 'refresh',
							resource: config.resource, scopes: refreshScopes, expiresAt: token.refreshTokenExpiresAt
						});
						return { ...token, client, user };
					}
					return { ...token, refreshToken: undefined, refreshTokenExpiresAt: undefined, client, user };
				}
			} satisfies Omit<OAuth2Server.AuthorizationCodeModel, 'saveAuthorizationCode'> &
				Pick<OAuth2Server.RefreshTokenModel, 'getRefreshToken' | 'revokeToken'>;
			const oauth = new OAuth2Server({
				requirePKCE: true, alwaysIssueNewRefreshToken: true,
				accessTokenLifetime: ACCESS_SECONDS, refreshTokenLifetime: REFRESH_SECONDS, model
			});
			const parsedForm = { ...body, client_id: authenticated.id, client_secret: authenticated.secret };
			const req = new OAuthRequest({
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					'content-length': String(new URLSearchParams(parsedForm).toString().length)
				},
				body: parsedForm, query: {}
			});
			const res = new OAuthResponse();
			try {
				await oauth.token(req, res);
			} catch (cause) {
				// Preserve credential consumption on client errors, including incorrect PKCE and refresh replay.
				if ((replay || codeSpent) && cause instanceof OAuthError && cause.code >= 400 && cause.code < 500) {
					return tokenError(cause.name, cause.code);
				}
				throw cause;
			}
			return json(res.body, { status: 200, headers: privateHeaders });
		});
	} catch (cause) {
		if (cause instanceof OAuthError && cause.code >= 400 && cause.code < 500) {
			return tokenError(cause.name, cause.code);
		}
		throw cause;
	}
}

export async function revokeOAuthToken(db: ListDb, config: OAuthConfig, request: Request) {
	const body = await readOAuthForm(request);
	if (!body?.token) return tokenError('invalid_request');
	const credentials = clientCredentials(request, body);
	const client = selectClient(config, credentials?.id ?? '');
	if (!client || !credentials?.secret || credentials.method !== client.authenticationMethod ||
		!matchingSecret(client.secret, credentials.secret)) {
		return tokenError('invalid_client', 401);
	}
	if (secretPattern.test(body.token)) {
		await db.transaction(async (tx) => {
			const [token] = await tx.select({ connectionId: aiOAuthTokens.connectionId }).from(aiOAuthTokens)
				.where(and(eq(aiOAuthTokens.hash, hash(body.token)), eq(aiOAuthTokens.resource, config.resource)));
			if (token) {
				await tx.update(aiConnections).set({ revokedAt: new Date() }).where(and(
					eq(aiConnections.id, token.connectionId), eq(aiConnections.clientId, client.id), isNull(aiConnections.revokedAt)
				));
			}
		});
	}
	return new Response(null, { status: 200, headers: privateHeaders });
}

export async function verifyMcpAccessToken(db: AiDb, config: OAuthConfig, authorization: string) {
	const value = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(authorization)?.[1];
	if (!value) return;
	const [row] = await db.select({
		connectionId: aiConnections.id, userId: aiConnections.userId, clientId: aiConnections.clientId,
		scopes: aiOAuthTokens.scopes, expiresAt: aiOAuthTokens.expiresAt
	}).from(aiOAuthTokens).innerJoin(aiConnections, eq(aiOAuthTokens.connectionId, aiConnections.id)).where(and(
		eq(aiOAuthTokens.hash, hash(value)), eq(aiOAuthTokens.kind, 'access'),
		eq(aiOAuthTokens.resource, config.resource), gt(aiOAuthTokens.expiresAt, new Date()),
		isNull(aiOAuthTokens.consumedAt), isNull(aiConnections.revokedAt), isNotNull(aiConnections.activatedAt)
	));
	const client = row && selectClient(config, row.clientId);
	if (!client || !allowedScopes(client, row.scopes)) return;
	return row;
}

export async function getAiConnections(db: AiDb, userId: string) {
	const connections = await db.select({
		id: aiConnections.id, clientId: aiConnections.clientId, activatedAt: aiConnections.activatedAt, revokedAt: aiConnections.revokedAt
	}).from(aiConnections).where(and(eq(aiConnections.userId, userId),
		isNotNull(aiConnections.activatedAt))).orderBy(aiConnections.revokedAt, aiConnections.createdAt);
	let clients: RegisteredClient[] = [];
	try {
		const parsed = clientsSchema.safeParse(JSON.parse(env.LIST_OAUTH_CLIENTS ?? '[]'));
		if (parsed.success) clients = parsed.data;
	} catch { /* Display the registered client IDs until configuration is fixed. */ }
	return connections.map((row) => ({
		id: row.id, name: clients.find(({ id }) => id === row.clientId)?.name ?? row.clientId,
		activatedAt: row.activatedAt!, revoked: !!row.revokedAt
	}));
}

export async function disconnectAiConnection(db: AiDb, id: string, userId: string) {
	const [revoked] = await db.update(aiConnections).set({ revokedAt: new Date() }).where(and(
		eq(aiConnections.id, id), eq(aiConnections.userId, userId),
		isNotNull(aiConnections.activatedAt), isNull(aiConnections.revokedAt)
	)).returning({ id: aiConnections.id });
	return !!revoked;
}
