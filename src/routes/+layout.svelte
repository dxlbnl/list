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
	<link rel="icon" type="image/svg+xml" href="/icon.svg" />
</svelte:head>

<main class="container">
	<Header user={data.user} />
	{@render children()}
</main>

<footer>
	made with ♥ by <a href="https://www.dexterlabs.nl" target="_blank" rel="noopener noreferrer">dexter</a>
</footer>

<style>
	.container {
		max-width: 600px;
		margin: 0 auto;
		padding: var(--space-8) var(--space-4);
	}

	footer {
		text-align: center;
		padding: var(--space-8) var(--space-4);
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	footer a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	footer a:hover {
		color: var(--accent);
	}
</style>
