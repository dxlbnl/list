<script lang="ts">
	import { onMount } from 'svelte';
	import { aiListAction, AiProposalConflict } from '$lib/client/actions';
	import type { AiProposal } from '$lib/validations';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import InputGroup from '$lib/components/ui/InputGroup.svelte';

	let { listId, open = $bindable(false) }: { listId: string; open?: boolean } = $props();
	let proposals = $state<AiProposal[]>([]);
	let links = $state<{ id: string }[]>([]);
	let link = $state('');
	let agentRequest = $state('');
	let copied = $state(false);
	let message = $state('');
	let busy = $state(false);
	let finishRefresh: (() => void) | undefined;

	async function refresh() {
		const result = await aiListAction(listId);
		proposals = result.proposals;
		links = result.links;
	}

	async function run(action: () => Promise<void>) {
		if (busy) return;
		busy = true;
		message = '';
		try { await action(); }
		catch (e) { message = e instanceof Error ? e.message : 'Request failed.'; }
		finally {
			busy = false;
			finishRefresh?.();
		}
	}

	async function createLink() {
		const result = await aiListAction(listId, 'POST');
		link = result.url;
		agentRequest = result.request;
		copied = false;
		await refresh();
	}

	async function copyRequest() {
		try {
			await navigator.clipboard.writeText(agentRequest);
			copied = true;
			message = '';
		} catch {
			message = 'Could not copy the AI request. Try again.';
		}
	}

	async function revokeLinks() {
		await aiListAction(listId, 'DELETE');
		link = '';
		agentRequest = '';
		copied = false;
		await refresh();
	}

	async function decide(proposal: AiProposal, decision: 'accepted' | 'rejected') {
		try {
			await aiListAction(listId, 'POST', { id: proposal.id, version: proposal.version, decision });
		} catch (error) {
			if (!(error instanceof AiProposalConflict)) throw error;
			await refresh();
			message = proposals.some(({ id }) => id === proposal.id)
				? 'This proposal changed. Review the updated items before deciding.'
				: 'This proposal was already reviewed or has expired.';
			return;
		}
		await refresh();
	}

	onMount(() => {
		let mounted = true;
		let refreshQueued = false;
		const canPoll = () => mounted && navigator.onLine && document.visibilityState === 'visible';

		function poll() {
			if (!canPoll() || busy) return;
			refreshQueued = false;
			void run(refresh);
		}

		const resume = () => {
			if (!canPoll()) return;
			refreshQueued = true;
			void poll();
		};

		finishRefresh = () => {
			if (refreshQueued) poll();
		};
		document.addEventListener('visibilitychange', resume);
		window.addEventListener('online', resume);
		void poll();
		const timer = setInterval(poll, 15000);
		return () => {
			mounted = false;
			finishRefresh = undefined;
			clearInterval(timer);
			document.removeEventListener('visibilitychange', resume);
			window.removeEventListener('online', resume);
		};
	});
</script>

{#if proposals.length || (message && !open)}
	<section class="ai-proposals" aria-label="AI proposals">
		{#if proposals.length}
			<h2 class="mono small muted">AI proposals</h2>
			{#each proposals as proposal (proposal.id)}
				<article class="ai-proposals-card">
					<ul>{#each proposal.items as item, index (index)}<li>{item.groupName ? `[${item.groupName}] ` : ''}{item.name}</li>{/each}</ul>
					<p class="small muted">Expires {new Date(proposal.expiresAt).toLocaleString()}</p>
					<div class="ai-proposals-actions">
						<button class="btn-primary" disabled={busy} onclick={() => run(() => decide(proposal, 'accepted'))}>Accept</button>
						<button class="btn-primary ai-proposals-secondary" disabled={busy} onclick={() => run(() => decide(proposal, 'rejected'))}>Reject</button>
					</div>
				</article>
			{/each}
		{/if}
		{#if message && !open}
			<p class="small muted" role="alert">{message}</p>
			<button class="btn-primary ai-proposals-secondary" disabled={busy} onclick={() => run(refresh)}>Refresh</button>
		{/if}
	</section>
{/if}

<Dialog bind:open title="Connect AI" description="Let your AI suggest groceries. You decide what goes on this list.">
	<div class="ai-connect">
		{#if link}
			<div class="ai-connect-copy">
				<p class="small muted">Copy the request and paste it into your AI chat.</p>
				<InputGroup
					prefix="→"
					readonly
					aria-label="Secret AI link"
					value={link}
					actionLabel={copied ? 'Request copied' : 'Copy AI request'}
					onAction={copyRequest}
				/>
				<p class="small muted" role="status">{copied ? 'The request is ready to paste.' : 'Keep the request private. Copy it now if you need it later.'}</p>
			</div>
		{:else}
			<button class="btn-primary ai-connect-create" disabled={busy} onclick={() => run(createLink)}>
				{busy ? 'Please wait…' : 'Create AI link'}
			</button>
		{/if}

		{#if links.length}
			<div class="ai-connect-manage">
				<p class="small muted">{links.length === 1 ? '1 active link' : `${links.length} active links`}</p>
				<button class="btn-primary ai-connect-revoke" disabled={busy} onclick={() => run(revokeLinks)}>Revoke all AI links</button>
			</div>
		{/if}

		{#if message}<p class="ai-connect-error small" role="alert">{message}</p>{/if}
		<p class="ai-connect-note small muted">Links stay active until revoked. Proposals expire after 7 days.</p>
	</div>
</Dialog>

<style>
	:global {
		.ai-connect {
			display: flex;
			flex-direction: column;
			gap: var(--space-6);
			min-width: 0;

			.ai-connect-copy { display: flex; flex-direction: column; gap: var(--space-3); }
			.ai-connect-create { width: 100%; }
			.ai-connect-manage { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-3); }
			.ai-connect-revoke { background: transparent; border-color: var(--border); color: var(--danger); text-align: left; }
			.ai-connect-revoke:hover:not(:disabled) { border-color: var(--danger); background: var(--danger-muted); color: var(--danger); }
			.ai-connect-note { border-top: 1px solid var(--border); padding-top: var(--space-4); }
			.ai-connect-error { color: var(--danger); }
		}

		.ai-proposals {
			display: flex;
			flex-direction: column;
			gap: var(--space-4);
			margin-bottom: var(--space-6);

			.ai-proposals-card { display: flex; flex-direction: column; gap: var(--space-4); background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-4); overflow-wrap: anywhere; }
			.ai-proposals-card ul { padding-left: var(--space-4); }
			.ai-proposals-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }
			.ai-proposals-secondary { background: transparent; border-color: var(--border); color: var(--fg-2); }
		}
	}
</style>
