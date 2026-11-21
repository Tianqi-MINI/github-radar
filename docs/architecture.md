# 架构说明

## 请求流

```
浏览器
  ├─ 静态资源  /            → app/index.html
  │            /js/*.js     → app/js/*
  │            /styles.css  → app/styles.css
  └─ JSON API
       ├─ GET  /api/feed            → data/feed.json（本地精选）
       ├─ GET  /api/repo-guides     → data/repo-guides.json
       ├─ GET  /api/research-kits   → data/research-kits.json
       ├─ GET  /api/small-resources → data/small-resources.json
       ├─ GET  /api/live-feed       → server/feed.py → GitHub Search API
       ├─ GET  /api/live-repo       → server/readme.py → GitHub REST API
       ├─ GET  /api/github-auth     → server/auth.py（只返回状态）
       ├─ POST /api/github-auth     → 保存 Token（仅本机回环地址）
       └─ DELETE /api/github-auth   → 清除 Token（仅本机回环地址）
```

## 前端模块

| 文件 | 职责 | 依赖 |
| --- | --- | --- |
| `js/util.js` | localStorage、转义、文本归一化、日期、复制 | 无（可单独复用） |
| `js/scoring.js` | 权威度 / 新鲜度 / 综合分计算 | `util.js`（可单独复用） |
| `js/onboard.js` | 问卷读写、自由文本语义解析、个人化打分 | `util` 的同名辅助函数 |
| `js/app.js` | 状态、渲染、事件、实时抓取与回退 | 以上三者 |

加载顺序固定在 `index.html`：

```
util.js → scoring.js → onboard.js → app.js
```

`app.js` 用**函数声明**包装 `util.js` 的能力，而不是顶层 `const` 解构。
原因：`onboard.js` 也声明了同名的 `readJSON` 等函数，顶层 `const` 会触发
`SyntaxError: Identifier 'readJSON' has already been declared`，整页不初始化。

## 后端模块

| 文件 | 职责 |
| --- | --- |
| `config.py` | 路径、数据文件名、API 常量、静态文件白名单 |
| `errors.py` | `GitHubRequestError`（HTTP 状态 + 机器可读 code + 额度信息） |
| `auth.py` | Token 读取 / 保存 / 清除，线程锁保护 |
| `github_api.py` | 请求头、代理回退、额度解析、错误翻译 |
| `feed.py` | 搜索通道、安全初筛、去重合并、结果归一化 |
| `readme.py` | 仓库详情 + README + 官方中文 README |
| `handler.py` | 路由、静态文件、鉴权接口、安全响应头 |
| `app.py` | 启动入口与局域网地址提示 |

## 安全边界

- 静态文件仅允许 `STATIC_SUFFIXES` 白名单，且必须位于 `app/` 内；
  `server/` 与 `data/` 不会被静态服务暴露。
- Token 只写入 `data/.github-token.json`，API 响应不包含 Token。
- `POST/DELETE /api/github-auth` 只允许回环地址（127.0.0.1 / ::1）。
- 所有 HTML/JS/CSS 响应 `Cache-Control: no-store`，避免旧版本缓存。
- 实时搜索结果只保留公开、非 fork、非归档、非私有、非停用、有明确许可证的仓库。
- **托管模式**：`RADAR_ALLOW_LOCAL_TOKEN_WRITE=0` 时，所有客户端（包括回环）的 Token 写入接口均返回 403。
- **限流**：`/api/live-feed` 与 `/api/live-repo` 按客户端 IP 做滑动窗口限流（默认 30 次/60 秒），超限返回 429 + `Retry-After`。
- **缓存**：`/api/live-feed` 按 `(focuses, major, page, stage, need, terms)` 做进程内 TTL 缓存（默认 90 秒），同一 key 并发请求只做一次上游调用。
- **代理信任**：`RADAR_TRUST_PROXY=1` 时，限流使用 `X-Forwarded-For` 第一个 IP 作为客户端 key；默认不信任（本地直连）。

## 扩展点

### 增加一个关注方向

1. `server/feed.py`：在 `FOCUS_TOPIC`、`FOCUS_QUERY`、`LIVE_TOPIC_WHY` 增加条目。
2. `app/js/onboard.js`：在 `FOCUS_INTENTS` / `TOPIC_FOCUS_MAP` 增加关键词映射。
3. `data/feed.json`：给该方向补充本地精选（可选）。
4. `tests/test_server.py`：补一条 `pick_query` 断言。

### 替换本地存档数据

保持 JSON 结构不变，直接替换 `data/*.json` 即可；服务端只做读取和转发。

### 在别的项目里复用评分

```html
<script src="/js/util.js"></script>
<script src="/js/scoring.js"></script>
<script>
  const scores = RadarScoring.calculateScores(item, guide, personalization);
  const combined = RadarScoring.recommendationScore(scores);
</script>
```

两个文件都不依赖 DOM，也不会自动发起请求。

### 把本项目接入别的后端

前端只依赖 9 个 JSON 路由（见上方请求流）。新后端只要返回相同字段，
前端无需改动；字段定义以 `data/feed.json` 与 `server/feed.py::normalize_repo` 为准。
