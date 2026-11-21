# GitHub 兴趣雷达（纯 GitHub 版）

面向非程序员大学生的开源项目发现网页。先填一份轻量问卷，页面再把你的专业、
关注方向、AI 工具、科研阶段和目标转成可解释的匹配分，从 **GitHub 官方 Search API**
实时推荐仓库，并在网络不可用时回退到本地精选存档。

本项目是「GitHub 雷达」系列在不含 B 站 / 小红书多平台功能时的定稿版本（v21）。

## 功能

- **问卷驱动**：自由输入专业、关注方向和目标，4 个问题推导科研阶段。
- **可解释评分**：个人匹配 62% + 权威度 23% + 新鲜度 15%，每项理由都能看到。
- **实时 + 存档双来源**：GitHub 实时搜索失败时自动回退本地 24 条精选，并明确标注。
- **安全初筛**：只保留公开、非 fork、非归档、有明确开源许可证的仓库。
- **推荐去重**：推荐历史保存在浏览器本地，同一项目不会重复推送。
- **多样批次**：每批 6 条、每个主题最多 2 条，避免 AI 类项目刷屏。
- **科研工具箱**：按专业和科研阶段给出数据库、工具、检索式与三步工作流。
- **轻量资源**：独立的 PPT 模板 / Agent Skill 小资源区。
- **本地优先**：设置、推荐历史只存在浏览器里，不上传服务器。

## 快速开始

需要 Python 3.9+，无第三方依赖。

```powershell
# Windows
.\scripts\start.ps1

# macOS / Linux
./scripts/start.sh
```

默认地址：`http://127.0.0.1:4173`

只想让同一局域网的其他电脑访问：

```powershell
.\scripts\start.ps1 -Host 0.0.0.0
```

脚本会打印可用的局域网地址。跨网络访问需要部署到公网服务器，见
[docs/deployment.md](docs/deployment.md)。

## 项目结构

```
app/                静态前端
  index.html
  styles.css
  js/
    util.js         纯工具函数（可单独复用）
    scoring.js      纯评分算法（可单独复用）
    onboard.js      问卷解析与个人化
    app.js          页面编排与渲染
server/             Python 后端包
  config.py         路径与可调参数
  auth.py           GitHub Token 存取
  github_api.py     GitHub REST 封装
  feed.py           实时搜索与安全初筛
  readme.py         仓库详情与中文 README
  handler.py        HTTP 路由与静态文件
  app.py            启动入口
data/               本地精选数据
tests/              离线单元测试
scripts/            启动与验证脚本
docs/               版本演进、架构、踩坑与部署说明
```

## 测试

```powershell
.\scripts\check.ps1
```

包含：JS 语法检查、Python 编译、11 项单元测试、**托管模式验证**（403 拒绝、
90 秒缓存、限流 429、PORT 注入）、静态/本地路由检查、UI 回归。

浏览器端回归（需要本机安装 Chrome）：

```powershell
node scripts\verify-ui.js http://127.0.0.1:4173/
```

覆盖桌面 / 手机端无横向溢出、卡片渲染、模块加载与控制台 0 错误。

## GitHub Token（可选）

匿名访问 GitHub API 每小时约 60 次；连接 Token 后为 5000 次。

- 页面内「连接 GitHub」按钮保存的 Token 只写入 `data/.github-token.json`，不会回传浏览器。
- 也可以启动前设置环境变量 `GITHUB_TOKEN`。
- `data/.github-token.json` 已加入 `.gitignore`，**不要**把它提交到仓库。

## 部署

本项目是一个需要常驻运行的 Python 服务，不能只靠 GitHub Pages 静态托管。
可选方案与取舍见 [docs/deployment.md](docs/deployment.md)。

验证期使用 Render 免费档的完整步骤见
[docs/render-quickstart.md](docs/render-quickstart.md)。仓库已包含 `render.yaml`
与 `Dockerfile`，托管环境用以下环境变量：

| 变量 | 作用 |
| --- | --- |
| `GITHUB_TOKEN` | GitHub Token（平台密钥，不写仓库） |
| `RADAR_HOST=0.0.0.0` | 监听所有网卡 |
| `RADAR_ALLOW_LOCAL_TOKEN_WRITE=0` | 托管环境禁用页面内 Token 写入 |
| `RADAR_TRUST_PROXY=1` | 信任平台 `X-Forwarded-For` 做限流 |
| `RADAR_LIVE_CACHE_TTL=90` | 实时搜索缓存秒数 |
| `RADAR_LIVE_RATE_LIMIT=30` | 每个 IP 每分钟实时请求上限 |

## 版本演进

从 v1 到 v21 的改进要点整理在
[docs/version-history.md](docs/version-history.md)。B 站 / 小红书多平台版本
（v22、v23）不在本仓库范围内。

## 许可证

尚未选择开源许可证。公开发布前请按需要补充 `LICENSE`（例如 MIT 或 Apache-2.0），
否则默认保留所有权利。
