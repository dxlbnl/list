<script lang="ts">
	import { syncManager } from "$lib/client/sync.svelte";
</script>

<div class="sync-status mono small">
	{#if syncManager.isSyncing}
		<span class="status-icon pulse syncing"></span>
		<span class="muted">Syncing...</span>
	{:else if !syncManager.isOnline}
		<span class="status-icon danger"></span>
		<span class="danger">Offline</span>
	{:else}
		<span class="status-icon success"></span>
		<span class="muted">Online</span>
	{/if}
</div>

<style>
	.sync-status {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		background: var(--bg-1);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
	}

	.status-icon {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.status-icon.success { background: #10b981; }
	.status-icon.danger { background: #ef4444; }
	.status-icon.syncing { background: var(--accent); }

	.pulse {
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.5; transform: scale(1.2); }
		100% { opacity: 1; transform: scale(1); }
	}

	.muted { color: var(--fg-4); }
	.danger { color: #ef4444; }
</style>
