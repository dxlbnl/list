<script>
  import { goto, prefetch, prefetchRoutes } from '$app/navigation';
  let name

  const create = async () => {
    const response = await fetch('/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name
      })
    })
    const { id } = await response.json()
    goto(`/${id}`)
  }
</script>

<h1>Synchronizing shopping lists</h1>

<p>Create one now</p>

<form on:submit|preventDefault={create}>
  <label for=name>Name</label>
  <input id=name bind:value={name}>
  <button type=submit>Create</button>
</form>