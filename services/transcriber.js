const EventEmitter = require('events')
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk')
const buildSentence = require('../helpers/buildSentence')

class Transcriber extends EventEmitter {
  constructor() {
    super()
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY)
    this.deepgramSocket = null
    this.maintainConnectionTimer = null
    this.transcriberPause = false
    this.targetLanguage = null
  }

  setTargetLanguage(lang) {
    this.targetLanguage = lang
  }

  async startTranscriptionStream(sampleRate, inputLanguage) {
    if (this.deepgramSocket) return
    try {
      const dg = this.deepgram.listen.live({
        model: 'nova-2',
        punctuate: true,
        language: inputLanguage,
        interim_results: true,
        diarize: false,
        smart_format: true,
        endpointing: 1,
        encoding: 'linear16',
        sample_rate: sampleRate,
      })

      dg.on(LiveTranscriptionEvents.Open, () => {
        this.emit('transcriber-ready', 'Ready')
      })

      dg.on(LiveTranscriptionEvents.Transcript, (data) => {
        const isFinal = data.is_final
        const transcript = data.channel.alternatives[0]?.transcript || ''
        if (!isFinal || !transcript) return

        // Подаємо текст у збирач речень
        const sentence = buildSentence(transcript)
        if (sentence) {
          // Видаємо ТІЛЬКИ речення; переклад робить orchestrator
          this.emit('final', { sentence, targetLang: this.targetLanguage })
        }
      })

      dg.on(LiveTranscriptionEvents.Close, () => {
        this.emit('close', 'Deepgram connection is closed')
        this.deepgramSocket = null
      })

      this.deepgramSocket = dg
    } catch (error) {
      console.log('Deepgram start error', error) // eslint-disable-line
      this.emit('error', { message: error.message, stack: error.stack })
    }
  }

  send(audioData) {
    try {
      this.deepgramSocket?.send(audioData)
    } catch (error) {
      this.emit('error', { message: error.message, stack: error.stack })
    }
  }

  resetMaintainConnectionTimer() {
    if (this.maintainConnectionTimer) {
      clearInterval(this.maintainConnectionTimer)
      this.maintainConnectionTimer = null
    }
  }

  async pauseTranscriptionStream(flag) {
    this.transcriberPause = flag
    if (
      this.transcriberPause &&
      this.deepgramSocket &&
      this.deepgramSocket.conn &&
      this.deepgramSocket.conn.readyState === 1
    ) {
      // keep-alive за потреби
      this.maintainConnectionTimer = setInterval(() => {
        const keepAliveMessage = JSON.stringify({ type: 'KeepAlive' })
        try {
          this.deepgramSocket.send(keepAliveMessage)
        } catch (error) {
          clearInterval(this.maintainConnectionTimer)
          this.maintainConnectionTimer = null
          this.emit('error', { message: error.message, stack: error.stack })
        }
      }, 5000)

      // Форсуємо добір останнього речення (крапкою)
      try {
        const lastSentence = buildSentence('.')
        if (lastSentence && lastSentence !== '.') {
          this.emit('final', {
            sentence: lastSentence,
            targetLang: this.targetLanguage,
          })
        }
      } catch (error) {
        this.emit('error', { message: error.message, stack: error.stack })
      }
    } else {
      this.resetMaintainConnectionTimer()
    }
  }

  async endTranscriptionStream() {
    this.transcriberPause = false
    this.resetMaintainConnectionTimer()
    try {
      if (this.deepgramSocket?.conn) await this.deepgramSocket.conn.close()
      this.deepgramSocket = null
    } catch (error) {
      this.emit('error', { message: error.message, stack: error.stack })
    }
  }
}

module.exports = Transcriber
