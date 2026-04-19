<script lang="ts">
	import AccessCard from '$lib/components/ui/AccessCard.svelte';
	import { enhance } from '$app/forms';

	let { data } = $props();
	let isLoading = $state(false);
</script>

<svelte:head>
	<title>Confirm Session | Lists</title>
</svelte:head>

<div class="confirm-page">
	<AccessCard 
		title="Confirm session" 
		subtitle="Please confirm you want to sign in on this device to secure your lists."
	>
		<form 
			method="POST" 
			use:enhance={() => {
				isLoading = true;
				return async ({ update }) => {
					await update();
					isLoading = false;
				};
			}}
		>
			<div class="confirm-content">
				<div class="token-display mono tiny muted">
					Secure token: {data.token.slice(0, 8)}...
				</div>
				
				<button 
					type="submit" 
					class="btn-primary w-full mono tracking-widest"
					disabled={isLoading}
				>
					{isLoading ? "Authorizing..." : "Confirm & sync"}
				</button>
				
			</div>
		</form>
	</AccessCard>
</div>

<style>
	.confirm-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 70vh;
		padding: var(--space-4);
		width: 100%;
		max-width: 480px;
		margin: 0 auto;
	}

	.confirm-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
	}

	.token-display {
		padding: var(--space-4);
		background: var(--bg-0);
		border: 1px dashed var(--border);
		border-radius: var(--radius-md);
		text-align: center;
		letter-spacing: 0.1em;
	}

	.w-full { width: 100%; }
</style>
