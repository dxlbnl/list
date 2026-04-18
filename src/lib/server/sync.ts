import { EventEmitter } from 'events';

class SyncHub extends EventEmitter {
	constructor() {
		super();
		this.setMaxListeners(100);
	}
	broadcast(listId: string, payload?: any) {
		this.emit('update', { listId, ...payload });
	}
}

// In development, HMR causes the hub to be recreated.
// Store it in globalThis to persist the instance and its listeners.
const globalHub = globalThis as any;
export const syncHub: SyncHub = globalHub.syncHub || (globalHub.syncHub = new SyncHub());
