import { generateText } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import inquirer from 'inquirer';
import { tracerProvider } from "./instrumentation"
import { customerServicePrompt } from './setUpLangfuseClient'
import { buildSearchContext } from './rag/search';
import { collectUserFeedback, runAiJudge } from './scoring';

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
  const messageId = crypto.randomUUID();

  // 检索相关知识
  const context = buildSearchContext(prompt, sessionId);

  // 构建带上下文的用户消息
  const userContent = context
    ? `请基于以下参考资料回答问题：\n\n${context}\n\n---\n\n问题：${prompt}`
    : prompt;

  // 添加用户消息
  history.push({ role: 'user', content: userContent });

  console.log('\n⏳ 思考中...\n');

  const { text } = await generateText({
    model: deepseek('deepseek-v4-flash'),
    messages: history,
    system: customerServicePrompt,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'chat-response',
      metadata: {
        sessionId,
        messageId,
      },
    },
  });

  // 添加 AI 响应
  history.push({ role: 'assistant', content: text });

  console.log('🤖 AI：', text, '\n');

  // 用户反馈：对本次回答打分
  await collectUserFeedback(messageId);

  // AI 裁判：自动评估本轮回答质量
  await runAiJudge(messageId, prompt, text, context, sessionId);

  chat();
}

console.log("Session ID:" + sessionId)
console.log('🎯 AI 对话助手 (输入 q 退出)\n');
chat();
