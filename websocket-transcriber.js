const Transcriber = require('./services/transcriber');
const { onFinalSentence } = require('./services/orchestrator');
const { cleanupClient } = require('./services/orchestrator');

const setupTranscriberHandlers = (socket, io, clientId) => {
  const transcriber = new Transcriber()
  const emit = (ev, p) => io.to(clientId).emit(ev, p)

  transcriber.on('transcriber-ready', () => emit('transcriber-ready', 'Ready'))
  transcriber.on('final', async ({ sentence, targetLang }) => {
    await onFinalSentence({ io, clientId, sentence, targetLang })
  })
  transcriber.on('error', (e) => emit('error', e))
  transcriber.on('close', (d) => emit('close', d))

  socket.on('incoming-audio', async (data) => {
    if (!transcriber.deepgramSocket) {
      await transcriber.startTranscriptionStream(
        data.sampleRate,
        data.inputLanguage
      )
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
}

module.exports = { setupTranscriberHandlers }

// const  Transcriber = require('./services/transcriber')
// const { onFinalSentence } = require('./services/orchestrator')

// const setupTranscriberHandlers = (socket, io, clientId) => {
//   const transcriber = new Transcriber()
//   const emit = (ev, p) => io.to(clientId).emit(ev, p)

//   transcriber.on('transcriber-ready', () => emit('transcriber-ready', 'Ready'))
//   transcriber.on('final', async ({ sentence, targetLang }) => {
//     await onFinalSentence({ io, clientId, sentence, targetLang })
//   })
//   transcriber.on('error', (e) => emit('error', e))
//   transcriber.on('close', (d) => emit('close', d))

//   socket.on('incoming-audio', async (data) => {
//     if (!transcriber.deepgramSocket) {
//       await transcriber.startTranscriptionStream(
//         data.sampleRate,
//         data.inputLanguage
//       )
//     }
//     transcriber.setTargetLanguage(data.targetLanguage)
//     transcriber.send(data.audioData)
//   })

//   socket.on('pause-deepgram', (flag) =>
//     transcriber.pauseTranscriptionStream(flag)
//   )
//   socket.on('disconnect-deepgram', () => transcriber.endTranscriptionStream())
// }

// module.exports = { setupTranscriberHandlers }
