import { error, json } from '@sveltejs/kit';
import type { z } from 'zod';
import { logger } from '$lib/logger';

export function bearer(request: Request) {
 const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('authorization') ?? '');
 if (!match) error(401, 'Bearer token required');
 return match[1];
}
export function editToken(request: Request) {
 const token = request.headers.get('x-proposal-token') ?? '';
 if (!/^[A-Za-z0-9_-]{43}$/.test(token)) error(401, 'X-Proposal-Token required');
 return token;
}
export async function readBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
 if (!request.headers.get('content-type')?.startsWith('application/json')) error(415, 'Use application/json');
 const reader = request.body?.getReader();
 if (!reader) error(400, 'JSON body required');
 const chunks: Uint8Array[] = [];
 let size = 0;
 while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  size += value.length;
  if (size > 32768) { await reader.cancel(); error(413, 'Body too large'); }
  chunks.push(value);
 }
 const bytes = new Uint8Array(size);
 let offset = 0;
 for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
 let body: unknown;
 try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { error(400, 'Invalid JSON'); }
 const parsed = schema.safeParse(body);
 if (!parsed.success) error(400, 'Invalid request');
 return parsed.data;
}
export function sameOrigin(request: Request, url: URL) {
 if (request.headers.get('origin') !== url.origin) error(403, 'Same-origin request required');
}
export async function aiJson(value: unknown, status = 200) {
 await logger.flush();
 return json(value, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
