<script lang="ts">
 import { onMount } from 'svelte';
 import { resolve } from '$app/paths';
 import { aiListAction } from '$lib/client/actions';
 import type { AiProposal } from '$lib/validations';
 import Dialog from '$lib/components/ui/Dialog.svelte';
 let { listId, open = $bindable(false) }: { listId: string; open?: boolean } = $props();
 let proposals = $state<AiProposal[]>([]);
 let links = $state<{ id: string }[]>([]);
 let link = $state('');
 let message = $state('');
 let busy = $state(false);
 async function refresh() {
  const result = await aiListAction(listId);
  proposals = result.proposals; links = result.links;
 }
 async function run(action: () => Promise<void>) {
  busy = true; message = '';
  try { await action(); } catch (e) { message = e instanceof Error ? e.message : 'Verzoek mislukt'; }
  finally { busy = false; }
 }
 async function decide(proposal: AiProposal, decision: 'accepted' | 'rejected') {
  await aiListAction(listId, 'POST', { id: proposal.id, version: proposal.version, decision });
  await refresh();
 }
 onMount(() => {
  let active = true;
  const poll = () => { if (active && !busy && navigator.onLine) run(refresh); };
  poll();
  const timer = setInterval(poll, 15000);
  return () => { active = false; clearInterval(timer); };
 });
</script>

<section class="ai-panel" aria-label="AI-voorstellen">
 {#if proposals.length}
  <h2>AI-voorstellen</h2>
  {#each proposals as proposal (proposal.id)}
   <article>
    <ul>{#each proposal.items as item, index (index)}<li>{item.groupName ? `[${item.groupName}] ` : ''}{item.name}</li>{/each}</ul>
    <p>Versie {proposal.version} · vervalt {new Date(proposal.expiresAt).toLocaleString()}</p>
    <button disabled={busy} onclick={() => run(() => decide(proposal, 'accepted'))}>Accepteren</button>
    <button disabled={busy} onclick={() => run(() => decide(proposal, 'rejected'))}>Afwijzen</button>
   </article>
  {/each}
 {/if}
 {#if message}<p role="alert">{message} <button disabled={busy} onclick={() => run(refresh)}>Vernieuwen</button></p>{/if}
</section>
<Dialog bind:open title="Koppel met AI" description="Deze permanente koppeling laat een AI alleen voorstellen doen voor deze lijst. Jij beoordeelt de items voordat ze worden toegevoegd.">
 <div class="ai-panel">
  <p>{links.length} actieve koppeling(en). Een geheim wordt alleen bij aanmaken getoond. Bewaar de koppeling veilig.</p>
  <button disabled={busy} onclick={() => run(async () => { const result = await aiListAction(listId, 'POST'); link = result.url; await refresh(); })}>Nieuwe koppeling</button>
  {#if links.length}<button disabled={busy} onclick={() => run(async () => { await aiListAction(listId, 'DELETE'); link = ''; await refresh(); })}>Alle AI-koppelingen intrekken</button>{/if}
  {#if link}
   <label>Kopieer deze geheime koppeling voor je AI-agent <input readonly value={link} onclick={(event) => event.currentTarget.select()} /></label>
  {/if}
  <p>Voorstellen verlopen na 7 dagen. Intrekken blokkeert ook het opvragen en wijzigen van bestaande voorstellen door de agent.</p>
  <a href={resolve('/api/ai/openapi.json')} target="_blank" rel="noreferrer">OpenAPI-documentatie</a>
 </div>
</Dialog>
<style>
 :global {
  .ai-panel { margin-block: var(--space-4); overflow-wrap: anywhere; }
  .ai-panel article { border: 1px solid var(--border); padding: var(--space-4); margin-block: var(--space-4); }
  .ai-panel button { margin: var(--space-2); padding: var(--space-2); cursor: pointer; }
  .ai-panel input { width: 100%; padding: var(--space-2); }
  .ai-panel p { margin-block: var(--space-3); }
 }
</style>
