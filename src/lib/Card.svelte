<script lang='ts'>
  export let title : string
  export let description : string?
</script>

<content>
  <h1>{title}</h1>
  
  {#if description}
    <p>{description}</p>
  {/if}
  
  <slot />
</content>

<style>
  content {
    @apply flex flex-col shadow-xl;
  }

  h1 {
    @apply py-6 px-14 bg-yellow-400 rounded-tl-2xl rounded-tr-2xl text-center space-y-8;

    @apply text-3xl text-gray-700;
  }

  content > p {
    @apply m-2;
  }
</style>