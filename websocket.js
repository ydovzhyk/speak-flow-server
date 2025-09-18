const { setupChatHandlers, setUsersMap } = require('./websocket-chat');
const { setupTranscriberHandlers } = require('./websocket-transcriber');

const users = new Map(); // socketId => userId
setUsersMap(users);
const watchers = new Map(); // userId => Set(socketIds)

const initializeWebSocket = (io) => {
  io.on('connection', async (socket) => {
    const userId = socket.handshake.query.userId
    users.set(socket.id, userId)
    // eslint-disable-next-line no-console
    console.log(`🟢 User connected: ${userId} (${socket.id})`)

    // 🔔 Якщо хтось вже спостерігає за цим userId — повідомляємо їх
    if (watchers.has(userId)) {
      watchers.get(userId).forEach((socketId) => {
        io.to(socketId).emit('user-online', userId)
      })
    }

    // 🔹 Обробка підписки на онлайн-статус
    socket.on('watch-user', ({ targetUserId }) => {
      if (!targetUserId) return
      if (!watchers.has(targetUserId)) {
        watchers.set(targetUserId, new Set())
      }
      watchers.get(targetUserId).add(socket.id)
      // eslint-disable-next-line no-console
      console.log(`👁️ ${userId} is watching ${targetUserId}`)

      // Якщо targetUserId вже онлайн — одразу повідомляємо
      if ([...users.values()].includes(targetUserId)) {
        socket.emit('user-online', targetUserId)
      }
    })

    // ------🔹 ПІДКЮЧЕННЯ ЧАТУ  ------
    setupChatHandlers(socket, io);
    // ------🔹 ЛОГІКА ТРАНСКРИПЦІЇ  ------
    setupTranscriberHandlers(socket);

    // 🔹 Обробка відписки
    socket.on('unwatch-user', ({ targetUserId }) => {
      if (!targetUserId || !watchers.has(targetUserId)) return
      watchers.get(targetUserId).delete(socket.id)
      if (watchers.get(targetUserId).size === 0) {
        watchers.delete(targetUserId)
      }
      // eslint-disable-next-line no-console
      console.log(`🚫 ${userId} stopped watching ${targetUserId}`)
    })

    // 🔹 Обробка відключення
    socket.on('disconnect', () => {
      const userId = users.get(socket.id)
      users.delete(socket.id)
      // eslint-disable-next-line no-console
      console.log(`🔴 User disconnected: ${socket.id} (userId: ${userId})`)

      // 🔔 Сповіщаємо всіх, хто слідкує за цим userId
      if (userId && watchers.has(userId)) {
        watchers.get(userId).forEach((socketId) => {
          io.to(socketId).emit('user-offline', userId)
        })
      }

      // ❗️ Додатково — очищаємо цей сокет з усіх watcher'ів
      for (const [watchedId, socketSet] of watchers.entries()) {
        socketSet.delete(socket.id)
        if (socketSet.size === 0) {
          watchers.delete(watchedId)
        }
      }
    })
  })

  return io;
}

module.exports = initializeWebSocket;
