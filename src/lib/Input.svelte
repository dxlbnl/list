<script>
	import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let input = ''
</script>

	<form on:submit|preventDefault={() => {
    dispatch('add', input)
		input = ''
	}}>
		<input bind:value={input} placeholder='Add an item' />
	</form>

	<style>
		form {
			@apply flex;
		}
		input {
			@apply w-full pl-3 pr-10 py-2 border-2 border-gray-200 hover:border-gray-300 focus:outline-none focus:border-blue-500 transition-colors;
		}
	</style>