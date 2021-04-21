import fs from 'fs';

import { Store } from './store.js'
import { randomName } from './words.js'

let stateMap = new Map() 

function createState(id, name) {
  const state = {
    store: new Store(`data/${id}.json`, { name }),
    clients: []
  }
  stateMap.set(id, state)
  return state
}
function loadState(id) {
  if (stateMap.has(id)) {
    return stateMap.get(id)
  }
  if (fs.existsSync(`data/${id}.json`)) {
    return createState(id)
  }
}
function getState(id) {
  const { store, clients } = stateMap.get(id)
  return {
    ...store,
    clients: clients.length
  }
}

function updateAll(id) {
  stateMap.get(id).clients.forEach(client => client.response.write(`data: ${JSON.stringify(getState(id))}\n\n`))
}

export function stateHandler(request, response) {
  const id = request.params.id;
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  };
  
  const clientId = Date.now();
  
  const newClient = {
    id: clientId,
    response
  };

  let state = loadState(id)
  if (!state) {
    // Check if store exists or redirect to /
    response.writeHead(302, 'Unknown list', {
      Location: '/'
    })
    response.send()
    return
  }
  
  response.writeHead(200, headers);

  state.clients.push(newClient);
  updateAll(id)
  
  response.write(`data: ${JSON.stringify(getState(id))}\n\n`);
  request.on('close', () => {
    console.log(`${clientId} Connection closed`);
    state.clients = state.clients.filter(client => client.id !== clientId);
    updateAll(id)
  });
}

export function createList(request, response) {
  // Something to fix grievers?d
  let id, i;

  let { name } = request.body

  if (name && name.length) {
    id = name.replace(/[^a-zA-Z0-9.+_]+/g, '-').replace(/^-/, '').replace(/-$/, '')
    if (stateMap.has(id)) {

      response.writeHead(400, 'Invalid name')
      response.send()
      return
    }
  } else {
    for (id=randomName(), i=0; stateMap.has(id); i++, id=randomName()) {
      if (i > 20) {
        console.error("Too many tries generating id")
        response.writeHead(500)
        response.send()
        return
      }
    }
    name = null
  }
  
  console.log('Created list', id)
  createState(id, name)

  response.writeHead(201, 'Created', {
    'Content-Type': 'application/json'
  })
  response.write(JSON.stringify({ id }))
  response.send()
}

export function addItem(request, response) {
  const id = request.params.id
  const item = request.body;
  const state = stateMap.get(id)

  state.store.add(item)

  updateAll(id)
  response.send()
}
export function updateItem(request, response) {
  const id = request.params.id
  const item = request.body;
  const state = stateMap.get(id)
  state.store.update(item)
  updateAll(id)
  response.send()
}
export function removeItem(request, response) {
  const id = request.params.id
  const item = request.body;
  const state = stateMap.get(id)
  state.store.remove(item)
  updateAll(id)
  response.send()
}