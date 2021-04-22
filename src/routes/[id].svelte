<script context="module">
	export const ssr = false;
</script>

<script lang="ts">
	import { page } from '$app/stores';
	import List from '$lib/List.svelte';
	import Input from '$lib/Input.svelte';
	import { add, remove, Category } from '$lib/api';
	import { source } from '$lib/eventSource'

	const state = source(`${$page.params.id}/state`)

	const pickCategory = (options=Object.values(Category)) => (
		options[Math.floor(Math.random() * options.length)]
	)

	function removeItem(rid) {
		const item = $state.items.find(({ id }) => rid === id )
		remove($page.params.id, item)
	}

	$: {
		console.log($state)
	}
</script>

<h1>{$state?.name || $page.params.id.replace(/-/g, ' ')}</h1>
<Input
	on:add={
		({ detail }) => add($page.params.id, {
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