<script lang="ts">
	import List from '$lib/List.svelte';
	import Input from '$lib/Input.svelte';
	import { add, remove, Category } from '$lib/api';
	import { source } from '$lib/eventSource'

	const state = source('/state')

	const pickCategory = (options=Object.values(Category)) => (
		options[Math.floor(Math.random() * options.length)]
	)

	function removeItem(rid) {
		const item = $state.items.find(({ id }) => rid === id )
		remove(item)
	}
</script>

<main>
	<h1>List</h1>

	<Input
		on:add={
			({ detail }) => add({
				id: detail,
				category: pickCategory(),
				done: false,
				rank: $state.items.length
			})
		}
	/>
	{#if $state}
		<List items={$state.items}
			on:remove={({ detail }) => removeItem(detail)}
		/>
	{/if}
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
