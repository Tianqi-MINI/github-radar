# GitHub 兴趣雷达

一个帮大学生发现 GitHub 工具和项目的网页。你只需要写下专业、最近的目标和感兴趣
的方向，它会从中挑出更值得点开的项目，并解释“为什么适合你”。

无论你在找 AI 工具、小产品、科研工具、PPT 模板，还是想为作品集找灵感，都可以把
它当作一个更省时间的起点：少刷搜索结果，多一点能直接上手的仓库。

## 下载（Windows）

- [下载 Windows 便携版](https://github.com/Tianqi-MINI/github-radar/releases/latest/download/github-radar-portable.zip)
- [下载 SHA-256 校验文件](https://github.com/Tianqi-MINI/github-radar/releases/latest/download/github-radar-portable.zip.sha256)

如果上面的 Release 地址被网络拦截，可下载
[完整仓库归档](https://github.com/Tianqi-MINI/github-radar/archive/refs/heads/master.zip)。
解压归档后，在 `downloads/` 目录中找到 `github-radar-portable_1.zip`，再解压一次即可
得到可运行的程序。

便携版已经内置 Python 运行时，不需要安装 Python，也不需要管理员权限。完整解压后
双击 `start-github-radar.bat` 即可使用；详细步骤见下方“Windows 便携包”。

## 功能

- **两分钟上手**：用一段自然语言描述自己的专业和目标，不用先学复杂筛选器。
- **进入后有指引**：首次进入自动展示五步说明，顶栏也可随时重新打开。
- **推荐有理由**：每条卡片都会说明项目是什么、和你有什么关系、大致怎么开始。
- **质量先筛**：优先展示公开、非 fork、非归档、有明确开源许可证的仓库。
- **看得见的进展**：可以连续换一批，推荐过的项目不会马上重复出现。
- **离线也不空屏**：实时搜索不可用时，自动显示本地精选项目。
- **设置留在本地**：问卷、推荐历史和偏好保存在当前浏览器，不保存用户档案。

## 快速开始

需要 Python 3.9+，无第三方依赖。

```powershell
# Windows
.\scripts\start.ps1

# macOS / Linux
./scripts/start.sh
```

默认地址：`http://127.0.0.1:4173`

## Windows 便携包

如果只想在 Windows 上试用，不用配置 Python：

1. 从上方“直接下载”入口取得 ZIP 文件。
2. 完整解压 ZIP 文件到任意文件夹，不要在压缩软件预览窗口里直接运行。
3. 双击 `start-github-radar.bat`。
4. 等待浏览器自动打开页面；关闭命令行窗口即可停止服务。

包内已附带官方 Python 3.12.10 嵌入式运行时，不需要管理员权限，也不修改系统
环境变量。维护者可用以下命令重新打包：

```powershell
.\scripts\package-portable.ps1 -PythonEmbedZip .\outputs\python-3.12.10-embed-amd64.zip
```

打包脚本会排除 Git 数据、密钥文件、缓存和日志；初次生成在 `outputs/`，校验后
把版本化副本放入 `downloads/`。推送 `v*` 标签时，GitHub Actions 会复核哈希并
创建 Releases 中的稳定下载文件。

想让同一宿舍或实验室的电脑也能访问：

```powershell
.\scripts\start.ps1 -Host 0.0.0.0
```

脚本会打印可用的局域网地址。跨网络访问需要部署到公网服务器，见
[docs/deployment.md](docs/deployment.md)。

## 部署成在线网址

这个项目包含一个 Python 服务，不能只靠 GitHub Pages 托管。如果想长期分享给
别人访问，可以使用 Render、Railway、Fly.io 或自己的云服务器。完整方案和
安全注意事项见 [docs/deployment.md](docs/deployment.md)。

## 维护者说明

<details>
<summary>查看项目结构、测试和 Token 配置</summary>

### 项目结构

```
app/                静态前端
  index.html
  styles.css
  js/
    util.js         纯工具函数（可单独复用）
    scoring.js      纯评分算法（可单独复用）
    onboard.js      问卷解析与个人化
    guide.js        零依赖站内使用指引
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
docs/               架构、演进与部署说明
```

### 测试

```powershell
.\scripts\check.ps1
```

包含：JS 语法检查、Python 编译、12 项单元测试、**托管模式验证**（403 拒绝、
90 秒缓存、限流 429、PORT 注入）、静态/本地路由检查、UI 回归。

浏览器端回归（需要本机安装 Chrome）：

```powershell
node scripts\verify-ui.js http://127.0.0.1:4173/
```

覆盖首次自动引导、五步前进与完成状态、桌面 / 手机端无横向溢出、卡片渲染、
模块加载与控制台 0 错误。维护说明见 [docs/user-guide.md](docs/user-guide.md)。

### GitHub Token（可选）

匿名访问 GitHub API 每小时约 60 次；连接 Token 后为 5000 次。

- 页面内「连接 GitHub」按钮保存的 Token 只写入 `data/.github-token.json`，不会回传浏览器。
- 也可以启动前设置环境变量 `GITHUB_TOKEN`。
- `data/.github-token.json` 已加入 `.gitignore`，**不要**把它提交到仓库。

Render 免费档的完整步骤见 [docs/render-quickstart.md](docs/render-quickstart.md)。
仓库已包含 `render.yaml` 与 `Dockerfile`，托管环境用以下环境变量：

| 变量 | 作用 |
| --- | --- |
| `GITHUB_TOKEN` | GitHub Token（平台密钥，不写仓库） |
| `RADAR_HOST=0.0.0.0` | 监听所有网卡 |
| `RADAR_ALLOW_LOCAL_TOKEN_WRITE=0` | 托管环境禁用页面内 Token 写入 |
| `RADAR_TRUST_PROXY=1` | 信任平台 `X-Forwarded-For` 做限流 |
| `RADAR_LIVE_CACHE_TTL=90` | 实时搜索缓存秒数 |
| `RADAR_LIVE_RATE_LIMIT=30` | 每个 IP 每分钟实时请求上限 |

### 功能演进

关键功能和设计取舍整理在
[docs/version-history.md](docs/version-history.md)。

## 许可证

尚未选择开源许可证。公开发布前请按需要补充 `LICENSE`（例如 MIT 或 Apache-2.0），
否则默认保留所有权利。
