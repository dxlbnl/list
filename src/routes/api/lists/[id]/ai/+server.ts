import { db } from '$lib/server/db';
import { aiLinks } from '$lib/server/db/schema';
import { hashToken, secretToken, requireMember, pendingProposals } from '$lib/server/ai';
import { aiJson, sameOrigin } from '$lib/server/ai-http';
import { nanoid } from '$lib/utils';
import { and, eq, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ params, locals }) => aiJson(await db.transaction(async (tx) => {
 const proposals = await pendingProposals(tx, params.id, locals.user?.id);
 const links = await tx.select({ id: aiLinks.id, createdAt: aiLinks.createdAt }).from(aiLinks).where(and(eq(aiLinks.listId, params.id), isNull(aiLinks.revokedAt)));
 return { proposals, links };
}));
export const POST: RequestHandler = async ({ params, locals, request, url }) => {
 sameOrigin(request, url);
 return aiJson(await db.transaction(async (tx) => {
  await requireMember(tx, params.id, locals.user?.id);
  const token = secretToken(), id = nanoid();
  await tx.insert(aiLinks).values({ id, listId: params.id, tokenHash: hashToken(token) });
  const connectionUrl = `${url.origin}/api/ai/connect#token=${token}`;
  const openapi = `${url.origin}/api/ai/openapi.json`;
  const agentRequest = [
   'Suggest groceries for my List. Submit them as proposals for me to review.',
   `Read the API documentation first: ${openapi}`,
   `Use this secret link: ${connectionUrl}`,
   'Read the token from the URL fragment and use it as described in the API documentation. Save the edit token and version from the response for future changes.',
   'Keep the secret link private and keep tokens out of request URLs and logs.',
   'Ask me which groceries to propose.'
  ].join('\n\n');
  return { id, url: connectionUrl, token, openapi, request: agentRequest };
 }), 201);
};
export const DELETE: RequestHandler = async ({ params, locals, request, url }) => {
 sameOrigin(request, url);
 return aiJson(await db.transaction(async (tx) => {
  await requireMember(tx, params.id, locals.user?.id);
  await tx.update(aiLinks).set({ revokedAt: new Date() }).where(and(eq(aiLinks.listId, params.id), isNull(aiLinks.revokedAt)));
  return { revoked: true };
 }));
};
