
export enum Category {
  Snacks = 'snacks',
  Groente = 'groente',
  Houdbaar = 'houdbaar',
  Zuivel = 'zuivel',
  Brood = 'brood',
  Ontbijt = 'ontbijt',
  Drank = 'drank',
}

export type Item = {
  id: string,
  category: Category,
  done: boolean,
  rank: number
}

const callItem = (item: Item, method: string) : Promise<Response> =>
  fetch('/item', {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(item)
  })

export const update = (item: Item) : Promise<Response>  =>
  callItem(item, 'PUT')

export const add = (item: Item) : Promise<Response>  =>
  callItem(item, 'POST')

export const remove = (item: Item) : Promise<Response>  =>
  callItem(item, 'DELETE')
