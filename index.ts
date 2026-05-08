import { generateText } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import inquirer from 'inquirer';
import { tracerProvider } from "./instrumentation"
import { customerServicePrompt } from './setUpLangfuseClient'
import { fuseSearch } from './rag/search';
import { trace } from '@opentelemetry/api';
import { LangfuseClient } from "@langfuse/client";

const tracer = trace.getTracer('rag');
const langfuse = new LangfuseClient();

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

/** 从知识库检索相关内容，格式化为 AI 上下文 */
function buildSearchContext(query: string): string {
  const results = fuseSearch(query);
  if (results.length === 0) return '';

  return results
    .slice(0, 3)
    .map((r, i) => `[参考资料 ${i + 1}]（相关度: ${(1 - (r.score ?? 0)).toFixed(2)}）
${r.item}`)
    .join('\n\n---\n\n');
}

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

  // 检索相关知识
  const context = buildSearchContext(prompt);

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
      },
    },
  });

  // 添加 AI 响应
  history.push({ role: 'assistant', content: text });

  console.log('🤖 AI：', text, '\n');

  // AI 裁判：自动评估本轮回答质量
  tracer.startActiveSpan('ai-judge', async (judgeSpan) => {
    const traceId = judgeSpan.spanContext().traceId;
    const judgeSystem = `你是一个AI对话质量评估员。请评估 AI 的回答质量，仅返回 JSON。

评分维度（1-5分）：
- helpfulness: 对用户有帮助吗？
- accuracy: 准确吗？（是否基于提供的上下文，有无幻觉）
- relevance: 回答与问题相关吗？

{"helpfulness": 4, "accuracy": 5, "relevance": 5, "summary": "一句话评价"}`;

    const { text: evaluation } = await generateText({
      model: deepseek('deepseek-v4-flash'),
      system: judgeSystem,
      messages: [
        { role: 'user', content: `用户问题：${prompt}\n\nAI回答：${text}${context ? `\n\n参考资料：${context}` : ''}` }
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'ai-judge',
        metadata: { sessionId },
      },
    });

    try {
      const scores = JSON.parse(evaluation);
      await Promise.all([
        langfuse.score.create({ traceId, name: 'helpfulness', value: scores.helpfulness, dataType: 'NUMERIC' }),
        langfuse.score.create({ traceId, name: 'accuracy', value: scores.accuracy, dataType: 'NUMERIC' }),
        langfuse.score.create({ traceId, name: 'relevance', value: scores.relevance, dataType: 'NUMERIC' }),
        langfuse.score.create({ traceId, name: 'judge-summary', value: scores.summary, dataType: 'TEXT' }),
      ]);
      // console.log(`📊 AI 评分: helpfulness=${scores.helpfulness} accuracy=${scores.accuracy} relevance=${scores.relevance}`);
    } catch (e) {
      console.error('⚠️ AI 评分解析失败:', (e as Error).message);
    }

    judgeSpan.end();
  });

  chat();
}

console.log("Session ID:" + sessionId)
console.log('🎯 AI 对话助手 (输入 q 退出)\n');
chat();
