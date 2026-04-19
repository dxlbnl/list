<script lang="ts">
	import { enhance } from '$app/forms';
	import AccessCard from '$lib/components/ui/AccessCard.svelte';
	let { data, form } = $props();
</script>

<main class="settings-container">
	<header class="settings-header">
		<h1>SYSTEM_SETTINGS</h1>
	</header>

	<section class="settings-section">
		<div class="section-header">
			<h2 class="mono tiny uppercase tracking-widest">User_Identity</h2>
			<div class="status-badge" class:verified={data.user.email_verified}>
				{data.user.email_verified ? 'VERIFIED' : 'ANONYMOUS_SESSION'}
			</div>
		</div>

		<div class="settings-card">
			{#if data.user.email}
				<div class="info-row">
					<span class="label mono tiny muted">EMAIL_ADDRESS</span>
					<span class="value">{data.user.email}</span>
				</div>
				<div class="info-row">
					<span class="label mono tiny muted">ACCOUNT_STATUS</span>
					<span class="value success">SECURED</span>
				</div>
			{:else}
				<AccessCard 
					{form}
					action="?/secureAccount"
					title="SECURE_IDENTITY"
					subtitle="Account_Security_Protocol // V1.0"
					description="This is an anonymous session. Secure your account with an email address to ensure you never lose access to your lists."
					placeholder="ENTER_EMAIL_TO_SECURE"
					actionLabel="SECURE"
					loadingLabel="SENDING..."
					successTitle="Security Link Sent"
					successMessage="Check your email for the magic link to secure your account and merge your anonymous data."
				/>
			{/if}
		</div>
	</section>

	<section class="settings-section">
		<h2 class="mono tiny uppercase tracking-widest">Technical_Details</h2>
		<div class="settings-card mono small">
			<div class="info-row">
				<span class="label tiny muted">USER_ID</span>
				<span class="value">{data.user.id}</span>
			</div>
			<div class="info-row">
				<span class="label tiny muted">SESSION_PERSISTENCE</span>
				<span class="value">PERMANENT_COOKIE</span>
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
			background: rgba(34, 197, 94, 0.1);
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
			border-bottom: 1px solid rgba(255, 255, 255, 0.03);
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
			background: rgba(239, 68, 68, 0.05);
			border-left: 3px solid var(--danger);
			padding: var(--space-4);
			color: var(--fg-2);
			font-size: 0.875rem;
		}

		.success-box {
			background: rgba(34, 197, 94, 0.05);
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
	}
</style>
