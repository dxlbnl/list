<script lang="ts">
	import { resolve } from '$app/paths';
	let { data } = $props();
</script>

<svelte:head><title>Connect {data.clientName} to List</title></svelte:head>

<section class="consent" aria-labelledby="consent-title">
	<h1 id="consent-title">Connect {data.clientName} to List</h1>
	{#if data.signedIn}
		{#if data.user?.email}<p>Signed in as {data.user.email}</p>{/if}
		<ul>
			{#if data.scopes.includes('lists:read')}
				<li>Find your lists and read their items and groups, including shared lists you can access.</li>
			{/if}
			{#if data.scopes.includes('proposals:create')}
				<li>Suggest items for you to review and add in List.</li>
			{/if}
			{#if data.scopes.includes('offline_access')}<li>Stay connected between visits.</li>{/if}
		</ul>
		<p>You can disconnect this app in Settings.</p>
		<form method="POST">
			<input type="hidden" name="intent" value={data.intent} />
			<button class="btn-primary consent-secondary" type="submit" name="decision" value="deny">Cancel</button>
			<button class="btn-primary" type="submit" name="decision" value="allow">Allow access</button>
		</form>
	{:else}
		<p>Sign in to your List account to review this connection request. Open the email link in this same browser.</p>
		<a class="btn-primary" href="{resolve('/login')}?oauth=1">Sign in</a>
	{/if}
</section>

<style>
	.consent { max-width: 30rem; margin: 4rem auto; padding: 1rem; }
	ul { padding-inline-start: 1.5rem; }
	form { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 0.5rem; margin-top: 1.5rem; }
	.consent-secondary { color: var(--fg-2); background: transparent; border-color: var(--border); }
</style>
