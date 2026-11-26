import { describe, it, expect } from 'vitest';
import { aiCreateSchema } from '$lib/validations';
import { bearer, editToken, readBody, sameOrigin } from './ai-http';

describe('AI HTTP boundary', () => {
 it('requires header credentials and rejects secrets in query strings', () => {
  const request = new Request('https://list.test/api/ai/proposals?token=secret');
  expect(() => bearer(request)).toThrow();
  expect(() => editToken(request)).toThrow();
  const token = 'a'.repeat(43);
  expect(bearer(new Request(request.url, { headers: { Authorization: `Bearer ${token}` } }))).toBe(token);
 });
 it('requires same-origin human decisions', () => {
  expect(() => sameOrigin(new Request('https://list.test', { headers: { Origin: 'https://evil.test' } }), new URL('https://list.test'))).toThrow();
  expect(() => sameOrigin(new Request('https://list.test'), new URL('https://list.test'))).toThrow();
 });
 it('bounds actual streamed bytes and validates malformed JSON/content type', async () => {
  await expect(readBody(new Request('https://list.test', { method: 'POST', body: 'x'.repeat(32769), headers: { 'Content-Type': 'application/json' } }), aiCreateSchema)).rejects.toMatchObject({ status: 413 });
  await expect(readBody(new Request('https://list.test', { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } }), aiCreateSchema)).rejects.toMatchObject({ status: 400 });
  await expect(readBody(new Request('https://list.test', { method: 'POST', body: '{}' }), aiCreateSchema)).rejects.toMatchObject({ status: 415 });
 });
});
