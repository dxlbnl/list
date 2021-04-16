const fs = require('fs');


// Load state from fs

class Store {
  constructor(path = 'state.json') {
    this.path = path

    if (fs.existsSync(path)) {
      const { items } = JSON.parse(fs.readFileSync(path, { encoding: 'utf-8'}))
      this.items = items
    } else {
      this.items = []
    }
  }
  get() {
    return {
      items: this.items
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
            items: this.items
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

module.exports = new Store()