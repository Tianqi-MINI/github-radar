# 部署与上线

## 先明确：这不是纯静态网页

本项目包含一个 Python HTTP 服务（实时 GitHub 搜索、README 读取、Token 管理）。
GitHub Pages / Cloudflare Pages 只能托管静态文件，**无法运行** `server/`。
要让别人通过网址使用，需要一台 7×24 在线的机器。

## 方案对比

| 方案 | 适合场景 | 优点 | 代价 |
| --- | --- | --- | --- |
| 本机 + 局域网 | 同宿舍 / 同实验室 | 零成本、数据不出本机 | 只能同网段访问；电脑关机即失效 |
| 本机 + 内网穿透 | 临时演示、课程作业 | 不需要服务器 | 免费隧道域名会变；需保持电脑开机 |
| 云服务器 / VPS | 长期公开访问 | 稳定、可绑域名、可加 HTTPS | 需要维护系统与安全组 |
| Python PaaS（Render / Railway / Fly.io） | 快速上线 | 部署简单、自带 HTTPS | 免费额度可能休眠；需要配置启动命令 |

## 云平台通用配置

启动命令：

```bash
python -m server.app --host 0.0.0.0 --port $PORT
```

- 平台通常通过 `PORT` 环境变量注入端口；本项目已支持 `RADAR_PORT`/`--port`，
  若平台使用 `PORT`，可把启动命令写成：
  `python -m server.app --host 0.0.0.0 --port ${PORT}`（bash）
  或 Windows 下显式传 `--port`。
- 数据文件随仓库部署，无需数据库。
- 建议把 `GITHUB_TOKEN` 配置为平台环境变量，而不是提交 Token 文件。

## 安全清单

1. **不要提交** `data/.github-token.json`（已在 `.gitignore`）。
2. 公开部署时，Token 保存接口只接受回环地址，外部用户无法写入或删除 Token。
3. 如果需要多用户写入 Token，应改为"每用户会话"方案，当前版本不提供。
4. 建议前置反向代理（Nginx / Caddy），启用 HTTPS 与访问日志。
5. GitHub 匿名搜索每小时约 60 次；公开访问量大时务必配置 Token 或加缓存。

## 上传到 GitHub 前检查

```text
[ ] git init 后确认 data/.github-token.json 不在待提交列表
[ ] outputs/ 没有被提交
[ ] README 中的地址改为你的部署地址
[ ] 选择并添加 LICENSE（如 MIT）
[ ] 运行 .\scripts\check.ps1 全部通过
```
