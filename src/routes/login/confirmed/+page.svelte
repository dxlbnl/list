<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import AccessCard from '$lib/components/ui/AccessCard.svelte';

	let countdown = $state(3);

	onMount(() => {
		const timer = setInterval(() => {
			countdown--;
			if (countdown <= 0) {
				clearInterval(timer);
				goto('/');
			}
		}, 1000);
		return () => clearInterval(timer);
	});
</script>

<main class="login-container">
	<AccessCard 
		title="VERIFIED"
		subtitle="Security_Protocol // V2.4"
	>
		<div class="success-message">
			<div class="success-icon success">✓</div>
			<p class="mono tiny uppercase tracking-widest">Access Granted</p>
			<p class="message-text">Your email has been successfully verified. Your lists and session are now secured.</p>
		</div>

		{#snippet footer()}
			<div class="card-footer split">
				<span class="mono tiny muted">REDIRECTING_IN_{countdown}S...</span>
				<a href="/" class="manual-link mono tiny">CONTINUE_NOW</a>
			</div>
		{/snippet}
	</AccessCard>
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

		.success-icon.success {
			color: var(--success);
		}

		.card-footer.split {
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.manual-link {
			color: var(--fg-0);
			text-decoration: underline;
			text-underline-offset: 4px;
		}

		.manual-link:hover {
			color: var(--accent);
		}
	}
</style>
