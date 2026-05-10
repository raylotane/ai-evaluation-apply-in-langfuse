# NOWWA 咖啡智能助手

基于 Vercel AI SDK 构建的 CLI 智能助手，专为 NOWWA 挪瓦咖啡打造。支持菜单查询、天气获取、品牌知识问答等功能，集成 Langfuse 全链路可观测与质量评估体系。

## 功能特性

- **菜单查询** — 查询 NOWWA 咖啡菜单，支持按类别筛选（美式、拿铁、特调）
- **天气查询** — 获取指定城市天气信息
- **日期时间** — 获取当前日期和时间
- **品牌问答** — 基于品牌知识库，回答关于 NOWWA 的产品推荐、品牌故事、生活方式等问题（RAG 检索增强生成）
- **多轮对话** — 支持连续对话，保持上下文记忆
- **用户反馈** — 对每次回答进行赞/踩评价
- **AI 自动评估** — 从 helpfulness、accuracy、relevance 三个维度自动评分

## 可观测性与评估

- 接入 Langfuse + OpenTelemetry 全链路追踪
- Session ID 聚合多轮对话，实现对话级别可观测
- Langfuse 托管 Prompt 模板，提示词与代码解耦管理
- 双层评估机制：用户反馈 + AI Judge 自动评分

## 快速启动

```bash
bun install
```

复制 `.env.example` 为 `.env.local`，填入以下变量：
- `DEEPSEEK_API_KEY` — DeepSeek API 密钥
- `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_BASE_URL` — Langfuse 连接信息

```bash
bun dev
```
