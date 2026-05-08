import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();


// 获取最新版本的 customer-service-prompt
export const prompt = await langfuse.prompt.get("customer-service-prompt", {
  label: 'latest'
});

export const customerServicePrompt = prompt.compile({
  customer_name: 'Alice',
})