# GitHub 兴趣雷达 Windows 便携版

## 下载

- `github-radar-portable.zip`：Windows 10 / 11 64 位便携版
- `github-radar-portable.zip.sha256`：SHA-256 校验文件

## 使用

1. 完整解压 `github-radar-portable.zip` 到一个文件夹。
2. 双击 `start-github-radar.bat`。
3. 等待浏览器自动打开；使用期间保持命令行窗口开启。
4. 关闭命令行窗口即可停止服务。

便携版已内置 Python 3.12.10 运行时，不需要安装 Python，也不需要管理员权限。
实时搜索需要联网；断网时会使用本地精选项目。

## 校验下载

PowerShell：

```powershell
Get-FileHash .\github-radar-portable.zip -Algorithm SHA256
```

将输出与 `github-radar-portable.zip.sha256` 中记录的值比较。两者一致后再解压运行。

## 安全提醒

- 只从本仓库的 Releases 或官方仓库归档下载。
- 不要把 GitHub Token 发给他人，也不要放入聊天记录、截图或代码仓库。
- 本项目只读取 GitHub 公开仓库信息；问卷和推荐历史保存在当前浏览器。

