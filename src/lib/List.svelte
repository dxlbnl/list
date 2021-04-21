<script>
	import { page } from '$app/stores';
  import Item from './Item.svelte'
  import { update } from '$lib/api'
  
  import { dndzone } from 'svelte-dnd-action'
  import { flip } from 'svelte/animate'

  export let items = []
  let localItems = items

  $: {
    console.log("Sync items from export", items)
    localItems = items
  }
  $: {
    items.sort(({ rank: rankA }, { rank: rankB }) => rankA - rankB)
  }

  const flipDurationMs = 300

  function sortItems({ type, detail: { items, info }}) {
    console.log(type, items, info)
    localItems = items

    // Find the new index Of the dropped element
    const index = items.findIndex(item => item.id === info.id)
    const item = items[index]
    const previous = index > 0 ? items[index-1] : null
    const next = index < items.length ? items[index+1] : null
    
    if (!item || (!next && !previous)) {
      return
    }
    if (!previous) {
      item.rank = next.rank - 1
    } else if (!next) {
      item.rank = previous.rank + 0.1
    } else {
      item.rank = (next.rank + previous.rank) / 2
    }

    if (type === 'finalize') {
      update($page.params.id, item)
    }
  }
</script>

<ul
  use:dndzone={{ items: localItems, flipDurationMs }}
  on:consider={sortItems}
  on:finalize={sortItems}
>
  {#each localItems as item(item.id)}
    <li animate:flip={{duration: flipDurationMs}}>
      <Item
        on:remove {...item}
        on:change={() => update($page.params.id, item)}
        bind:done={item.done}
      />
    </li>
  {/each}
</ul>

<style>
  ul {
    flex: 1;
    
    text-align: left;
    list-style: none;;
    margin: 0;
    padding: 0;
  }
</style>