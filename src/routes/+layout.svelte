<script lang="ts">
	import "../app.css";
	import { syncManager } from "$lib/client/sync.svelte";
	import favicon from "$lib/assets/favicon.svg";

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
