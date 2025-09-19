const { translateOne, inferStyleProfile } = require('./translator')

const STATE = new Map()
// state shape per clientId: { recentSentences, styleProfile, lastStyleAt, chain, lastSeen, prevTargetLang }

function getState(clientId) {
  if (!STATE.has(clientId)) {
    STATE.set(clientId, {
      recentSentences: [],
      styleProfile: null,
      lastStyleAt: 0,
      chain: Promise.resolve(),
      lastSeen: Date.now(),
      prevTargetLang: null,
    })
  }
  return STATE.get(clientId)
}

function cleanupClient(clientId) {
  STATE.delete(clientId)
}

function resetStyle(clientId) {
  const s = getState(clientId)
  s.styleProfile = null
  s.recentSentences = []
  s.prevTargetLang = null
}

async function withTimeout(promise, ms = 15000) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('translate timeout')), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function onFinalSentence({ io, clientId, sentence, targetLang }) {
  const s = getState(clientId)
  s.lastSeen = Date.now()

  if (s.prevTargetLang && s.prevTargetLang !== targetLang) {
    s.styleProfile = null
    s.recentSentences = []
  }
  s.prevTargetLang = targetLang

  s.chain = s.chain
    .then(async () => {
      let translated = null
      try {
        translated = await withTimeout(
          translateOne(sentence, targetLang, s.styleProfile),
          15000
        )
      } catch (e) {
        io.to(clientId).emit('error', {
          message: 'translate failed',
          detail: e?.message || String(e),
        })
      }

      io.to(clientId).emit('final', sentence)
      if (translated !== null && translated !== undefined) {
        io.to(clientId).emit('final-transleted', translated)
      }

      s.recentSentences.push(sentence)
      if (s.recentSentences.length > 12) {
        s.recentSentences = s.recentSentences.slice(-12)
      }

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
    .catch(() => {
      /* no-op */
    })
}

const TTL_MS = 5 * 60_000
if (!global.__SF_ORCH_TTL_SET__) {
  global.__SF_ORCH_TTL_SET__ = true
  setInterval(() => {
    const now = Date.now()
    for (const [clientId, s] of STATE) {
      if (now - s.lastSeen > TTL_MS) STATE.delete(clientId)
    }
  }, 60_000)
}

module.exports = { onFinalSentence, cleanupClient, resetStyle }

// const { translateOne, inferStyleProfile } = require('./translator')

// const STATE = new Map()
// // state: { recentSentences, styleProfile, lastStyleAt, chain }

// function getState(clientId) {
//   if (!STATE.has(clientId)) {
//     STATE.set(clientId, {
//       recentSentences: [],
//       styleProfile: null,
//       lastStyleAt: 0,
//       chain: Promise.resolve(), // послідовність для цього клієнта
//     })
//   }
//   return STATE.get(clientId)
// }

// async function onFinalSentence({ io, clientId, sentence, targetLang }) {
//   const s = getState(clientId)

//   // Додаємо ЗАДАЧУ в ланцюг: перекласти → емітити дві події ПІДРЯД
//   s.chain = s.chain
//     .then(async () => {
//       const translated = await translateOne(
//         sentence,
//         targetLang,
//         s.styleProfile
//       )

//       io.to(clientId).emit('final', sentence)
//       io.to(clientId).emit('final-transleted', translated)

//       // оновлюємо контекст для стилю
//       s.recentSentences.push(sentence)
//       if (s.recentSentences.length > 12)
//         s.recentSentences = s.recentSentences.slice(-12)

//       const NEED_STYLE =
//         (!s.styleProfile && s.recentSentences.length >= 5) ||
//         (Date.now() - s.lastStyleAt > 60_000 && s.recentSentences.length >= 6)

//       if (NEED_STYLE) {
//         inferStyleProfile(s.recentSentences.slice(-10))
//           .then((profile) => {
//             s.styleProfile = profile
//             s.lastStyleAt = Date.now()
//           })
//           .catch(() => {})
//       }
//     })
//     .catch((e) => {
//       io.to(clientId).emit('error', {
//         message: 'translate failed',
//         detail: e?.message,
//       })
//     })
// }

// module.exports = { onFinalSentence }
