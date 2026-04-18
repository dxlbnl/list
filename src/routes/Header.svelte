<script lang="ts">
	import Dialog from "$lib/components/ui/Dialog.svelte";
	import SyncStatus from "$lib/components/ui/SyncStatus.svelte";
	import QRCode from "qrcode";
	import { page } from '$app/state';

	let { user } = $props();

	let qrCodeDataUrl = $state("");
	let isSyncDialogOpen = $state(false);
	let isLoadingQr = $state(false);

	async function handleSyncDevice() {
		isLoadingQr = true;
		try {
			const res = await fetch("/api/auth/clone", { method: "POST" });
			const { url } = await res.json();
			qrCodeDataUrl = await QRCode.toDataURL(url, {
				width: 300,
				margin: 2,
				color: {
					dark: "#ffffff",
					light: "#00000000",
				},
			});
		} catch (e) {
			console.error("Failed to generate sync QR:", e);
		} finally {
			isLoadingQr = false;
		}
	}

	$effect(() => {
		if (isSyncDialogOpen) {
			handleSyncDevice();
		}
	});

	const pageTitle = $derived(page.data.title || "Lists");
</script>

<header>
	<div class="header-main">
		<a href="/" class="logo-link">
			<h1>{pageTitle}</h1>
		</a>
		<SyncStatus />
	</div>
	<div class="header-actions">
		<Dialog 
			bind:open={isSyncDialogOpen}
			title="Sync to Device" 
			description="Scan this QR code with another device to mirror this session. This link expires in 10 minutes."
		>
			{#snippet trigger()}
				<button class="btn-settings muted">Sync Device</button>
			{/snippet}

			<div class="qr-container">
				{#if isLoadingQr}
					<div class="qr-placeholder mono small muted">Generating...</div>
				{:else if qrCodeDataUrl}
					<img src={qrCodeDataUrl} alt="Sync QR Code" class="qr-image" />
				{:else}
					<div class="qr-placeholder mono small danger">Error loading QR</div>
				{/if}
			</div>
		</Dialog>
		<a href="/settings" class="btn-settings muted">Settings</a>
		{#if user}
			<div class="user-badge mono small muted">
				ID: {user.id.slice(0, 8)}...
				{#if user.email}
					({user.email})
				{:else}
					<span class="status-anon">Anonymous</span>
				{/if}
			</div>
		{/if}
	</div>
</header>

<style>
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-8);
		border-bottom: 1px solid var(--border);
		padding-bottom: var(--space-4);
	}

	.header-main {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.logo-link {
		text-decoration: none;
		color: inherit;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.btn-settings {
		text-decoration: none;
		font-size: 0.875rem;
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
		border: 1px solid transparent;
		transition: all 0.2s;
	}

	.btn-settings:hover {
		border-color: var(--border);
		background: var(--bg-1);
		color: var(--fg-1);
	}

	.user-badge {
		background: var(--bg-1);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
	}

	.status-anon {
		color: var(--accent);
	}

	.qr-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 200px;
		background: var(--bg-0);
		border-radius: var(--radius-md);
		padding: var(--space-4);
	}

	.qr-image {
		width: 100%;
		max-width: 250px;
		image-rendering: pixelated;
	}

	.qr-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
