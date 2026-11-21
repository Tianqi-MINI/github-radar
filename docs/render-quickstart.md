# Render 验证期部署手册

目标：用 Render 免费 Web Service 得到一个 HTTPS 链接，让别人可以直接打开使用。

> 上线前请先在本地跑 `.\scripts\check.ps1`，确认全部通过。

## 1. 先在本地模拟托管模式

托管环境与本地有三点不同：端口由平台注入、Token 来自环境变量、本机 Token 写入关闭。

PowerShell：

```powershell
$env:PORT = "8080"
$env:RADAR_HOST = "0.0.0.0"
$env:RADAR_ALLOW_LOCAL_TOKEN_WRITE = "0"
$env:RADAR_TRUST_PROXY = "1"
$env:GITHUB_TOKEN = "<你的 fine-grained PAT>"
python -m server.app
```

验证：

```powershell
Invoke-WebRequest http://127.0.0.1:8080/api/health -UseBasicParsing
```

期望看到：

- `"authMode": "token"`
- `"localTokenWrite": false`
- `"trustProxy": true`

## 2. 创建 GitHub 仓库

1. 在 GitHub 新建仓库（建议先 Private）。
2. 推送 `project-007-github-radar-github-only-release` 的内容。
3. 确认以下文件**没有**进入提交：
   - `data/.github-token.json`
   - `outputs/`
   - `__pycache__/`

## 3. 创建 fine-grained Token

GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token：

- Repository access：Public repositories (read-only)
- Permissions：只保留读取公开仓库所需的最小权限
- 有效期：90 天（到期前轮换）

复制 Token，先不要写进任何文件。

## 4. 用 Blueprint 部署

仓库根目录已有 `render.yaml`。

1. Render Dashboard → New → Blueprint。
2. 连接刚创建的 GitHub 仓库。
3. Render 会读取 `render.yaml`，创建 `github-radar` 免费服务。
4. 在环境变量提示处粘贴 `GITHUB_TOKEN`。
5. 确认区域为 Singapore、Plan 为 Free，然后部署。

如果 Blueprint 不可用，也可以手动创建 Web Service：

- Runtime：Python
- Build Command：`pip install -r requirements.txt`
- Start Command：`python -m server.app --host 0.0.0.0 --port $PORT`
- Health Check Path：`/api/health`
- 环境变量按 `render.yaml` 逐项填写

## 5. 部署后验收

把 Render 分配的 `https://<name>.onrender.com` 打开，依次检查：

```text
[ ] 首屏正常显示问卷
[ ] 提交问卷后出现推荐卡片
[ ] /api/health 返回 authMode=token
[ ] /api/feed 返回 24 条
[ ] 浏览器控制台 0 错误
[ ] 手机宽度 390px 无横向溢出
[ ] 连续刷新不会触发 429（正常点击频率下）
```

再用无痕窗口、手机流量各打开一次，确认不是只有本机能访问。

## 6. 冷启动说明

Render 免费实例在无访问一段时间后会休眠，首次访问需要等待唤醒。
这是免费档的预期行为，不是 Bug。可以在 README 或页面提示：

> 首次访问可能需要唤醒服务，请稍等几十秒。

## 7. 监控与额度

- 用 UptimeRobot 免费版监控 `/api/health`（5 分钟间隔），异常发邮件。
- GitHub 匿名额度约每小时 60 次；配置 Token 后为 5000 次。
- 本项目已加 90 秒缓存与每 IP 每分钟 30 次限流，正常使用不会轻易打满。

## 8. 回滚

Render 支持按提交版本回滚。发现线上异常时：

1. 在 Render 选择上一个正常部署。
2. 本地 `git log` 找到对应提交。
3. 修复后重新部署。

## 9. 常见问题

| 现象 | 排查 |
| --- | --- |
| 502 / 服务起不来 | 看 Render Logs，确认启动命令与 `PORT` 环境变量 |
| `/api/health` 正常但页面 404 | 确认 `app/index.html` 已提交 |
| `authMode=anonymous` | `GITHUB_TOKEN` 没生效或已过期 |
| 429 频繁 | 调大 `RADAR_LIVE_RATE_LIMIT`，或检查是否有脚本刷接口 |
| 首次打开很慢 | 免费实例冷启动，属正常现象 |
