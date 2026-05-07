import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';


if (!process.env.LANGFUSE_SECRET_KEY || !process.env.LANGFUSE_PUBLIC_KEY) {
  console.error('❌ 缺少 LANGFUSE_SECRET_KEY / LANGFUSE_PUBLIC_KEY 环境变量');
  process.exit(1);
}

// Initialize OpenTelemetry with Langfuse exporter
// Must be set up before any AI SDK calls
export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  baseUrl: process.env.LANGFUSE_BASE_URL,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
});

export const tracerProvider = new NodeTracerProvider({
  spanProcessors: [langfuseSpanProcessor],
});

tracerProvider.register();