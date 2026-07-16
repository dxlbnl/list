import { describe, it, expect } from 'vitest';
import { now, observe } from './hlc';

describe('hlc — hybrid logical clock for LWW stamps', () => {
	it('emits strictly monotonic timestamps', () => {
		const a = now().getTime();
		const b = now().getTime();
		const c = now().getTime();
		expect(b).toBeGreaterThan(a);
		expect(c).toBeGreaterThan(b);
	});

	it('advances past an observed (future) timestamp', () => {
		const future = Date.now() + 1_000_000;
		observe(future);
		expect(now().getTime()).toBeGreaterThan(future);
	});

	it('ignores null/undefined observations', () => {
		const before = now().getTime();
		observe(null);
		observe(undefined);
		expect(now().getTime()).toBeGreaterThan(before);
	});
});
