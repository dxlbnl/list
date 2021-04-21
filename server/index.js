import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import morgan from 'morgan'
import { createProxyMiddleware } from 'http-proxy-middleware'

import {
  createList,
  stateHandler, 
  addItem,
  updateItem,
  removeItem
} from './events.js'

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(morgan('dev'))

// Configuration
const PORT = process.env.NODE_ENV === 'dev' ? 4000 : 80;
const API_SERVICE_URL = "http://localhost:3000";

app.post('/create', createList)

app.post('/:id/item', addItem);
app.delete('/:id/item', removeItem);
app.put('/:id/item', updateItem);

app.get('/:id/state', stateHandler);

if (process.env.NODE_ENV === 'dev') {
  app.use('/', createProxyMiddleware({
    target: API_SERVICE_URL
  }))
} else {
  app.use(express.static('/app/static'))
  app.get('*', (request, response) => response.sendFile('/app/static/list/index.html'));
}

app.listen(PORT, () => {
  console.log(`Events service listening at http://localhost:${PORT}`)
})