const express = require('express');
const { json, urlencoded } = require('body-parser');
const cors = require('cors');
const morgan = require('morgan')
const { createProxyMiddleware } = require('http-proxy-middleware')

const {
  stateHandler, 
  addItem,
  updateItem,
  removeItem
} = require('./events')

const app = express();

app.use(cors());
app.use(json());
app.use(urlencoded({extended: false}));
app.use(morgan('dev'))

// Configuration
const PORT = 4000;
const HOST = "localhost";
const API_SERVICE_URL = "http://localhost:3000";

app.post('/item', addItem);
app.delete('/item', removeItem);
app.put('/item', updateItem);

app.get('/state', stateHandler);

app.use('/', createProxyMiddleware({
  target: API_SERVICE_URL
}))

app.listen(PORT, () => {
  console.log(`Events service listening at http://localhost:${PORT}`)
})