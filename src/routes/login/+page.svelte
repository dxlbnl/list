<script lang="ts">
	import AccessCard from '$lib/components/ui/AccessCard.svelte';
	let { form } = $props();
</script>

<main class="login-container">
	<AccessCard 
		{form}
		title="AUTHENTICATE"
		description="Enter your registered email address to receive a one-time magic link. New users will be automatically registered."
		placeholder="IDENTITY_EMAIL_ADDRESS"
		actionLabel="DISPATCH"
		loadingLabel="SENDING..."
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
