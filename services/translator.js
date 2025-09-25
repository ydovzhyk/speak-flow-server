const OpenAI = require('openai')
const openai = new OpenAI({ apiKey: process.env.GPT_API_KEY })

const FAST_MODEL = 'gpt-4o-mini' // швидкий
const STYLE_MODEL = 'gpt-4o' // точніший для аналізу стилю

function styleSystem(lang) {
  return `You are a translation style profiler for ${lang}.
Return a short JSON with fields:
{
  "tone": "...",
  "formality": "...",
  "domainHints": "...",
  "glossary": ["..."] // optional fixed terms to keep consistent
}`
}

async function inferStyleProfile(sentences) {
  const text = sentences.join(' ')
  const r = await openai.chat.completions.create({
    model: STYLE_MODEL,
    temperature: 0.2,
    messages: [
      { role: 'system', content: styleSystem('any source language') },
      { role: 'user', content: `Text sample:\n${text}\nReturn JSON only.` },
    ],
  })
  try {
    return JSON.parse(r.choices[0].message.content)
  } catch {
    return { tone: 'neutral', formality: 'neutral' }
  }
}

function translateSystem(targetLang, styleProfile) {
  const base = `You are a precise translator into ${targetLang}.
- Preserve meaning, names, numbers, game/jargon terms.
- One-sentence input → one-sentence output.
- Do NOT add quotes or commentary.`
  if (!styleProfile) return base
  return `${base}
Follow style hints:
${JSON.stringify(styleProfile)}`
}

async function translateOne(sentence, targetLang, styleProfile) {
  const r = await openai.chat.completions.create({
    model: FAST_MODEL,
    temperature: 0.2,
    messages: [
      { role: 'system', content: translateSystem(targetLang, styleProfile) },
      { role: 'user', content: sentence },
    ],
  })
  let out = r.choices[0].message.content.trim()
  if (out.startsWith('"') && out.endsWith('"')) out = out.slice(1, -1)
  return out
}

module.exports = { translateOne, inferStyleProfile }
