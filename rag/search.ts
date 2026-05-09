import { trace } from '@opentelemetry/api';
import { docs } from './article';
import Fuse from 'fuse.js';

const fuse = new Fuse(docs, {
  includeScore: true,
  threshold: 1,
});

export const fuseSearch = (query: string) => {
  return fuse.search(query);
};

const tracer = trace.getTracer('my-app');

/**
 * 从知识库检索相关内容，带 OpenTelemetry 追踪
 */
export function retrievalWithTrace(query: string, results: string, sessionId: string) {

  return tracer.startActiveSpan('retrieval', {
    attributes: {
      'gen_ai.operation.name': 'retrieval',
      'session.id': sessionId,
    },
  }, async (span) => {
    const startTime = Date.now();

    span.setAttribute('input', `user input: ${query}`);
    span.setAttribute('output', results);
    span.setAttribute('retrieval.count', results.length);
    span.setAttribute('retrieval.threshold', 1);
    span.setAttribute('duration_ms', Date.now() - startTime);

    span.end();

    return results;
  });
}

/**
 * 格式化检索结果为 AI 上下文
 */
export function formatRetrievalContext(results: Fuse.FuseResult<string>[]): string {
  if (results.length === 0) return '';

  return results
    .slice(0, 3)
    .map((r, i) => `[参考资料 ${i + 1}]（相关度: ${(1 - (r.score ?? 0)).toFixed(2)}）\n${r.item}`)
    .join('\n\n---\n\n');
}


/** 从知识库检索相关内容，格式化为 AI 上下文 */
export const buildSearchContext = (query: string, sessionId: string): string => {
  const results = fuseSearch(query);
  const resultsFormatted = formatRetrievalContext(results);
  retrievalWithTrace(query, resultsFormatted, sessionId)
  return resultsFormatted
}