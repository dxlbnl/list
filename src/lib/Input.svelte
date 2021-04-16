<script>
	import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let input = ''
</script>

	<form on:submit|preventDefault={() => {
    dispatch('add', input)
		input = ''
	}}>
		<input bind:value={input} />
	</form>