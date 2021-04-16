<script lang='ts'>
  import type { Category } from '$lib/api'
	import { createEventDispatcher } from 'svelte';

  export let category:Category
  export let id:string
  export let done:boolean

  const dispatch = createEventDispatcher();
</script>

<section class:done class={category}  >
  <input
    type='checkbox'
    bind:checked={done}
    on:change
  />

  <span>{id}</span>

  <button on:click={() => dispatch('remove', id)}>X</button>
</section>

<style>
  section {
    user-select: none;

    cursor: grab;
    background: gray;
    padding: 0.4rem;
    margin: 0.6rem;
    font-size: 1rem
    ;
    display: flex;
    justify-content: space-between;
  }
  section.done {
    opacity: 0.6;
  }
  section.done span {
    text-decoration: brown line-through 5px;
  }
  button {
    background: #ffffff70;
    margin: -.6rem;
    border: 0;
    padding-right: 0.7rem;
  }

  section.snacks { background: red;}
  section.groente { background: green;}
  section.houdbaar { background: yellow;}
  section.zuivel { background: lightyellow;}
  section.brood { background: burlywood;}
  section.ontbijt { background: orange;}
  section.drank { background: purple;}
</style>