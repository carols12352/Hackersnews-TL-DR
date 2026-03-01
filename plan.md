# HackersNews TL;DR V1 设计方案（TypeScript + Next.js）

## 0. 目标与范围
- 构建一个可持续自动更新的 HN Top 内容摘要网页。
- 首版聚焦 Top 5 stories，30 分钟周期刷新，成本可控，可观测，可继续迭代。
- 输出语言默认英文（与 HN 原始内容一致），后续可加多语言层。

---

## 1. 总体架构

### 1.1 技术栈
- 前端与服务：Next.js（App Router）+ TypeScript
- 定时触发：
  - 优先：Vercel Cron（生产）
  - 本地开发：`node-cron` 或手动触发 API
- 数据缓存：Redis / Upstash Redis / Vercel KV（二选一）
- LLM：OpenAI API（建议 JSON 结构化输出）
- 监控日志：基础 `console` + 可选 Sentry

### 1.2 运行流程（高层）
1. Cron 每 30 分钟触发 `/api/cron/refresh`。
2. 服务拉取 HN Top IDs，取前 5。
3. 检查 Top 是否变化：
   - 无变化：只更新元信息（last_checked_at），不触发 LLM。
   - 有变化：对新增或未缓存 story 拉取详情 + 评论并生成摘要。
4. 把结构化结果写入缓存（TTL 30-60 分钟，建议 45 分钟）。
5. 前端页面读取“最新摘要列表 key”并渲染。

---

## 2. 数据层设计

### 2.1 Hacker News API 读取策略
- Top 列表：`https://hacker-news.firebaseio.com/v0/topstories.json`
- Item 详情：`https://hacker-news.firebaseio.com/v0/item/{id}.json`

### 2.2 需要提取字段
每个 story：
- `id`
- `title`
- `url`（原始链接）
- `by`
- `score`
- `time`
- `kids`（评论 ID）

评论提取（目标 30-50 条高价值评论）：
- 来源：story 的一级评论 + 可选二级评论
- 过滤：
  - 删除 `deleted/dead`
  - 删除空文本
- 排序建议：优先 `score` 高，其次时间（新）
- 截断：最多 50 条，最少 30 条（不足则全部）

### 2.3 数据模型（建议 TypeScript）
```ts
export interface HNStoryRaw {
  id: number;
  title: string;
  url?: string;
  by: string;
  score: number;
  time: number;
  kids?: number[];
}

export interface HNCommentRaw {
  id: number;
  by?: string;
  text?: string;
  score?: number;
  time?: number;
  deleted?: boolean;
  dead?: boolean;
  parent?: number;
}

export interface StorySummary {
  storyId: number;
  title: string;
  url: string;
  generatedAt: string;
  tldrBullets: string[]; // 3-5
  commentSummary: string[]; // 核心观点点列
  consensusView?: string; // 主流观点
  counterView?: string; // 反对观点（可选）
  sourceMeta: {
    storyScore: number;
    commentsUsed: number;
    topRank: number;
  };
}
```

---

## 3. AI 摘要层设计

### 3.1 输入构建
- 输入内容：
  - story 标题 + URL
  - 评论列表（清洗 HTML、限制单条长度）
- Token 控制：
  - 每条评论截断到固定字符（如 400-600）
  - 总评论超限时按优先级裁剪（高分优先）

### 3.2 输出约束（必须结构化）
建议强制 JSON Schema：
- `tldr_bullets`: 3-5 条
- `comment_core_points`: 3-6 条
- `consensus_view`: 字符串
- `counter_view`: 字符串（可空）

Prompt 原则：
- 高信息密度，避免空话。
- 不复述标题，不写“可能/也许”泛化句。
- 仅基于输入，无法判断时明确 `unknown`。

### 3.3 失败重试
- LLM 失败重试 2 次（指数退避）
- JSON 解析失败时自动二次修复 prompt
- 最终失败：返回 `summary_status=failed`，前端降级展示原帖信息

---

## 4. 成本控制与缓存策略

### 4.1 去重原则
同一帖子只生成一次 summary（在 TTL 周期内）。

### 4.2 Key 设计（Redis/KV）
- `hn:top5:latest` -> 当前 Top 5 ID 列表 + 更新时间
- `hn:story:{storyId}:summary:v1` -> 单帖摘要（TTL 45 分钟）
- `hn:story:{storyId}:fingerprint` -> 输入指纹（title+commentIds hash）

### 4.3 重新生成判定
仅在以下情况触发 LLM：
- 缓存不存在
- 缓存过期
- 指纹变化（标题变化/评论显著变化）

### 4.4 成本保护
- 单次任务最大处理 5 帖
- 全局并发限制（例如 2）
- 设置每日 token 预算上限（触发后只展示无摘要模式）

---

## 5. 刷新机制设计

### 5.1 推荐策略（组合）
- 固定 30 分钟 Cron（主触发）
- Top 变化检测（二次门控）

实际逻辑：
1. Cron 到点运行。
2. 拉取 top5，计算 hash。
3. 若 hash 未变化且摘要仍有效 -> 直接结束。
4. 若变化 -> 仅对新增/变更项生成摘要。

### 5.2 手动刷新
提供 `/api/refresh?force=true`（仅管理员 token 可用）便于排障。

---

## 6. Next.js 项目结构建议

```txt
news/
  src/
    app/
      page.tsx
      api/
        cron/refresh/route.ts
        stories/route.ts
    lib/
      hn.ts            # HN API client
      comments.ts      # 评论抓取与清洗
      summarize.ts     # LLM 调用与 schema 校验
      cache.ts         # Redis/KV 封装
      refresh.ts       # 刷新主流程
      types.ts
```

页面行为：
- SSR 拉取 `/api/stories` 数据渲染
- 可选前端每 5-10 分钟轻量 revalidate

---

## 7. API 合约（V1）

### 7.1 `GET /api/stories`
返回 Top 5 摘要列表：
```json
{
  "updatedAt": "2026-02-27T12:00:00.000Z",
  "stories": [
    {
      "storyId": 123,
      "title": "...",
      "url": "https://...",
      "tldrBullets": ["..."],
      "commentSummary": ["..."],
      "consensusView": "...",
      "counterView": "..."
    }
  ]
}
```

### 7.2 `POST /api/cron/refresh`
- 由 Cron 调用
- Header 校验 `CRON_SECRET`
- 返回本轮统计：
  - `topChanged`
  - `storiesProcessed`
  - `llmCalls`
  - `durationMs`

---

## 8. 可靠性与可观测性
- 关键日志字段：`job_id`, `story_id`, `cache_hit`, `llm_latency_ms`, `token_usage`
- 错误分类：`hn_fetch_error`, `llm_error`, `cache_error`, `schema_error`
- 简单健康检查：`GET /api/health`

---

## 9. 安全与配置

### 9.1 环境变量
- `OPENAI_API_KEY`
- `REDIS_URL` / `KV_REST_API_URL` + token
- `CRON_SECRET`
- `SUMMARY_TTL_SECONDS=2700`（45 分钟）

### 9.2 安全措施
- Cron API 必须鉴权
- 对外 API 限流（基础频控）
- 不记录完整评论原文到长期日志

---

## 10. V1 里程碑拆解（建议 5 步）
1. 搭建 HN 拉取 + 评论清洗模块（含单测）
2. 接入缓存层，完成 `story summary` 读写与 TTL
3. 接入 LLM 结构化输出与校验
4. 完成 Cron 刷新流程 + Top 变化门控
5. 完成页面展示 + 错误降级 + 基础监控

---

## 11. 验收标准（Definition of Done）
- 每 30 分钟自动运行一次刷新任务
- 页面始终可显示 Top 5（即使摘要失败）
- 同一 story 在 TTL 内不重复调用 LLM
- 输出固定结构，`tldrBullets` 保持 3-5 条
- 刷新任务可观测（有统计日志）

---

## 12. V1 后续可扩展
- 多语言摘要（中/英切换）
- 评论立场聚类与情绪分布
- 按主题标签（AI/Infra/Security）筛选
- 增加“摘要置信度”和“信息来源覆盖度”指标
