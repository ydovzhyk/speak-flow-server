const { translateOne, inferStyleProfile } = require('./translator')

const STATE = new Map()
// state: { recentSentences, styleProfile, lastStyleAt, chain }

function getState(clientId) {
  if (!STATE.has(clientId)) {
    STATE.set(clientId, {
      recentSentences: [],
      styleProfile: null,
      lastStyleAt: 0,
      chain: Promise.resolve(), // послідовність для цього клієнта
    })
  }
  return STATE.get(clientId)
}

async function onFinalSentence({ io, clientId, sentence, targetLang }) {
  const s = getState(clientId)

  // Додаємо ЗАДАЧУ в ланцюг: перекласти → емітити дві події ПІДРЯД
  s.chain = s.chain
    .then(async () => {
      const translated = await translateOne(
        sentence,
        targetLang,
        s.styleProfile
      )

      io.to(clientId).emit('final', sentence)
      io.to(clientId).emit('final-transleted', translated)

      // оновлюємо контекст для стилю
      s.recentSentences.push(sentence)
      if (s.recentSentences.length > 12)
        s.recentSentences = s.recentSentences.slice(-12)

      const NEED_STYLE =
        (!s.styleProfile && s.recentSentences.length >= 5) ||
        (Date.now() - s.lastStyleAt > 60_000 && s.recentSentences.length >= 6)

      if (NEED_STYLE) {
        inferStyleProfile(s.recentSentences.slice(-10))
          .then((profile) => {
            s.styleProfile = profile
            s.lastStyleAt = Date.now()
          })
          .catch(() => {})
      }
    })
    .catch((e) => {
      io.to(clientId).emit('error', {
        message: 'translate failed',
        detail: e?.message,
      })
    })
}

module.exports = { onFinalSentence }
