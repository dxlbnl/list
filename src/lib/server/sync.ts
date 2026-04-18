import { EventEmitter } from 'events';

class SyncHub extends EventEmitter {
	broadcast(listId: string) {
		this.emit('update', listId);
	}
}

export const syncHub = new SyncHub();
