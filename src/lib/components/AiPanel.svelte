<script lang="ts">
	import { onMount } from 'svelte';
	import { aiListAction } from '$lib/client/actions';
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
		catch (e) { message = e instanceof Error ? e.message : 'Verzoek mislukt'; }
		finally { busy = false; }
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
			message = 'Kopiëren is niet gelukt. Probeer het opnieuw.';
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
		await aiListAction(listId, 'POST', { id: proposal.id, version: proposal.version, decision });
		await refresh();
	}

	onMount(() => {
		const poll = () => { if (!busy && navigator.onLine) void run(refresh); };
		poll();
		const timer = setInterval(poll, 15000);
		return () => clearInterval(timer);
	});
</script>

{#if proposals.length || (message && !open)}
	<section class="ai-proposals" aria-label="AI-voorstellen">
		{#if proposals.length}
			<h2 class="mono small muted">AI-voorstellen</h2>
			{#each proposals as proposal (proposal.id)}
				<article class="ai-proposals-card">
					<ul>{#each proposal.items as item, index (index)}<li>{item.groupName ? `[${item.groupName}] ` : ''}{item.name}</li>{/each}</ul>
					<p class="small muted">Versie {proposal.version} · vervalt {new Date(proposal.expiresAt).toLocaleString()}</p>
					<div class="ai-proposals-actions">
						<button class="btn-primary" disabled={busy} onclick={() => run(() => decide(proposal, 'accepted'))}>Accepteren</button>
						<button class="btn-primary ai-proposals-secondary" disabled={busy} onclick={() => run(() => decide(proposal, 'rejected'))}>Afwijzen</button>
					</div>
				</article>
			{/each}
		{/if}
		{#if message && !open}
			<p class="small muted" role="alert">{message}</p>
			<button class="btn-primary ai-proposals-secondary" disabled={busy} onclick={() => run(refresh)}>Vernieuwen</button>
		{/if}
	</section>
{/if}

<Dialog bind:open title="Koppel met AI" description="Laat je AI boodschappen voorstellen. Jij bepaalt wat er op deze lijst komt.">
	<div class="ai-connect">
		{#if link}
			<div class="ai-connect-copy">
				<p class="small muted">Kopieer het verzoek en plak het in je AI-chat.</p>
				<InputGroup
					prefix="→"
					readonly
					aria-label="Geheime AI-koppeling"
					value={link}
					actionLabel={copied ? 'Gekopieerd' : 'Kopieer'}
					onAction={copyRequest}
				/>
				<p class="small muted" role="status">{copied ? 'Het verzoek staat klaar om te plakken.' : 'Bewaar dit verzoek veilig. Deze geheime koppeling wordt alleen nu getoond.'}</p>
			</div>
		{:else}
			<button class="btn-primary ai-connect-create" disabled={busy} onclick={() => run(createLink)}>
				{busy ? 'Even geduld…' : 'Koppeling maken'}
			</button>
		{/if}

		{#if links.length}
			<div class="ai-connect-manage">
				<p class="small muted">{links.length === 1 ? 'Er is 1 actieve koppeling.' : `Er zijn ${links.length} actieve koppelingen.`}</p>
				<button class="btn-primary ai-connect-revoke" disabled={busy} onclick={() => run(revokeLinks)}>Alle koppelingen intrekken</button>
			</div>
		{/if}

		{#if message}<p class="ai-connect-error small" role="alert">{message}</p>{/if}
		<p class="ai-connect-note small muted">De koppeling blijft geldig tot je die intrekt. Voorstellen vervallen na 7 dagen.</p>
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
