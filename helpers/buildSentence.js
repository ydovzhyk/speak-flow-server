let buffer = [];

const formatText = (text) => {
  text = text.replace(/\s{2,}/g, " ");
  text = text.replace(/,([^\s])/g, ", $1");

  return text
    .split(/(?<=[.!?])\s+/)
    .map(
      (sentence) =>
        sentence.charAt(0).toUpperCase() + sentence.slice(1).toLowerCase()
    )
    .join(" ");
};

const buildSentence = (transcript) => {
  // Перевірка, чи переданий transcript є дійсною строкою
  if (typeof transcript !== "string" || transcript.length === 0) {
    return null;
  }

  // Перевірка, чи потрібно додати пробіл перед додаванням нового тексту
  if (
    buffer.length > 0 &&
    !buffer[buffer.length - 1].match(/\s/) &&
    !transcript[0].match(/\s/)
  ) {
    buffer.push(" ");
  }

  // Процес додавання символів до буферу та перевірка на завершення речення
  for (const char of transcript) {
    buffer.push(char);
    if ([".", "!", "?"].includes(char)) {
      const result = formatText(buffer.join("").trim());
      buffer = [];
      return result;
    }
  }

  // Особливий випадок, коли передається крапка, щоб завершити речення
  if (transcript === ".") {
    const result = formatText(buffer.join("").trim());
    buffer = [];
    return result;
  }

  return null; // Якщо жодне речення не завершене, повернення null
};

module.exports = buildSentence;
