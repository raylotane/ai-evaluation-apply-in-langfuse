import { generateText } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import inquirer from 'inquirer';
import { trace } from '@opentelemetry/api';
import { LangfuseClient } from "@langfuse/client";

const tracer = trace.getTracer('rag');
const langfuse = new LangfuseClient();
const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
});

/** 收集用户对 AI 回答的反馈（赞/踩）*/
export async function collectUserFeedback(messageId: string, sessionId: string) {
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

  tracer.startActiveSpan('user-feedback', async (span) => {
    try {
      await langfuse.score.create({
        traceId: messageId,
        name: 'user-feedback',
        value: feedback === 'thumbs_up' ? 1 : 0,
        dataType: 'BOOLEAN',
        metadata: { sessionId }
      });
      // console.log(`✅ 用户反馈已记录: ${feedback === 'thumbs_up' ? '👍 满意' : '👎 不满意'}`);
    } catch (e) {
      console.error('⚠️ 用户反馈保存失败:', (e as Error).message);
    }
    span.end();
  });
}

/** AI 裁判：自动评估本轮回答质量 */
export async function runAiJudge(
  messageId: string,
  prompt: string,
  text: string,
  context: string,
  sessionId: string,
) {
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
        experimental_telemetry: { isEnabled: true, functionId: 'ai-judge', metadata: { sessionId, messageId } },
      });

      const scores = JSON.parse(evaluation);

      const metadata = { sessionId }

      await Promise.all([
        langfuse.score.create({ traceId: messageId, name: 'helpfulness', value: scores.helpfulness, dataType: 'NUMERIC', metadata }),
        langfuse.score.create({ traceId: messageId, name: 'accuracy', value: scores.accuracy, dataType: 'NUMERIC', metadata }),
        langfuse.score.create({ traceId: messageId, name: 'relevance', value: scores.relevance, dataType: 'NUMERIC', metadata }),
        langfuse.score.create({ traceId: messageId, name: 'judge-summary', value: scores.summary, dataType: 'TEXT', metadata }),
      ]);
    } catch (e) {
      console.error('⚠️ AI 评分解析失败:', (e as Error).message);
    }
    judgeSpan.end();
  });
}
