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
    console.log('Database connection successful')

    const server = http.createServer(app)

    const io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    })

    initializeWebSocket(io)

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on port ${PORT}`)
    })
  })
  .catch((error) => {
    console.log(error.message)
    process.exit(1)
  })
