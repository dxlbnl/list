import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import morgan from 'morgan'
import { createProxyMiddleware } from 'http-proxy-middleware'
import serveStatic from 'serve-static'

import {
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
const PORT = 4000;
const HOST = "localhost";
const API_SERVICE_URL = "http://localhost:3000";

app.post('/item', addItem);
app.delete('/item', removeItem);
app.put('/item', updateItem);

app.get('/state', stateHandler);

if (process.env.NODE_ENV === 'dev') {
  app.use('/', createProxyMiddleware({
    target: API_SERVICE_URL
  }))
} else {
  app.use(serveStatic('/app/static'))
}

app.listen(PORT, () => {
  console.log(`Events service listening at http://localhost:${PORT}`)
})