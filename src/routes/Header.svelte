<script lang="ts">
	import { page } from '$app/state';
	import UserMenu from "$lib/components/ui/UserMenu.svelte";

	let { user } = $props();

	const pageTitle = $derived(page.data.title || "Lists");
</script>

<header>
	<div class="header-content">
		<a href="/" class="logo-link" class:is-back={page.url.pathname !== '/'}>
			{#if page.url.pathname !== '/'}
				<span class="back-arrow mono">←</span>
			{/if}
			<h1>{pageTitle}</h1>
		</a>
		<UserMenu {user} />
	</div>
</header>

<style>
	header {
		padding: var(--space-4) 0;
		margin-bottom: var(--space-8);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		background: var(--header-bg);
		backdrop-filter: blur(12px);
		z-index: 100;
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		max-width: var(--max-width, 800px);
		margin: 0 auto;
		padding: 0 var(--space-4);
	}

	.logo-link {
		text-decoration: none;
		color: inherit;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.logo-link:hover {
		opacity: 0.8;
	}

	.logo-link.is-back:hover {
		transform: translateX(-4px);
		color: var(--accent);
	}

	.back-arrow {
		color: var(--accent);
		font-weight: bold;
		font-size: 1.1rem;
	}

	h1 {
		font-size: 1.25rem;
		margin: 0;
	}

	@media (max-width: 600px) {
		header {
			margin-bottom: var(--space-4);
			padding: var(--space-3) 0;
		}

		h1 {
			font-size: 1.1rem;
		}
	}
</style>
