<script lang="ts">
	import { page } from "$app/state";
</script>

<div class="error-container">
	<div class="error-card">
		<header class="error-header">
			<div class="system-tag mono tiny uppercase tracking-widest">
				System_Error_Report // V4.0.4
			</div>
			<h1 class="mono">STATUS: {page.status}</h1>
		</header>

		<div class="error-body">
			<div class="terminal-output">
				<div class="output-line">
					<span class="prefix">></span>
					<span class="command">diagnostic_check --verbose</span>
				</div>
				<div class="output-line response">
					<span class="timestamp mono tiny">[{new Date().toISOString()}]</span>
					<span class="message danger">{page.error?.message || "Unknown_Error_Encountered"}</span>
				</div>
				<div class="output-line hint">
					<span class="prefix">></span>
					<span class="muted">Access restricted or resource lifecycle terminated.</span>
				</div>
			</div>
		</div>

		<footer class="error-footer">
			<a href="/" class="btn-primary">Return_To_Base</a>
		</footer>
	</div>
</div>

<style>
	.error-container {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
	}

	.error-card {
		background: var(--bg-1);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		width: 100%;
		max-width: 500px;
		display: flex;
		flex-direction: column;
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}

	.error-header {
		padding: var(--space-6) var(--space-8);
		border-bottom: 1px solid var(--border);
		background: var(--subtle-bg);

		.system-tag {
			color: var(--danger);
			opacity: 0.8;
			margin-bottom: var(--space-2);
		}

		h1 {
			font-size: 1.5rem;
			letter-spacing: 0.1em;
			color: var(--fg-0);
		}
	}

	.error-body {
		padding: var(--space-8);
	}

	.terminal-output {
		background: var(--bg-0);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		font-family: var(--font-mono);
	}

	.output-line {
		display: flex;
		gap: var(--space-3);
		font-size: 0.85rem;

		.prefix {
			color: var(--accent);
			font-weight: bold;
		}

		.command {
			color: var(--fg-1);
		}

		.message {
			color: var(--fg-1);
		}

		&.response {
			padding-left: var(--space-4);
			flex-direction: column;
			gap: var(--space-1);
		}

		.danger {
			color: var(--danger);
			font-weight: 500;
		}
	}

	.error-footer {
		padding: var(--space-6) var(--space-8);
		background: var(--footer-bg);
		border-top: 1px solid var(--border);
		display: flex;
		justify-content: center;
	}

	.btn-primary {
		text-decoration: none;
		text-align: center;
	}
</style>
