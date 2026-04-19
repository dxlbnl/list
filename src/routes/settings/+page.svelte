<script lang="ts">
	import { enhance } from '$app/forms';
	import AccessCard from '$lib/components/ui/AccessCard.svelte';
	import { themeManager, type Theme } from '$lib/client/theme.svelte';
	let { data, form } = $props();

	const themes: { id: Theme; label: string }[] = [
		{ id: 'system', label: 'System' },
		{ id: 'light', label: 'Light' },
		{ id: 'dark', label: 'Dark' }
	];
</script>

<main class="settings-container">
	<header class="settings-header">
		<h1>Settings</h1>
	</header>

	<section class="settings-section">
		<div class="section-header">
			<h2 class="mono tiny uppercase tracking-widest">User identity</h2>
			<div class="status-badge" class:verified={data.user.email_verified}>
				{data.user.email_verified ? 'Verified' : 'Anonymous session'}
			</div>
		</div>

		<div class="settings-card">
			{#if data.user.email}
				<div class="info-row">
					<span class="label mono tiny muted">Email address</span>
					<span class="value">{data.user.email}</span>
				</div>
				<div class="info-row">
					<span class="label mono tiny muted">Account status</span>
					<span class="value success">Secured</span>
				</div>
			{:else}
				<AccessCard 
					{form}
					action="?/secureAccount"
					title="Register"
					subtitle="Account security"
					description="This is an anonymous session. Secure your account with an email address to ensure you never lose access to your lists."
					placeholder="email@example.com"
					actionLabel="Secure"
					loadingLabel="Sending..."
					successTitle="Security link sent"
					successMessage="Check your email for the magic link to secure your account and merge your anonymous data."
				/>
			{/if}
		</div>
	</section>

	<section class="settings-section">
		<h2 class="mono tiny uppercase tracking-widest">Interface</h2>
		<div class="settings-card">
			<div class="info-row">
				<span class="label mono tiny muted">Theme selection</span>
				<div class="theme-toggle-group">
					{#each themes as theme}
						<button 
							class="theme-btn mono tiny" 
							class:active={themeManager.current === theme.id}
							onclick={() => themeManager.set(theme.id)}
						>
							{theme.label}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<section class="settings-section">
		<h2 class="mono tiny uppercase tracking-widest">Technical details</h2>
		<div class="settings-card mono small">
			<div class="info-row">
				<span class="label tiny muted">User ID</span>
				<span class="value">{data.user.id}</span>
			</div>
			<div class="info-row">
				<span class="label tiny muted">Session persistence</span>
				<span class="value">Persistent</span>
			</div>
		</div>
	</section>
</main>

<style>
	:global {
		.settings-container {
			display: flex;
			flex-direction: column;
			gap: var(--space-8);
		}

		.settings-header {
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
			border-bottom: 1px dashed var(--border);
			padding-bottom: var(--space-4);
		}

		.settings-header h1 {
			font-family: var(--font-mono);
			font-size: 1.5rem;
			letter-spacing: 0.1em;
		}

		.settings-section {
			display: flex;
			flex-direction: column;
			gap: var(--space-4);
		}

		.section-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.status-badge {
			font-family: var(--font-mono);
			font-size: 0.65rem;
			padding: 2px 8px;
			background: var(--bg-2);
			border: 1px solid var(--border);
			border-radius: 4px;
			color: var(--fg-2);
		}

		.status-badge.verified {
			color: var(--success);
			border-color: var(--success);
			background: var(--success-muted);
		}

		.settings-card {
			background: var(--bg-1);
			padding: var(--space-6);
			border-radius: var(--radius-md);
			border: 1px solid var(--border);
			display: flex;
			flex-direction: column;
			gap: var(--space-4);
		}

		.info-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: var(--space-4);
			flex-wrap: wrap;
			border-bottom: 1px solid var(--border);
			padding-bottom: var(--space-2);
		}

		.info-row:last-child {
			border-bottom: none;
			padding-bottom: 0;
		}

		.info-row .label {
			letter-spacing: 0.05em;
		}

		.warning-box {
			background: var(--danger-muted);
			border-left: 3px solid var(--danger);
			padding: var(--space-4);
			color: var(--fg-2);
			font-size: 0.875rem;
		}

		.success-box {
			background: var(--success-muted);
			border-left: 3px solid var(--success);
			padding: var(--space-4);
			display: flex;
			flex-direction: column;
			gap: var(--space-1);
		}

		.success-box p:first-child {
			color: var(--success);
			font-weight: 600;
		}

		.error-text {
			color: var(--danger);
			margin-top: var(--space-2);
		}

		.mb-2 { margin-bottom: var(--space-2); }
		.block { display: block; }
		.success { color: var(--success); }

		.theme-toggle-group {
			display: flex;
			gap: var(--space-1);
			background: var(--bg-0);
			padding: var(--space-1);
			border-radius: var(--radius-md);
			border: 1px solid var(--border);
			flex: 1;
			justify-content: flex-end;
			min-width: 200px;
		}

		.theme-btn {
			flex: 1;
			text-align: center;
			padding: var(--space-1) var(--space-3);
			border-radius: var(--radius-sm);
			transition: all 0.2s;
			color: var(--fg-3);
			letter-spacing: 0.05em;

			&:hover {
				color: var(--fg-1);
			}

			&.active {
				background: var(--accent);
				color: white;
			}
		}
	}
</style>
