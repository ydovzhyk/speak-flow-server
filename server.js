const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const initializeWebSocket = require("./websocket.js");

mongoose.set("strictQuery", false);
require("dotenv").config();

const { DB_HOST, PORT = 4000 } = process.env;

// Підключення до MongoDB
mongoose
  .connect(DB_HOST)
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Database connection successful')

    // Створення HTTP-сервера
    const server = http.createServer(app)

    // Ініціалізація WebSocket-сервера
    const io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    })

    // Ініціалізація WebSocket функціоналу
    initializeWebSocket(io)

    // Запуск сервера
    server.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server listening at http://localhost:${PORT}`)
    })
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.log(error.message)
    process.exit(1)
  });
