import fs from 'fs';
import { EventEmitter } from 'node:events';

const Categories = <const> [
  'snacks',
  'groente',
  'houdbaar',
  'zuivel',
  'brood',
  'ontbijt',
  'drank',
]

type Item = {
  id: string;
  category: typeof Categories[number];
  rank: number;
  done?: boolean;
}

export class Store {
  name: string;
  path: string;
  items: Item[];

  $$pending: boolean = false;
  $$writing: boolean = false;

  constructor(path = 'data/state.json', name?: string) {
    this.path = path

    if (fs.existsSync(path)) {
      const { items, name } = JSON.parse(fs.readFileSync(path, { encoding: 'utf-8'}))
      this.items = items
      this.name = name
    } else {
      this.items = []
      this.name = name || "Default"
    }
  }
  get() {
    return {
      items: this.items,
      name: this.name
    }
  }
  add(item: Item) {
    console.log("store.add:", item)
    if (this.items.find(({ id }) => id === item.id)) return
    
    this.items.push(item)
    this.save()
  }
  update(item: Item) {
    console.log('store.update:', item)
    const index = this.items.findIndex(({ id }) => id === item.id)
    this.items[index] = item
    this.save()
  }
  remove(item: Item) {
    console.log('store.remove', item.id)
    this.items = this.items.filter(({ id }) => item.id !== id )
    this.save()
  }
  save() {
    if (!this.$$pending) {
      this.$$pending = true
      global.setTimeout(() => {
        this.$$pending = false
        
        if (!this.$$writing) {
          this.$$writing = true
          fs.writeFile(this.path, JSON.stringify({
            items: this.items,
            name: this.name
          }), () => {
            this.$$writing = false
          })
        } else {
          this.save()
        }
      }, 10)
    }
  }
}

type State = {
  store: Store, 
  emitter: EventEmitter
}

export const stateMap = new Map<string, State>() 

export function createState(id: string, name?: string) {
  const state: State = {
    store: new Store(`data/${id}.json`, name),
    emitter: new EventEmitter(),
  }
  stateMap.set(id, state)
  return state
}
export function loadState(id: string) {
  if (stateMap.has(id)) {
    return stateMap.get(id)
  }
  if (fs.existsSync(`data/${id}.json`)) {
    return createState(id)
  }
}
export function updateAll(id: string) {
  const state = stateMap.get(id)

  if (!state) return

  state.emitter.emit('state', state.store);
}