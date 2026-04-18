<script lang='ts'>
	export let Component: ConstructorOfATypedSvelteComponent;

	export let props = {}
</script>

<svelte:component this={Component} {...props}>
	<h1 data-testid="slot">Test Data</h1>
</svelte:component>
