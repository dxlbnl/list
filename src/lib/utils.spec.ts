import { describe, it, expect } from 'vitest';
import { rankBetween } from '$lib/utils';

describe('rankBetween — fractional-index reorder', () => {
	it('returns the midpoint between two ranks', () => {
		expect(rankBetween(1, 2)).toBe(1.5);
		expect(rankBetween(0, 1)).toBe(0.5);
	});

	it('extends past the ends', () => {
		expect(rankBetween(5, null)).toBe(6); // move to the end
		expect(rankBetween(null, 5)).toBe(4); // move to the front
		expect(rankBetween(null, null)).toBe(0); // first/only item
	});

	it('stays strictly ordered under repeated midpoint inserts', () => {
		const a = 0;
		let b = 1;
		for (let i = 0; i < 20; i++) {
			const m = rankBetween(a, b);
			expect(m).toBeGreaterThan(a);
			expect(m).toBeLessThan(b);
			b = m; // keep inserting just before b
		}
	});
});
