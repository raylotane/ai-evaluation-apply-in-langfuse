import { generateText } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import inquirer from 'inquirer';
import { tracerProvider } from "./instrumentation"

if (!process.env.DEEPSEEK_API_KEY) {
  console.error('❌ 缺少 DEEPSEEK_API_KEY 环境变量');
  process.exit(1);
}

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// 历史消息
const history: { role: 'user' | 'assistant'; content: string }[] = [];

// Generate a session ID to group all turns of this conversation in Langfuse
const sessionId = crypto.randomUUID();

async function chat() {
  const { prompt } = await inquirer.prompt([
    {
      type: 'input',
      name: 'prompt',
      message: '💬 你：',
      validate: (input: string) => input.trim().length > 0 || '输入不能为空！',
    },
  ]);

  if (prompt.toLowerCase() === 'q' || prompt.toLowerCase() === 'quit' || prompt.toLowerCase() === 'exit') {
    console.log('\n👋 再见！');
    tracerProvider.shutdown()
    process.exit(0);
  }

  // 添加用户消息
  history.push({ role: 'user', content: prompt });

  console.log('\n⏳ 思考中...\n');

  const { text } = await generateText({
    model: deepseek('deepseek-v4-flash'),
    messages: history,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'chat-response',
      metadata: {
        sessionId,
      },
    },
  });

  // 添加 AI 响应
  history.push({ role: 'assistant', content: text });

  console.log('🤖 AI：', text, '\n');

  chat();
}

console.log("Session ID:" + sessionId)
console.log('🎯 AI 对话助手 (输入 q 退出)\n');
chat();
