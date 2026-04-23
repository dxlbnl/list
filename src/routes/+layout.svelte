<script lang="ts">
	import "../app.css";
	import { syncManager } from "$lib/client/sync.svelte";
	import { page } from '$app/state';
	import Header from "./Header.svelte";
	import { themeManager } from "$lib/client/theme.svelte";

	let { data, children } = $props();

	$effect(() => {
		syncManager.init(data.supabaseToken);
	});

	const pageTitle = $derived(page.data.title || "Lists");
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<link rel="icon" href="/icon-192.png" />
</svelte:head>

<main class="container">
	<Header user={data.user} />
	{@render children()}
</main>

<style>
	.container {
		max-width: 600px;
		margin: 0 auto;
		padding: var(--space-8) var(--space-4);
	}
</style>
