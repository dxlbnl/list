<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
	let loading = $state(false);
</script>

<main class="container">
	<header>
		<a href="/" class="back-link muted small">← Back</a>
		<h1>Sign In</h1>
	</header>

	<section class="auth-box">
		{#if form?.success}
			<div class="success-message">
				<p>Magic link sent! Check your email.</p>
				<p class="muted small">If you don't see it, check your spam folder.</p>
			</div>
		{:else}
			<p class="muted">Enter your email to sign in or create an account. We'll send you a magic link.</p>
			
			<form method="POST" use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update();
					loading = false;
				};
			}}>
				<div class="input-group">
					<input 
						type="email" 
						name="email" 
						placeholder="email@example.com" 
						required 
					/>
					<button class="btn-primary" disabled={loading}>
						{loading ? 'Sending...' : 'Send Link'}
					</button>
				</div>
				{#if form?.error}
					<p class="error-text">{form.error}</p>
				{/if}
			</form>
		{/if}
	</section>
</main>

<style>
	:global {
		.auth-box {
			background: var(--bg-1);
			padding: var(--space-8);
			border-radius: var(--radius-lg);
			border: 1px solid var(--border);
			display: flex;
			flex-direction: column;
			gap: var(--space-6);
		}

		.success-message {
			text-align: center;
			color: var(--success);
		}

		.error-text {
			color: var(--danger);
			font-size: 0.875rem;
			margin-top: var(--space-2);
		}
	}
</style>
