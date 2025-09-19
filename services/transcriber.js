const EventEmitter = require('events')
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk')
const buildSentence = require('../helpers/buildSentence')

class Transcriber extends EventEmitter {
  constructor() {
    super()
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY)
    this.deepgramSocket = null
    this.transcriberPause = false
    this.targetLanguage = null
    this.keepAliveInterval = null
    this.pauseAutoClose = null
    this._onOpen = null
    this._onTranscript = null
    this._onClose = null
  }

  setTargetLanguage(lang) {
    this.targetLanguage = lang
  }

  async startTranscriptionStream(sampleRate, inputLanguage) {
    if (this.deepgramSocket) return

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

    this._onOpen = () => this.emit('transcriber-ready', 'Ready')
    this._onTranscript = (data) => {
      if (!data.is_final) return
      const transcript = data.channel.alternatives[0]?.transcript || ''
      const sentence = buildSentence(transcript)
      if (sentence) {
        this.emit('final', { sentence, targetLang: this.targetLanguage })
      }
    }
    this._onClose = () => {
      this.emit('close', 'Deepgram connection is closed')
      this.deepgramSocket = null
    }

    dg.on(LiveTranscriptionEvents.Open, this._onOpen)
    dg.on(LiveTranscriptionEvents.Transcript, this._onTranscript)
    dg.on(LiveTranscriptionEvents.Close, this._onClose)

    this.deepgramSocket = dg
  }

  send(audioData) {
    try {
      this.deepgramSocket?.send(audioData)
    } catch (e) {
      this.emit('error', { message: e.message, stack: e.stack })
    }
  }

  _clearTimers() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = null
    }
    if (this.pauseAutoClose) {
      clearTimeout(this.pauseAutoClose)
      this.pauseAutoClose = null
    }
  }

  _detachDeepgramListeners() {
    if (!this.deepgramSocket) return
    const dg = this.deepgramSocket
    if (this._onOpen) dg.off?.(LiveTranscriptionEvents.Open, this._onOpen)
    if (this._onTranscript)
      dg.off?.(LiveTranscriptionEvents.Transcript, this._onTranscript)
    if (this._onClose) dg.off?.(LiveTranscriptionEvents.Close, this._onClose)
    this._onOpen = this._onTranscript = this._onClose = null
  }

  async pauseTranscriptionStream(flag) {
    this.transcriberPause = flag

    if (flag) {
      try {
        const last = buildSentence('.')
        if (last && last !== '.') {
          this.emit('final', {
            sentence: last,
            targetLang: this.targetLanguage,
          })
        }
      } catch (_) {}

      if (
        !this.keepAliveInterval &&
        this.deepgramSocket?.conn?.readyState === 1
      ) {
        this.keepAliveInterval = setInterval(() => {
          try {
            this.deepgramSocket.send(JSON.stringify({ type: 'KeepAlive' }))
          } catch (e) {
            this._clearTimers()
            this.emit('error', { message: e.message, stack: e.stack })
          }
        }, 5000)
      }

      if (!this.pauseAutoClose) {
        this.pauseAutoClose = setTimeout(() => {
          this.endTranscriptionStream().catch(() => {})
        }, 50_000)
      }
    } else {
      this._clearTimers()
    }
  }

  async endTranscriptionStream() {
    this.transcriberPause = false
    this._clearTimers()

    try {
      this._detachDeepgramListeners()
      await this.deepgramSocket?.conn?.close()
    } catch (e) {
      this.emit('error', { message: e.message, stack: e.stack })
    } finally {
      this.deepgramSocket = null
    }
  }

  async dispose() {
    await this.endTranscriptionStream()
    this.removeAllListeners()
  }
}

module.exports = Transcriber;

// const EventEmitter = require('events')
// const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk')
// const buildSentence = require('../helpers/buildSentence')

// class Transcriber extends EventEmitter {
//   constructor() {
//     super()
//     this.deepgram = createClient(process.env.DEEPGRAM_API_KEY)
//     this.deepgramSocket = null
//     this.maintainConnectionTimer = null
//     this.transcriberPause = false
//     this.targetLanguage = null
//   }

//   setTargetLanguage(lang) {
//     this.targetLanguage = lang
//   }

//   async startTranscriptionStream(sampleRate, inputLanguage) {
//     if (this.deepgramSocket) return
//     try {
//       const dg = this.deepgram.listen.live({
//         model: 'nova-2',
//         punctuate: true,
//         language: inputLanguage,
//         interim_results: true,
//         diarize: false,
//         smart_format: true,
//         endpointing: 1,
//         encoding: 'linear16',
//         sample_rate: sampleRate,
//       })

//       dg.on(LiveTranscriptionEvents.Open, () => {
//         this.emit('transcriber-ready', 'Ready')
//       })

//       dg.on(LiveTranscriptionEvents.Transcript, (data) => {
//         const isFinal = data.is_final
//         const transcript = data.channel.alternatives[0]?.transcript || ''
//         if (!isFinal || !transcript) return

//         // Подаємо текст у збирач речень
//         const sentence = buildSentence(transcript)
//         if (sentence) {
//           // Видаємо ТІЛЬКИ речення; переклад робить orchestrator
//           this.emit('final', { sentence, targetLang: this.targetLanguage })
//         }
//       })

//       dg.on(LiveTranscriptionEvents.Close, () => {
//         this.emit('close', 'Deepgram connection is closed')
//         this.deepgramSocket = null
//       })

//       this.deepgramSocket = dg
//     } catch (error) {
//       console.log('Deepgram start error', error) // eslint-disable-line
//       this.emit('error', { message: error.message, stack: error.stack })
//     }
//   }

//   send(audioData) {
//     try {
//       this.deepgramSocket?.send(audioData)
//     } catch (error) {
//       this.emit('error', { message: error.message, stack: error.stack })
//     }
//   }

//   resetMaintainConnectionTimer() {
//     if (this.maintainConnectionTimer) {
//       clearInterval(this.maintainConnectionTimer)
//       this.maintainConnectionTimer = null
//     }
//   }

//   async pauseTranscriptionStream(flag) {
//     this.transcriberPause = flag
//     if (
//       this.transcriberPause &&
//       this.deepgramSocket &&
//       this.deepgramSocket.conn &&
//       this.deepgramSocket.conn.readyState === 1
//     ) {
//       // keep-alive за потреби
//       this.maintainConnectionTimer = setInterval(() => {
//         const keepAliveMessage = JSON.stringify({ type: 'KeepAlive' })
//         try {
//           this.deepgramSocket.send(keepAliveMessage)
//         } catch (error) {
//           clearInterval(this.maintainConnectionTimer)
//           this.maintainConnectionTimer = null
//           this.emit('error', { message: error.message, stack: error.stack })
//         }
//       }, 5000)

//       // Форсуємо добір останнього речення (крапкою)
//       try {
//         const lastSentence = buildSentence('.')
//         if (lastSentence && lastSentence !== '.') {
//           this.emit('final', {
//             sentence: lastSentence,
//             targetLang: this.targetLanguage,
//           })
//         }
//       } catch (error) {
//         this.emit('error', { message: error.message, stack: error.stack })
//       }
//     } else {
//       this.resetMaintainConnectionTimer()
//     }
//   }

//   async endTranscriptionStream() {
//     this.transcriberPause = false
//     this.resetMaintainConnectionTimer()
//     try {
//       if (this.deepgramSocket?.conn) await this.deepgramSocket.conn.close()
//       this.deepgramSocket = null
//     } catch (error) {
//       this.emit('error', { message: error.message, stack: error.stack })
//     }
//   }
// }

// module.exports = Transcriber
