const mongoose = require('mongoose')
const http = require('http')
const { Server } = require('socket.io')
const app = require('./app')
const initializeWebSocket = require('./websocket.js')

mongoose.set('strictQuery', false)
require('dotenv').config()

const { DB_HOST, PORT = 4000 } = process.env

mongoose
  .connect(DB_HOST)
  .then(() => {
    console.log('Database connection successful') // eslint-disable-line

    const server = http.createServer(app)

    const io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    })

    initializeWebSocket(io)

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on port ${PORT}`) // eslint-disable-line
    })
  })
  .catch((error) => {
    console.log(error.message) // eslint-disable-line
    process.exit(1)
  })
