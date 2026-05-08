# ai-evaluation-apply-in-langfuse

使用 langfuse 进行 AI 评估

## 版本规划

### v1 — 基础 Chat

 - [x] 打通 ai-sdk → DeepSeek/Qwen → Langfuse 整条链路
 - [x] 多轮对话
 - [x] Langfuse 托管 prompt 模板

### 环境配置

复制 `.env.example` 为 `.env.local`，填入以下变量：
- `DEEPSEEK_API_KEY` - DeepSeek API 密钥
- `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_BASE_URL` - Langfuse 连接信息

### 快速启动

```bash
bun install
bun dev
```
