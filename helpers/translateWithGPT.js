const OpenAI = require("openai");
const chatGPTAnalyzeStyle = require("./chatGPTAnalyzeStyle");

const openai = new OpenAI({
  apiKey: process.env.GPT_API_KEY,
  organization: "org-xsUP3MkZS9wB7EwEuTQk6sY5",
  project: "proj_XMuEhtXksJuB4VYwyvWbX4KQ",
});

let currentModel = "gpt-4o-mini";
let contextBuffer = [];
let queue = [];
let isProcessing = false;
let intervalId = null;
let newSentencesCount = 0;
let textStyleArray = [];
let textStyle = null;
let numberOfIterations = 0;
let translationPrompt = 0;

const processQueue = async (targetLanguage, resolve, reject) => {
  if (isProcessing && queue.length < 3) {
    return;
  }

  isProcessing = true;
  const sentencesToTranslate = queue.splice(0, queue.length);
  newSentencesCount = sentencesToTranslate.length;

  contextBuffer = [...contextBuffer, ...sentencesToTranslate];

  if (contextBuffer.length > 7) {
    contextBuffer = contextBuffer.slice(-7);
  }

  try {
    const result = await translateWithGPTInternal(
      contextBuffer.join(" "),
      targetLanguage
    );
    resolve(result);
  } catch (error) {
    if (error.code === "rate_limit_exceeded") {
      const retryAfter = parseInt(error.headers["retry-after-ms"]) || 20000;

      if (currentModel === "gpt-4o-mini") {
        currentModel = "gpt-4o";
      }
      setTimeout(() => {
        processQueue(targetLanguage, resolve, reject);
      }, retryAfter);
    } else {
      console.log('Error translating with GPT:', error) // eslint-disable-line
      reject(error)
    }
  }
  isProcessing = false;
};

const translateWithGPTInternal = async (text, targetLanguage) => {
  numberOfIterations++;

  if (numberOfIterations === 1) {
    translationPrompt = `Remember the technical instructions for our session: 1) Always translate the provided text to the specified language. 2) Ensure that all details are preserved, and avoid omitting or altering any part of the original meaning. 3) Continue to follow these instructions throughout the entire session, additional instructions will be provide time by time in content. Translate the text: "${text}"`;
  } else if (numberOfIterations === 5) {
    const determineStyle = async (text) => {
      const styleContext = await chatGPTAnalyzeStyle(text);
      return styleContext;
    };
    textStyle = await determineStyle(
      textStyleArray.splice(0, textStyleArray.length).join(" ")
    );

    translationPrompt = `Update instructions for our session: 1) Always translate the provided text to the specified language. 2) Ensure that all details are preserved, and avoid omitting or altering any part of the original meaning. 3) Continue to follow these instructions throughout the entire session, additional instructions will be provide time by time in content. 4) ${textStyle}. Translate the text: "${text}"`;
    textStyle = null;
    textStyleArray = [];
  } else {
    translationPrompt = `Translate the text: "${text}"`;
  }

  const stream = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that translates text to ${targetLanguage}.`,
      },
      {
        role: "user",
        content: translationPrompt,
      },
    ],
    model: currentModel,
    temperature: 0.3,
    stream: true,
  });

  let translatedText = "";

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    translatedText += content;
  }
  translatedText = translatedText.trim();

  if (translatedText.startsWith('"') && translatedText.endsWith('"')) {
    translatedText = translatedText.slice(1, -1);
  }

  const translatedSentences = translatedText.split(/(?<=[.?!])\s+/);

  const sentencesOut = translatedSentences.slice(-newSentencesCount).join(" ");

  return sentencesOut;
};

const translateWithGPT = (text, targetLanguage, inProgress = true) => {
  if (text === "" && !inProgress) {
    contextBuffer = [];
    queue = [];
    isProcessing = false;
    clearInterval(intervalId);
    intervalId = null;
    newSentencesCount = 0;
    textStyleArray = [];
    textStyle = null;
    numberOfIterations = 0;
    translationPrompt = 0;
    return;
  }

  return new Promise((resolve, reject) => {
    queue.push(text);
    textStyleArray.push(text);

    if (!intervalId) {
      intervalId = setInterval(() => {
        processQueue(targetLanguage, resolve, reject);
      }, 20000);
    } else if (!isProcessing) {
      processQueue(targetLanguage, resolve, reject);
    }
  });
};

module.exports = translateWithGPT;
