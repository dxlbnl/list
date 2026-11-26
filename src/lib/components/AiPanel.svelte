<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { AiProposalConflict, AiProposalGroupConflict, decideAiProposal, getAiProposals } from '$lib/client/actions';
	import type { AiDecision, AiProposal } from '$lib/validations';

	let { listId }: { listId: string } = $props();
	let proposals = $state<AiProposal[]>([]);
	let message = $state('');
	let loadFailed = $state(false);
	let busy = $state(false);
	let reassignment = $state<{ id: string; options: string[]; groups: { from: string; to?: string }[] }>();

	function grouped(items: AiProposal['items']) {
		const groups = new SvelteMap<string, string[]>();
		for (const { name, groupName } of items) {
			const group = groups.get(groupName) ?? [];
			group.push(name);
			groups.set(groupName, group);
		}
		return [...groups.keys()].sort().map((name) => ({ name, items: groups.get(name)! }));
	}

	async function refresh(background = false) {
		if (busy) return;
		busy = true;
		if (!background) message = '';
		try {
			proposals = await getAiProposals(listId);
			loadFailed = false;
		} catch {
			if (!background || proposals.length) loadFailed = true;
		} finally {
			busy = false;
		}
	}

	async function decide(proposal: AiProposal, decision: AiDecision['decision']) {
		busy = true;
		message = '';
		try {
			const groupOverrides = decision === 'accepted' && reassignment?.id === proposal.id
				? reassignment.groups.flatMap(({ from, to }) => to === undefined ? [] : [{ from, to }])
				: undefined;
			await decideAiProposal(listId, proposal.id, { version: proposal.version, decision, groupOverrides });
			proposals = proposals.filter(({ id }) => id !== proposal.id);
			if (reassignment?.id === proposal.id) reassignment = undefined;
		} catch (cause) {
			if (cause instanceof AiProposalGroupConflict) {
				const previous = reassignment?.id === proposal.id ? reassignment.groups : [];
				const current = previous.filter(({ from, to }) =>
					!cause.missingGroups.includes(from) && (to === '' || (to && cause.groups.includes(to)))
				);
				reassignment = {
					id: proposal.id, options: cause.groups,
					groups: [...current, ...cause.missingGroups.map((from) => ({ from }))]
				};
			} else if (cause instanceof AiProposalConflict) {
				if (reassignment?.id === proposal.id) reassignment = undefined;
				try {
					proposals = await getAiProposals(listId);
					message = proposals.some(({ id }) => id === proposal.id)
						? 'This proposal changed. Review the updated items before deciding.'
						: 'This proposal was already reviewed or has expired.';
				} catch {
					message = 'Could not refresh the changed AI proposal.';
				}
			} else {
				message = cause instanceof Error ? cause.message : 'Could not review the AI proposal.';
			}
		} finally {
			busy = false;
		}
	}

	onMount(() => {
		const poll = () => { if (navigator.onLine) void refresh(true); };
		poll();
		const timer = setInterval(poll, 15000);
		return () => clearInterval(timer);
	});
</script>

{#if proposals.length || message || loadFailed}
	<section class="ai-proposals" aria-label="AI proposals">
		{#if proposals.length}<h2 class="mono small muted">AI proposals</h2>{/if}
		{#each proposals as proposal (proposal.id)}
			{@const replacements = reassignment?.id === proposal.id ? reassignment : undefined}
			<article class="ai-proposals-card">
				{#each grouped(proposal.items) as { name: groupName, items: names } (groupName)}
					<div>
						<h3 class="mono tiny uppercase tracking-widest">{groupName || 'GENERAL'}</h3>
						<ul>{#each names as name, index (index)}<li>{name}</li>{/each}</ul>
					</div>
				{/each}
				<p class="small muted">{proposal.items.length} {proposal.items.length === 1 ? 'item' : 'items'} · Expires {proposal.expiresAt.toLocaleString()}</p>
				{#if replacements}
					<div class="ai-proposals-groups">
						<p class="small" role="alert">Some groups have changed. Choose where to add the affected items.</p>
						{#each replacements.groups as group (group.from)}
							<label class="small">
								<span>{group.from}</span>
								<select bind:value={group.to}>
									<option value={undefined} disabled>Choose a group</option>
									<option value="">General</option>
									{#each replacements.options as name (name)}<option value={name}>{name}</option>{/each}
								</select>
							</label>
						{/each}
					</div>
				{/if}
				<div class="ai-proposals-actions">
					<button class="btn-primary" disabled={busy || replacements?.groups.some(({ to }) => to === undefined)} onclick={() => decide(proposal, 'accepted')}>Accept</button>
					<button class="btn-primary ai-proposals-secondary" disabled={busy} onclick={() => decide(proposal, 'rejected')}>Reject</button>
				</div>
			</article>
		{/each}
		{#if message || loadFailed}
			<p class="small muted" role="alert">{message || 'Could not refresh AI proposals.'}</p>
			<button class="btn-primary ai-proposals-secondary" disabled={busy} onclick={() => refresh()}>Refresh</button>
		{/if}
	</section>
{/if}

<style>
	:global {
		.ai-proposals {
			display: flex;
			flex-direction: column;
			gap: var(--space-4);
			margin-bottom: var(--space-6);

			.ai-proposals-card { display: flex; flex-direction: column; gap: var(--space-4); background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-4); overflow-wrap: anywhere; }
			.ai-proposals-card ul { padding-left: var(--space-4); }
			.ai-proposals-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }
			.ai-proposals-groups { display: flex; flex-direction: column; gap: var(--space-3); }
			.ai-proposals-groups label { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
			.ai-proposals-groups select { max-width: 100%; color: var(--fg-1); background: var(--bg-0); }
			.ai-proposals-secondary { background: transparent; border-color: var(--border); color: var(--fg-2); }
		}
	}
</style>
