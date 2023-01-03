<script lang='ts'>
  import '../app.css';
</script>


<main class='p-4 max-sm:pr-16 min-h-screen min-w-full text-sm'>
	<slot />
</main>

<style>
	main {
		@apply flex items-start justify-center;
		@apply bg-yellow-100;

		@apply font-sans;
	}
</style>
