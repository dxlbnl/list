import { db } from '$lib/server/db';
import { aiLinks, lists } from '$lib/server/db/schema';
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
  const [list] = await tx.select({ name: lists.name }).from(lists).where(eq(lists.id, params.id));
  const token = secretToken(), id = nanoid();
  await tx.insert(aiLinks).values({ id, listId: params.id, tokenHash: hashToken(token) });
  const connectionUrl = `${url.origin}/api/ai/connect#token=${token}`;
  const openapi = `${url.origin}/api/ai/openapi.json`;
  const agentRequest = [
   `This connection is for the list named ${JSON.stringify(list.name)} in List.`,
   'When I ask you to add items to this list, you can submit a proposal for me to review.',
   `API documentation: ${openapi}`,
   `Private connection link: ${connectionUrl}`,
   'The API uses the token from the URL fragment as a Bearer token in the Authorization header. The response includes an edit token and version for future changes.',
   'Keep the connection link private and keep API credentials out of request URLs and logs.'
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
