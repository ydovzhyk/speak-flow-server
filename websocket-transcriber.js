const Transcriber = require('./services/transcriber')
const { onFinalSentence } = require('./services/orchestrator')
const { cleanupClient } = require('./services/orchestrator')
const { ensureUserForClientId } = require('./helpers/ensureUserForClientId')
const { User } = require('./models/user')

const setupTranscriberHandlers = (socket, io, clientId) => {
  const transcriber = new Transcriber()
  const emit = (ev, p) => io.to(clientId).emit(ev, p)

  let baseTotalMs = null
  const readBaseTotal = async () => {
    if (baseTotalMs !== null) return baseTotalMs
    const { Types } = require('mongoose')
    let doc = null
    if (Types.ObjectId.isValid(clientId)) {
      doc = await User.findById(clientId, { 'usage.totalRecordMs': 1 }).lean()
    }
    if (!doc) {
      doc = await User.findOne(
        { clientKey: clientId },
        { 'usage.totalRecordMs': 1 }
      ).lean()
    }
    baseTotalMs = Number(doc?.usage?.totalRecordMs || 0)
    return baseTotalMs
  }

  transcriber.on('transcriber-ready', () => emit('transcriber-ready', 'Ready'))
  transcriber.on('final', async ({ sentence, targetLang }) => {
    await onFinalSentence({ io, clientId, sentence, targetLang })
  })
  transcriber.on('error', (e) => emit('error', e))
  transcriber.on('close', (d) => emit('close', d))

  transcriber.on('usage-progress', async (payload) => {
    const base = await readBaseTotal().catch(() => 0)
    emit('usage:progress', {
      ...payload,
      liveTotalMs: base + payload.seconds * 1000,
    })
  })

  socket.on('incoming-audio', async (data) => {
    if (!transcriber.deepgramSocket) {
      await transcriber.startTranscriptionStream(
        data.sampleRate,
        data.inputLanguage
      )
      readBaseTotal().catch(() => {})
    }
    transcriber.setTargetLanguage(data.targetLanguage)
    transcriber.send(data.audioData)
  })

  socket.on('pause-deepgram', (flag) =>
    transcriber.pauseTranscriptionStream(flag)
  )
  socket.on('disconnect-deepgram', () => transcriber.endTranscriptionStream())

  socket.on('disconnect', async () => {
    await transcriber.dispose()
    cleanupClient(clientId)
  })

  transcriber.on('usage-final', async (payload) => {
    try {
      const userObjectId = await ensureUserForClientId(clientId)
      const ms = Math.max(0, Number(payload.seconds || 0) * 1000)

      const updated = await User.findByIdAndUpdate(
        userObjectId,
        {
          $inc: { 'usage.totalRecordMs': ms },
          $set: {
            'usage.lastSession.startedAt': payload.startedAt,
            'usage.lastSession.endedAt': payload.endedAt,
            'usage.lastSession.durationMs': ms,
          },
        },
        { new: true, projection: { 'usage.totalRecordMs': 1 } }
      ).lean()

      baseTotalMs = Number(
        updated?.usage?.totalRecordMs ?? (baseTotalMs || 0) + ms
      )

      emit('usage:final', {
        seconds: payload.seconds,
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        totalMs: baseTotalMs,
      })
    } catch (e) {
      emit('error', { message: 'usage update failed', detail: e?.message })
    }
  })
}

module.exports = { setupTranscriberHandlers }