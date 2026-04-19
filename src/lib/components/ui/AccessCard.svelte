<script lang="ts">
	import { enhance } from "$app/forms";
	import type { Snippet } from "svelte";

	interface Props {
		title: string;
		subtitle?: string;
		description?: string;
		placeholder?: string;
		actionLabel?: string;
		loadingLabel?: string;
		form?: any;
		action?: string;
		successTitle?: string;
		successMessage?: string;
		children?: Snippet;
		footer?: Snippet;
	}

	let {
		title,
		subtitle = "System_Access_Portal // V2.4",
		description,
		placeholder,
		actionLabel,
		loadingLabel,
		form,
		action,
		successTitle = "Magic Link Sent",
		successMessage = "We've dispatched a secure access link to your inbox. Please verify your identity via the link to continue.",
		children,
		footer,
	}: Props = $props();

	let loading = $state(false);
</script>

<div class="access-card">
	<header class="card-header">
		<div class="terminal-info mono tiny uppercase tracking-widest">
			{subtitle}
		</div>
		<h1>{title}</h1>
	</header>

	<div class="card-content">
		{#if children}
			<div class="card-body">
				{@render children()}
			</div>
		{:else if form?.success}
			<div class="success-message">
				<div class="success-icon">✉</div>
				<p
					class="mTo protect your account, please confirm you want ono tiny uppercase tracking-widest"
				>
					{successTitle}
				</p>
				<p class="message-text">{successMessage}</p>
				<p class="muted small hint">
					Check your spam folder if the transmission is delayed.
				</p>
			</div>
		{:else}
			<div class="card-body">
				{#if description}
					<p class="muted description">{description}</p>
				{/if}

				<form
					method="POST"
					{action}
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							await update();
							loading = false;
						};
					}}
				>
					<div class="input-group">
						<div class="input-prefix">></div>
						<input
							type="email"
							name="email"
							{placeholder}
							required
							autofocus
						/>
						<button class="input-action-btn" disabled={loading}>
							{loading ? loadingLabel : actionLabel}
						</button>
					</div>
					{#if form?.error}
						<p class="error-text mono tiny">{form.error}</p>
					{/if}
				</form>
			</div>
		{/if}
	</div>

	<footer class="card-footer">
		{#if footer}
			{@render footer()}
		{:else}
			<p class="mono tiny muted uppercase">
				Security_Protocol: Magic_Link_Only
			</p>
		{/if}
	</footer>
</div>

<style>
	:global {
		.access-card {
			background: var(--bg-1);
			border: 1px solid var(--border);
			border-radius: var(--radius-lg);
			width: 100%;
			display: flex;
			flex-direction: column;
			box-shadow: var(--shadow-md);
			overflow: hidden;

			.card-header {
				padding: var(--space-6) var(--space-8);
				border-bottom: 1px solid var(--border);
				background: var(--subtle-bg);

				h1 {
					font-family: var(--font-mono);
					font-size: 1.5rem;
					letter-spacing: 0.15em;
					margin-top: var(--space-2);
					color: var(--fg-0);
				}
			}

			.card-body {
				padding: var(--space-8);
				display: flex;
				flex-direction: column;
				gap: var(--space-6);
			}

			.description {
				font-size: 0.95rem;
				line-height: 1.6;
			}

			.card-footer {
				padding: var(--space-4) var(--space-8);
				background: var(--footer-bg);
				border-top: 1px solid var(--border);
			}

			.success-message {
				padding: var(--space-12) var(--space-10);
				text-align: center;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-4);
			}

			.success-icon {
				font-size: 2.5rem;
				color: var(--accent);
				margin-bottom: var(--space-2);
			}

			.message-text {
				line-height: 1.6;
				color: var(--fg-1);
			}

			.hint {
				margin-top: var(--space-6);
				padding: 0 var(--space-4);
				color: var(--fg-2);
				font-size: 0.875rem;
			}

			.error-text {
				color: var(--danger);
				margin-top: var(--space-2);
			}

			.terminal-info {
				color: var(--accent);
				opacity: 0.8;
			}
		}
	}
</style>
