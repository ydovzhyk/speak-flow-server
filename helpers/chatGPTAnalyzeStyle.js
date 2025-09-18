const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.GPT_API_KEY,
  organization: "org-xsUP3MkZS9wB7EwEuTQk6sY5",
  project: "proj_XMuEhtXksJuB4VYwyvWbX4KQ",
});

const chatGPTAnalyzeStyle = async (text) => {
  const style = await openai.chat.completions.create({
    messages: [
      { role: "system", content: "You are a text style analyst." },
      {
        role: "user",
        content: `Please analyze the following text and determine the appropriate style or context for translation: "${text}"`,
      },
    ],
    model: "gpt-4",
    temperature: 0.3,
  });

  return style.choices[0].message.content;
};

module.exports = chatGPTAnalyzeStyle;
