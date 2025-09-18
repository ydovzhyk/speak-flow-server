const { Transcriber } = require('./helpers');

const setupTranscriberHandlers = (socket) => {
  const transcriber = new Transcriber();

  transcriber.on('transcriber-ready', () => {
    socket.emit('transcriber-ready', 'Ready')
  });

  transcriber.on('final', (transcript) => {
    socket.emit('final', transcript)
  });

  transcriber.on('final-transleted', (transletedResponse) => {
    socket.emit('final-transleted', transletedResponse)
  });

  transcriber.on('partial', (transcript) => {
    socket.emit('partial', transcript)
  });

  transcriber.on('error', (error) => {
    socket.emit('error', error)
  });

  transcriber.on('close', (data) => {
    socket.emit('close', data)
  });

  socket.on('incoming-audio', async (data) => {
    if (!transcriber.deepgramSocket) {
      await transcriber.startTranscriptionStream(
        data.sampleRate,
        data.inputLanguage
      )
      transcriber.send(data.audioData, data.targetLanguage)
    } else {
      transcriber.send(data.audioData, data.targetLanguage)
    }
  });

  socket.on('pause-deepgram', (data) => {
    transcriber.pauseTranscriptionStream(data)
  });

  socket.on('diconnect-deepgram', () => {
    transcriber.endTranscriptionStream()
  });
};

module.exports = { setupTranscriberHandlers };