import { db } from '$lib/client/db';

class SyncManager {
	isSyncing = $state(false);
	lastSyncError = $state<string | null>(null);

	constructor() {
		// Start sync loop
		if (typeof window !== 'undefined') {
			this.startLoop();
		}
	}

	async startLoop() {
		while (true) {
			try {
				await this.processQueue();
			} catch (e) {
				console.error('Sync loop error:', e);
			}
			// Wait 5 seconds before next check
			await new Promise(resolve => setTimeout(resolve, 5000));
		}
	}

	async processQueue() {
		const ops = await db.syncQueue.toArray();
		if (ops.length === 0) return;

		this.isSyncing = true;
		this.lastSyncError = null;

		try {
			const response = await fetch('/api/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ operations: ops })
			});

			if (!response.ok) {
				throw new Error(`Sync failed: ${response.statusText}`);
			}

			const { results } = await response.json();

			// Remove successfully processed ops from queue
			const successfulIds = results
				.filter((r: any) => r.status === 'success')
				.map((r: any) => r.id);
			
			if (successfulIds.length > 0) {
				await db.syncQueue.bulkDelete(successfulIds);
			}

			const errors = results.filter((r: any) => r.status === 'error');
			if (errors.length > 0) {
				console.warn('Some operations failed to sync:', errors);
				// We might want to handle specific errors here (e.g. 403 Forbidden)
			}
		} catch (e) {
			this.lastSyncError = (e as Error).message;
			throw e;
		} finally {
			this.isSyncing = false;
		}
	}

	async forceSync() {
		await this.processQueue();
	}
}

export const syncManager = new SyncManager();
