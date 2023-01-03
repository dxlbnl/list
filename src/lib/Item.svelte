<script lang='ts'>
  import type { Category } from '$lib/api'
  import Checkbox from '$lib/Checkbox.svelte'
	import { createEventDispatcher } from 'svelte';

  import Button from './Button.svelte'

  export let category:Category
  export let id:string
  export let done:boolean

  const dispatch = createEventDispatcher();
</script>

<section class:done class={category}>
  <Checkbox bind:checked={done} on:change label={id}/>

  <Button on:click={() => dispatch('remove', id)}>X</Button>
</section>

<style>
  section {
    @apply flex bg-gray-50 p-2;
  }
  section span {
    @apply flex-auto;
  }
  section.done {
    @apply text-opacity-50;
  }
  section.done :global(label) {
    @apply line-through;
  }
  section.snacks { @apply bg-red-300; }
  section.groente { @apply bg-green-300; }
  section.houdbaar { @apply bg-indigo-300; }
  section.zuivel { @apply bg-yellow-300;}
  section.brood { @apply bg-blue-300;}
  section.ontbijt { @apply bg-pink-300;}
  section.drank { @apply bg-purple-300;}
</style>