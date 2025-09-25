const bcrypt = require('bcrypt')
const { Types } = require('mongoose')
const { User } = require('../models/user')

async function ensureUserForClientId(clientId) {
  if (Types.ObjectId.isValid(clientId)) {
    const byId = await User.findById(clientId, { _id: 1 }).lean()
    if (byId) return byId._id
  }

  const byKey = await User.findOne({ clientKey: clientId }, { _id: 1 }).lean()
  if (byKey) return byKey._id

  const email = `${clientId}@guest.local`
  const passwordHash = await bcrypt.hash(`${clientId}:${Date.now()}`, 10)
  const username = `Guest-${String(clientId).slice(0, 6)}`

  const created = await User.create({
    email,
    passwordHash,
    username,
    userAvatar: '',
    clientKey: clientId,
    usage: {
      totalRecordMs: 0,
      lastSession: { startedAt: null, endedAt: null, durationMs: 0 },
    },
  })

  return created._id
}

module.exports = { ensureUserForClientId };
