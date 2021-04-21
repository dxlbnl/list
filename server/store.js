import fs from 'fs';


// Load state from fs

export class Store {
  constructor(path = 'data/state.json', { name }) {
    this.path = path

    if (fs.existsSync(path)) {
      const { items, name } = JSON.parse(fs.readFileSync(path, { encoding: 'utf-8'}))
      this.items = items
      this.name = name
    } else {
      this.items = []
      this.name = name
    }
  }
  get() {
    return {
      items: this.items,
      name: this.name
    }
  }
  add(item) {
    console.log("store.add:", item)
    if (this.items.find(({ id }) => id === item.id)) return
    
    this.items.push(item)
    this.save()
  }
  update(item) {
    console.log('store.update:', item)
    const index = this.items.findIndex(({ id }) => id === item.id)
    this.items[index] = item
    this.save()
  }
  remove(item) {
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
