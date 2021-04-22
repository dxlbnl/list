<script>
	import '../app.css';
</script>

<main>
	<slot />
</main>

<style>
	main {
		height: 100vh;
		text-align: center;
		margin: 0 auto;
		max-width: 30rem;

		display: flex;
		flex-direction: column;
	}
</style>
