import { describe, it, expect } from 'vitest';
import { aiDecisionSchema } from '$lib/validations';
import { readBody, sameOrigin } from './ai-http';

describe('AI review HTTP boundary', () => {
	it('requires a same-origin browser decision', () => {
		const url = new URL('https://list.test');
		expect(() => sameOrigin(new Request(url, { headers: { Origin: 'https://foreign.test' } }), url)).toThrow();
		expect(() => sameOrigin(new Request(url), url)).toThrow();
		expect(() => sameOrigin(new Request(url, { headers: { Origin: url.origin } }), url)).not.toThrow();
	});

	it('bounds actual streamed bytes and validates JSON and content type', async () => {
		const create = (body: string, type = 'application/json') => new Request('https://list.test', {
			method: 'POST', body, headers: { 'Content-Type': type }
		});
		await expect(readBody(create('x'.repeat(32769)), aiDecisionSchema)).rejects.toMatchObject({ status: 413 });
		await expect(readBody(create('{'), aiDecisionSchema)).rejects.toMatchObject({ status: 400 });
		await expect(readBody(create('{}', 'text/plain'), aiDecisionSchema)).rejects.toMatchObject({ status: 415 });
	});
});
