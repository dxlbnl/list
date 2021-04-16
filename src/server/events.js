
let clients = [];
let state = {
  clients: clients.length,
  items: []
};

function updateState() {
  state.clients = clients.length
  updateAll()
}
function updateAll() {
  clients.forEach(client => client.response.write(`data: ${JSON.stringify(state)}\n\n`))
}

function stateHandler(request, response) {
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
  updateState()

  response.write(`data: ${JSON.stringify(state)}\n\n`);
  request.on('close', () => {
    console.log(`${clientId} Connection closed`);
    clients = clients.filter(client => client.id !== clientId);
    updateState()
  });
}

function addItem(request, response) {
  const item = request.body;
  console.log("Adding", item)

  if (state.items.find(({ id }) => id === item.id)) return
  
  state.items.push(item)
  updateAll()
  response.send()
}
function updateItem(request, response) {
  const item = request.body;
  const index = state.items.findIndex(({ id }) => id === item.id)
  state.items[index] = item
  updateAll()
  response.send()
}
function removeItem(request, response) {
  const item = request.body;
  state.items = state.items.filter(({ id }) => item.id !== id )
  updateAll()
  response.send()
}

module.exports = {
  stateHandler,
addItem,
updateItem,
removeItem
}