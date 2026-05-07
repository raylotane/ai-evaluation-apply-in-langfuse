import { generateText } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const { text } = await generateText({
  model: deepseek('deepseek-v4-flash'),
  prompt: 'hi, how are you?',
});

console.log(text);
