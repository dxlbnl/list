<script lang="ts">
  import TailwindCss from '$lib/TailwindCss.svelte';
</script>

<TailwindCss />

<main>
	<slot />
</main>

<style>
	main {
		@apply p-4 min-h-screen min-w-full;
		@apply flex items-start justify-center;
		@apply bg-yellow-100;

		@apply font-sans;
	}
</style>
