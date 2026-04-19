<script lang="ts">
	import AccessCard from '$lib/components/ui/AccessCard.svelte';
	let { form } = $props();
</script>

<main class="login-container">
	<AccessCard 
		{form}
		title="Sign in"
		description="Enter your email to receive a secure login link. New accounts will be created automatically."
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
