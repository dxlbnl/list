import store from './store.js'

let clients = [];

function getState() {
  return {
    ...store.get(),
    clients: clients.length
  }
}

function updateAll() {
  clients.forEach(client => client.response.write(`data: ${JSON.stringify(getState())}\n\n`))
}

export function stateHandler(request, response) {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  };
  response.writeHead(200, headers);
  
  const clientId = Date.now();
  
  const newClient = {
    id: clientId,
    response
  };
  
  clients.push(newClient);
  updateAll()

  response.write(`data: ${JSON.stringify(getState())}\n\n`);
  request.on('close', () => {
    console.log(`${clientId} Connection closed`);
    clients = clients.filter(client => client.id !== clientId);
    updateAll()
  });
}

export function addItem(request, response) {
  const item = request.body;

  store.add(item)

  updateAll()
  response.send()
}
export function updateItem(request, response) {
  const item = request.body;
  store.update(item)
  updateAll()
  response.send()
}
export function removeItem(request, response) {
  const item = request.body;
  store.remove(item)
  updateAll()
  response.send()
}