const { setupTranscriberHandlers } = require('./websocket-transcriber')

const initializeWebSocket = (io) => {
  io.on('connection', (socket) => {
    const clientId =
      socket.handshake.auth?.clientId ||
      socket.handshake.query?.clientId ||
      socket.id

    socket.join(clientId)

    console.log(`🟢 WS connected: clientId=${clientId}, socket=${socket.id}`) // eslint-disable-line

    setupTranscriberHandlers(socket, io, clientId)

    socket.on('disconnect', () => {
      console.log( // eslint-disable-line
        `🔴 WS disconnected: clientId=${clientId}, socket=${socket.id}`
      )
    })
  })

  return io;
}

module.exports = initializeWebSocket;
