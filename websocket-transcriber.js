const { Transcriber } = require('./helpers')

const setupTranscriberHandlers = (socket, io, clientId) => {
  const transcriber = new Transcriber()

  const emit = (event, payload) => {
    if (clientId) io.to(clientId).emit(event, payload)
    else socket.emit(event, payload)
  }

  transcriber.on('transcriber-ready', () => emit('transcriber-ready', 'Ready'))
  transcriber.on('final', (t) => emit('final', t))
  transcriber.on('final-transleted', (t) => emit('final-transleted', t))
  transcriber.on('partial', (t) => emit('partial', t))
  transcriber.on('error', (e) => emit('error', e))
  transcriber.on('close', (d) => emit('close', d))

  socket.on('incoming-audio', async (data) => {
    if (!transcriber.deepgramSocket) {
      await transcriber.startTranscriptionStream(
        data.sampleRate,
        data.inputLanguage
      )
    }
    transcriber.send(data.audioData, data.targetLanguage)
  })

  socket.on('pause-deepgram', (flag) => {
    transcriber.pauseTranscriptionStream(flag)
  })

  socket.on('disconnect-deepgram', () => {
    transcriber.endTranscriptionStream()
  })
}

module.exports = { setupTranscriberHandlers }
