# TinyAI 助手 — ai-sdk + Langfuse 学习路径设计

## 概述

使用 Vercel AI SDK + Langfuse + DeepSeek/阿里云百炼，通过一个贯穿项目从零到一掌握：
- ai-sdk 核心 API（streamText, generateText, generateObject, tool calling）
- Langfuse 五大能力（Prompt 管理, Tracing, 监测, 评估, 实验）
- 跨 provider 最佳实践
- AI 工程迭代闭环（构建→测量→优化）

## 技术栈

| 层 | 选型 |
|---|------|
| 运行时 | Bun |
| AI SDK | `@ai-sdk/core`, `@ai-sdk/openai-compatible` |
| 模型 | DeepSeek (chat + embedding), 阿里云百炼 Qwen |
| 可观测性 | Langfuse (tracing + eval + prompt management) |
| 向量存储 | 内存数组（预留接口可换 Chroma/PGVector） |
| 代码结构 | 纯 TypeScript，无框架依赖 |

## 架构

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  ai-sdk      │────▶│  DeepSeek    │     │  Langfuse    │
│  (统一接口)    │     │  / Qwen API  │     │  (观测+管理)  │
│              │     │              │     │              │
│  streamText  │     │  Chat/Embed  │     │  Prompts     │
│  generateText│     │  Tool Call   │     │  Tracing     │
│  generateObj │     │              │     │  Evaluation  │
│  tool calling│     │              │     │  Datasets    │
└──────┬───────┘     └──────────────┘     └──────┴───────┘
       │                                           │
       └─────────────── 应用逻辑 ──────────────────┘
                      │
              ┌───────┴────────┐
              │  向量存储 (RAG) │
              └────────────────┘
```

代码分层：
- `src/providers/` — DeepSeek / Qwen provider 配置
- `src/chat/` — 核心对话逻辑
- `src/langfuse/` — Langfuse 客户端、prompt 拉取
- `src/rag/` — RAG 相关（embedding, chunk, vector store）
- `src/tools/` — 工具定义与注册
- `src/agent/` — Agent 执行逻辑
- `src/evaluation/` — 评估数据集、runner、judge
- `src/experiment/` — 实验管理、A/B 对比

## 版本规划

### v1 — 基础 Chat

**目标：** 打通 ai-sdk → DeepSeek/Qwen → Langfuse 整条链路。

**功能：**
- 支持切换 DeepSeek 和 Qwen 两个 provider
- 多轮对话
- Langfuse 托管 prompt 模板
- 每次调用生成 Langfuse Trace

**数据流：**
```
User Input → ai-sdk streamText → DeepSeek/Qwen API → Stream Response
                                  → Langfuse Trace (generation span)
```

**文件：**
- `src/providers/deepseek.ts` — DeepSeek provider
- `src/providers/qwen.ts` — Qwen provider
- `src/chat/chat.ts` — 对话逻辑
- `src/chat/messages.ts` — 消息管理
- `src/langfuse/client.ts` — Langfuse 客户端
- `src/langfuse/prompt.ts` — 从 Langfuse 拉取 prompt
- `src/config.ts` — 环境变量
- `src/index.ts` — CLI 入口

---

### v2 — 知识库（RAG）

**目标：** 加入文档检索增强生成，完善 Langfuse 监测。

**功能：**
- 文档导入 + 文本分块
- Embedding + 向量检索（内存实现，预留接口）
- RAG：检索 → 拼接上下文 → 生成回答
- Langfuse Score（人工打分）
- 监测仪表盘

**数据流：**
```
Question → Embedding → 向量检索 → ai-sdk generateText (prompt + chunks) → 回答
                                  → Langfuse Trace (含 retrieval span)
                                  → Langfuse Score
```

**新增文件：**
- `src/rag/embed.ts`
- `src/rag/chunk.ts`
- `src/rag/vectorStore.ts`
- `src/rag/search.ts`
- `src/evaluation/scoring.ts`

**技术决策：**
- Embedding 用 provider 自带 API
- Chunk 按段落 + 滑动窗口（500 tokens, overlap 50）
- 检索用余弦相似度 + Top-K（k=3）
- 预留 `VectorStore` 接口

---

### v3 — Agent 工具调用

**目标：** 工具调用 + 完整 Trace 链路追踪。

**功能：**
- 定义多个 Tool（weather, searchDocs, calculator, currentTime）
- ai-sdk tool calling 多步推理
- Langfuse Trace 含工具子 span

**工具集：**

| 工具 | 功能 | 实现 |
|------|------|------|
| `get_weather` | 查天气 | 模拟/对接公开 API |
| `search_docs` | 检索知识库 | 复用 v2 RAG |
| `calculator` | 计算 | eval 表达式 |
| `get_current_time` | 时间 | 系统函数 |

**Trace 结构：**
```
Trace
├── generation (初始请求)
├── tool_call: get_weather (input, output, duration)
├── tool_call: search_docs (input, output, duration)
└── generation (最终回答)
```

**新增文件：**
- `src/tools/registry.ts`
- `src/tools/weather.ts`
- `src/tools/calculator.ts`
- `src/tools/searchDocs.ts`
- `src/tools/currentTime.ts`
- `src/agent/executor.ts`

---

### v4 — 评估体系

**目标：** 自动化 LLM-as-judge 评估流水线。

**功能：**
- Langfuse Dataset（question + expected answer）
- LLM-as-judge（交叉评估，避免同模型 bias）
- 四维评估：Accuracy, Relevance, Completeness, Safety
- `ai-sdk generateObject` 结构化输出评估结果
- 批量评估 Runner

**评估流程：**
```
Dataset → 被评估模型 → 回答 → Judge 模型 → generateObject → Langfuse Score
```

**新增文件：**
- `src/evaluation/dataset.ts`
- `src/evaluation/runner.ts`
- `src/evaluation/judges/prompt.ts`
- `src/evaluation/judges/criteria.ts`
- `src/evaluation/report.ts`

---

### v5 — 优化迭代

**目标：** 基于评估结果的闭环优化。

**功能：**
- Langfuse Prompt 版本管理（A/B 测试）
- 实验管理（prompt 版本 + 模型参数 + 评估结果）
- A/B 对比展示
- 参数调优（temperature, top_p）
- 回归检测

**迭代案例：**
```
V1.0: "你是一个知识库助手，请基于检索内容回答问题。"
V1.1: "…如果检索内容不足以回答，请明确说'资料不足'。请分点回答。"
V1.2: "…你是一个专业的技术文档助手…请标注引用来源 [1][2]…"
```

每次修改 → 跑评估 → 对比结果 → 决定是否发布。

**新增文件：**
- `src/experiment/manager.ts`
- `src/experiment/config.ts`
- `src/experiment/compare.ts`

## 准备条件

1. 注册 DeepSeek API key
2. 注册阿里云百炼 API key
3. 注册 Langfuse Cloud 或自部署
4. 安装依赖：`bun add ai @ai-sdk/openai-compatible langfuse`

## 成功标准

完成 v5 后，学习者应掌握：
- ai-sdk 核心 API：streamText, generateText, generateObject, tool calling
- Langfuse 五大能力：Prompt 管理, Tracing, 监测, 评估, 实验
- 跨 provider 架构设计
- AI 工程迭代闭环方法论
