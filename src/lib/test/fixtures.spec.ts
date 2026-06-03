import { describe, it, expect } from 'vitest';
import { itemSchema, listSchema } from '$lib/validations';
import { world } from './fixtures';

describe('fixtures (zod4-mock wiring)', () => {
	it('generates a list that parses against listSchema', () => {
		const list = world.generate(listSchema);
		expect(() => listSchema.parse(list)).not.toThrow();
	});

	it('generates an item that parses against itemSchema', () => {
		const item = world.generate(itemSchema);
		expect(() => itemSchema.parse(item)).not.toThrow();
	});

	it('honours per-call overrides via the library overrides option', () => {
		const list = world.generate(listSchema, { overrides: { name: 'Groceries' } });
		expect(list.name).toBe('Groceries');
	});

	it("generated item.listId resolves to a registered list's id (relation, no manual FK)", () => {
		const item = world.generate(itemSchema);
		const relatedList = world.registry.find(listSchema, (l) => l.id === item.listId);
		expect(relatedList).toBeDefined();
		expect(relatedList?.id).toBe(item.listId);
	});
});
