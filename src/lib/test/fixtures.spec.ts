import { describe, it, expect } from 'vitest';
import { itemSchema, listSchema } from '$lib/validations';
import { itemFixture, listFixture } from './fixtures';

describe('fixtures (zod4-mock wiring)', () => {
	it('generates a list fixture that parses against listSchema', () => {
		const list = listFixture();
		expect(() => listSchema.parse(list)).not.toThrow();
	});

	it('generates an item fixture that parses against itemSchema', () => {
		const item = itemFixture();
		expect(() => itemSchema.parse(item)).not.toThrow();
	});

	it('honours per-test overrides', () => {
		const list = listFixture({ name: 'Groceries' });
		expect(list.name).toBe('Groceries');
	});
});
