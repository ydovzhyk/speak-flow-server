const EventEmitter = require("events");
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const translateWithGPT = require("./translateWithGPT");
const buildSentence = require("./buildSentence");

class Transcriber extends EventEmitter {
  constructor() {
    super();
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.deepgramSocket = null;
    this.inactivityTimeout = 3000;
    this.maintainConnectionTimer = null;
    this.transcriberPause = false;
    this.targetLanguage = null;
  }

  async startTranscriptionStream(rate, inputLanguage) {
    if (!this.deepgramSocket) {
      try {
        const dgConnection = this.deepgram.listen.live({
          model: "nova-2",
          punctuate: true,
          language: inputLanguage,
          interim_results: true,
          diarize: false,
          smart_format: true,
          endpointing: 1,
          encoding: "linear16",
          sample_rate: rate,
        });

        // Event listener for when the Deepgram connection is opened
        dgConnection.on(LiveTranscriptionEvents.Open, () => {
          this.emit("transcriber-ready");
          // this.startInactivityTimer();
        });

        // Event listener for receiving transcription data
        dgConnection.on(LiveTranscriptionEvents.Transcript, async (data) => {
          const isFinal = data.is_final;
          const transcript = data.channel.alternatives[0].transcript;

          if (isFinal) {
            this.resetMaintainConnectionTimer();
            this.processAndSendTranslation(transcript);
          }
        });

        // Event listener for when the Deepgram connection is closed
        dgConnection.on(LiveTranscriptionEvents.Close, () => {
          this.emit("close", "Deepgram connection is closed");
          this.deepgramSocket = null;
        });

        this.deepgramSocket = dgConnection;
      } catch (error) {
        console.log( // eslint-disable-line
          'Error occurred: Event listener for when the Deepgram connection is closed',
          error
        )
        this.emit('error', { message: error.message, stack: error.stack })
      }
    }
  }

  // Method to send audio data to Deepgram
  send(audioData, targetLanguage) {
    this.deepgramSocket.send(audioData);
    this.targetLanguage = targetLanguage;
  }

  // Method to send data for translate
  async processAndSendTranslation(transcript) {
    try {
      const newTranscript = await buildSentence(transcript);
      if (newTranscript) {
        this.emit("final", newTranscript);

        const transletedResponse = await translateWithGPT(
          newTranscript,
          this.targetLanguage
        );
        if (transletedResponse) {
          this.emit("final-transleted", transletedResponse);
        }
      }
    } catch (error) {
      console.log('Error occurred: Method to send data for translate', error) // eslint-disable-line
      this.emit('error', { message: error.message, stack: error.stack })
    }
  }

  // Method to reset maintainConnection timer
  resetMaintainConnectionTimer() {
    if (this.maintainConnectionTimer) {
      clearInterval(this.maintainConnectionTimer);
      this.maintainConnectionTimer = null;
    }
  }

  // Method to pause (keepAlive) the transcription stream
  async pauseTranscriptionStream(data) {
    this.transcriberPause = data;
    if (
      this.transcriberPause &&
      this.deepgramSocket &&
      this.deepgramSocket.conn &&
      this.deepgramSocket.conn.readyState === 1
    ) {
      // We keep in touch with deepgram
      this.maintainConnectionTimer = setInterval(() => {
        const keepAliveMessage = JSON.stringify({ type: "KeepAlive" });
        try {
          this.deepgramSocket.send(keepAliveMessage);
        } catch (error) {
          clearInterval(this.maintainConnectionTimer);
          this.maintainConnectionTimer = null;
          console.log( // eslint-disable-line
            "Error occurred: Method to pause (keepAlive) the transcription stream",
            error
          );
          this.emit("error", { message: error.message, stack: error.stack });
        }
      }, 5000);
      // We try to get the last sentence from the buffer and return its translation.
      try {
        const lastTranscript = await buildSentence(".");
        if (lastTranscript !== ".") {
          this.emit("final", lastTranscript);

          const transletedResponse = await translateWithGPT(
            lastTranscript,
            this.targetLanguage,
            false
          );
          if (transletedResponse) {
            this.emit("final-transleted", transletedResponse);
          }
          // We clear the data for the new text.
          const clearText = "";
          translateWithGPT(clearText, this.targetLanguage, false);
        }
      } catch (error) {
        console.log( // eslint-disable-line
          "Error occurred: Method to get sentences from bufer buildSentences",
          error
        );
        this.emit("error", { message: error.message, stack: error.stack });
      }
    }
  }

  // Method to end the transcription stream
  async endTranscriptionStream() {
    if (this.transcriberPause) {
      this.transcriberPause = false;
    }
    try {
      await this.deepgramSocket.conn.close();
    } catch (error) {
      console.log( // eslint-disable-line
        "Error occurred: Method to end the transcription stream",
        error
      );
      this.emit("error", { message: error.message, stack: error.stack });
    }
  }
}

module.exports = Transcriber;
