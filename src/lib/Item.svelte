<script lang="ts">
	import type { Category } from '$lib/api';
	import Checkbox from '$lib/Checkbox.svelte';
	import { createEventDispatcher } from 'svelte';

	export let category: Category;
	export let id: string;
	export let rank: number;
	export let done: boolean;

	const dispatch = createEventDispatcher();
</script>

<section class:done class={category} {rank}>
	<Checkbox bind:checked={done} on:change label={id} />

	<button
		on:click={() => dispatch('remove', id)}
		class="bg-red-100 px-4 py-2 -m-2  text-lg font-black tracking-wider text-red-600 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
		>x</button
	>
</section>

<style lang="postcss">
	section {
		@apply flex bg-gray-50 p-2;
	}
	section.done {
		@apply text-opacity-50;
	}
	section.done :global(label) {
		@apply line-through;
	}
	section.snacks {
		@apply bg-red-300;
	}
	section.groente {
		@apply bg-green-300;
	}
	section.houdbaar {
		@apply bg-indigo-300;
	}
	section.zuivel {
		@apply bg-yellow-300;
	}
	section.brood {
		@apply bg-blue-300;
	}
	section.ontbijt {
		@apply bg-pink-300;
	}
	section.drank {
		@apply bg-purple-300;
	}
</style>
