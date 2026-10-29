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
   'Stel boodschappen voor op mijn List-lijst. Voeg niets rechtstreeks toe: ik keur de voorstellen zelf goed.',
   `Lees eerst de API-documentatie: ${openapi}`,
   `Gebruik deze geheime koppeling: ${connectionUrl}`,
   'Lees het token uit het URL-fragment en gebruik het uitsluitend volgens de API-documentatie. Bewaar het bewerkingstoken en versienummer uit het antwoord voor eventuele wijzigingen.',
   'Deel de geheime koppeling niet en zet tokens niet in request-URLs of logs.',
   'Vraag mij welke boodschappen ik wil laten voorstellen.'
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
