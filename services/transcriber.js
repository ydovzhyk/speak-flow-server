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

    // таймери з'єднання
    this.keepAliveInterval = null
    this.pauseAutoClose = null

    // посилання на DG-слухачі (щоб коректно відв'язувати)
    this._onOpen = null
    this._onTranscript = null
    this._onClose = null

    // ---- usage tracking ----
    // перший старт сесії (для startedAt)
    this._sessionStartMs = null
    this._sessionStartedAt = null
    this._usageFinalized = false

    // акумуляція ТІЛЬКИ активного часу (без пауз)
    this._accumulatedMs = 0 // сумарний активний час по завершених сегментах
    this._segmentStartMs = null // старт поточного активного сегмента (null, якщо пауза)

    // періодичний прогрес (раз/сек) під час активного інтервалу
    this._progressInterval = null
  }

  // ------ util: прогресний тік ------
  _clearProgress() {
    if (this._progressInterval) {
      clearInterval(this._progressInterval)
      this._progressInterval = null
    }
  }

  _armProgress() {
    if (this._progressInterval) return
    this._progressInterval = setInterval(() => {
      if (this._usageFinalized) return
      // немає активного сегмента і ще нічого не накопичено — нічого емитити
      if (!this._segmentStartMs && this._accumulatedMs === 0) return
      this.emit('usage-progress', {
        startedAt: this._sessionStartedAt,
        seconds: this._getActiveSeconds(),
      })
    }, 1000)
  }

  setTargetLanguage(lang) {
    this.targetLanguage = lang
  }

  // ------ підрахунок активного часу ------
  _getActiveMs() {
    const live = this._segmentStartMs ? Date.now() - this._segmentStartMs : 0
    return Math.max(0, this._accumulatedMs + live)
  }

  _getActiveSeconds() {
    return Math.max(0, Math.round(this._getActiveMs() / 1000))
  }

  // ===== usage helpers =====
  _startUsage() {
    // перший запуск (не плутати з resume після паузи)
    const now = Date.now()
    this._sessionStartMs = now
    this._sessionStartedAt = new Date(now).toISOString()
    this._usageFinalized = false

    // нова сесія: обнуляємо акумуляцію і відкриваємо активний сегмент
    this._accumulatedMs = 0
    this._segmentStartMs = now

    this._clearProgress()
    this._armProgress()

    this.emit('usage-started', { startedAt: this._sessionStartedAt })
  }

  _finalizeUsage(reason = 'end') {
    if (this._usageFinalized) return
    if (!this._sessionStartMs) return

    // рахуємо тільки активний час
    const seconds = this._getActiveSeconds()
    const endedAtIso = new Date().toISOString()

    this.emit('usage-final', {
      seconds,
      startedAt: this._sessionStartedAt,
      endedAt: endedAtIso,
      reason,
    })

    // mark done + reset
    this._usageFinalized = true
    this._sessionStartMs = null
    this._sessionStartedAt = null
    this._accumulatedMs = 0
    this._segmentStartMs = null

    this._clearProgress()
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

    this._onOpen = () => {
      this._startUsage()
      this.emit('transcriber-ready', 'Ready')
    }

    this._onTranscript = (data) => {
      if (!data.is_final) return
      const transcript = data.channel.alternatives[0]?.transcript || ''
      const sentence = buildSentence(transcript)
      if (sentence) {
        this.emit('final', { sentence, targetLang: this.targetLanguage })
      }
    }

    this._onClose = () => {
      // Deepgram сам закрив конект (наприклад, довго не було аудіо)
      this._finalizeUsage('dg-close')
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
      // ---- PAUSE ----
      // добиваємо активний сегмент у акумульований час
      if (this._segmentStartMs) {
        this._accumulatedMs += Date.now() - this._segmentStartMs
        this._segmentStartMs = null
      }
      // прогрес-тік зупиняємо (на паузі секунди не тікають)
      this._clearProgress()

      // keepAlive + авто-закриття при довгій паузі
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
      // ---- RESUME ----
      this._clearTimers()
      if (!this._usageFinalized) {
        this._segmentStartMs = Date.now() // відкриваємо новий активний відрізок
        this._armProgress() // знову тікає прогрес
      }
    }
  }

  async endTranscriptionStream() {
    this.transcriberPause = false
    this._clearTimers()

    try {
      this._finalizeUsage('end') // підсумки + зупинка прогресу
      this._detachDeepgramListeners()
      await this.deepgramSocket?.conn?.close()
    } catch (e) {
      this.emit('error', { message: e.message, stack: e.stack })
    } finally {
      this.deepgramSocket = null
      this._clearProgress()
    }
  }

  async dispose() {
    await this.endTranscriptionStream()
    this.removeAllListeners()
  }
}

module.exports = Transcriber