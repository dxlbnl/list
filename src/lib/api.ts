
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

const callItem = (id: string, item: Item, method: string) : Promise<Response> =>
  fetch(`/${id}/item`, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(item)
  })

export const update = (id: string, item: Item) : Promise<Response>  =>
  callItem(id, item, 'PUT')

export const add = (id: string, item: Item) : Promise<Response>  =>
  callItem(id, item, 'POST')

export const remove = (id: string, item: Item) : Promise<Response>  =>
  callItem(id, item, 'DELETE')
