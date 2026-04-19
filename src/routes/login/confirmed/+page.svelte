<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

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

<main class="confirm-container">
	<div class="success-card">
		<div class="status-header mono tiny uppercase tracking-widest">
			Identity_Verified
		</div>
		
		<div class="content">
			<div class="check-icon">✓</div>
			<h1>ACCESS_GRANTED</h1>
			<p class="muted">Your email has been successfully verified. Your lists and session are now secured.</p>
		</div>

		<div class="footer mono tiny muted">
			REDIRECTING_IN_{countdown}S...
			<a href="/" class="manual-link">CONTINUE_NOW</a>
		</div>
	</div>
</main>

<style>
	:global {
		.confirm-container {
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 60vh;
		}

		.success-card {
			background: var(--bg-1);
			border: 1px solid var(--success);
			border-radius: var(--radius-lg);
			width: 100%;
			max-width: 450px;
			overflow: hidden;
			box-shadow: 0 0 40px rgba(34, 197, 94, 0.1);
		}

		.status-header {
			background: rgba(34, 197, 94, 0.1);
			color: var(--success);
			padding: var(--space-3) var(--space-6);
			border-bottom: 1px solid var(--success);
		}

		.success-card .content {
			padding: var(--space-8);
			text-align: center;
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: var(--space-4);
		}

		.check-icon {
			font-size: 3rem;
			color: var(--success);
			margin-bottom: var(--space-2);
		}

		.success-card h1 {
			font-family: var(--font-mono);
			font-size: 1.75rem;
			letter-spacing: 0.1em;
			color: var(--fg-0);
		}

		.success-card p {
			font-size: 0.95rem;
			line-height: 1.6;
		}

		.success-card .footer {
			padding: var(--space-6);
			background: rgba(0, 0, 0, 0.2);
			border-top: 1px solid var(--border);
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
			color: var(--success);
		}
	}
</style>
