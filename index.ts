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

/** 收集用户对 AI 回答的反馈（赞/踩），返回 traceId */
async function collectUserFeedback(): Promise<string | null> {
  const { feedback } = await inquirer.prompt([
    {
      type: 'select',
      name: 'feedback',
      message: '👆 对本次回答满意吗？',
      choices: [
        { name: '👍 满意', value: 'thumbs_up' },
        { name: '👎 不满意', value: 'thumbs_down' },
      ],
    },
  ]);

  if (feedback === 'skip') return null;

  return tracer.startActiveSpan('user-feedback', async (span) => {
    const traceId = span.spanContext().traceId;
    try {
      await langfuse.score.create({
        traceId,
        name: 'user-feedback',
        value: feedback === 'thumbs_up' ? 1 : 0,
        dataType: 'BOOLEAN',
      });
      console.log(`✅ 用户反馈已记录: ${feedback === 'thumbs_up' ? '👍 满意' : '👎 不满意'}`);
    } catch (e) {
      console.error('⚠️ 用户反馈保存失败:', (e as Error).message);
    }
    span.end();
    return traceId;
  });
}

/** AI 裁判：自动评估本轮回答质量 */
async function runAiJudge(traceId: string, prompt: string, text: string, context: string) {
  const judgeSystem = `你是 AI 回答质量评估员。请从以下三个维度对 AI 的回答进行评分，并给出总结。

评分标准（每项 1-10 分）：
- helpfulness：回答是否解决了用户问题，是否实用
- accuracy：回答是否准确，是否有事实错误
- relevance：回答是否与问题相关，是否紧扣主题

请严格返回 JSON 格式，不要包含其他内容：
{
  "helpfulness": <1-10>,
  "accuracy": <1-10>,
  "relevance": <1-10>,
  "summary": "<一句话总结>"
}`;

  const judgeMessages = [
    { role: 'user' as const, content: `## 用户问题\n${prompt}\n\n## 参考资料\n${context || '无'}\n\n## AI 回答\n${text}` },
  ];

  tracer.startActiveSpan('ai-judge', async (judgeSpan) => {
    try {
      const { text: evaluation } = await generateText({
        model: deepseek('deepseek-v4-flash'),
        system: judgeSystem,
        messages: judgeMessages,
        experimental_telemetry: { isEnabled: true, functionId: 'ai-judge', metadata: { sessionId } },
      });

      const scores = JSON.parse(evaluation);
      await Promise.all([
        langfuse.score.create({ traceId, name: 'helpfulness', value: scores.helpfulness, dataType: 'NUMERIC' }),
        langfuse.score.create({ traceId, name: 'accuracy', value: scores.accuracy, dataType: 'NUMERIC' }),
        langfuse.score.create({ traceId, name: 'relevance', value: scores.relevance, dataType: 'NUMERIC' }),
        langfuse.score.create({ traceId, name: 'judge-summary', value: scores.summary, dataType: 'TEXT' }),
      ]);
      console.log('✅ AI 自动评分完成\n');
    } catch (e) {
      console.error('⚠️ AI 评分解析失败:', (e as Error).message);
    }
    judgeSpan.end();
  });
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

  // 用户反馈：对本次回答打分
  const traceId = await collectUserFeedback();

  // AI 裁判：自动评估本轮回答质量（和用户反馈共享同一个 traceId）
  if (traceId) {
    runAiJudge(traceId, prompt, text, context);
  }

  chat();
}

console.log("Session ID:" + sessionId)
console.log('🎯 AI 对话助手 (输入 q 退出)\n');
chat();
