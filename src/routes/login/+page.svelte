<script lang="ts">
	import { page } from '$app/state';
	import AccessCard from '$lib/components/ui/AccessCard.svelte';
	let { form } = $props();
	const oauth = $derived(page.url.searchParams.get('oauth') === '1');
</script>

<main class="login-container">
	<AccessCard 
		{form}
		title="Sign in"
		description={oauth ? 'Enter the email address you use for List. Open the secure link in this browser.' : 'Enter your email to receive a secure login link. New accounts will be created automatically.'}
		action={oauth ? '/login?oauth=1' : undefined}
		placeholder="email@example.com"
		actionLabel="Send link"
		loadingLabel="Sending..."
	/>
</main>

<style>
	:global {
		.login-container {
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 70vh;
			width: 100%;
			max-width: 480px;
			margin: 0 auto;
		}
	}
</style>
