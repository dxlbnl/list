<script>
  import Card from '$lib/Card.svelte';
  import { goto } from '$app/navigation';
  let name

  const create = async () => {
    const response = await fetch('/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name
      })
    })
    if (response.ok) {
      const { id } = await response.json()
      goto(`/${id}`)
    }
  }
</script>

<Card title='Create a List' description='Create synchronizing list, and share it with your mates'>
  <form on:submit|preventDefault={create}>
    <label for=name>Name</label>
    <section>
      <input type=text id=name bind:value={name}>
      <button type=submit>Create</button>
    </section>
  </form>
</Card>

<style>
  form {
    @apply m-2;
  }
  form > section {
    @apply m-4 flex;
  }
  form input {
    @apply rounded-l-lg p-4 border-t mr-0 border-b border-l text-gray-800 border-yellow-600 bg-white;
  }
  form button {
    @apply px-8 rounded-r-lg bg-yellow-400  text-gray-800 font-bold p-4 uppercase border-yellow-600 border-t border-b border-r;
  }

  form label {
    @apply block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2;
  }
</style>