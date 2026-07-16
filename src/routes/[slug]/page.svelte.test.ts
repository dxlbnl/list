/**
 * Characterisation test for B7 (audit T4) — the current "group disappears
 * when its last active item is deleted" behaviour.
 *
 * This test pins down today's behaviour so that B5 ("persist empty groups")
 * has a meaningful red→green pivot when it flips the contract. The
 * assertion here is intentionally locking in something we want to change.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';

import Page from './+page.svelte';
import { db as dexieDb } from '$lib/client/db';
import { addItem, deleteItem } from '$lib/client/actions';
import { syncManager } from '$lib/client/sync.svelte';
import { listSchema } from '$lib/validations';
import { world } from '$lib/test/fixtures';

// SvelteKit virtual modules the page imports. `setup.client.ts` stubs
// `$app/environment` + `$env/static/public`; the page also needs
// `$app/navigation` and `$app/paths` to resolve.
vi.mock('$app/navigation', () => ({
	goto: vi.fn(async () => {})
}));

vi.mock('$app/paths', () => ({
	resolve: (p: string) => p
}));

describe('list page — characterisation: group lifecycle when its last item is deleted', () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(async () => {
		// Sync's fetch calls (`/api/sync`, `/api/lists/...`) would otherwise hit
		// the dev server during a component test. Stub with a benign 404 so
		// nothing crashes and no remote state is touched.
		originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn(async () =>
			new Response(JSON.stringify([]), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		) as typeof globalThis.fetch;

		// Belt-and-braces: keep the periodic push loop from firing.
		syncManager.isOnline = false;

		// Fresh Dexie state each test.
		await dexieDb.items.clear();
		await dexieDb.lists.clear();
		await dexieDb.syncQueue.clear();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('characterises current behaviour: group disappears when its last active item is deleted (B5 will reverse this)', async () => {
		// 1. Seed a list via the schema-derived world (no hand-stamped FKs).
		world.populate(listSchema, 1);
		const list = world.registry.pick(listSchema);
		await dexieDb.lists.add(list);

		// 2. Seed two items through the actions layer (Rule: mutations go via
		//    actions.ts). One default group, one custom — two groups means the
		//    page renders the group header (which carries the group name we
		//    are asserting on).
		await addItem(list.id, 'Milk', '');
		const snacksItemId = await addItem(list.id, 'Chips', 'Snacks');

		// 3. Render the page. `data` is what `+page.ts` produces for the route,
		//    merged with the parent `+layout.server.ts` fields.
		render(Page, {
			data: {
				listId: list.id,
				initialList: list,
				title: list.name,
				user: {
					id: list.createdBy,
					email: null,
					email_verified: false,
					createdAt: new Date()
				},
				supabaseToken: undefined,
				sessionInvalid: undefined
			}
		});

		// 4. Sanity: the custom group's name is rendered before deletion.
		await expect.element(page.getByText('Snacks')).toBeInTheDocument();
		await expect.element(page.getByText('GENERAL')).toBeInTheDocument();

		// 5. Act: delete the only item in the custom group.
		await deleteItem(snacksItemId);

		// Let Dexie's liveQuery + the page's $effect propagate to localGroups.
		await tick();

		// 6. Characterise: the group name is no longer in the rendered output.
		//    (B5 will change this — the group should persist with zero items.)
		await expect.element(page.getByText('Snacks')).not.toBeInTheDocument();

		// And the surviving group is still there.
		await expect.element(page.getByText('Milk')).toBeInTheDocument();
	});
});
