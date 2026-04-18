<script lang='ts'>
  export let title : string
  export let description : string | null = null
</script>

<content class="flex-1">
  <h1>{title}</h1>
  
  {#if description}
    <p>{description}</p>
  {/if}
  
  <slot />
</content>

<style lang="postcss">
  content {
    @apply flex flex-col shadow-xl max-w-md;
  }

  h1 {
    @apply py-6 px-14;
    @apply bg-yellow-400 rounded-tl-2xl rounded-tr-2xl text-center space-y-8;

    @apply text-3xl font-semibold text-gray-700;
  }

  content > p {
    @apply m-2;
  }
</style>