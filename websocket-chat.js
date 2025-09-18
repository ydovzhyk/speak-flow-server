const { Chat } = require('./models/chat')
const { MessageWS } = require('./models/messageWS')
const { User } = require('./models/user')
const { Apartment } = require('./models/apartment')
// const mongoose = require("mongoose");

let users
const setUsersMap = (map) => {
  users = map
}

// 🔹 Функція для оновлення нових повідомлень користувача
const updateUserNewMessages = async (userId) => {
  try {
    const allChats = await Chat.find({ users: userId })
    const newMessageIds = []
    allChats.forEach((chat) => {
      const userIndex = chat.users.indexOf(userId)
      if (userIndex === 0) {
        newMessageIds.push(...chat.newMessagesUserOne)
      } else if (userIndex === 1) {
        newMessageIds.push(...chat.newMessagesUserTwo)
      }
    })

    await User.findByIdAndUpdate(userId, {
      newMessages: newMessageIds,
    })
  } catch (err) {
    throw new Error(err)
  }
}

const setupChatHandlers = (socket, io) => {
  // ------🔹 ЛОГІКА ЧАТУ  ------
  socket.on(
    'create-chat',
    async ({ userId, ownerId, apartmentId }, callback) => {
      try {
        let chat = await Chat.findOne({
          users: { $all: [userId, ownerId] },
          propertyId: apartmentId,
        })

        if (!chat) {
          const apartment = await Apartment.findById(apartmentId)

          if (!apartment) {
            return callback(new Error('Apartment not found'), null)
          }

          chat = new Chat({
            users: [userId, ownerId],
            propertyId: apartmentId,
            propertyPhoto: apartment.mainImage || '',
            propertyTitle: apartment.title || '',
          })

          await chat.save()
        }
        // eslint-disable-next-line no-console
        console.log(`🆕 Chat created (or found): ${chat._id}`)

        callback(null, { chatId: chat._id.toString() })
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error creating chat:', error)
        callback(error, null)
      }
    }
  )

  // 🔹 Перевіряємо чи є чат
  socket.on(
    'check-chat',
    async ({ userId, ownerId, apartmentId }, callback) => {
      try {
        const chat = await Chat.findOne({
          users: { $all: [userId, ownerId] },
          propertyId: apartmentId,
        })
        if (!chat) {
          callback(null, null)
        } else {
          // eslint-disable-next-line no-console
          console.log(`Chat found): ${chat._id}`)
          callback(null, { chatId: chat._id.toString() })
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error creating chat:', error)
        callback(error, null)
      }
    }
  )

  // 🔹 Збираємо всю переписку
  socket.on('conversation', async ({ chatId }, callback) => {
    try {
      const chat = await Chat.findById(chatId)
      if (!chat) {
        callback(null, null)
      }
      // Отримуємо всі повідомлення цього чату, сортуємо за датою створення
      const messages = await MessageWS.find({ chatId }).sort({ createdAt: 1 })
      // Додаємо користувача в кімнату WebSocket
      socket.join(chatId)
      // Повертаємо історію чату та сам чат
      callback(null, { messages, chat })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching chat messages:', error)
      callback(error, null)
    }
  })

  // 🔹 Відправка повідомлення
  socket.on('message', async ({ chatId, senderId, text }, callback) => {
    try {
      const sender = await User.findById(senderId)
      if (!sender) {
        throw new Error(`Chat not found: ${chatId}`)
      }
      const chat = await Chat.findById(chatId)
      if (!chat) {
        throw new Error(`Chat not found: ${chatId}`)
      }
      const message = new MessageWS({
        chatId,
        senderId,
        text,
        senderAvatar: sender.userAvatar,
        senderName: sender.username,
      })
      await message.save()
      const senderIndex = chat.users.indexOf(senderId)
      const updateField =
        senderIndex === 0
          ? { $push: { newMessagesUserTwo: message._id } }
          : { $push: { newMessagesUserOne: message._id } }

      await Chat.findByIdAndUpdate(chatId, {
        ...updateField,
        lastMessage: text,
        lastMessageAt: Date.now(),
      })

      await updateUserNewMessages(chat.users[1 - senderIndex])

      // 🔔 Сповіщаємо користувача, що йому надійшло нове повідомлення, треба оновити користувача
      const recipientId = chat.users[1 - senderIndex]
      for (const [socketId, id] of users.entries()) {
        if (id === recipientId) {
          io.to(socketId).emit('user-new-message')
        }
      }

      io.to(chatId).emit('message', { senderId, text, createdAt: new Date() })
      callback(null, { info: 'Message sent' })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Error sending message:', error)
      callback(error, null)
    }
  });

  // 🔹 Отримуємо аватар власника помешкання
  socket.on('owner-avatar', async ({ ownerId }, callback) => {
    try {
      const owner = await User.findById(ownerId)
      if (!owner) {
        callback(null, null)
      } else {
        callback(null, {
          info: { avatar: owner.userAvatar, name: owner.username },
        })
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error creating chat:', error)
      callback(error, null)
    }
  })

  // 🔹 Видаляємо нові повідомлення для користувача
  socket.on(
    'clear-new-messages',
    async ({ chatId, field, userId }, callback) => {
      if (!chatId || !field || !userId) return
      try {
        const chat = await Chat.findById(chatId)
        if (!chat) throw new Error(`Chat not found: ${chatId}`)

        const clearedIds =
          field === 'newMessagesUserOne'
            ? [...chat.newMessagesUserOne]
            : [...chat.newMessagesUserTwo]

        await Chat.findByIdAndUpdate(chatId, {
          [field]: [],
        })

        await User.findByIdAndUpdate(userId, {
          $pull: { newMessages: { $in: clearedIds } },
        })

        // 🔔 Повідомляємо клієнт що повідомлення видалено, необхідно оновити користувача
        for (const [socketId, id] of users.entries()) {
          if (id === userId) {
            io.to(socketId).emit('user-new-message')
          }
        }

        callback(null, { message: 'Success' })
        // eslint-disable-next-line no-console
        console.log(`🧹 Cleared ${field} for chat ${chatId}`)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error clearing new messages:', error)
      }
    }
  )
}

module.exports = { setupChatHandlers, setUsersMap }
