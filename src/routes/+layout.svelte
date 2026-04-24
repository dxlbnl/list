<script lang="ts">
	import "../app.css";
	import { syncManager } from "$lib/client/sync.svelte";
	import { page } from "$app/state";
	import Header from "./Header.svelte";
	import { logout } from "$lib/client/auth";

	import { untrack } from "svelte";

	let { data, children } = $props();

	$effect(() => {
		if (data.sessionInvalid) {
			logout();
			return;
		}

		const token = data.supabaseToken;
		untrack(() => {
			syncManager.init(token);
		});
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
