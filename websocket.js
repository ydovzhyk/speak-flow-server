const { setupTranscriberHandlers } = require('./websocket-transcriber');
const { cleanupClient } = require('./services/orchestrator');
const { User } = require('./models/user')

const initializeWebSocket = (io) => {
  io.on('connection', async (socket) => {
    const clientId =
      socket.handshake.auth?.clientId ||
      socket.handshake.query?.clientId ||
      socket.id

    socket.join(clientId)

    console.log(`🟢 WS connected: clientId=${clientId}, socket=${socket.id}`)

    setupTranscriberHandlers(socket, io, clientId)

    // We are sending usage immediately after connection
    try {
      const { Types } = require('mongoose')
      let doc = null

      if (Types.ObjectId.isValid(clientId)) {
        doc = await User.findById(clientId, { usage: 1 }).lean()
      }
      if (!doc) {
        doc = await User.findOne({ clientKey: clientId }, { usage: 1 }).lean()
      }

      if (doc?.usage) {
        io.to(clientId).emit('usage:current', {
          totalMs: Number(doc.usage.totalRecordMs || 0),
          lastSession: {
            startedAt: doc.usage.lastSession?.startedAt || null,
            endedAt: doc.usage.lastSession?.endedAt || null,
            seconds: Math.floor(
              (doc.usage.lastSession?.durationMs || 0) / 1000
            ),
          },
        })
      } else {
        io.to(clientId).emit('usage:current', {
          totalMs: 0,
          lastSession: { startedAt: null, endedAt: null, seconds: 0 },
        })
      }
    } catch (e) {
      /* no-op */
    }

    socket.on('disconnect', () => {
      cleanupClient(clientId)
      console.log(
        `🔴 WS disconnected: clientId=${clientId}, socket=${socket.id}`
      )
    })
  })

  return io;
}

module.exports = initializeWebSocket;
