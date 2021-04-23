<script lang="ts">
  import TailwindCss from '$lib/TailwindCss.svelte';
</script>

<TailwindCss />

<main>
	<slot />
</main>

<style>
	main {
		@apply min-h-screen;
		@apply min-w-full;
		@apply flex;
		@apply items-center;
		@apply justify-center;
		@apply bg-yellow-100;

		@apply font-sans;
	}
</style>
