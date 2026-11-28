<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	const title = $derived(`Connect ${data.clientName} to List`);
	const permissions = [
		{ scope: 'lists:read', icon: '≡', title: 'Read your lists', detail: 'Read items and groups on your lists, including shared lists you can access.' },
		{ scope: 'proposals:create', icon: '+', title: 'Suggest items', detail: 'You review each proposal in List before its items are added.' },
		{ scope: 'offline_access', icon: '↻', title: 'Stay connected', detail: 'Keep the connection between visits.' }
	];
</script>

<svelte:head><title>{title}</title></svelte:head>

<div class="oauth-consent">
	<section class="oauth-consent-card" aria-labelledby="consent-title">
		<header class="oauth-consent-header">
			<span class="oauth-consent-brand"><img src={resolve('/icon.svg')} width="30" height="30" alt="" /></span>
			<div>
				<p class="oauth-consent-kicker">AI connection</p>
				<h1 id="consent-title">{title}</h1>
			</div>
		</header>

		<div class="oauth-consent-body">
			{#if data.signedIn}
				{#if data.user?.email}
					<p class="oauth-consent-account"><span class="muted">Signed in as</span><strong>{data.user.email}</strong></p>
				{/if}
				<h2 id="consent-permissions">Requested permissions</h2>
				<ul class="oauth-consent-permissions" aria-labelledby="consent-permissions">
					{#each permissions.filter(({ scope }) => data.scopes.includes(scope)) as permission (permission.scope)}
						<li>
							<span class="oauth-consent-glyph" aria-hidden="true">{permission.icon}</span>
							<div><strong>{permission.title}</strong><p>{permission.detail}</p></div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted">Sign in to your List account to review this request. Open the email link in this same browser.</p>
			{/if}
		</div>

		{#if data.signedIn}
			<form class="oauth-consent-actions" method="POST">
				<input type="hidden" name="intent" value={data.intent} />
				<button class="btn-primary oauth-consent-cancel" type="submit" name="decision" value="deny">Cancel</button>
				<button class="btn-primary" type="submit" name="decision" value="allow">Allow access</button>
			</form>
		{:else}
			<div class="oauth-consent-actions">
				<a class="btn-primary" href="{resolve('/login')}?oauth=1">Sign in</a>
			</div>
		{/if}
	</section>
	{#if data.signedIn}
		<p class="oauth-consent-note">Manage or disconnect this app in Settings → AI connections.</p>
	{/if}
</div>

<style>
	:global {
		.oauth-consent {
			max-width: 31.5rem;
			margin: var(--space-10) auto var(--space-6);

			.oauth-consent-card {
				overflow: hidden;
				border: 1px solid var(--border);
				border-radius: var(--radius-lg);
				background: var(--bg-1);
				box-shadow: var(--shadow-xl);
			}

			.oauth-consent-header {
				display: grid;
				grid-template-columns: auto minmax(0, 1fr);
				align-items: center;
				gap: var(--space-4);
				padding: var(--space-6) var(--space-8);
				background: var(--subtle-bg);
				border-bottom: 1px solid var(--border);
			}

			.oauth-consent-brand,
			.oauth-consent-glyph {
				display: grid;
				place-items: center;
				background: var(--accent-muted);
			}

			.oauth-consent-brand {
				width: var(--space-12);
				aspect-ratio: 1;
				border-radius: var(--radius-md);
			}

			.oauth-consent-kicker,
			h2 {
				font: 500 0.6875rem/1.4 var(--font-mono);
				letter-spacing: 0.12em;
				text-transform: uppercase;
			}

			.oauth-consent-kicker {
				color: var(--accent);
			}

			h1 {
				font-size: clamp(1.2rem, 4vw, 1.65rem);
				line-height: 1.25;
				letter-spacing: -0.035em;
				margin-top: var(--space-1);
				overflow-wrap: anywhere;
			}

			.oauth-consent-body {
				padding: var(--space-6) var(--space-8);
			}

			.oauth-consent-account {
				display: flex;
				align-items: baseline;
				flex-wrap: wrap;
				gap: var(--space-2) var(--space-3);
				padding: var(--space-3) var(--space-4);
				margin-bottom: var(--space-6);
				border: 1px solid var(--border);
				border-radius: var(--radius-md);
				background: var(--bg-0);
				font-size: 0.875rem;
				overflow-wrap: anywhere;
			}

			.oauth-consent-account strong {
				color: var(--fg-0);
				font-weight: 500;
				min-width: 0;
			}

			h2 {
				color: var(--fg-2);
			}

			.oauth-consent-permissions {
				list-style: none;
				margin-top: var(--space-2);
			}

			.oauth-consent-permissions li {
				display: grid;
				grid-template-columns: auto minmax(0, 1fr);
				align-items: start;
				gap: var(--space-3);
				padding-block: var(--space-3);
			}

			.oauth-consent-permissions li + li {
				border-top: 1px solid var(--border);
			}

			.oauth-consent-glyph {
				width: calc(var(--space-4) + var(--space-3));
				aspect-ratio: 1;
				border-radius: var(--radius-sm);
				color: var(--accent);
				font: 500 1rem/1 var(--font-mono);
			}

			.oauth-consent-permissions strong {
				display: block;
				color: var(--fg-0);
				font-size: 0.9375rem;
				font-weight: 600;
			}

			.oauth-consent-permissions p {
				margin-top: var(--space-1);
				color: var(--fg-2);
				font-size: 0.875rem;
			}

			.oauth-consent-actions {
				display: flex;
				justify-content: flex-end;
				flex-wrap: wrap;
				gap: var(--space-2);
				padding: var(--space-4) var(--space-8);
				background: var(--footer-bg);
				border-top: 1px solid var(--border);
			}

			.oauth-consent-actions .btn-primary {
				display: inline-grid;
				place-items: center;
				min-height: 44px;
				text-decoration: none;
			}

			.oauth-consent-cancel {
				background: transparent;
				color: var(--fg-1);
				border-color: var(--border-hover);
			}

			.oauth-consent-note {
				margin: var(--space-4) auto 0;
				color: var(--fg-2);
				font-size: 0.8125rem;
				text-align: center;
			}
		}

		@media (max-width: 28rem) {
			.oauth-consent {
				margin-top: var(--space-6);

				.oauth-consent-header,
				.oauth-consent-body,
				.oauth-consent-actions {
					padding-inline: var(--space-4);
				}

				.oauth-consent-header {
					gap: var(--space-3);
				}

				.oauth-consent-actions .btn-primary {
					flex: 1 1 auto;
					padding-inline: var(--space-3);
				}
			}
		}
	}
</style>
